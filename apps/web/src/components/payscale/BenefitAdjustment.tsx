'use client';

import { Card, Source } from './Ui';
import { REF } from '@/lib/payscale/sourceReference';
import { taka } from '@/lib/payscale/format';
import benefits from '@/data/payscale/benefitRules.json';

/**
 * "২০১৫ সালের অতিরিক্ত সুবিধা / Adjustment".
 *
 * This section exists because the question it answers — "does my 10%/15%
 * special benefit get added, or taken off, when my pay is fixed?" — is the one
 * people most often get wrong, and getting it wrong changes the number by
 * thousands of taka.
 *
 * The answer from the order is narrow and worth stating plainly: বিশেষ সুবিধা is
 * abolished from 1 July 2026 and adjusted against arrears. It is not a
 * component of basic pay, it is not added before fixation and it is not
 * deducted after. The order also names no rate for it at all — so this
 * component never shows one, whatever the user types in.
 */
export function BenefitAdjustment({ amount }: { amount?: number }) {
  const rule = benefits.specialBenefit2015;
  const entered = typeof amount === 'number' && amount > 0;

  return (
    <Card className="border-warning/30 bg-warning/5">
      <h3 className="text-subheading text-ink">২০১৫ সালের অতিরিক্ত সুবিধা / Adjustment</h3>

      {entered ? (
        <dl className="mt-3 space-y-2">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-small text-ink-muted">৩০ জুন ২০২৬ তারিখে আহরিত বিশেষ সুবিধা</dt>
            <dd className="font-bengali text-small tabular-nums text-ink">{taka(amount)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-small text-ink-muted">বেতন নির্ধারণে যোগ/বিয়োগ</dt>
            <dd className="font-bengali text-small tabular-nums text-ink">{taka(0)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-warning/25 pt-2">
            <dt className="text-small font-medium text-ink">Fixation Base-এ প্রভাব</dt>
            <dd className="text-small font-medium text-ink">কোনও প্রভাব নাই</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-small text-ink">
          এই ক্ষেত্রে ১০%/১৫% অতিরিক্ত সুবিধা প্রযোজ্য নয়।
        </p>
      )}

      <div className="mt-3 space-y-2 border-t border-warning/25 pt-3">
        <p className="text-small text-ink-muted">{rule.plainAnswer}</p>
        <blockquote className="border-l-2 border-warning/40 pl-3 text-small italic text-ink-muted">
          “{rule.sourceText}”
        </blockquote>
        <p className="text-small text-ink-muted">
          <span className="font-medium text-ink">ব্যতিক্রম:</span> {rule.exception.statement}
        </p>
      </div>

      <Source source={REF.specialBenefit} />
    </Card>
  );
}

/** The claims this order does *not* support, stated once so the FAQ and the
 *  result page can both point at the same text. */
export function MythBusters() {
  return (
    <div className="space-y-3">
      {benefits.notInThisGazette.map((item) => (
        <div key={item.claim} className="rounded-control border border-border bg-surface-sunken p-3.5">
          <p className="text-small text-ink">
            <span className="mr-1.5 rounded bg-danger/10 px-1.5 py-0.5 text-micro text-danger">
              {item.verdict}
            </span>
            <span className="text-ink-muted">“{item.claim}”</span>
          </p>
          <p className="mt-2 text-small text-ink-muted">
            <span className="font-medium text-ink">গেজেটে আছে:</span> {item.whatTheGazetteActuallySays}
          </p>
        </div>
      ))}
    </div>
  );
}
