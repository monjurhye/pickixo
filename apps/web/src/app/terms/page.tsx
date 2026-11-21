import Link from 'next/link';
import type { Metadata } from 'next';
import { TextPage } from '@/components/layout/TextPage';
import { buildMetadata } from '@/lib/seo';
import { BUSINESS, BUSINESS_NAME } from '@/lib/business';

export const metadata: Metadata = buildMetadata({
  title: 'Terms of service',
  description: 'The terms for using pickixo.com and buying Pickixo digital products.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <TextPage
      eyebrow="Policies"
      title="Terms of service"
      updated={BUSINESS.policiesUpdated}
      intro={
        <p>
          These terms apply when you use pickixo.com or buy a product from{' '}
          {BUSINESS_NAME}. By using the site or buying, you agree to them.
        </p>
      }
    >
      <h2>1. Who we are</h2>
      <p>
        pickixo.com is run by {BUSINESS_NAME}, a business in Bangladesh. You can
        reach us at <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> or through
        the <Link href="/contact">contact page</Link>.
      </p>

      <h2>2. Free tools and information</h2>
      <p>
        The calculators, guides and learning games on this site are free. We work
        to keep them correct, but they are for information only. Salary, pay
        fixation and banking figures should be checked with your accounts office
        or bank before you rely on them for a decision.
      </p>

      <h2>3. Buying a product</h2>
      <ul>
        <li>Products and their prices in Bangladeshi taka are listed on <Link href="/pricing">Products &amp; pricing</Link>. The price shown when you pay is the price you are charged.</li>
        <li>Payment is taken by a third-party payment gateway. Your card, bank or mobile-wallet details go to the gateway, not to us.</li>
        <li>An order is complete when the payment is confirmed. We then deliver the product as described on its listing.</li>
        <li>Refunds follow our <Link href="/refund-policy">refund &amp; return policy</Link>.</li>
      </ul>

      <h2>4. Using what you buy</h2>
      <p>
        A digital product is licensed to you for your own use. Please do not
        resell, share publicly or redistribute it unless its listing says you may.
      </p>

      <h2>5. Our apps</h2>
      <p>
        Our Android apps are distributed through Google Play, and Google Play’s
        terms also apply to them. Each app has its own privacy policy, linked from{' '}
        <Link href="/our-apps">Our Android apps</Link>.
      </p>

      <h2>6. Links to other sites</h2>
      <p>
        Pickixo Shop links to products on Amazon. As an Amazon Associate we earn
        from qualifying purchases. Those purchases are between you and Amazon.
      </p>

      <h2>7. Acceptable use</h2>
      <p>
        Please do not try to break, overload or misuse the site, or use it for
        anything unlawful.
      </p>

      <h2>8. Liability</h2>
      <p>
        We provide the free parts of this site as they are. To the extent the law
        allows, we are not liable for losses that come from relying on free
        information here. Nothing in these terms takes away rights you have as a
        consumer under the law of Bangladesh.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these terms. The date at the top shows when they last
        changed; a purchase is covered by the terms in force when you made it.
      </p>

      <h2>10. Law</h2>
      <p>These terms are governed by the laws of Bangladesh.</p>
    </TextPage>
  );
}
