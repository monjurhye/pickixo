import type { Metadata } from 'next';
import { PayScaleShell } from '@/components/payscale/PayScaleShell';
import { GrossSalaryCalculator } from '@/components/payscale/GrossSalaryCalculator';
import { Card, SectionHeading } from '@/components/payscale/Ui';
import { breadcrumbSchema, buildMetadata, jsonLd, softwareApplicationSchema } from '@/lib/seo';
import allowances from '@/data/payscale/allowanceRules.json';

const PATH = '/gross-salary-calculator';
const TITLE = 'গ্রস বেতন ক্যালকুলেটর ২০২৬ — মূল বেতন + ভাতা';
const DESCRIPTION =
  'জাতীয় বেতনস্কেল, ২০২৬ অনুযায়ী গ্রস বেতনের হিসাব — বাড়ি ভাড়া, চিকিৎসা, শিক্ষা সহায়ক, '
  + 'টিফিন, যাতায়াত, মোবাইল, পাহাড়ি ও হাওড় ভাতা। যে ভাতার হার গেজেটে নাই, তাহা অনুমান করা '
  + 'হয় না — আপনি নিজে অঙ্ক দিতে পারেন।';

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbSchema([
              { name: 'হোম', path: '/' },
              { name: 'গ্রস বেতন ক্যালকুলেটর', path: PATH },
            ]),
            softwareApplicationSchema({
              name: 'গ্রস বেতন ক্যালকুলেটর ২০২৬',
              description: DESCRIPTION,
              url: PATH,
              category: 'FinanceApplication',
            }),
          ),
        }}
      />

      <PayScaleShell
        title="গ্রস বেতন ক্যালকুলেটর"
        crumb="গ্রস বেতন"
        activeHref={PATH}
        lead={
          <>
            মূল বেতন + ভাতা = গ্রস বেতন। ভাতা কখনও মূল বেতনের অংশ নয় এবং বেতন নির্ধারণে
            ব্যবহৃত হয় না।
          </>
        }
      >
        <Card className="mb-5 border-warning/30 bg-warning/5">
          <h2 className="text-subheading text-ink">কখন এই হার কার্যকর হইবে</h2>
          <p className="mt-1.5 text-small text-ink-muted">{allowances.entitlementRule.statement}</p>
          <p className="mt-2 text-small text-ink">
            অর্থাৎ নিচের ভাতার অঙ্কগুলি <span className="font-medium">১ জানুয়ারি ২০২৮</span> হইতে
            প্রযোজ্য। ৩১ ডিসেম্বর ২০২৭ পর্যন্ত আপনি ৩০ জুন ২০২৬ তারিখে যে অঙ্ক পাইতেন তাহাই পাইবেন।
          </p>
          <p className="mt-2 text-micro text-ink-subtle">{allowances.entitlementRule.sourceSection}</p>
        </Card>

        <GrossSalaryCalculator />

        <section aria-labelledby="formula-heading" className="mt-12">
          <SectionHeading id="formula-heading">সূত্র</SectionHeading>
          <Card>
            <p className="font-bengali text-body text-ink">
              মূল বেতন (Basic)
              <br />+ বাড়ি ভাড়া ভাতা
              <br />+ চিকিৎসা ভাতা
              <br />+ শিক্ষা সহায়ক ভাতা
              <br />+ অন্যান্য প্রযোজ্য ভাতা
              <br /><span className="font-semibold">= গ্রস বেতন (Gross Salary)</span>
              <br />− কর্তন (আয়কর, জিপিএফ ইত্যাদি — গেজেটে হার নাই)
              <br /><span className="font-semibold">= নিট বেতন (Net Salary)</span>
            </p>
          </Card>
          <p className="mt-3 text-small text-ink-muted">
            বাংলা নববর্ষ ভাতা (মূল বেতনের ১৫%) এবং উৎসব ভাতা বৎসরে প্রদেয়, তাই মাসিক গ্রসে
            যোগ করা হয় নাই। অনুচ্ছেদ ৩১ অনুযায়ী আয়কর কর্মচারী নিজে নিরূপণ ও পরিশোধ করিবেন;
            এই গেজেটে কোনও করহার নির্ধারিত হয় নাই।
          </p>
        </section>
      </PayScaleShell>
    </>
  );
}
