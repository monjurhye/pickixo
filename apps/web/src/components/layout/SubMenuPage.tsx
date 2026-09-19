import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { AppCard } from '@/components/apps/AppCard';
import { EmptyState } from '@/components/ui/States';
import { apiFetchOrNull, type AppSummary } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';
import { SUBMENUS, getSubMenu, getVertical } from '@/lib/verticals';
import { buildMetadata, jsonLd, breadcrumbSchema } from '@/lib/seo';

/**
 * The page behind one submenu entry, e.g. /banking/loans.
 *
 * Shared, because every submenu page is the same shape: a heading, the
 * registry's apps in that category, and the sibling entries to move sideways.
 * A route folder per entry (rather than one dynamic segment) keeps
 * /banking/<app-slug> free for the generic app page.
 */

export function subMenuMetadata(vertical: string, slug: string): Metadata {
  const parent = getVertical(vertical);
  const sub = getSubMenu(vertical, slug);
  if (!parent || !sub) return {};
  return buildMetadata({
    title: `${sub.name} — ${parent.name}`,
    description: sub.description,
    path: `/${parent.slug}/${sub.slug}`,
  });
}

export async function SubMenuPage(
  { vertical, slug }: { vertical: string; slug: string },
) {
  const parent = getVertical(vertical);
  const sub = getSubMenu(vertical, slug);
  if (!parent || !sub) notFound();

  const [user, apps] = await Promise.all([
    getCurrentUser(),
    apiFetchOrNull<AppSummary[]>(
      `/apps?vertical=${parent.slug}&category=${sub.slug}&limit=100`,
      { revalidate: 300 },
    ),
  ]);

  const list = apps ?? [];
  const siblings = SUBMENUS[parent.slug] ?? [];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: parent.name, path: `/${parent.slug}` },
            { name: sub.name, path: `/${parent.slug}/${sub.slug}` },
          ])),
        }}
      />

      <SiteHeader user={user} />

      <main id="main" className="mx-auto max-w-6xl px-4 py-10">
        <nav aria-label="Breadcrumb" className="text-small text-ink-subtle">
          <Link href="/" className="hover:text-ink">Home</Link>
          <span className="mx-1.5">›</span>
          <Link href={`/${parent.slug}`} className="hover:text-ink">{parent.name}</Link>
          <span className="mx-1.5">›</span>
          <span className="text-ink-muted">{sub.name}</span>
        </nav>

        <h1 className="mt-4 text-title text-ink">{sub.name}</h1>
        <p className="mt-1 text-body text-ink-subtle">{sub.nameBn}</p>
        <p className="mt-2 max-w-2xl text-body text-ink-muted">{sub.description}</p>

        <div className="mt-5 flex flex-wrap gap-2" aria-label={`More in ${parent.name}`}>
          {siblings.map((s) => (
            <Link
              key={s.slug}
              href={`/${parent.slug}/${s.slug}`}
              aria-current={s.slug === sub.slug ? 'page' : undefined}
              className={
                s.slug === sub.slug
                  ? 'rounded-full bg-surface-sunken px-3 py-1 text-small font-medium text-ink'
                  : 'rounded-full border border-border px-3 py-1 text-small text-ink-muted hover:bg-surface-sunken hover:text-ink'
              }
            >
              {s.name}
            </Link>
          ))}
        </div>

        {list.length === 0 ? (
          <EmptyState
            className="mt-10 rounded-card border border-border bg-surface"
            title="Nothing here yet"
            body={`${sub.name} is part of the plan but has nothing built yet.`}
            action={
              <Link href={`/${parent.slug}`} className="text-small text-accent-ink underline">
                Back to {parent.name}
              </Link>
            }
          />
        ) : (
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((app) => <AppCard key={app.id} app={app} />)}
          </div>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
