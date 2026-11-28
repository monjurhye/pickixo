import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { LandHelper } from '@/components/land/LandHelper';
import { getCurrentUser } from '@/lib/session';
import { breadcrumbSchema, buildMetadata, jsonLd, softwareApplicationSchema } from '@/lib/seo';

const PATH = '/bhumi-seba';
const TITLE = 'ভূমি সেবা সহায়ক: খতিয়ান, নামজারি, খাজনা ও মালিকানা যাচাই';
const DESCRIPTION =
  'বাংলাদেশের সব অনলাইন ভূমি সেবার অফিসিয়াল লিংক, জমির একক রূপান্তর (শতাংশ, কাঠা, বিঘা, একর), '
  + 'জমি কেনার আগে মালিকানা যাচাইয়ের চেকলিস্ট এবং ই-নামজারির কাগজপত্র ও ফি।';

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

export default async function Page() {
  const user = await getCurrentUser();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbSchema([
              { name: 'হোম', path: '/' },
              { name: 'বাংলাদেশ', path: '/bangladesh' },
              { name: 'ভূমি সেবা সহায়ক', path: PATH },
            ]),
            softwareApplicationSchema({
              name: 'ভূমি সেবা সহায়ক',
              description: DESCRIPTION,
              url: PATH,
              category: 'UtilitiesApplication',
            }),
          ),
        }}
      />

      <SiteHeader user={user} />

      <main id="main" className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <nav aria-label="Breadcrumb" className="ps-no-print text-small text-ink-subtle">
          <Link href="/" className="hover:text-ink">হোম</Link>
          <span className="mx-1.5" aria-hidden="true">›</span>
          <Link href="/bangladesh" className="hover:text-ink">বাংলাদেশ</Link>
          <span className="mx-1.5" aria-hidden="true">›</span>
          <span className="text-ink-muted">ভূমি সেবা</span>
        </nav>

        <header className="mt-4">
          <h1 className="font-bengali text-title text-ink">ভূমি সেবা সহায়ক</h1>
          <p className="mt-2.5 max-w-2xl text-body text-ink-muted">
            খতিয়ান, নামজারি ও খাজনার অফিসিয়াল সাইট এক জায়গায়, জমির একক রূপান্তর, আর জমি কেনার আগে
            মালিকানা যাচাইয়ের ধাপে ধাপে চেকলিস্ট।
          </p>
        </header>

        <div className="mt-8">
          <LandHelper />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
