import type { Metadata } from 'next';
import { TextPage, AddressBlock } from '@/components/layout/TextPage';
import { buildMetadata } from '@/lib/seo';
import { BUSINESS, BUSINESS_NAME } from '@/lib/business';

export const metadata: Metadata = buildMetadata({
  title: 'Contact',
  description: 'How to reach Pickixo: email, phone and postal address, for app support, orders and refunds.',
  path: '/contact',
});

export default function ContactPage() {
  return (
    <TextPage
      eyebrow="Contact"
      title="Contact us"
      intro={<p>For help with one of our apps, an order, a refund, or anything else.</p>}
    >
      <h2>Email</h2>
      <p>
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
      </p>
      <p>
        Writing about an app? Please name the app and your phone model. About an
        order? Please include the order or transaction number from your receipt.
      </p>

      {BUSINESS.phone ? (
        <>
          <h2>Phone</h2>
          <p><a href={`tel:${BUSINESS.phone.replace(/[^+\d]/g, '')}`}>{BUSINESS.phone}</a></p>
        </>
      ) : null}

      {BUSINESS.hours ? (
        <>
          <h2>Hours</h2>
          <p>{BUSINESS.hours}</p>
        </>
      ) : null}

      {BUSINESS.address ? (
        <>
          <h2>Address</h2>
          <p><strong>{BUSINESS_NAME}</strong></p>
          <AddressBlock address={BUSINESS.address} phone={null} />
        </>
      ) : null}
    </TextPage>
  );
}
