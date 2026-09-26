'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/States';
import {
  CAPABILITY_LABELS, DECISION_LABELS, isNoteworthy, timeAgo, formatClock,
  type AgentActivity, type AgentStatus, type ContentPlan, type PendingComment,
} from '@/lib/facebook-agent';

/**
 * The agent's control panel.
 *
 * Two things this page is built around.
 *
 * **The stop button has to be findable in a hurry.** It is large, it is red,
 * and it does not move when the layout changes. Someone reaching for it is
 * usually watching their Page do something they did not expect.
 *
 * **"Did nothing" is shown as success, not as absence.** Most runs decide not
 * to act, and that is the agent working correctly. A dashboard that only shows
 * activity teaches the owner that a quiet agent is a broken one, and the next
 * thing they do is raise the limits.
 */

const POLL_MS = 20_000;

export function AgentDashboard() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [activity, setActivity] = useState<AgentActivity | null>(null);
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [comments, setComments] = useState<{ pending: PendingComment[]; flagged: PendingComment[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const pageId = status?.page?.id ?? null;

  const refresh = useCallback(async () => {
    try {
      const next = await apiFetch<AgentStatus>('/facebook/status');
      setStatus(next);
      setError(null);

      if (next.page) {
        // Each panel is fetched independently: one failing endpoint should not
        // blank the page, which is the same rule the rest of the site follows.
        const [act, pl, cm] = await Promise.allSettled([
          apiFetch<AgentActivity>(`/facebook/${next.page.id}/activity?limit=25`),
          apiFetch<ContentPlan[]>(`/facebook/${next.page.id}/plans?limit=25`),
          apiFetch<{ pending: PendingComment[]; flagged: PendingComment[] }>(
            `/facebook/${next.page.id}/comments`,
          ),
        ]);
        if (act.status === 'fulfilled') setActivity(act.value);
        if (pl.status === 'fulfilled') setPlans(pl.value);
        if (cm.status === 'fulfilled') setComments(cm.value);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'Could not load the agent status.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    timer.current = setInterval(() => { void refresh(); }, POLL_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [refresh]);

  const act = useCallback(async (path: string, label: string, body?: unknown) => {
    if (!pageId) return;
    setBusy(label);
    try {
      await apiFetch(`/facebook/${pageId}${path}`, {
        method: path === '/settings' ? 'PATCH' : 'POST',
        body: body as Record<string, unknown> | undefined,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'That did not work.');
    } finally {
      setBusy(null);
    }
  }, [pageId, refresh]);

  const connect = useCallback(async () => {
    setBusy('connect');
    try {
      const { url } = await apiFetch<{ url: string }>('/facebook/connect');
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'Could not start the connection.');
      setBusy(null);
    }
  }, []);

  if (!loaded) {
    return <div className="py-16 text-center text-body text-ink-muted">Loading…</div>;
  }

  // --- nothing configured ------------------------------------------------
  if (status && !status.meta_configured) {
    return (
      <Notice tone="warning" title="Facebook is not configured on this server">
        <p>
          The agent needs a Meta app before it can reach a Page. Add{' '}
          <code className="text-ink">META_APP_ID</code>,{' '}
          <code className="text-ink">META_APP_SECRET</code>,{' '}
          <code className="text-ink">META_REDIRECT_URI</code> and{' '}
          <code className="text-ink">FACEBOOK_TOKEN_KEY</code> to the server
          environment, then restart the API.
        </p>
        <p className="mt-2">
          Until then this page has nothing to show, and a Connect button would
          only fail.
        </p>
      </Notice>
    );
  }

  // --- configured but no Page --------------------------------------------
  if (status && !status.connected) {
    return (
      <div className="rounded-card border border-border bg-surface p-8 text-center">
        <h2 className="text-heading text-ink">Connect a Facebook Page</h2>
        <p className="mx-auto mt-2 max-w-md text-body text-ink-muted">
          You will be sent to Facebook to authorise access. Pickixo never asks
          for your Facebook password and never sees one.
        </p>
        <Button className="mt-6" size="lg" loading={busy === 'connect'} onClick={connect}>
          Connect with Facebook
        </Button>
        {error ? <p role="alert" className="mt-4 text-small text-danger">{error}</p> : null}
      </div>
    );
  }

  const page = status!.page!;
  const agent = status!.agent!;
  const latest = activity?.runs?.[0] ?? null;
  const stopped = agent.emergency_stopped;

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="rounded-control border border-danger/30 bg-danger/5
                                   px-4 py-3 text-small text-danger">{error}</p>
      ) : null}

      {/* --- header ------------------------------------------------------- */}
      <section className="rounded-card border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-heading text-ink">{page.name}</h2>
              {stopped ? <Badge tone="danger">STOPPED</Badge>
                : agent.enabled ? <Badge tone="success">ACTIVE</Badge>
                : <Badge>OFF</Badge>}
              <Badge tone={agent.mode === 'FULL_AUTO' ? 'accent' : 'neutral'}>
                {agent.mode.replace('_', ' ')}
              </Badge>
            </div>
            <p className="mt-1.5 text-small text-ink-muted">
              {latest
                ? <>Last checked {timeAgo(latest.started_at)} · {latest.state}</>
                : <>No runs yet</>}
              {' · '}
              {status!.worker_running
                ? <span className="text-success">worker running</span>
                : <span className="text-warning">worker not running</span>}
            </p>
          </div>

          {/* The control someone reaches for in a hurry. */}
          {stopped ? (
            <Button variant="secondary" loading={busy === 'resume'}
                    onClick={() => act('/resume', 'resume')}>
              Resume agent
            </Button>
          ) : (
            <Button variant="danger" size="lg" loading={busy === 'stop'}
                    onClick={() => act('/stop', 'stop')}>
              STOP AGENT
            </Button>
          )}
        </div>

        {page.status !== 'connected' ? (
          <p className="mt-4 rounded-control border border-danger/30 bg-danger/5 px-4 py-3
                        text-small text-danger">
            The connection is <strong>{page.status}</strong>
            {page.status_detail ? ` — ${page.status_detail}` : ''}. The Page needs
            reconnecting before the agent can do anything.
          </p>
        ) : null}

        {stopped ? (
          <p className="mt-4 rounded-control border border-danger/30 bg-danger/5 px-4 py-3
                        text-small text-ink-muted">
            <strong className="text-danger">Emergency stop engaged.</strong>{' '}
            No posts, stories or replies will be started. Anything already in
            flight was allowed to finish recording what it did.
          </p>
        ) : null}
      </section>

      {/* --- today -------------------------------------------------------- */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Meter label="Reels today" used={agent.today.reels}
               max={agent.limits.max_reels_per_day} />
        <Meter label="Posts today" used={agent.today.feed_posts}
               max={agent.limits.max_feed_posts_per_day} />
        <Meter label="Quizzes" used={agent.today.image_posts}
               max={agent.limits.max_image_posts_per_day} />
        <Meter label="Text posts" used={agent.today.text_posts}
               max={agent.limits.max_text_posts_per_day} />
        <Meter label="Stories" used={agent.today.stories}
               max={agent.limits.max_stories_per_day} />
        <Meter label="Replies this hour" used={agent.today.replies_last_hour}
               max={agent.limits.max_comment_replies_per_hour} />
      </section>

      {/* --- current decision --------------------------------------------- */}
      <section className="rounded-card border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-subheading text-ink">What the agent is doing</h3>
          <Button size="sm" variant="secondary" loading={busy === 'run'}
                  disabled={stopped} onClick={() => act('/run', 'run')}>
            Run now
          </Button>
        </div>
        <p className="mt-3 text-body text-ink-muted">
          {latest?.reason || 'Nothing recorded yet. Press Run now to wake it once.'}
        </p>
        {latest ? (
          <p className="mt-2 text-micro text-ink-subtle">
            {DECISION_LABELS[latest.decision ?? ''] ?? latest.decision ?? '—'}
            {latest.used_ai ? ' · used AI reasoning' : ' · decided by rules, no AI cost'}
            {latest.duration_ms ? ` · ${Math.round(latest.duration_ms)}ms` : ''}
          </p>
        ) : null}
      </section>

      {/* --- capabilities ------------------------------------------------- */}
      <section className="rounded-card border border-border bg-surface p-5">
        <h3 className="text-subheading text-ink">What this connection can do</h3>
        <p className="mt-1 text-micro text-ink-subtle">
          Taken from what Facebook actually granted, not from what was asked for.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {Object.entries(CAPABILITY_LABELS).map(([key, label]) => {
            const able = page.capabilities?.[key as keyof typeof page.capabilities] === true;
            const missing = page.capabilities?.missing?.[key];
            return (
              <li key={key} className="flex items-start gap-2 text-small">
                <span aria-hidden="true" className={able ? 'text-success' : 'text-ink-subtle'}>
                  {able ? '✓' : '—'}
                </span>
                <span className={able ? 'text-ink' : 'text-ink-subtle'}>
                  {label}
                  {!able && missing?.length ? (
                    <span className="block text-micro text-ink-subtle">
                      needs {missing.join(', ')}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* --- activity ----------------------------------------------------- */}
      <section className="rounded-card border border-border bg-surface p-5">
        <h3 className="text-subheading text-ink">Recent activity</h3>
        <p className="mt-1 text-micro text-ink-subtle">
          Every wake is listed, including the ones that decided to do nothing —
          that is the agent working, not failing.
        </p>
        {activity?.runs?.length ? (
          <ol className="mt-4 divide-y divide-border">
            {activity.runs.map((run) => (
              <li key={run.id} className="flex gap-3 py-3">
                <span className="w-14 shrink-0 font-mono text-micro text-ink-subtle tabular-nums">
                  {formatClock(run.started_at)}
                </span>
                <span aria-hidden="true" className={
                  run.status === 'failed' ? 'text-danger'
                    : isNoteworthy(run) ? 'text-success' : 'text-ink-subtle'
                }>
                  {run.status === 'failed' ? '✕' : isNoteworthy(run) ? '✓' : '·'}
                </span>
                <div className="min-w-0">
                  <p className="text-small text-ink">
                    {DECISION_LABELS[run.decision ?? ''] ?? run.decision ?? 'Checked'}
                    {run.actions_taken > 0 ? ` (${run.actions_taken})` : ''}
                  </p>
                  <p className="text-micro text-ink-muted">{run.error || run.reason}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-small text-ink-subtle">No runs recorded yet.</p>
        )}
      </section>

      {/* --- comments ----------------------------------------------------- */}
      {comments && (comments.pending.length > 0 || comments.flagged.length > 0) ? (
        <section className="rounded-card border border-border bg-surface p-5">
          <h3 className="text-subheading text-ink">Comments</h3>
          {comments.flagged.length > 0 ? (
            <div className="mt-3 rounded-control border border-warning/30 bg-warning/5 p-4">
              <p className="text-small font-medium text-ink">
                {comments.flagged.length} flagged for you to look at
              </p>
              <p className="mt-1 text-micro text-ink-muted">
                Sensitive or ambiguous comments are never answered automatically.
              </p>
              <ul className="mt-2 space-y-2">
                {comments.flagged.slice(0, 5).map((c) => (
                  <li key={c.comment_id} className="text-small text-ink-muted">
                    <span className="text-ink">{c.author_name ?? 'Someone'}:</span>{' '}
                    {c.message.slice(0, 140)}
                    <Badge>{c.classification}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {comments.pending.length > 0 ? (
            <p className="mt-3 text-small text-ink-muted">
              {comments.pending.length} comment(s) waiting to be triaged.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* --- calendar ----------------------------------------------------- */}
      <section className="rounded-card border border-border bg-surface p-5">
        <h3 className="text-subheading text-ink">Content</h3>
        {plans.length ? (
          <ul className="mt-3 divide-y divide-border">
            {plans.map((plan) => (
              <li key={plan.id} className="flex flex-wrap items-start gap-3 py-3">
                <Badge tone={
                  plan.status === 'published' ? 'success'
                    : plan.status === 'failed' ? 'danger'
                    : plan.status === 'needs_review' ? 'warning' : 'neutral'
                }>
                  {plan.status.replace('_', ' ')}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-small text-ink">
                    {plan.topic || plan.content_type.replace('_', ' ')}
                    {plan.animal ? <span className="text-ink-muted"> · {plan.animal}</span> : null}
                  </p>
                  {plan.caption ? (
                    <p className="mt-0.5 text-micro text-ink-muted">
                      {plan.caption.slice(0, 160)}
                    </p>
                  ) : null}
                  {plan.status_detail ? (
                    <p className="mt-0.5 text-micro text-ink-subtle">{plan.status_detail}</p>
                  ) : null}
                </div>
                <span className="text-micro text-ink-subtle">{timeAgo(plan.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-small text-ink-subtle">
            Nothing drafted yet.
          </p>
        )}
      </section>

      {/* --- settings ----------------------------------------------------- */}
      <AgentSettings agent={agent} busy={busy} onSave={(body) => act('/settings', 'settings', body)} />
    </div>
  );
}


function Meter({ label, used, max }: { label: string; used: number; max: number }) {
  const ratio = max > 0 ? Math.min(1, used / max) : 0;
  const full = max > 0 && used >= max;
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <p className="text-micro text-ink-subtle">{label}</p>
      <p className="mt-1 text-subheading text-ink tabular-nums">
        {used} <span className="text-ink-subtle">/ {max}</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full transition-[width] ${full ? 'bg-warning' : 'bg-accent'}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}


function Notice({ tone, title, children }: {
  tone: 'warning' | 'danger'; title: string; children: React.ReactNode;
}) {
  const border = tone === 'warning' ? 'border-warning/30 bg-warning/5'
                                    : 'border-danger/30 bg-danger/5';
  return (
    <div className={`rounded-card border p-6 ${border}`}>
      <h2 className="text-subheading text-ink">{title}</h2>
      <div className="mt-2 text-body text-ink-muted">{children}</div>
    </div>
  );
}


function AgentSettings({ agent, busy, onSave }: {
  agent: NonNullable<AgentStatus['agent']>;
  busy: string | null;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState({
    enabled: agent.enabled,
    mode: agent.mode,
    max_feed_posts_per_day: agent.limits.max_feed_posts_per_day,
    max_image_posts_per_day: agent.limits.max_image_posts_per_day,
    max_text_posts_per_day: agent.limits.max_text_posts_per_day,
    max_stories_per_day: agent.limits.max_stories_per_day,
    max_reels_per_day: agent.limits.max_reels_per_day,
    max_comment_replies_per_hour: agent.limits.max_comment_replies_per_hour,
    min_minutes_between_feed_posts: agent.limits.min_minutes_between_feed_posts,
    comment_reply_confidence: agent.comment_reply_confidence,
    diversity_days: agent.diversity_days,
  });

  const field = (key: keyof typeof draft, label: string, min: number, max: number,
                 step = 1, hint?: string) => (
    <label className="block">
      <span className="text-small text-ink">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={String(draft[key])}
        onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
        className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2
                   text-body text-ink"
      />
      {hint ? <span className="mt-1 block text-micro text-ink-subtle">{hint}</span> : null}
    </label>
  );

  return (
    <section className="rounded-card border border-border bg-surface p-5">
      <h3 className="text-subheading text-ink">Settings</h3>
      <p className="mt-1 text-micro text-ink-subtle">
        These are ceilings the agent may not exceed, not targets. It is expected
        to do less than they allow most of the time. The server clamps them
        again, so a value here can lower a limit but never raise it past what
        the operator set.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-small text-ink">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
          />
          Agent enabled
        </label>
        <select
          value={draft.mode}
          onChange={(e) => setDraft({ ...draft, mode: e.target.value as typeof draft.mode })}
          className="rounded-control border border-border bg-surface px-3 py-2 text-small text-ink"
        >
          <option value="FULL_AUTO">FULL AUTO — decide and publish</option>
          <option value="APPROVAL_REQUIRED">APPROVAL REQUIRED — draft and wait</option>
          <option value="PAUSED">PAUSED — take no action</option>
        </select>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {field('max_reels_per_day', 'Reels per day', 0, 10, 1,
               'Rendered on this server; the optional hook clip is the only paid step.')}
        {field('max_feed_posts_per_day', 'Feed posts per day', 0, 20)}
        {field('max_image_posts_per_day', 'Quizzes per day', 0, 20, 1,
               'Photo posts are always quizzes.')}
        {field('max_text_posts_per_day', 'Text posts per day', 0, 20, 1,
               'Counted inside feed posts, so text can never take a quiz slot.')}
        {field('max_stories_per_day', 'Stories per day', 0, 30)}
        {field('max_comment_replies_per_hour', 'Replies per hour', 0, 60)}
        {field('min_minutes_between_feed_posts', 'Minutes between posts', 0, 1440, 15)}
        {field('diversity_days', 'Avoid repeating for (days)', 1, 365, 1,
               'How far back the duplicate check looks.')}
        {field('comment_reply_confidence', 'Reply confidence', 0, 1, 0.05,
               'Below this the agent does not reply on its own.')}
      </div>

      <p className="mt-4 text-small text-ink-muted">
        Publishes {agent.preferred_hours.length
          ? `${String(Math.min(...agent.preferred_hours)).padStart(2, '0')}:00–`
            + `${String(Math.max(...agent.preferred_hours) + 1).padStart(2, '0')}:00`
          : 'at any hour'} {agent.posting_timezone} time. Replies go out at any
        hour. Days are counted on the same clock.
      </p>

      <Button className="mt-5" loading={busy === 'settings'}
              onClick={() => onSave(draft)}>
        Save settings
      </Button>
    </section>
  );
}
