import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { AppCard } from '@/components/apps/AppCard';
import { EmptyState } from '@/components/ui/States';
import { apiFetchOrNull, type AppSummary } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';
import { VERTICALS, getVertical, isVertical } from '@/lib/verticals';
import { buildMetadata, jsonLd, breadcrumbSchema } from '@/lib/seo';

/**
 * One listing page serving all seven sections, driven by the registry.
 *
 * Static routes take precedence over this dynamic segment in Next, so
 * /dashboard, /search and /sign-in are unaffected. Anything else that is not a
 * known vertical is a genuine 404 rather than an empty page.
 */

export function generateStaticParams() {
  return VERTICALS.map((v) => ({ vertical: v.slug }));
}

export async function generateMetadata(
  { params }: { params: { vertical: string } },
): Promise<Metadata> {
  const vertical = getVertical(params.vertical);
  if (!vertical) return {};
  return buildMetadata({
    title: `${vertical.name} — ${vertical.tagline}`,
    description: vertical.description,
    path: `/${vertical.slug}`,
  });
}

export const revalidate = 300;

export default async function VerticalPage(
  { params }: { params: { vertical: string } },
) {
  if (!isVertical(params.vertical)) notFound();
  const vertical = getVertical(params.vertical)!;

  const [user, apps] = await Promise.all([
    getCurrentUser(),
    apiFetchOrNull<AppSummary[]>(
      `/apps?vertical=${vertical.slug}&limit=100`,
      { revalidate: 300 },
    ),
  ]);

  const list = apps ?? [];
  const ready = list.filter((a) => a.status !== 'planned');
  const planned = list.filter((a) => a.status === 'planned');

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: vertical.name, path: `/${vertical.slug}` },
          ])),
        }}
      />

      <SiteHeader user={user} />

      <main id="main" className="mx-auto max-w-6xl px-4 py-10">
        <nav aria-label="Breadcrumb" className="text-small text-ink-subtle">
          <Link href="/" className="hover:text-ink">Home</Link>
          <span className="mx-1.5">›</span>
          <span className="text-ink-muted">{vertical.name}</span>
        </nav>

        <h1 className="mt-4 text-title text-ink">{vertical.name}</h1>
        <p className="mt-2 max-w-2xl text-body text-ink-muted">
          {vertical.description}
        </p>

        {list.length === 0 ? (
          <EmptyState
            className="mt-10 rounded-card border border-border bg-surface"
            title="Nothing here yet"
            body={`${vertical.name} is part of the plan but has nothing built yet. The rest of Pickixo is ready to use.`}
            action={
              <Link href="/tools" className="text-small text-accent-ink underline">
                Browse tools instead
              </Link>
            }
          />
        ) : (
          <>
            {ready.length > 0 ? (
              <section className="mt-8">
                <h2 className="sr-only">Available now</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {ready.map((app) => <AppCard key={app.id} app={app} />)}
                </div>
              </section>
            ) : null}

            {planned.length > 0 ? (
              <section className="mt-10">
                <h2 className="text-subheading text-ink">Coming soon</h2>
                <p className="mt-1 text-small text-ink-muted">
                  These are not built yet. They are listed so you can see what is
                  planned — nothing here works today.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {planned.map((app) => <AppCard key={app.id} app={app} />)}
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
