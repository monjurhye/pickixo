import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { getCurrentUser } from '@/lib/session';
import { Disclaimer } from './Ui';

/**
 * The frame every pay-scale page shares: header, breadcrumb, title, the
 * cross-links between the calculators, and the disclaimer.
 *
 * The disclaimer is part of the shell rather than something each page adds,
 * because a page that shows a salary figure without it is exactly the page
 * that should not exist.
 */

export const PAY_SCALE_LINKS = [
  { href: '/salary-calculator', label: 'বেতন ক্যালকুলেটর' },
  { href: '/pay-scale-2026', label: 'বেতনস্কেল ২০২৬' },
  { href: '/pay-fixation-2026', label: 'বেতন নির্ধারণ পদ্ধতি' },
  { href: '/2015-vs-2026-pay-scale', label: '২০১৫ বনাম ২০২৬' },
  { href: '/increment-calculator', label: 'ইনক্রিমেন্ট' },
  { href: '/gross-salary-calculator', label: 'গ্রস বেতন' },
  { href: '/salary-checker', label: 'বেতন যাচাই' },
] as const;

export async function PayScaleShell({
  title, lead, crumb, children, wide = false, activeHref,
}: {
  title: string;
  lead?: ReactNode;
  crumb: string;
  children: ReactNode;
  wide?: boolean;
  activeHref?: string;
}) {
  const user = await getCurrentUser();

  return (
    <>
      <SiteHeader user={user} />

      <main id="main" className={`mx-auto px-4 py-8 sm:py-10 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
        <nav aria-label="Breadcrumb" className="ps-no-print text-small text-ink-subtle">
          <Link href="/" className="hover:text-ink">হোম</Link>
          <span className="mx-1.5" aria-hidden="true">›</span>
          <Link href="/salary-calculator" className="hover:text-ink">সরকারি বেতন</Link>
          <span className="mx-1.5" aria-hidden="true">›</span>
          <span className="text-ink-muted">{crumb}</span>
        </nav>

        <header className="mt-4">
          <h1 className="font-bengali text-title text-ink">{title}</h1>
          {lead ? <p className="mt-2.5 text-body text-ink-muted">{lead}</p> : null}
        </header>

        <nav aria-label="সরকারি বেতন সংক্রান্ত পাতা" className="ps-no-print mt-5 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex min-w-max gap-2 pb-1">
            {PAY_SCALE_LINKS.map((link) => {
              const active = link.href === activeHref;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-block rounded-full border px-3 py-1.5 text-small transition ${
                      active
                        ? 'border-accent/40 bg-accent-soft text-accent-ink'
                        : 'border-border bg-surface text-ink-muted hover:border-border-strong hover:text-ink'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-7">{children}</div>

        <Disclaimer />
      </main>

      <SiteFooter />
    </>
  );
}

/** A reusable disclosure list for FAQ sections. */
export function Faq({ items, id = 'faq' }: { items: readonly { q: string; a: string }[]; id?: string }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="ps-no-print mt-12">
      <h2 id={`${id}-heading`} className="text-heading text-ink">সাধারণ জিজ্ঞাসা</h2>
      <div className="mt-4 divide-y divide-border border-y border-border">
        {items.map((item) => (
          <details key={item.q} className="group py-4">
            <summary className="cursor-pointer list-none text-subheading text-ink marker:hidden">
              <span className="flex items-start justify-between gap-4">
                {item.q}
                <span aria-hidden="true" className="shrink-0 text-ink-subtle transition-transform group-open:rotate-45">
                  +
                </span>
              </span>
            </summary>
            <p className="mt-2 whitespace-pre-line text-body text-ink-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
