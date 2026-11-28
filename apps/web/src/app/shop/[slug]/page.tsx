import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TextPage } from '@/components/layout/TextPage';
import { BuyForm } from '@/components/BuyForm';
import { buildMetadata } from '@/lib/seo';
import { BUSINESS, PRODUCTS, formatBdt } from '@/lib/business';

/** One page per product, at /shop/<slug>: the address ads and links point to. */
export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export const dynamicParams = false;

const find = (slug: string) => PRODUCTS.find((p) => p.slug === slug);

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = find(params.slug);
  if (!p) return {};
  return buildMetadata({
    title: `${p.name} — ${formatBdt(p.priceBdt)}`,
    description: p.description,
    path: `/shop/${p.slug}`,
  });
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const p = find(params.slug);
  if (!p) notFound();
  const price = formatBdt(p.priceBdt);
  const isIosBook = p.slug === 'ios-app-without-mac-bangla';

  return (
    <TextPage eyebrow={p.kind === 'tool' ? 'Pickixo Shop · Tool' : 'Pickixo Shop · Ebook'} title={p.name} intro={<p>{p.description}</p>}>
      <div className="not-prose mt-6 grid gap-3 rounded-card border border-border bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="font-display text-display text-ink">{price}</p>
          <p className="text-small text-ink-subtle">
            {[p.kind === 'tool' ? 'Tool' : 'PDF ebook', p.language, p.pages ? `${p.pages} pages` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <p className="text-small text-ink-muted">Delivery: {p.delivery}</p>
        <BuyForm slug={p.slug} price={price} />
      </div>

      {p.contents?.length ? (
        <>
          <h2>What is inside</h2>
          <ol lang="bn">
            {p.contents.map((c) => <li key={c}>{c}</li>)}
          </ol>
        </>
      ) : null}

      {isIosBook ? (
        <>
          <h2>Good to know before you buy</h2>
          <ul>
            <li>
              The whole book is in Bangla. It follows one real app, ArchiveX File Manager, from a
              Windows computer to the App Store, with the mistakes made on the way and how each was fixed.
            </li>
            <li>
              You do not need a Mac or an iPhone. You do need an Apple Developer Program membership,
              which Apple charges US$99 a year for; that is paid to Apple, not to us.
            </li>
            <li>It does not teach Swift or SwiftUI programming. It assumes you have, or can write, your app&apos;s code.</li>
            <li>No book can promise that Apple will approve an app, and this one does not.</li>
            <li>The information is current as of October 2026. Apple, Google and other services change their rules and prices.</li>
            <li>
              Apple, App Store, iPhone and Xcode are trademarks of Apple Inc. This book is not made,
              approved or endorsed by Apple.
            </li>
          </ul>
        </>
      ) : null}

      <h2>Paying</h2>
      <p>
        The price is shown in taka and is the full amount you pay. Payment is
        handled by EPS (Easy Payment System), a payment gateway authorised by
        Bangladesh Bank: you can pay by card, mobile wallet (bKash, Nagad,
        Rocket and others) or internet banking. We never see your card number or
        wallet PIN.
      </p>
      <p>
        After payment you get a download link straight away, and by email. It
        works for 7 days and up to 5 downloads.
      </p>

      <h2>Before you buy</h2>
      <p>
        Please read our <Link href="/refund-policy">refund &amp; return policy</Link> and{' '}
        <Link href="/terms">terms of service</Link>. Questions about this product?{' '}
        Email <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>. Everything we sell is on the{' '}
        <Link href="/shop">shop</Link>.
      </p>
    </TextPage>
  );
}
