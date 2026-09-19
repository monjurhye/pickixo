'use client';

import { Card, Money, ResultHero, Source, Stat, Warnings } from './Ui';
import { formatBn, formatDateBn, gradeLabel, percentBn, taka, toBnDigits } from '@/lib/payscale/format';
import { REF } from '@/lib/payscale/sourceReference';
import type { FixationResult } from '@/lib/payscale/types';

/**
 * The result of a pay fixation.
 *
 * Three things are kept visually separate on purpose, because conflating them
 * is how people end up with the wrong expectation:
 *
 *   • the basic pay fixed in the 2026 scale (what the scale says you are on),
 *   • what is actually paid during the two transition windows (অনুচ্ছেদ ১(৩)),
 *   • allowances, which are not here at all — they do not change until 2028.
 */
export function SalaryResult({ result }: { result: FixationResult }) {
  if (!result.ok) {
    return (
      <div className="space-y-4">
        <Card className="border-danger/30 bg-danger/5">
          <h3 className="text-subheading text-ink">বেতন নির্ধারণ করা যাইতেছে না</h3>
          <p className="mt-1.5 text-small text-ink-muted">
            এই তথ্যের ভিত্তিতে নির্দিষ্ট বেতন নির্ধারণ নিশ্চিত করা যাচ্ছে না। নিচের
            বার্তাগুলি দেখুন।
          </p>
        </Card>
        <Warnings items={result.warnings} />
      </div>
    );
  }

  const { input, oldScale, newScale } = result;

  return (
    <div className="ps-report space-y-4">
      {/* --- headline ------------------------------------------------------ */}
      <ResultHero
        eyebrow="২০২৬ স্কেলে নির্ধারিত মূল বেতন (পূর্ণ হারে)"
        badge={gradeLabel(input.grade)}
        value={taka(result.newBasic)}
        caption="১ জুলাই ২০২৬ তারিখে ১টি বার্ষিক বেতনবৃদ্ধিসহ। এই অঙ্ক একবারে নয়, পর্যায়ক্রমে প্রদেয় — নিচের টেবিল দেখুন।"
        compare={(
          <>
            <span className="text-ink-muted">
              আগের মূল বেতন <span className="font-semibold text-ink">{taka(input.currentBasic)}</span>
            </span>
            <span aria-hidden="true" className="hidden text-ink-subtle sm:inline">→</span>
            <span className="rounded-full bg-surface px-2.5 py-1 font-semibold text-success">
              পূর্ণ হারে +{taka(result.monthlyIncrease)} ({percentBn(result.percentIncrease)})
            </span>
            {result.phases[0] ? (
              <span className="text-ink-muted">
                ৩১ ডিসেম্বর ২০২৬ পর্যন্ত হাতে পাইবেন{' '}
                <span className="font-semibold text-ink">{taka(result.phases[0].payable)}</span>
                {' '}({toBnDigits(result.phases[0].percent)}%)
              </span>
            ) : null}
          </>
        )}
        footer={[
          { label: 'বার্ষিক বৃদ্ধি (পূর্ণ হারে)', value: taka(result.annualIncrease), hint: 'মাসিক বৃদ্ধি × ১২' },
          {
            label: 'পরবর্তী বেতনবৃদ্ধি',
            value: result.nextIncrementAmount === null ? 'নির্ধারিত নয়' : `+${taka(result.nextIncrementAmount)}`,
            hint: result.nextIncrementDate ? formatDateBn(result.nextIncrementDate) : 'স্কেলের সর্বোচ্চ ধাপ',
          },
        ]}
      >
        {oldScale && newScale ? (
          <dl className="space-y-1.5">
            <div className="flex flex-col gap-0.5 text-small sm:flex-row sm:justify-between sm:gap-4">
              <dt className="text-ink-muted">২০১৫ স্কেল (বর্তমান)</dt>
              <dd className="font-bengali tabular-nums text-ink">
                {toBnDigits(oldScale.minimum)}–{toBnDigits(oldScale.maximum)}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 text-small sm:flex-row sm:justify-between sm:gap-4">
              <dt className="text-ink-muted">অনুরূপ ২০২৬ স্কেল</dt>
              <dd className="font-bengali tabular-nums text-ink">
                {toBnDigits(newScale.minimum)}–{toBnDigits(newScale.maximum)}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 text-small sm:flex-row sm:justify-between sm:gap-4">
              <dt className="text-ink-muted">অনুচ্ছেদ ৫ অনুযায়ী নির্ধারিত ধাপ</dt>
              <dd className="font-bengali tabular-nums text-ink">
                {taka(result.fixedBasic)}
                {result.fixedStepIndex !== null
                  ? ` (ধাপ ${toBnDigits(result.fixedStepIndex + 1)}/${toBnDigits(newScale.stepCount)})`
                  : ''}
              </dd>
            </div>
          </dl>
        ) : null}
        <Source source={REF.entitlement} />
      </ResultHero>

      {/* --- what is actually paid, and when ------------------------------- */}
      <PhaseTable result={result} />
    </div>
  );
}

