'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/States';

/**
 * Closed-test panel: which testers actually open each app, day by day.
 *
 * The numbers come from the apps' own heartbeats (POST /api/testing/heartbeat),
 * not from Play Console, which does not report tester activity. A tester who
 * opted in on Play but never opened the app shows here as "not seen" — which
 * is exactly the person to nudge before the 14 days run out.
 */

const POLL_MS = 30_000;

type Tester = { id: string; email: string; name: string; created_at: string };

type Install = {
  id: string;
  tester_id: string | null;
  device: string;
  app_version: string;
  first_seen: string;
  last_seen: string;
  days: string[];
  streak: number;
  active_today: boolean;
};

type TestApp = {
  id: string;
  package: string;
  name: string;
  test_started_on: string | null;
  required_testers: number;
  required_days: number;
  enabled: boolean;
  installs: Install[];
  active_today: number;
  qualified: number;
};

type Overview = { today: string; window: number; testers: Tester[]; apps: TestApp[] };

function errorText(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return 'This panel is for admins only.';
    return err.code;
  }
  return fallback;
}

function lastDays(today: string, count: number): string[] {
  const end = new Date(`${today}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (count - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function TesterPanel() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await apiFetch<Overview>('/testing/overview'));
      setError(null);
    } catch (err) {
      setError(errorText(err, 'Could not load the testers.'));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { void refresh(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const run = useCallback(async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
      await refresh();
      return true;
    } catch (err) {
      setError(errorText(err, 'That did not work.'));
      return false;
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  if (!data) {
    return error
      ? <p role="alert" className="py-16 text-center text-body text-danger">{error}</p>
      : <div className="py-16 text-center text-body text-ink-muted">Loading…</div>;
  }

  const activeTesters = new Set(
    data.apps.flatMap((a) => a.installs.filter((i) => i.active_today && i.tester_id)
      .map((i) => i.tester_id)),
  ).size;
  const anonymousToday = data.apps.reduce(
    (n, a) => n + a.installs.filter((i) => i.active_today && !i.tester_id).length, 0);

  return (
    <div className="space-y-10">
      {error ? <p role="alert" className="text-small text-danger">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Testers on the list" value={data.testers.length} />
        <Stat label="Testers active today" value={activeTesters}
              hint={anonymousToday ? `+${anonymousToday} unlinked installs` : undefined} />
        <Stat label="Apps in closed test" value={data.apps.filter((a) => a.enabled).length} />
      </div>

      <section aria-labelledby="apps-heading" className="space-y-6">
        <h2 id="apps-heading" className="text-subheading text-ink">Apps</h2>
        {data.apps.map((app) => (
          <AppCard key={app.id} app={app} data={data} busy={busy} run={run} />
        ))}
        <AddApp busy={busy} run={run} />
      </section>

      <TesterList testers={data.testers} apps={data.apps} busy={busy} run={run} />
    </div>
  );
}

type Run = (label: string, fn: () => Promise<unknown>) => Promise<boolean>;

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="text-micro text-ink-subtle">{label}</div>
      <div className="mt-1 text-title text-ink">{value}</div>
      {hint ? <div className="text-micro text-ink-subtle">{hint}</div> : null}
    </div>
  );
}

function AppCard({ app, data, busy, run }: {
  app: TestApp; data: Overview; busy: string | null; run: Run;
}) {
  const [editing, setEditing] = useState(false);
  const days = useMemo(() => lastDays(data.today, data.window), [data.today, data.window]);
  const emailOf = useMemo(
    () => new Map(data.testers.map((t) => [t.id, t.email])), [data.testers]);

  const seen = new Set(app.installs.map((i) => i.tester_id).filter(Boolean));
  const notSeen = data.testers.filter((t) => !seen.has(t.id));
  const daysLeft = app.test_started_on
    ? app.required_days - Math.floor(
      (Date.parse(data.today) - Date.parse(app.test_started_on)) / 86_400_000)
    : null;
  const done = app.qualified >= app.required_testers;

  return (
    <article className="rounded-card border border-border bg-surface p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-heading text-ink">{app.name}</h3>
          <div className="text-micro text-ink-subtle">{app.package}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!app.enabled ? <Badge>paused</Badge> : null}
          <Badge tone={done ? 'success' : 'warning'}>
            {app.qualified}/{app.required_testers} with {app.required_days}-day streak
          </Badge>
          <Badge tone="accent">{app.active_today} active today</Badge>
          {daysLeft !== null ? (
            <Badge>{daysLeft > 0 ? `day ${app.required_days - daysLeft + 1} of ${app.required_days}` : 'test period over'}</Badge>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Close' : 'Edit'}
          </Button>
        </div>
      </header>

      {editing ? <EditApp app={app} busy={busy} run={run} onDone={() => setEditing(false)} /> : null}

      {app.installs.length === 0 ? (
        <p className="mt-4 text-small text-ink-muted">
          No heartbeat yet. Add the heartbeat call to this app (see the guide at
          the bottom of this page) and open it once on a test device.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-small">
            <thead>
              <tr className="text-micro text-ink-subtle">
                <th className="py-1 pr-3 text-left font-normal">Tester</th>
                {days.map((d) => (
                  <th key={d} className="w-5 px-0.5 text-center font-normal" title={d}>
                    {Number(d.slice(8))}
                  </th>
                ))}
                <th className="pl-3 text-right font-normal">Streak</th>
                <th className="pl-3 text-right font-normal">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {app.installs.map((i) => {
                const active = new Set(i.days);
                return (
                  <tr key={i.id}>
                    <td className="max-w-[16rem] truncate py-1 pr-3 text-ink">
                      {i.tester_id ? emailOf.get(i.tester_id) ?? 'removed tester' : (
                        <LinkInstall install={i} testers={data.testers} busy={busy} run={run} />
                      )}
                      <span className="ml-1 text-micro text-ink-subtle">
                        {[i.device, i.app_version && `v${i.app_version}`].filter(Boolean).join(' · ')}
                      </span>
                    </td>
                    {days.map((d) => (
                      <td key={d} className="px-0.5 py-1">
                        <div
                          title={`${d}${active.has(d) ? ' — opened' : ''}`}
                          className={`mx-auto h-4 w-4 rounded-sm ${
                            active.has(d) ? 'bg-success' : 'bg-surface-sunken'}`}
                        />
                      </td>
                    ))}
                    <td className={`pl-3 text-right tabular-nums ${
                      i.streak >= app.required_days ? 'text-success' : 'text-ink'}`}>
                      {i.streak}
                    </td>
                    <td className="whitespace-nowrap pl-3 text-right text-ink-muted">
                      {timeAgo(i.last_seen)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {notSeen.length > 0 && app.installs.length > 0 ? (
        <details className="mt-4 text-small">
          <summary className="cursor-pointer text-ink-muted">
            {notSeen.length} testers not seen in this app
          </summary>
          <p className="mt-2 break-words text-ink-subtle">
            {notSeen.map((t) => t.email).join(', ')}
          </p>
        </details>
      ) : null}
    </article>
  );
}

function LinkInstall({ install, testers, busy, run }: {
  install: Install; testers: Tester[]; busy: string | null; run: Run;
}) {
  return (
    <select
      aria-label="Link this install to a tester"
      className="rounded-control border border-border bg-surface px-1 py-0.5 text-small text-ink-muted"
      value=""
      disabled={busy !== null}
      onChange={(e) => {
        const tester_id = e.target.value;
        if (tester_id) {
          void run(`link-${install.id}`, () => apiFetch(`/testing/installs/${install.id}`, {
            method: 'PATCH', body: { tester_id },
          }));
        }
      }}
    >
      <option value="">Unlinked install — choose tester…</option>
      {testers.map((t) => <option key={t.id} value={t.id}>{t.email}</option>)}
    </select>
  );
}

const inputClass =
  'h-9 rounded-control border border-border bg-surface px-2 text-small text-ink ' +
  'placeholder:text-ink-subtle focus:border-accent focus:outline-none';

function EditApp({ app, busy, run, onDone }: {
  app: TestApp; busy: string | null; run: Run; onDone: () => void;
}) {
  const [draft, setDraft] = useState({
    name: app.name,
    test_started_on: app.test_started_on ?? '',
    required_testers: app.required_testers,
    required_days: app.required_days,
    enabled: app.enabled,
  });

  const save = async () => {
    const ok = await run(`save-${app.id}`, () => apiFetch(`/testing/apps/${app.id}`, {
      method: 'PATCH',
      body: { ...draft, test_started_on: draft.test_started_on || null },
    }));
    if (ok) onDone();
  };

  const remove = async () => {
    if (!window.confirm(`Remove ${app.name} and all of its activity history?`)) return;
    await run(`remove-${app.id}`, () => apiFetch(`/testing/apps/${app.id}`, { method: 'DELETE' }));
  };

  return (
    <div className="mt-4 grid gap-3 rounded-card bg-surface-sunken p-4 sm:grid-cols-2">
      <label className="text-micro text-ink-subtle">Name
        <input className={`${inputClass} mt-1 w-full`} value={draft.name}
               onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </label>
      <label className="text-micro text-ink-subtle">Closed test started on
        <input type="date" className={`${inputClass} mt-1 w-full`} value={draft.test_started_on}
               onChange={(e) => setDraft({ ...draft, test_started_on: e.target.value })} />
      </label>
      <label className="text-micro text-ink-subtle">Testers required
        <input type="number" min={1} max={500} className={`${inputClass} mt-1 w-full`}
               value={draft.required_testers}
               onChange={(e) => setDraft({ ...draft, required_testers: Number(e.target.value) })} />
      </label>
      <label className="text-micro text-ink-subtle">Days required
        <input type="number" min={1} max={90} className={`${inputClass} mt-1 w-full`}
               value={draft.required_days}
               onChange={(e) => setDraft({ ...draft, required_days: Number(e.target.value) })} />
      </label>
      <label className="flex items-center gap-2 text-small text-ink">
        <input type="checkbox" checked={draft.enabled}
               onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
        Count heartbeats for this app
      </label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button size="sm" variant="danger" loading={busy === `remove-${app.id}`} onClick={remove}>
          Remove app
        </Button>
        <Button size="sm" loading={busy === `save-${app.id}`} onClick={save}>Save</Button>
      </div>
    </div>
  );
}

function AddApp({ busy, run }: { busy: string | null; run: Run }) {
  const [pkg, setPkg] = useState('');
  const [name, setName] = useState('');
  const [started, setStarted] = useState('');

  const add = async () => {
    const ok = await run('add-app', () => apiFetch('/testing/apps', {
      method: 'POST',
      body: { package: pkg.trim(), name: name.trim(), test_started_on: started || null },
    }));
    if (ok) { setPkg(''); setName(''); setStarted(''); }
  };

  return (
    <div className="rounded-card border border-dashed border-border-strong p-5">
      <h3 className="text-small font-medium text-ink">Add an app</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <input className={`${inputClass} min-w-[14rem] flex-1`} placeholder="com.example.app"
               value={pkg} onChange={(e) => setPkg(e.target.value)} />
        <input className={`${inputClass} min-w-[10rem] flex-1`} placeholder="App name"
               value={name} onChange={(e) => setName(e.target.value)} />
        <input type="date" aria-label="Closed test started on" className={inputClass}
               value={started} onChange={(e) => setStarted(e.target.value)} />
        <Button size="sm" className="h-9" loading={busy === 'add-app'}
                disabled={!pkg.trim() || !name.trim()} onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}

function TesterList({ testers, apps, busy, run }: {
  testers: Tester[]; apps: TestApp[]; busy: string | null; run: Run;
}) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeToday = useMemo(() => {
    const ids = new Set<string>();
    for (const a of apps) for (const i of a.installs) {
      if (i.active_today && i.tester_id) ids.add(i.tester_id);
    }
    return ids;
  }, [apps]);

  const appsOf = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of apps) for (const id of new Set(a.installs.map((i) => i.tester_id))) {
      if (id) map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [apps]);

  const add = async () => {
    let summary = '';
    const ok = await run('add-testers', async () => {
      const r = await apiFetch<{ added: string[]; already_listed: string[]; skipped: string[] }>(
        '/testing/testers', { method: 'POST', body: { text } });
      summary = `${r.added.length} added`
        + (r.already_listed.length ? `, ${r.already_listed.length} already on the list` : '')
        + (r.skipped.length ? `, skipped: ${r.skipped.join(', ')}` : '');
    });
    if (ok) { setText(''); setResult(summary); }
  };

  const loadCsv = async (file: File | undefined) => {
    if (!file) return;
    const content = await file.text();
    setText((prev) => [prev, content].filter(Boolean).join('\n'));
  };

  const csv = testers.map((t) => t.email).join('\n');

  const download = () => {
    const url = URL.createObjectURL(new Blob([`${csv}\n`], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'closed-testers.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(testers.map((t) => t.email).join(', '));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const remove = (t: Tester) => {
    if (!window.confirm(`Remove ${t.email} from the tester list?`)) return;
    void run(`remove-${t.id}`, () => apiFetch(`/testing/testers/${t.id}`, { method: 'DELETE' }));
  };

  return (
    <section aria-labelledby="testers-heading" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="testers-heading" className="text-subheading text-ink">
          Testers <span className="text-ink-subtle">({testers.length})</span>
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={copy}>
            {copied ? 'Copied' : 'Copy all emails'}
          </Button>
          <Button size="sm" variant="secondary" onClick={download}>
            Download CSV for Play Console
          </Button>
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface p-4">
        <label htmlFor="new-testers" className="text-small font-medium text-ink">
          Add testers
        </label>
        <textarea
          id="new-testers"
          rows={3}
          className="mt-2 w-full rounded-control border border-border bg-surface p-2 text-small text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
          placeholder="Paste emails — one per line, or separated by commas"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <label className="cursor-pointer text-small text-accent-ink hover:underline">
            Upload CSV file
            <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only"
                   onChange={(e) => { void loadCsv(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <Button size="sm" loading={busy === 'add-testers'} disabled={!text.trim()} onClick={add}>
            Add to list
          </Button>
        </div>
        {result ? <p className="mt-2 text-small text-ink-muted">{result}</p> : null}
        <p className="mt-2 text-micro text-ink-subtle">
          New testers also have to be added to the email list in Play Console
          (Testing → Closed testing → Testers). Download the CSV above and upload it there.
        </p>
      </div>

      <ul className="divide-y divide-border rounded-card border border-border bg-surface">
        {testers.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2">
            <div className="min-w-0">
              <div className="truncate text-small text-ink">{t.email}</div>
              <div className="text-micro text-ink-subtle">
                {appsOf.get(t.id) ? `seen in ${appsOf.get(t.id)} of ${apps.length} apps` : 'not seen in any app yet'}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {activeToday.has(t.id) ? <Badge tone="success">active today</Badge> : null}
              <button
                type="button"
                aria-label={`Remove ${t.email}`}
                className="rounded-control p-1 text-ink-subtle hover:bg-surface-sunken hover:text-danger"
                disabled={busy !== null}
                onClick={() => remove(t)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" aria-hidden="true">
                  <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" />
                </svg>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
