import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { getCurrentUser } from '@/lib/session';

/**
 * The shell for the company and policy pages: a quiet header block with the
 * title, then long-form text set in `.prose-page`.
 */
export async function TextPage({
  eyebrow,
  title,
  intro,
  updated,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: ReactNode;
  updated?: string;
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <>
      <SiteHeader user={user} />
      <main id="main" className="mx-auto max-w-6xl px-4 pb-8 pt-14 sm:pt-20">
        <header className="max-w-3xl border-b border-border pb-8">
          {eyebrow ? (
            <p className="text-micro font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-3 text-display text-ink">{title}</h1>
          {intro ? (
            <div className="mt-5 max-w-2xl text-subheading font-normal text-ink-muted">{intro}</div>
          ) : null}
          {updated ? (
            <p className="mt-4 text-small text-ink-subtle">Last updated {updated}</p>
          ) : null}
        </header>
        <div className="prose-page pt-2">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}

/** The business's postal address and phone, or nothing while they are unset. */
export function AddressBlock({
  address,
  phone,
}: {
  address: string[] | null;
  phone: string | null;
}) {
  if (!address && !phone) return null;
  return (
    <address className="mt-3 not-italic text-ink-muted">
      {address?.map((line) => (
        <span key={line} className="block">{line}</span>
      ))}
      {phone ? <span className="block">Phone: {phone}</span> : null}
    </address>
  );
}
