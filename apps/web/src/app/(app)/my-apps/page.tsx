import type { Metadata } from 'next';
import Link from 'next/link';
import { MyAppsList } from '@/components/apps/MyAppsList';
import { EmptyState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { apiFetchOrNull, type MyAppEntry } from '@/lib/api';
import { forwardCookies } from '@/lib/session';

export const metadata: Metadata = { title: 'My Apps' };

/**
 * My Apps (§15).
 *
 * A new user gets an empty state that says what this is for and offers a way
 * out of it, never a blank screen (§23).
 */
export default async function MyAppsPage() {
  const entries = await apiFetchOrNull<MyAppEntry[]>('/me/apps', {
    cookie: forwardCookies(),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-title text-ink">My Apps</h1>
      <p className="mt-2 text-body text-ink-muted">
        The Pickixo products you want close to hand. Pin the important ones,
        and drag or use the arrows to put them in your own order.
      </p>

      <div className="mt-8">
        {!entries || entries.length === 0 ? (
          <EmptyState
            className="rounded-card border border-border bg-surface"
            title="Your Pickixo apps will appear here."
            body="Explore Pickixo and add the tools you use most."
            action={<Link href="/tools"><Button>Explore Pickixo</Button></Link>}
          />
        ) : (
          <MyAppsList initial={entries} />
        )}
      </div>
    </div>
  );
}
