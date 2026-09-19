import type { Metadata } from 'next';
import Link from 'next/link';
import { PayScaleShell, Faq } from '@/components/payscale/PayScaleShell';
import { SalaryCalculator } from '@/components/payscale/SalaryCalculator';
import { Card, SectionHeading } from '@/components/payscale/Ui';
import { MAIN_FAQ } from '@/lib/payscale/faq';
import { PAY_SCALE_2026 } from '@/lib/payscale/payScale';
import { gradeLabel, taka } from '@/lib/payscale/format';
import {
  absoluteUrl, breadcrumbSchema, buildMetadata, jsonLd, softwareApplicationSchema,
} from '@/lib/seo';

/**
 * The English-language entry point for the same calculator.
 *
 * Same engine, same disclaimers; the difference is the search intent it
 * answers ("govt salary calculator bangladesh") and an English summary of the
 * order for people who search that way. The numbers and the rule text stay in
 * Bengali, because they are quotations from a Bengali statutory instrument and
 * paraphrasing them into English would put a translation between the reader
 * and the rule.
 */

const PATH = '/govt-salary-calculator-bangladesh';
const TITLE = 'Government Salary Calculator Bangladesh — Pay Scale 2026';
const DESCRIPTION =
  'Free government salary calculator for Bangladesh, built from the National Pay Scale '
  + '2026 gazette (S.R.O. 347-Ain/2026, 17 September 2026). Grade 1–20 pay fixation, '
  + 'annual increment, phased 40%/50% payment and allowance rates, with the gazette '
  + 'article cited for every figure.';

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbSchema([
              { name: 'Home', path: '/' },
              { name: 'Government Salary Calculator', path: PATH },
            ]),
            softwareApplicationSchema({
              name: 'Bangladesh Government Salary Calculator 2026',
              description: DESCRIPTION,
              url: PATH,
              category: 'FinanceApplication',
            }),
            {
              '@type': 'FAQPage',
              '@id': `${absoluteUrl(PATH)}#faq`,
              mainEntity: MAIN_FAQ.slice(0, 8).map((item) => ({
                '@type': 'Question',
                name: item.q,
                acceptedAnswer: { '@type': 'Answer', text: item.a },
              })),
            },
          ),
        }}
      />

      <PayScaleShell
        title="Government Salary Calculator, Bangladesh"
        crumb="Government salary calculator"
        activeHref={PATH}
        lead={
          <>
            Pay fixation under the National Pay Scale 2026 — চাকরি (বেতন ও ভাতাদি) আদেশ,
            ২০২৬, S.R.O. 347-Ain/2026, gazetted 17 September 2026 and effective from
            1 July 2026.
          </>
        }
      >
        <Card className="mb-5">
          <h2 className="text-subheading text-ink">What this order actually changed</h2>
          <ul className="mt-2 space-y-2 text-small text-ink-muted">
            <li>
              <span className="font-medium text-ink">New scales for all 20 grades.</span> The
              2015 scales are abolished and each is replaced by a corresponding 2026 scale
              (Article 3(1)). Grades 1–11 start at exactly double their 2015 minimum;
              grades 12–20 start at more than double.
            </li>
            <li>
              <span className="font-medium text-ink">Fixation is by step, not by percentage.</span>{' '}
              Article 5 takes the difference between your pay and the bottom of your old
              scale, adds it to the bottom of the new scale, and places you on that step —
              or the next higher one if there is no exact match.
            </li>
            <li>
              <span className="font-medium text-ink">One increment on 1 July 2026.</span>{' '}
              Article 9(2) grants a single annual increment immediately after fixation.
              Article 9(1) sets the increment date as the first day of each financial year.
            </li>
            <li>
              <span className="font-medium text-ink">The rise is paid in three stages.</span>{' '}
              Article 1(3) pays 40% of the increase (grades 1–9) or 50% (grades 10–20) from
              1 July to 31 December 2026, then 70%/75% to 30 June 2027, then 100% from
              1 July 2027.
            </li>
            <li>
              <span className="font-medium text-ink">The special benefit ends.</span> Article
              1(3)(ট) abolishes বিশেষ সুবিধা from 1 July 2026 and adjusts what was drawn
              against arrears. It is not added to, or deducted from, the fixation.
            </li>
            <li>
              <span className="font-medium text-ink">Allowance rates wait until 2028.</span>{' '}
              Article 1(3)(ঞ) keeps every allowance at its 30 June 2026 amount until
              31 December 2027.
            </li>
          </ul>
        </Card>

        <SalaryCalculator />

        <section aria-labelledby="scale-heading" className="mt-12">
          <SectionHeading id="scale-heading" sub="Starting basic pay under the 2026 scale">
            Pay scale 2026 at a glance
          </SectionHeading>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[30rem] border-collapse text-small">
              <thead>
                <tr className="border-b border-border-strong text-left text-micro text-ink-subtle">
                  <th scope="col" className="py-2 pr-3 font-medium">Grade</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Minimum</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Maximum</th>
                  <th scope="col" className="py-2 text-right font-medium">Steps</th>
                </tr>
              </thead>
              <tbody>
                {PAY_SCALE_2026.grades.map((g) => (
                  <tr key={g.grade} className="border-b border-border last:border-0">
                    <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">
                      <Link href={`/grade-${g.grade}-salary`} className="hover:text-accent-ink hover:underline">
                        {gradeLabel(g.grade)}
                      </Link>
                    </th>
                    <td className="py-2 pr-3 text-right font-bengali tabular-nums text-ink">{taka(g.minimum)}</td>
                    <td className="py-2 pr-3 text-right font-bengali tabular-nums text-ink-muted">
                      {g.fixed ? '—' : taka(g.maximum)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-ink-subtle">{g.stepCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="not-heading" className="mt-12">
          <h2 id="not-heading" className="text-heading text-ink">What this calculator will not do</h2>
          <p className="mt-3 text-body text-ink-muted">
            It will not invent a rule. Where the gazette is silent — what happens if a
            fixation base exceeds the top of the new scale, how the transition percentage
            rounds, what the festival bonus rate is, what happens to increments at the top
            of a scale — it says so and produces no figure, rather than offering a plausible
            one. It also will not tell you the government made a mistake: a difference
            between this calculation and an official fixation is reported as a difference,
            and the accounts office&apos;s verified বেতন নির্ধারণী বিবরণী is the document
            that governs (Article 32(10)).
          </p>
        </section>

        <Faq items={MAIN_FAQ} />
      </PayScaleShell>
    </>
  );
}
