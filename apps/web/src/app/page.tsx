import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { AppCard } from '@/components/apps/AppCard';
import { Button } from '@/components/ui/Button';
import { apiFetchOrNull, type AppSummary } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';
import { VERTICALS } from '@/lib/verticals';
import {
  buildMetadata, jsonLd, organizationSchema, websiteSchema,
  SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION,
} from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description: SITE_DESCRIPTION,
  path: '/',
});

/**
 * The homepage is a discovery surface, not a feature list (§11).
 *
 * Rendered on the server so the headings, copy and every product link are in
 * the HTML a crawler receives, rather than appearing after JavaScript runs
 * (§61).
 */
export default async function HomePage() {
  const [user, featured] = await Promise.all([
    getCurrentUser(),
    apiFetchOrNull<AppSummary[]>('/apps?featured=true&limit=6', { revalidate: 300 }),
  ]);

  return (
    <>
      {/* Organization and WebSite, linked by @id. Both describe things that
          genuinely exist: the site, its publisher, and a search box that really
          works at /search. Nothing here is a claim the page does not make. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(organizationSchema(), websiteSchema()),
        }}
      />

      <SiteHeader user={user} />

      <main id="main">
        {/* --- hero ------------------------------------------------------- */}
        <section className="mx-auto max-w-6xl px-4 pb-14 pt-16 sm:pt-24">
          <h1 className="max-w-3xl text-display text-ink">
            AI, Apps, Tools, Games, Jobs &amp; Education — all in one place.
          </h1>
          <p className="mt-5 max-w-xl text-subheading font-normal text-ink-muted">
            One Pickixo account. Use AI, get a job done, find work, keep
            studying — and keep the things you use most in My Apps.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={user ? '/dashboard' : '/sign-up'}>
              <Button size="lg">
                {user ? 'Go to your dashboard' : 'Create a free account'}
              </Button>
            </Link>
            <Link href="/tools">
              <Button size="lg" variant="secondary">Browse tools</Button>
            </Link>
          </div>

          <p className="mt-4 text-small text-ink-subtle">
            Free to use. No card, and no paid plan to decline.
          </p>
        </section>

        {/* --- the seven sections ----------------------------------------- */}
        <section
          aria-labelledby="sections-heading"
          className="mx-auto max-w-6xl px-4 py-10"
        >
          <h2 id="sections-heading" className="text-title text-ink">
            What is on Pickixo
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {VERTICALS.map((v) => (
              <Link
                key={v.slug}
                href={`/${v.slug}`}
                className="group rounded-card border border-border bg-surface p-5
                           transition-shadow hover:shadow-raised
                           focus-visible:outline-none focus-visible:ring-2
                           focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <p className="text-subheading text-ink">{v.name}</p>
                <p className="mt-1.5 text-small text-ink-muted">{v.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* --- featured products ------------------------------------------ */}
        {featured && featured.length > 0 ? (
          <section
            aria-labelledby="featured-heading"
            className="mx-auto max-w-6xl px-4 py-10"
          >
            <h2 id="featured-heading" className="text-title text-ink">
              Start here
            </h2>
            <p className="mt-2 text-body text-ink-muted">
              Products marked <em>Coming soon</em> are not built yet — they are
              listed so you can see where Pickixo is going.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((app) => (
                <AppCard key={app.id} app={app} />
              ))}
            </div>
          </section>
        ) : null}

        {/* --- why ---------------------------------------------------------- */}
        <section
          aria-labelledby="why-heading"
          className="mx-auto max-w-6xl px-4 py-10"
        >
          <h2 id="why-heading" className="text-title text-ink">Why Pickixo</h2>
          <dl className="mt-6 grid gap-6 sm:grid-cols-3">
            <div>
              <dt className="text-subheading text-ink">One account</dt>
              <dd className="mt-1.5 text-small text-ink-muted">
                The same sign-in across AI, tools, games, jobs and education —
                with one place to find what you used last.
              </dd>
            </div>
            <div>
              <dt className="text-subheading text-ink">AI that keeps answering</dt>
              <dd className="mt-1.5 text-small text-ink-muted">
                Several providers sit behind one AI. When one is rate limited or
                down, Pickixo moves to the next instead of showing you an error.
              </dd>
            </div>
            <div>
              <dt className="text-subheading text-ink">Honest about limits</dt>
              <dd className="mt-1.5 text-small text-ink-muted">
                Free AI runs on shared free-tier capacity, so there is a daily
                limit. We tell you what it is rather than calling it unlimited.
              </dd>
            </div>
          </dl>
        </section>

        {/* --- cta ---------------------------------------------------------- */}
        {!user ? (
          <section className="mx-auto max-w-6xl px-4 py-14">
            <div className="rounded-card border border-border bg-surface p-8 text-center">
              <h2 className="text-title text-ink">Keep what you use</h2>
              <p className="mx-auto mt-2 max-w-md text-body text-ink-muted">
                Create an account to pin the products you come back to, and pick
                up where you left off on any device.
              </p>
              <Link href="/sign-up" className="mt-6 inline-block">
                <Button size="lg">Create a free account</Button>
              </Link>
            </div>
          </section>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}
