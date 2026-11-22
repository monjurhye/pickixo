import Link from 'next/link';
import type { Metadata } from 'next';
import { TextPage } from '@/components/layout/TextPage';
import { BuyForm } from '@/components/BuyForm';
import { buildMetadata } from '@/lib/seo';
import { PRODUCTS, formatBdt, type Product } from '@/lib/business';

export const metadata: Metadata = buildMetadata({
  title: 'Shop: ebooks and tools',
  description: 'Ebooks and tools made by Pickixo, priced in taka. Pay with bKash, Nagad, Rocket or card and download straight away.',
  path: '/shop',
  index: PRODUCTS.length > 0,
});

const SHELVES: { kind: NonNullable<Product['kind']>; title: string; empty: string }[] = [
  { kind: 'ebook', title: 'Ebooks', empty: 'More ebooks are being written.' },
  { kind: 'tool', title: 'Tools', empty: 'Our first paid tools are on the way. Until then, our free tools are in the menu.' },
];

function ProductCard({ p }: { p: Product }) {
  const price = formatBdt(p.priceBdt);
  return (
    <article id={p.slug} className="grid gap-3 rounded-card border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-subheading text-ink">{p.href ? <Link href={p.href}>{p.name}</Link> : p.name}</h3>
        <p className="shrink-0 font-display text-heading text-ink">{price}</p>
      </div>
      <p className="text-small text-ink-muted">{p.description}</p>
      <p className="text-small text-ink-subtle">Delivery: {p.delivery}</p>
      <BuyForm slug={p.slug} price={price} />
    </article>
  );
}

export default function ShopPage() {
  return (
    <TextPage
      eyebrow="Pickixo Shop"
      title="Ebooks and tools"
      intro={
        <p>
          Made by us, priced in Bangladeshi taka. Pay with bKash, Nagad, Rocket,
          card or internet banking through EPS, and get the download link at once
          and by email.
        </p>
      }
    >
      {SHELVES.map((shelf) => {
        const items = PRODUCTS.filter((p) => (p.kind ?? 'ebook') === shelf.kind);
        return (
          <section key={shelf.kind} aria-labelledby={`shelf-${shelf.kind}`}>
            <h2 id={`shelf-${shelf.kind}`}>{shelf.title}</h2>
            {items.length ? (
              <div className="not-prose mt-4 grid gap-4 md:grid-cols-2">
                {items.map((p) => <ProductCard key={p.slug} p={p} />)}
              </div>
            ) : (
              <p>{shelf.empty}</p>
            )}
          </section>
        );
      })}

      <h2>Before you buy</h2>
      <p>
        Download links work for 7 days and up to 5 downloads. Please read the{' '}
        <Link href="/refund-policy">refund &amp; return policy</Link> and{' '}
        <Link href="/terms">terms</Link>. All prices are also listed on{' '}
        <Link href="/pricing">products &amp; pricing</Link>.
      </p>
      <p>
        Looking for things for the home and kitchen? Our{' '}
        <a href="https://shop.pickixo.com">Amazon finds</a> are on a separate site.
      </p>
    </TextPage>
  );
}
