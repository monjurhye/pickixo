import type { Metadata } from 'next';
import { PayScaleShell } from '@/components/payscale/PayScaleShell';
import { IncrementCalculator } from '@/components/payscale/IncrementCalculator';
import { Card, SectionHeading } from '@/components/payscale/Ui';
import { breadcrumbSchema, buildMetadata, jsonLd, softwareApplicationSchema } from '@/lib/seo';
import rules from '@/data/payscale/payRules2026.json';

const PATH = '/increment-calculator';
const TITLE = 'ইনক্রিমেন্ট ক্যালকুলেটর ২০২৬ — বার্ষিক বেতনবৃদ্ধি কত?';
const DESCRIPTION =
  'জাতীয় বেতনস্কেল, ২০২৬ অনুযায়ী বার্ষিক বেতনবৃদ্ধির হিসাব। গেজেটে কোনও শতকরা হার নাই — '
  + 'বৃদ্ধি মানে স্কেলের পরবর্তী ধাপ, তাই প্রতিটি ধাপে অঙ্ক ভিন্ন। তারিখ প্রতি অর্থবছরের '
  + 'প্রথম দিন, অর্থাৎ ১ জুলাই।';

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
              { name: 'ইনক্রিমেন্ট ক্যালকুলেটর', path: PATH },
            ]),
            softwareApplicationSchema({
              name: 'ইনক্রিমেন্ট ক্যালকুলেটর ২০২৬',
              description: DESCRIPTION,
              url: PATH,
              category: 'FinanceApplication',
            }),
          ),
        }}
      />

      <PayScaleShell
        title="ইনক্রিমেন্ট ক্যালকুলেটর"
        crumb="ইনক্রিমেন্ট"
        activeHref={PATH}
        lead="অনুচ্ছেদ ৯ অনুযায়ী বার্ষিক বেতনবৃদ্ধি — তারিখ, পরিমাণ ও পরবর্তী কয়েক বৎসরের ধাপ।"
      >
        <IncrementCalculator />

        <section aria-labelledby="rules-heading" className="mt-12">
          <SectionHeading id="rules-heading" sub="অনুচ্ছেদ ৯ — বেতন নির্ধারণের পর বার্ষিক বেতনবৃদ্ধি">
            বেতনবৃদ্ধির বিধি
          </SectionHeading>
          <div className="space-y-3">
            {rules.incrementRules.map((rule) => (
              <Card key={rule.ruleId}
                    className={rule.ruleId === 'INC-CEILING' ? 'border-warning/30 bg-warning/5' : ''}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-subheading text-ink">{rule.ruleName}</h3>
                  <span className="text-micro text-ink-subtle">{rule.sourceSection}</span>
                </div>
                <p className="mt-1.5 text-small text-ink-muted">{rule.statement}</p>
                {'amountRule' in rule && rule.amountRule ? (
                  <p className="mt-2 rounded-control border border-border bg-surface-sunken px-3 py-2 text-small text-ink">
                    {rule.amountRule}
                  </p>
                ) : null}
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="why-heading" className="mt-12">
          <h2 id="why-heading" className="text-heading text-ink">কেন “৫% ইনক্রিমেন্ট” বলা যায় না</h2>
          <p className="mt-3 text-body text-ink-muted">
            এই আদেশে বার্ষিক বেতনবৃদ্ধির কোনও শতকরা হার নির্ধারিত হয় নাই। অনুচ্ছেদ ৯ কেবল
            তারিখ বলিয়াছে — প্রতি অর্থ বৎসরের প্রথম দিবস — এবং বৃদ্ধি বলিতে বেতনস্কেলের
            পরবর্তী ধাপে উঠা বুঝায়। ধাপগুলির ব্যবধান সমান নয়, তাই কার্যকর হার এক ধাপ হইতে
            আরেক ধাপে বদলায়, এবং দুইজন কর্মচারীর বৃদ্ধি একই গ্রেডে থাকিয়াও ভিন্ন হইতে পারে।
          </p>
          <p className="mt-3 text-body text-ink-muted">
            স্কেলের সর্বোচ্চ ধাপে পৌঁছানোর পর কী হইবে, সে সম্পর্কে গেজেটে সুস্পষ্ট বিধান নাই।
            এই ক্যালকুলেটর সেই ক্ষেত্রে কোনও অঙ্ক দেখায় না; কেবল জানাইয়া দেয় যে বিধানটি
            নির্ধারিত নয়।
          </p>
        </section>
      </PayScaleShell>
    </>
  );
}
