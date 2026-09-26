'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/States';

type RunResult = {
  action: string;
  exit_code: number;
  output: string;
  log: string[];
};

/**
 * Run / Resume for Pickbot, for the admin who owns it.
 *
 * The buttons are only rendered for an admin (the page decides that), and the API
 * checks again — a rendered button is a convenience, never the authorisation.
 *
 * A pass is idempotent: it does nothing until a new daily candle has closed, so the
 * honest label is "Run now", not "Trade now". After a run the page is refreshed so
 * every number comes from the new snapshot rather than from this component's state.
 */
export function PickbotControls({ halted }: { halted: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<null | 'run' | 'resume'>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function invoke(action: 'run' | 'resume') {
    setBusy(action);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/markets/pickbot/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error?.detail ?? body?.detail ?? `Request failed (${res.status})`);
        return;
      }
      setResult(body as RunResult);
      // Pull the fresh snapshot into the server-rendered parts of the page.
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 rounded-card border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          loading={busy === 'run'}
          loadingLabel="Running"
          disabled={busy !== null || pending}
          onClick={() => invoke('run')}
        >
          Run now
        </Button>
        {halted ? (
          <Button
            size="sm"
            variant="secondary"
            loading={busy === 'resume'}
            loadingLabel="Clearing"
            disabled={busy !== null || pending}
            onClick={() => invoke('resume')}
          >
            Clear kill switch
          </Button>
        ) : null}
        <p className="text-micro text-ink-subtle">
          A pass only acts when a new daily candle has closed, so pressing this twice
          changes nothing.
        </p>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-small text-danger">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <Badge tone={result.exit_code === 0 ? 'success' : 'danger'}>
              exit {result.exit_code}
            </Badge>
            <span className="text-micro text-ink-subtle">{result.action}</span>
          </div>
          {result.log.length > 0 ? (
            <pre className="mt-2 max-h-64 overflow-auto rounded-card bg-surface-sunken p-3
                            text-micro leading-relaxed text-ink-muted">
              {result.log.join('\n')}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
