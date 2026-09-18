import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { AppCard } from '@/components/apps/AppCard';
import { EmptyState } from '@/components/ui/States';
import { apiFetchOrNull, type SearchResponse } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';
import { getVertical } from '@/lib/verticals';
import { buildMetadata } from '@/lib/seo';

/**
 * The full search results page (§10).
 *
 * noindex: a search results page is generated content with as many URLs as
 * there are queries, and letting a crawler in creates unbounded thin pages
 * competing with the product pages that should rank instead.
 */
export const metadata: Metadata = buildMetadata({
  title: 'Search Pickixo',
  description:
    'Search across AI, apps, tools, games, jobs and education on Pickixo.',
  path: '/search',
  // A results page has one URL per query, which is an unbounded set of thin
  // pages competing with the product pages that should rank instead. It stays
  // crawlable (follow) so the links out of it are still discovered.
  index: false,
});

export const dynamic = 'force-dynamic';

export default async function SearchPage(
  { searchParams }: { searchParams: { q?: string } },
) {
  const query = (searchParams.q ?? '').trim();
  const [user, results] = await Promise.all([
    getCurrentUser(),
    query
      ? apiFetchOrNull<SearchResponse>(`/search?q=${encodeURIComponent(query)}&limit=50`)
      : Promise.resolve(null),
  ]);

  const groups = results ? Object.entries(results.groups) : [];

  return (
    <>
      <SiteHeader user={user} />

      <main id="main" className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-title text-ink">
          {query ? <>Results for &ldquo;{query}&rdquo;</> : 'Search Pickixo'}
        </h1>

        {!query ? (
          <p className="mt-3 text-body text-ink-muted">
            Search across AI, apps, tools, games, jobs and education. Use the
            search box at the top of the page.
          </p>
        ) : results && results.total > 0 ? (
          <>
            <p className="mt-2 text-small text-ink-muted">
              {results.total} {results.total === 1 ? 'result' : 'results'}
            </p>
            <div className="mt-8 space-y-10">
              {groups.map(([vertical, apps]) => (
                <section key={vertical} aria-labelledby={`group-${vertical}`}>
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 id={`group-${vertical}`} className="text-subheading text-ink">
                      {getVertical(vertical)?.name ?? vertical}
                    </h2>
                    <Link
                      href={`/${vertical}`}
                      className="text-small text-accent-ink hover:underline"
                    >
                      All {getVertical(vertical)?.name ?? vertical}
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {apps.map((app) => <AppCard key={app.id} app={app} />)}
                  </div>
                </section>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            className="mt-8 rounded-card border border-border bg-surface"
            title={`Nothing matched "${query}"`}
            body="Try a shorter word, or browse a section from the menu."
          />
        )}
      </main>

      <SiteFooter />
    </>
  );
}