/**
 * অনুচ্ছেদ ১(৩) — the phased payment.
 *
 * The fixed basic pay above is not what lands in the bank account until July
 * 2027, and a calculator that shows only the final figure would be quietly
 * misleading for two years. So the windows get their own table.
 */
export function PhaseTable({ result }: { result: FixationResult }) {
  if (result.phases.length === 0 || result.newBasic === null) return null;
  const grade = result.input.grade;

  return (
    <Card>
      <h3 className="text-subheading text-ink">কখন কত টাকা হাতে পাইবেন</h3>
      <p className="mt-1 text-small text-ink-muted">
        অনুচ্ছেদ ১(৩) অনুযায়ী বৃদ্ধির সম্পূর্ণ অঙ্ক একবারে প্রদেয় নয় — পর্যায়ক্রমে
        প্রদেয়। শতাংশ প্রয়োগ হয় <span className="font-medium text-ink">বৃদ্ধির অঙ্কের উপর</span>,
        মূল বেতনের উপর নয়।
      </p>

      <div className="mt-3 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full border-collapse text-small">
          <thead>
            <tr className="border-b border-border-strong text-left text-micro font-medium text-ink-subtle">
              <th scope="col" className="py-2 pr-3 font-medium">সময়কাল</th>
              <th scope="col" className="py-2 pr-3 font-medium">বৃদ্ধির হার</th>
              <th scope="col" className="hidden py-2 pr-3 text-right font-medium sm:table-cell">যোগ হইবে</th>
              <th scope="col" className="py-2 text-right font-medium">প্রাপ্য মূল বেতন</th>
            </tr>
          </thead>
          <tbody>
            {result.phases.map((phase) => (
              <tr
                key={phase.id}
                className={`border-b border-border last:border-0 ${
                  phase.id === 'phase-3' ? 'bg-accent-soft/60' : ''
                }`}
              >
                <td className="py-3 pl-2 pr-3 align-top text-ink">
                  {formatDateBn(phase.from)}
                  {phase.to ? ` – ${formatDateBn(phase.to)}` : ' হইতে'}
                </td>
                <td className="py-2.5 pr-3 align-top font-bengali tabular-nums text-ink-muted">
                  {toBnDigits(phase.percent)}%
                </td>
                <td className="hidden py-2.5 pr-3 text-right align-top font-bengali tabular-nums text-ink-muted sm:table-cell">
                  <Money value={phase.addedToCurrentBasic} />
                </td>
                <td className="py-2.5 text-right align-top font-bengali tabular-nums font-medium text-ink">
                  <Money value={phase.payable} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-small text-ink-muted">
        {grade <= 9
          ? 'আপনি ৯ম গ্রেড বা তদূর্ধ্বে — তাই হার ৪০% ও ৭০%।'
          : 'আপনি ১০ম–২০তম গ্রেডে — তাই হার ৫০% ও ৭৫%।'}
        {' '}মোট বৃদ্ধি {taka(result.monthlyIncrease)}, যাহার উপর এই শতাংশ প্রযোজ্য।
      </p>

      {result.phases[2]?.note ? (
        <p className="mt-2 text-small text-ink-muted">{result.phases[2].note}</p>
      ) : null}

      <p className="mt-3 rounded-control border border-border bg-surface-sunken px-3 py-2.5 text-small text-ink-muted">
        <span className="font-medium text-ink">বকেয়া:</span> অনুচ্ছেদ ১(৩)(ঘ) অনুযায়ী
        ১ জুলাই ২০২৬ হইতে আদেশ জারির তারিখ (১৭ সেপ্টেম্বর ২০২৬) পর্যন্ত সময়ের বেতন
        বকেয়া হিসাবে প্রাপ্য। এই সময়ে আহরিত বিশেষ সুবিধা উক্ত বকেয়ার সহিত সমন্বয় হইবে।
      </p>

      <Source source={REF.phase1} />
    </Card>
  );
}

/** A compact version used on the grade landing pages. */
export function ResultSummary({ result }: { result: FixationResult }) {
  if (!result.ok || result.newBasic === null) return null;
  return (
    <div className="grid gap-2.5 sm:grid-cols-3">
      <Stat label="প্রারম্ভিক Basic (২০১৫)" value={taka(result.input.currentBasic)} />
      <Stat label="নির্ধারিত Basic (২০২৬)" value={taka(result.newBasic)} tone="accent" />
      <Stat
        label="বৃদ্ধি"
        value={taka(result.monthlyIncrease)}
        hint={`${percentBn(result.percentIncrease)} — মাসিক ${formatBn(result.monthlyIncrease ?? 0)}`}
      />
    </div>
  );
}
