import Link from 'next/link';
import type { Metadata } from 'next';
import { TextPage } from '@/components/layout/TextPage';
import { buildMetadata } from '@/lib/seo';
import { BUSINESS, BUSINESS_NAME } from '@/lib/business';

export const metadata: Metadata = buildMetadata({
  title: 'About',
  description: 'Who makes Pickixo, and what we make: Android apps, browser tools, learning games and digital products, from Bangladesh.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <TextPage
      eyebrow="About"
      title="A small software maker in Bangladesh"
      intro={<p>Pickixo makes apps and tools that are useful to people in Bangladesh, most of them in Bangla.</p>}
    >
      <h2>What we make</h2>
      <ul>
        <li><strong>Android apps and games</strong> on Google Play — <Link href="/our-apps">see the list</Link>.</li>
        <li><strong>Free tools in the browser</strong> — the 2026 pay-scale and salary calculators, banking calculators, and learning games for young children and Class 2.</li>
        <li><strong>Digital products</strong> — listed with their prices in the <Link href="/shop">shop</Link>.</li>
        <li><strong>Pickixo Shop</strong> — hand-picked products at <a href="https://shop.pickixo.com">shop.pickixo.com</a>, bought on Amazon.</li>
      </ul>

      <h2>Who we are</h2>
      <p>
        {BUSINESS.legalName ? <><strong>{BUSINESS_NAME}</strong> is </> : <>Pickixo is </>}
        a business registered in Bangladesh
        {BUSINESS.tradeLicenceNo ? <> (trade licence no. {BUSINESS.tradeLicenceNo})</> : null}
        {BUSINESS.proprietor ? <>, run by {BUSINESS.proprietor}</> : null}.
      </p>

      <h2>Get in touch</h2>
      <p>
        Email <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>, or see the{' '}
        <Link href="/contact">contact page</Link> for our address and phone number.
      </p>
    </TextPage>
  );
}
