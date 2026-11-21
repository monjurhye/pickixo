import Link from 'next/link';
import type { Metadata } from 'next';
import { TextPage } from '@/components/layout/TextPage';
import { buildMetadata } from '@/lib/seo';
import { BUSINESS, BUSINESS_NAME } from '@/lib/business';

export const metadata: Metadata = buildMetadata({
  title: 'Refund & return policy',
  description: 'When and how you can get your money back for a Pickixo digital product, and how long it takes.',
  path: '/refund-policy',
});

export default function RefundPolicyPage() {
  const refundWindow = BUSINESS.refundWindowDays;
  const processing = BUSINESS.refundProcessingDays;
  return (
    <TextPage
      eyebrow="Policies"
      title="Refund & return policy"
      updated={BUSINESS.policiesUpdated}
      intro={<p>This policy covers digital products bought from {BUSINESS_NAME} on pickixo.com.</p>}
    >
      <h2>Nothing to post back</h2>
      <p>
        We sell digital products only, so there is nothing to send back. A
        refund is asked for by email.
      </p>

      <h2>When you get a full refund</h2>
      <ul>
        <li>You paid, but the product was not delivered to you.</li>
        <li>The file or access we delivered does not work, and we cannot fix it for you.</li>
        <li>The product is clearly not what its description on our site said.</li>
        <li>You were charged twice, or charged the wrong amount.</li>
      </ul>

      <h2>When a refund is not given</h2>
      <p>
        Because a digital product cannot be given back once it has been
        downloaded or opened, we do not refund a product that was delivered and
        works as described just because you changed your mind. If you are not
        sure a product suits you, ask us before buying.
      </p>

      <h2>How to ask for a refund</h2>
      <ol>
        <li>
          Email <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
          {refundWindow ? <> within {refundWindow} days of your purchase</> : null}.
        </li>
        <li>Include the order or transaction number, the phone number or email you paid with, and what went wrong.</li>
        <li>We reply to confirm whether the refund is approved.</li>
      </ol>

      <h2>How the money comes back</h2>
      <p>
        An approved refund goes back through the payment gateway to the same
        card, bank account or mobile wallet you paid with
        {processing ? <>, within {processing} working days of approval</> : null}.
        How soon it shows on your statement then depends on your bank or wallet
        provider.
      </p>

      <h2>Products bought through Pickixo Shop</h2>
      <p>
        Items you find on <a href="https://shop.pickixo.com">shop.pickixo.com</a> are
        sold and delivered by Amazon, not by us. Returns and refunds for them
        follow Amazon’s own policy.
      </p>

      <h2>Questions</h2>
      <p>
        See our <Link href="/contact">contact page</Link>.
      </p>
    </TextPage>
  );
}
