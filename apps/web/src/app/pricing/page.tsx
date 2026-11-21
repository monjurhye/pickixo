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

const field =
  'mt-1 block w-full rounded-control border border-border-strong bg-canvas px-3 py-2 text-body text-ink ' +
  'focus:border-accent focus:outline-none';

/**
 * A plain HTML form: it posts to the Pages Function /api/eps/checkout, which
 * prices the order from products.json and sends the buyer on to EPS. Works
 * with JavaScript off.
 */
function BuyForm({ slug, price }: { slug: string; price: string }) {
  return (
    <details className="sm:col-span-2">
      <summary className="inline-flex cursor-pointer list-none items-center rounded-control bg-accent px-5 py-2.5
                          text-body font-medium text-white hover:bg-accent-hover">
        Buy now — {price}
      </summary>
      <form method="post" action="/api/eps/checkout" className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
        <input type="hidden" name="product" value={slug} />
        <label className="text-small text-ink sm:col-span-2">Your name
          <input name="name" required minLength={2} maxLength={80} autoComplete="name" className={field} />
        </label>
        <label className="text-small text-ink">Email (the download link goes here)
          <input name="email" type="email" required maxLength={120} autoComplete="email" className={field} />
        </label>
        <label className="text-small text-ink">Mobile number
          <input name="phone" type="tel" required pattern="(\+?88)?01[3-9][0-9]{8}" placeholder="01XXXXXXXXX"
                 autoComplete="tel" className={field} />
        </label>
        <label className="text-small text-ink">City or district
          <input name="city" required minLength={2} maxLength={60} autoComplete="address-level2" className={field} />
        </label>
        <label className="text-small text-ink">Postcode (optional)
          <input name="postcode" maxLength={10} inputMode="numeric" autoComplete="postal-code" className={field} />
        </label>
        <label className="flex items-start gap-2 text-small text-ink-muted sm:col-span-2">
          <input type="checkbox" name="agree" value="yes" required className="mt-1" />
          <span>
            I have read the <Link href="/refund-policy">refund policy</Link> and{' '}
            <Link href="/terms">terms</Link>. This is a digital product: once it
            works as described, it is not refunded for a change of mind.
          </span>
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="rounded-control bg-accent px-5 py-2.5 text-body font-medium text-white hover:bg-accent-hover">
            Pay {price} with EPS
          </button>
          <p className="mt-2 text-micro text-ink-subtle">
            You will be taken to EPS&apos;s secure payment page.
          </p>
        </div>
      </form>
    </details>
  );
}

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
              <BuyForm slug={p.slug} price={formatBdt(p.priceBdt)} />
            </div>
          ))}
        </div>
      )}

      <h2>Paying</h2>
      <p>
        Prices are shown in taka and are the full amount you pay. Payment is
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
        <Link href="/terms">terms of service</Link>. Questions about a product?{' '}
        Email <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>.
      </p>
    </TextPage>
  );
}
