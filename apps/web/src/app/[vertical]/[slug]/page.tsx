import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { AppCard, StatusBadge } from '@/components/apps/AppCard';
import { AddToMyApps } from '@/components/apps/AddToMyApps';
import { apiFetchOrNull, type AppDetail, type AppSummary } from '@/lib/api';
import { getCurrentUser, forwardCookies } from '@/lib/session';
import { getVertical, isVertical } from '@/lib/verticals';
import {
  buildMetadata, jsonLd, breadcrumbSchema, softwareApplicationSchema,
} from '@/lib/seo';

/**
 * A public landing page for every product (§51, §52).
 *
 * Two things this page refuses to do:
 *
 * 1. Hide behind a sign-in wall. The description, benefits and related products
 *    are all readable signed out, which is what makes them worth indexing.
 * 2. Pretend. A product with status 'planned' says plainly that it is not built
 *    and offers no controls that look like they would work (§123). It is also
 *    excluded from the sitemap by the API, so this page is reachable by link
 *    but is not submitted to search engines as content.
 */

export async function generateMetadata(
  { params }: { params: { vertical: string; slug: string } },
): Promise<Metadata> {
  // Resolved by route, not slug: a product may live at a path whose last
  // segment is not its slug (ai-chat is at /ai/chat).
  const route = `/${params.vertical}/${params.slug}`;
  const app = await apiFetchOrNull<AppDetail>(
    `/app-by-route?route=${encodeURIComponent(route)}`,
    { revalidate: 300 },
  );
  if (!app) return {};

  const planned = app.status === 'planned';

  return buildMetadata({
    title: app.seo_title ?? app.name,
    description:
      app.seo_description ??
      app.tagline ??
      `${app.name} on Pickixo.`,
    path: app.route,
    // A page that says "not built yet" is thin content. Asking Google to rank
    // it is asking to be judged on it. It stays crawlable so the links out of
    // it still work and the noindex is actually seen.
    index: !planned,
    ...(app.og_image ? { image: app.og_image } : {}),
    modifiedTime: app.updated_at ?? undefined,
  });
}

export const revalidate = 300;

export default async function AppLandingPage(
  { params }: { params: { vertical: string; slug: string } },
) {
  if (!isVertical(params.vertical)) notFound();

  const cookie = forwardCookies();
  const route = `/${params.vertical}/${params.slug}`;
  const [user, app] = await Promise.all([
    getCurrentUser(),
    // Not cached: the response carries `in_my_apps` for this specific user.
    // Looked up by route, which is the canonical URL — resolving by the last
    // path segment would miss every product whose slug differs from it.
    apiFetchOrNull<AppDetail>(
      `/app-by-route?route=${encodeURIComponent(route)}`, { cookie },
    ),
  ]);

  if (!app) notFound();

  const vertical = getVertical(app.vertical)!;
  const related = await apiFetchOrNull<AppSummary[]>(
    `/apps?vertical=${app.vertical}&limit=4`,
    { revalidate: 300 },
  );

  const planned = app.status === 'planned';

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbSchema([
              { name: 'Home', path: '/' },
              { name: vertical.name, path: `/${vertical.slug}` },
              { name: app.name, path: app.route },
            ]),
            // Described as an application only when it actually is one. A
            // product still marked planned gets no software markup: claiming a
            // free, in-stock WebApplication on a page that says "this is not
            // built yet" is a claim the page does not support.
            ...(!planned
              ? [softwareApplicationSchema({
                  name: app.name,
                  description:
                    app.seo_description ?? app.tagline ?? app.name,
                  url: app.route,
                  category: app.category ?? undefined,
                })]
              : []),
          ),
        }}
      />

      <SiteHeader user={user} />

      <main id="main" className="mx-auto max-w-4xl px-4 py-10">
        <nav aria-label="Breadcrumb" className="text-small text-ink-subtle">
          <Link href="/" className="hover:text-ink">Home</Link>
          <span className="mx-1.5">›</span>
          <Link href={`/${vertical.slug}`} className="hover:text-ink">
            {vertical.name}
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-ink-muted">{app.name}</span>
        </nav>

        <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-title text-ink">{app.name}</h1>
              <StatusBadge status={app.status} />
            </div>
            {app.tagline ? (
              <p className="mt-2 text-subheading font-normal text-ink-muted">
                {app.tagline}
              </p>
            ) : null}
          </div>

          {app.supports_my_apps && !planned ? (
            <AddToMyApps
              slug={app.slug}
              appId={app.id}
              initiallyAdded={Boolean(app.in_my_apps)}
              signedIn={Boolean(user)}
              size="md"
            />
          ) : null}
        </header>

        {app.description ? (
          <p className="mt-6 max-w-2xl text-body text-ink-muted">{app.description}</p>
        ) : null}

        {planned ? (
          <div
            role="status"
            className="mt-8 rounded-card border border-border bg-surface-sunken p-6"
          >
            <p className="text-subheading text-ink">This is not built yet</p>
            <p className="mt-2 max-w-xl text-body text-ink-muted">
              {app.name} is planned, not finished. There is nothing to use on this
              page today, and we would rather say so than show you a button that
              does nothing.
            </p>
            <Link
              href={`/${vertical.slug}`}
              className="mt-4 inline-block text-small text-accent-ink underline"
            >
              See what is ready in {vertical.name}
            </Link>
          </div>
        ) : (
          <div className="mt-8 rounded-card border border-border bg-surface p-6">
            <p className="text-subheading text-ink">Open {app.name}</p>
            <p className="mt-2 text-small text-ink-muted">
              {app.requires_auth && !user
                ? 'You will need an account to use this.'
                : 'Free to use, no sign-up required.'}
            </p>
            <Link
              href={app.requires_auth && !user ? '/sign-up' : `${app.route}/start`}
              className="mt-4 inline-block rounded-control bg-accent px-5 py-2.5
                         text-body font-medium text-white hover:bg-accent-hover"
            >
              {app.requires_auth && !user ? 'Create a free account' : `Open ${app.name}`}
            </Link>
          </div>
        )}

        {related && related.length > 1 ? (
          <section className="mt-14">
            <h2 className="text-subheading text-ink">More in {vertical.name}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {related
                .filter((r) => r.id !== app.id)
                .slice(0, 4)
                .map((r) => <AppCard key={r.id} app={r} />)}
            </div>
          </section>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}
