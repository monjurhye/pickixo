import Link from 'next/link';
import type { Metadata } from 'next';
import { TextPage } from '@/components/layout/TextPage';
import { buildMetadata } from '@/lib/seo';
import { BUSINESS, PRODUCTS, formatBdt } from '@/lib/business';

export const metadata: Metadata = buildMetadata({
  title: 'Products & pricing',
  description: 'Digital products sold by Pickixo, with prices in Bangladeshi taka and how each one is delivered.',
  path: '/pricing',
  // An empty price list is not a page worth indexing.
  index: PRODUCTS.length > 0,
});

export default function PricingPage() {
  return (
    <TextPage
      eyebrow="Products & pricing"
      title="What we sell"
      intro={
        <p>
          Digital products, priced in Bangladeshi taka (BDT). Our apps on Google
          Play and the tools on this site are free and are not part of this list.
        </p>
      }
    >
      {PRODUCTS.length === 0 ? (
        <p>
          Nothing is on sale yet — our first products are being prepared. When
          they are ready they will be listed here with their prices.
        </p>
      ) : (
        <div className="not-prose mt-6 divide-y divide-border border-y border-border">
          {PRODUCTS.map((p) => (
            <div key={p.slug} id={p.slug} className="grid gap-2 py-5 sm:grid-cols-[1fr_auto] sm:gap-8">
              <div>
                <p className="text-subheading text-ink">
                  {p.href ? <Link href={p.href}>{p.name}</Link> : p.name}
                </p>
                <p className="mt-1 text-small text-ink-muted">{p.description}</p>
                <p className="mt-1 text-small text-ink-subtle">Delivery: {p.delivery}</p>
              </div>
              <p className="font-display text-heading text-ink sm:text-right">{formatBdt(p.priceBdt)}</p>
            </div>
          ))}
        </div>
      )}

      <h2>Paying</h2>
      <p>
        Prices are shown in taka and are the full amount you pay. When online
        payment is open, it is handled by a payment gateway authorised by
        Bangladesh Bank; we never see your card number or mobile-wallet PIN.
      </p>

      <h2>Before you buy</h2>
      <p>
        Please read our <Link href="/refund-policy">refund &amp; return policy</Link> and{' '}
        <Link href="/terms">terms of service</Link>. Questions about a product?{' '}
        Email <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>.
      </p>
    </TextPage>
  );
}
