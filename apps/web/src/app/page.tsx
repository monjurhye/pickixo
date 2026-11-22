import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { getCurrentUser } from '@/lib/session';
import { SHOWN_VERTICALS } from '@/lib/verticals';
import { PLAY_APPS, PLAY_DEVELOPER_URL, playUrl } from '@/lib/play-apps';
import {
  buildMetadata, jsonLd, organizationSchema, websiteSchema,
  SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION,
} from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description: SITE_DESCRIPTION,
  path: '/',
});

/** Things on this site that work today, in the browser, with no sign-up. */
const ON_THE_WEB = [
  {
    href: '/pay-scale-2026',
    name: 'Pay scale 2026',
    nameBn: 'বেতন স্কেল ২০২৬',
    note: 'Salary, pay fixation and increment calculators for every grade, from the gazette.',
  },
  {
    href: '/kids',
    name: 'Pickixo Kids',
    nameBn: 'শিশুদের শেখা',
    note: 'The Bangla alphabet and numbers for 4- and 5-year-olds, as games.',
  },
  {
    href: '/education/class-2/math',
    name: 'Class 2 Maths',
    nameBn: 'দ্বিতীয় শ্রেণির গণিত',
    note: 'Learn, play and practise, chapter by chapter.',
  },
  {
    href: '/education/class-2/bangla',
    name: 'Class 2 Bangla',
    nameBn: 'দ্বিতীয় শ্রেণির বাংলা',
    note: 'Reading and word games from the textbook.',
  },
  {
    href: '/education/class-2/english',
    name: 'Class 2 English',
    nameBn: 'দ্বিতীয় শ্রেণির ইংরেজি',
    note: 'English lessons with Bangla meanings.',
  },
  {
    href: '/banking/calculators',
    name: 'Banking calculators',
    nameBn: 'ব্যাংকিং ক্যালকুলেটর',
    note: 'Loan, savings and deposit sums, worked out in the open.',
  },
];

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="M5 10h10M11 6l4 4-4 4" stroke="currentColor" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function SectionLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <p className="flex items-baseline gap-3 text-micro font-semibold uppercase tracking-[0.14em] text-ink-subtle">
      <span className="font-display text-small normal-case tracking-normal text-accent-ink">{n}</span>
      {children}
    </p>
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(organizationSchema(), websiteSchema()),
        }}
      />

      <SiteHeader user={user} />

      <main id="main">
        {/* --- hero ------------------------------------------------------- */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:pt-24">
          <p className="text-small text-ink-muted">Pickixo · Bangladesh</p>
          <h1 className="mt-5 max-w-4xl text-display text-ink">
            Small, useful software, made in Bangladesh.
          </h1>
          <p className="mt-6 max-w-2xl text-subheading font-normal text-ink-muted">
            We make Android apps and games, free calculators and learning games
            that run in the browser, and a shop of hand-picked products.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href="#apps"
              className="inline-flex h-12 items-center gap-2 rounded-control bg-accent px-6
                         text-subheading font-medium text-white hover:bg-accent-hover"
            >
              See our apps <Arrow />
            </a>
            <Link
              href="/pay-scale-2026"
              className="inline-flex items-center gap-2 text-subheading font-medium text-ink
                         underline decoration-border-strong underline-offset-4 hover:decoration-accent"
            >
              Pay scale 2026 calculator
            </Link>
          </div>
        </section>

        {/* --- android apps ----------------------------------------------- */}
        <section id="apps" aria-labelledby="apps-heading"
                 className="scroll-mt-20 border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1fr_2fr]">
            <div>
              <SectionLabel n="01">On Google Play</SectionLabel>
              <h2 id="apps-heading" className="mt-4 text-title text-ink">Our Android apps</h2>
              <p className="mt-3 max-w-sm text-body text-ink-muted">
                Games and everyday tools, most of them in Bangla.
              </p>
              <a href={PLAY_DEVELOPER_URL}
                 className="mt-5 inline-flex items-center gap-1.5 text-small font-medium text-accent-ink hover:underline">
                All apps on Google Play <Arrow />
              </a>
            </div>

            <ol className="divide-y divide-border border-y border-border">
              {PLAY_APPS.map((app, i) => (
                <li key={app.id}>
                  <a
                    href={playUrl(app.id)}
                    className="group grid grid-cols-[2.25rem_1fr_auto] items-baseline gap-3 py-4
                               hover:bg-surface-sunken/60 sm:px-2"
                  >
                    <span className="font-display text-small text-ink-subtle">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span>
                      <span className="text-subheading text-ink">{app.name}</span>
                      {app.nameBn ? (
                        <span lang="bn" className="ml-2 text-small text-ink-muted">{app.nameBn}</span>
                      ) : null}
                      <span className="mt-0.5 block text-small text-ink-muted">{app.blurb}</span>
                    </span>
                    <span className="flex items-center gap-1 text-micro font-medium text-ink-subtle
                                     group-hover:text-accent-ink">
                      <span className="hidden sm:inline">Google Play</span> <Arrow />
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* --- in the browser --------------------------------------------- */}
        <section aria-labelledby="web-heading" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <SectionLabel n="02">In your browser</SectionLabel>
            <h2 id="web-heading" className="mt-4 max-w-2xl text-title text-ink">
              Free to use, no account needed
            </h2>

            <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {ON_THE_WEB.map((item) => (
                <Link key={item.href} href={item.href} className="group block border-t-2 border-ink pt-4">
                  <p className="flex items-center justify-between gap-2 text-subheading text-ink
                                group-hover:text-accent-ink">
                    {item.name} <Arrow />
                  </p>
                  <p lang="bn" className="text-small text-ink-subtle">{item.nameBn}</p>
                  <p className="mt-2 text-small text-ink-muted">{item.note}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* --- shop -------------------------------------------------------- */}
        <section aria-labelledby="shop-heading" className="border-t border-border">
          <div className="mx-auto grid max-w-6xl items-end gap-8 px-4 py-16 md:grid-cols-[2fr_1fr]">
            <div>
              <SectionLabel n="03">Shop</SectionLabel>
              <h2 id="shop-heading" className="mt-4 text-title text-ink">Pickixo Shop</h2>
              <p className="mt-3 max-w-xl text-body text-ink-muted">
                Our own ebooks and tools, written and built by us, priced in taka
                and paid with bKash, Nagad, Rocket or card. Looking for things for
                the home? See our <a href="https://shop.pickixo.com">Amazon finds</a>.
              </p>
            </div>
            <a
              href="/shop"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-control border
                         border-ink px-6 text-subheading font-medium text-ink hover:bg-ink
                         hover:text-ink-inverted md:justify-self-end"
            >
              Open the shop <Arrow />
            </a>
          </div>
        </section>

        {/* --- everything else -------------------------------------------- */}
        <section aria-labelledby="sections-heading" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <SectionLabel n="04">Everything on Pickixo</SectionLabel>
            <h2 id="sections-heading" className="sr-only">Sections</h2>
            <ul className="mt-6 grid gap-x-10 sm:grid-cols-2">
              {SHOWN_VERTICALS.map((v) => (
                <li key={v.slug} className="border-b border-border">
                  <Link href={`/${v.slug}`}
                        className="flex items-baseline justify-between gap-4 py-3 hover:text-accent-ink">
                    <span className="text-subheading text-ink">
                      {v.name} <span lang="bn" className="ml-1 text-small font-normal text-ink-subtle">{v.nameBn}</span>
                    </span>
                    <span className="text-right text-small text-ink-subtle">{v.tagline}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* --- contact ------------------------------------------------------ */}
        <section className="mx-auto max-w-6xl px-4 pt-4">
          <p className="max-w-2xl font-display text-heading font-normal text-ink">
            Questions, a bug in one of our apps, or something you wish we made?{' '}
            <Link href="/contact" className="text-accent-ink underline decoration-accent/40 underline-offset-4 hover:decoration-accent">
              Write to us
            </Link>.
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
