import type { Metadata } from 'next';
import Link from 'next/link';
import { AppCard } from '@/components/apps/AppCard';
import { EmptyState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import {
  apiFetchOrNull,
  type AppSummary,
  type MyAppEntry,
  type RecentEntry,
} from '@/lib/api';
import { getCurrentUser, forwardCookies } from '@/lib/session';

export const metadata: Metadata = { title: 'Dashboard' };

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The user's own home (§13). Not an admin panel: no charts, no counters, no
 * metrics about themselves. Just what they use and what to do next.
 *
 * Each section is fetched independently and renders its empty state when it has
 * nothing, so a panel that fails does not take the page with it (§152).
 */
export default async function DashboardPage() {
  const cookie = forwardCookies();
  const user = await getCurrentUser();

  const [myApps, recent, recommended] = await Promise.all([
    apiFetchOrNull<MyAppEntry[]>('/me/apps', { cookie }),
    apiFetchOrNull<RecentEntry[]>('/me/recent', { cookie }),
    apiFetchOrNull<AppSummary[]>('/me/recommended', { cookie }),
  ]);

  const firstName = user?.display_name?.split(' ')[0] ?? null;
  const pinned = (myApps ?? []).slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-title text-ink">
        {greeting()}{firstName ? `, ${firstName}` : ''}
      </h1>
      <p className="mt-2 text-body text-ink-muted">What do you want to do?</p>

      {/* --- quick actions ------------------------------------------------ */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/ai/chat"><Button size="sm">Ask AI</Button></Link>
        <Link href="/tools"><Button size="sm" variant="secondary">Tools</Button></Link>
        <Link href="/jobs"><Button size="sm" variant="secondary">Jobs</Button></Link>
        <Link href="/education"><Button size="sm" variant="secondary">Study</Button></Link>
      </div>

      {/* --- my apps ------------------------------------------------------ */}
      <section aria-labelledby="my-apps-heading" className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="my-apps-heading" className="text-subheading text-ink">My Apps</h2>
          {pinned.length > 0 ? (
            <Link href="/my-apps" className="text-small text-accent-ink hover:underline">
              View all
            </Link>
          ) : null}
        </div>

        {pinned.length === 0 ? (
          <EmptyState
            className="mt-4 rounded-card border border-border bg-surface"
            title="Your Pickixo apps will appear here."
            body="Explore Pickixo and add the tools you use most, so they are one tap away next time."
            action={
              <Link href="/tools"><Button>Explore Pickixo</Button></Link>
            }
          />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pinned.map((entry) => (
              <AppCard
                key={entry.app.id}
                app={entry.app}
                action={
                  entry.is_pinned ? (
                    <span className="text-small text-accent-ink" title="Pinned">★</span>
                  ) : null
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* --- recently used ------------------------------------------------ */}
      {recent && recent.length > 0 ? (
        <section aria-labelledby="recent-heading" className="mt-12">
          <h2 id="recent-heading" className="text-subheading text-ink">Recently used</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recent.slice(0, 4).map((entry) => (
              <AppCard key={entry.app.id} app={entry.app} />
            ))}
          </div>
        </section>
      ) : null}

      {/* --- recommended --------------------------------------------------- */}
      {recommended && recommended.length > 0 ? (
        <section aria-labelledby="recommended-heading" className="mt-12">
          <h2 id="recommended-heading" className="text-subheading text-ink">
            You might find these useful
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.slice(0, 6).map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
