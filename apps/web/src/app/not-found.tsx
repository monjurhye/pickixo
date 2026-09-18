import Link from 'next/link';
import type { Metadata } from 'next';
import { Logo } from '@/components/Logo';
import { VERTICALS } from '@/lib/verticals';

/**
 * No canonical here, deliberately.
 *
 * A canonical on a 404 names some other URL as the real version of a page that
 * does not exist — and when the layout supplied one, every 404 on the site was
 * declaring itself canonical to the homepage. That is a soft-404 signal written
 * into the markup. A 404 identifies itself by its status code and its noindex,
 * and needs nothing else.
 */
export const metadata: Metadata = {
  title: 'Page not found',
  description:
    'That page does not exist on Pickixo. Search, or start from a section.',
  robots: { index: false, follow: true },
};

/**
 * A branded 404 that returns a real HTTP 404 (§71).
 *
 * Next serves this file with a 404 status automatically — importantly, this is
 * not a redirect to the homepage, which would tell a crawler the page exists.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-6xl"><Logo /></div>
      </header>

      <main id="main" className="mx-auto flex w-full max-w-2xl flex-1 flex-col
                                 justify-center px-4 py-16">
        <h1 className="text-title text-ink">Page not found</h1>
        <p className="mt-3 text-body text-ink-muted">
          That page does not exist. Maybe Pickixo can help you find something
          else.
        </p>

        <Link
          href="/search"
          className="mt-6 inline-block w-fit rounded-control bg-accent px-5 py-2.5
                     text-body font-medium text-white hover:bg-accent-hover"
        >
          Search Pickixo
        </Link>

        <nav aria-label="Sections" className="mt-10">
          <p className="text-small font-medium text-ink">Or start from a section</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {VERTICALS.map((v) => (
              <li key={v.slug}>
                <Link
                  href={`/${v.slug}`}
                  className="block rounded-control border border-border bg-surface px-3
                             py-2 text-small text-ink-muted hover:text-ink"
                >
                  {v.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </div>
  );
}
