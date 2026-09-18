import type { Metadata } from 'next';
import Link from 'next/link';
import { AppCard } from '@/components/apps/AppCard';
import { EmptyState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { apiFetchOrNull, type RecentEntry } from '@/lib/api';
import { forwardCookies } from '@/lib/session';

export const metadata: Metadata = { title: 'Activity' };

/**
 * Recently used (§21).
 *
 * Product-level only. This page can tell you that you opened the PDF
 * Compressor; it does not know, and Pickixo does not store, which file you
 * opened in it.
 */
export default async function ActivityPage() {
  const recent = await apiFetchOrNull<RecentEntry[]>('/me/recent', {
    cookie: forwardCookies(),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-title text-ink">Activity</h1>
      <p className="mt-2 text-body text-ink-muted">
        What you have opened recently. Pickixo records which products you used,
        not what you did inside them.
      </p>

      <div className="mt-8">
        {!recent || recent.length === 0 ? (
          <EmptyState
            className="rounded-card border border-border bg-surface"
            title="Nothing here yet"
            body="Once you start using Pickixo products, they will show up here."
            action={<Link href="/tools"><Button>Explore Pickixo</Button></Link>}
          />
        ) : (
          <ul className="space-y-3">
            {recent.map((entry) => (
              <li key={entry.app.id}>
                <AppCard
                  app={entry.app}
                  action={
                    <span className="text-micro text-ink-subtle">
                      {entry.use_count}×
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
