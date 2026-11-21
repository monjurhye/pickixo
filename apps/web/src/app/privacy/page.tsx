import Link from 'next/link';
import type { Metadata } from 'next';
import { TextPage } from '@/components/layout/TextPage';
import { buildMetadata } from '@/lib/seo';
import { BUSINESS, BUSINESS_NAME } from '@/lib/business';

export const metadata: Metadata = buildMetadata({
  title: 'Privacy policy',
  description: 'What pickixo.com collects, why, and what we do not do with it.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <TextPage
      eyebrow="Policies"
      title="Privacy policy"
      updated={BUSINESS.policiesUpdated}
      intro={
        <p>
          This policy is for the website pickixo.com. Each of our Android apps has
          its own privacy policy — see <Link href="/our-apps" className="text-accent-ink underline underline-offset-2">Our Android apps</Link>.
        </p>
      }
    >
      <h2>The short version</h2>
      <p>
        You can use the tools on this site without an account. We do not run
        advertising trackers or analytics on it, and we do not sell anyone’s data.
      </p>

      <h2>What stays on your device</h2>
      <p>
        Your light or dark theme choice, and progress in the learning games
        (Pickixo Kids, Class 2), are saved in your own browser’s storage. They are
        not sent to us. Clearing your browser data removes them.
      </p>

      <h2>What our host sees</h2>
      <p>
        The site is served through Cloudflare. Like any web host, it handles your
        IP address and browser details to deliver pages and protect the site from
        attacks. We use this only for security and keeping the site working.
      </p>

      <h2>When you buy something</h2>
      <p>
        To deliver a product and help you afterwards, we keep your name, email or
        phone number, what you bought, and the payment reference. The payment
        itself is processed by the payment gateway: your card number, bank login
        or wallet PIN go to the gateway and are never seen by us. We keep order
        records for as long as the law requires for accounts.
      </p>

      <h2>When you email us</h2>
      <p>We keep your message and our reply so we can help you. We do not add you to any mailing list.</p>

      <h2>Children</h2>
      <p>
        The learning games for children ask for no personal details and store
        progress only on the device.
      </p>

      <h2>Pickixo Shop</h2>
      <p>
        Links to Amazon on shop.pickixo.com carry our Amazon Associates tag. Once
        you are on Amazon, Amazon’s privacy notice applies.
      </p>

      <h2>Your choices</h2>
      <p>
        You can ask us what we hold about you, or ask us to delete it, by emailing{' '}
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>. Records the law
        requires us to keep, such as payment records, are kept for that period.
      </p>

      <h2>Contact</h2>
      <p>
        {BUSINESS_NAME} — <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>.
        Full details on the <Link href="/contact">contact page</Link>.
      </p>
    </TextPage>
  );
}
