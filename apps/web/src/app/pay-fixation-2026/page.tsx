import type { Metadata } from 'next';
import { PayScaleShell, Faq } from '@/components/payscale/PayScaleShell';
import { SalaryCalculator } from '@/components/payscale/SalaryCalculator';
import { BenefitAdjustment } from '@/components/payscale/BenefitAdjustment';
import { Card, SectionHeading } from '@/components/payscale/Ui';
import { FIXATION_FAQ } from '@/lib/payscale/faq';
import { absoluteUrl, breadcrumbSchema, buildMetadata, jsonLd } from '@/lib/seo';
import rules from '@/data/payscale/payRules2026.json';
import { taka, toBnDigits } from '@/lib/payscale/format';

const PATH = '/pay-fixation-2026';
const TITLE = 'Pay Fixation 2026 — বেতন নির্ধারণ পদ্ধতি ও উদাহরণ | বাংলাদেশ';
const DESCRIPTION =
  'চাকরি (বেতন ও ভাতাদি) আদেশ, ২০২৬ এর অনুচ্ছেদ ৫ অনুযায়ী বেতন নির্ধারণের সম্পূর্ণ পদ্ধতি — '
  + 'প্রারম্ভিক ধাপ, পার্থক্য পদ্ধতি, পরবর্তী উচ্চতর ধাপ, গেজেটের নিজস্ব দুইটি উদাহরণ, '
  + 'বিশেষ অবস্থার বিধান এবং উচ্চতর গ্রেডের প্রাপ্যতা।';

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
              { name: 'বেতন নির্ধারণ পদ্ধতি', path: PATH },
            ]),
            {
              '@type': 'FAQPage',
              '@id': `${absoluteUrl(PATH)}#faq`,
              mainEntity: FIXATION_FAQ.map((item) => ({
                '@type': 'Question',
                name: item.q,
                acceptedAnswer: { '@type': 'Answer', text: item.a },
              })),
            },
          ),
        }}
      />

      <PayScaleShell
        title="বেতন নির্ধারণ (Pay Fixation), ২০২৬"
        crumb="বেতন নির্ধারণ পদ্ধতি"
        activeHref={PATH}
        lead="অনুচ্ছেদ ৫ এর পদ্ধতি, গেজেটের নিজস্ব উদাহরণ এবং যে অবস্থাগুলিতে ভিন্ন বিধান প্রযোজ্য।"
      >
        <section aria-labelledby="method-heading">
          <SectionHeading id="method-heading" sub="অনুচ্ছেদ ৫ — জাতীয় বেতনস্কেল, ২০২৬ এ বেতন নির্ধারণ">
            নির্ধারণের বিধি
          </SectionHeading>

          <div className="space-y-3">
            {rules.payFixationRules.map((rule) => (
              <Card key={rule.ruleId}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-subheading text-ink">{rule.ruleName}</h3>
                  <span className="text-micro text-ink-subtle">{rule.sourceSection}</span>
                </div>
                {'appliesWhen' in rule && rule.appliesWhen ? (
                  <p className="mt-1.5 text-small text-ink-muted">
                    <span className="font-medium text-ink">কখন:</span> {rule.appliesWhen}
                  </p>
                ) : null}
                {'formula' in rule && rule.formula ? (
                  <p className="mt-2 rounded border border-border bg-surface-sunken px-2.5 py-1.5
                                font-bengali text-small text-ink">
                    {rule.formula}
                  </p>
                ) : null}
                <blockquote className="mt-2 border-l-2 border-border pl-3 text-small italic text-ink-muted">
                  “{rule.statement}”
                </blockquote>
                {'subRules' in rule && Array.isArray(rule.subRules) ? (
                  <ul className="mt-2.5 space-y-2">
                    {rule.subRules.map((sub) => (
                      <li key={sub.ruleId} className="rounded-control border border-border bg-surface-sunken p-3">
                        <p className="text-small font-medium text-ink">{sub.condition}</p>
                        <p className="mt-0.5 text-small text-ink-muted">{sub.statement}</p>
                        <p className="mt-1 text-micro text-ink-subtle">{sub.sourceSection}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {'calculatorNote' in rule && rule.calculatorNote ? (
                  <p className="mt-2 text-small text-warning">{rule.calculatorNote}</p>
                ) : null}
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="examples-heading" className="mt-12">
          <SectionHeading id="examples-heading"
            sub="গেজেটে মুদ্রিত দুইটি উদাহরণ — এই ক্যালকুলেটরের ফলাফল ইহাদের সহিত মিলিয়া দেখা হয়।">
            গেজেটের উদাহরণ
          </SectionHeading>
          <div className="grid gap-3 sm:grid-cols-2">
            {rules.gazetteWorkedExamples.map((ex) => (
              <Card key={ex.exampleId}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-subheading text-ink">{ex.label}</h3>
                  <span className="text-micro text-ink-subtle">গ্রেড {toBnDigits(ex.grade)}</span>
                </div>
                <div className="mt-2 flex items-baseline gap-2 font-bengali tabular-nums">
                  <span className="text-small text-ink-muted">{taka(ex.currentBasic)}</span>
                  <span aria-hidden="true" className="text-ink-subtle">→</span>
                  <span className="text-heading text-ink">{taka(ex.expectedFixedBasic)}</span>
                </div>
                <p className="mt-2 text-small text-ink-muted">{ex.explanation}</p>
                <p className="mt-2 text-micro text-ink-subtle">{ex.sourceSection} • গেজেট পৃষ্ঠা {ex.sourcePage}</p>
              </Card>
            ))}
          </div>
          <p className="mt-3 text-small text-ink-muted">
            লক্ষ করুন: উভয় উদাহরণের অঙ্কই অনুচ্ছেদ ৫ অনুযায়ী নির্ধারিত বেতন — ইহার সহিত
            অনুচ্ছেদ ৯(২) এর ১ জুলাই ২০২৬ তারিখের বার্ষিক বেতনবৃদ্ধি এখনও যোগ হয় নাই।
          </p>
        </section>

        <section aria-labelledby="benefit-heading" className="mt-12">
          <SectionHeading id="benefit-heading">১০% / ১৫% ও বিশেষ সুবিধা</SectionHeading>
          <BenefitAdjustment />
        </section>

        <section aria-labelledby="higher-heading" className="mt-12">
          <SectionHeading id="higher-heading" sub="অনুচ্ছেদ ৬ — উচ্চতর গ্রেডের প্রাপ্যতা">
            উচ্চতর গ্রেড
          </SectionHeading>
          <div className="space-y-3">
            {rules.higherGradeRules.map((rule) => (
              <Card key={rule.ruleId}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-subheading text-ink">{rule.ruleName}</h3>
                  <span className="text-micro text-ink-subtle">{rule.sourceSection}</span>
                </div>
                <p className="mt-1.5 text-small text-ink-muted">{rule.statement}</p>
                {'proviso' in rule && rule.proviso ? (
                  <p className="mt-2 rounded-control border border-accent/25 bg-accent-soft px-3 py-2 text-small text-accent-ink">
                    <span className="font-medium">শর্ত:</span> {rule.proviso}
                  </p>
                ) : null}
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="fullpay-heading" className="mt-12">
          <SectionHeading id="fullpay-heading" sub={rules.fullPayServiceTable.statement}>
            পদের পূর্ণ বেতন প্রাপ্তির শর্ত
          </SectionHeading>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[26rem] border-collapse text-small">
              <thead>
                <tr className="border-b border-border-strong text-left text-micro text-ink-subtle">
                  <th scope="col" className="py-2 pr-3 font-medium">গ্রেড</th>
                  <th scope="col" className="py-2 pr-3 font-medium">বেতনস্কেল</th>
                  <th scope="col" className="py-2 font-medium">নূ্যনতম চাকরির মেয়াদ</th>
                </tr>
              </thead>
              <tbody>
                {rules.fullPayServiceTable.rows.map((row) => (
                  <tr key={row.grade} className="border-b border-border last:border-0">
                    <th scope="row" className="py-2 pr-3 text-left font-medium text-ink tabular-nums">
                      {toBnDigits(row.grade)}
                    </th>
                    <td className="py-2 pr-3 font-bengali tabular-nums text-ink-muted">{row.scale}</td>
                    <td className="py-2 font-bengali tabular-nums text-ink">
                      {toBnDigits(row.minimumServiceYears)} বৎসর
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="calc-heading" className="mt-12">
          <SectionHeading id="calc-heading" sub="উপরের বিধিগুলি আপনার অঙ্কে প্রয়োগ করিয়া দেখুন।">
            নিজের বেতন নির্ধারণ করুন
          </SectionHeading>
          <SalaryCalculator />
        </section>

        <Faq items={FIXATION_FAQ} id="fixation-faq" />
      </PayScaleShell>
    </>
  );
}
