'use client';

import { useMemo, useState } from 'react';
import { buildAuditTrail, auditTrailToJson } from '@/lib/payscale/auditTrail';
import { citationLine } from '@/lib/payscale/sourceReference';
import { taka, toBnDigits } from '@/lib/payscale/format';
import { secondaryButtonClass } from './Ui';
import type { FixationResult } from '@/lib/payscale/types';

/**
 * The audit trail, rendered.
 *
 * Collapsed by default because most people want the number, and open in one
 * click because the people who need this — someone whose fixation came back
 * different from what they expected — need all of it, including the JSON they
 * can hand to an accounts officer.
 */
export function AuditTrailView({ result }: { result: FixationResult }) {
  const trail = useMemo(() => buildAuditTrail(result), [result]);
  const [copied, setCopied] = useState(false);

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(auditTrailToJson(trail));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <details className="group rounded-card border border-border bg-surface">
      <summary className="cursor-pointer list-none px-4 py-3.5 text-subheading text-ink marker:hidden">
        <span className="flex items-center justify-between gap-4">
          হিসাবের পূর্ণ বিবরণ (Audit Trail)
          <span aria-hidden="true" className="shrink-0 text-ink-subtle transition-transform group-open:rotate-45">+</span>
        </span>
      </summary>

      <div className="space-y-4 border-t border-border px-4 py-4">
        <section>
          <h4 className="text-small font-semibold text-ink">প্রদত্ত তথ্য</h4>
          <dl className="mt-1.5 space-y-1 text-small">
            <Row label="গ্রেড" value={toBnDigits(trail.input.grade)} />
            <Row label="৩০ জুন ২০২৬ তারিখের মূল বেতন" value={taka(trail.input.currentBasic)} />
            <Row label="কর্মচারীর অবস্থা" value={trail.input.category} />
            {trail.input.specialBenefitAmount ? (
              <Row label="আহরিত বিশেষ সুবিধা" value={taka(trail.input.specialBenefitAmount)} />
            ) : null}
          </dl>
        </section>

        <section>
          <h4 className="text-small font-semibold text-ink">প্রযোজ্য বিধিসমূহ</h4>
          <ul className="mt-1.5 space-y-1">
            {trail.applicableRules.map((rule) => (
              <li key={rule.ruleId} className="text-small text-ink-muted">
                <code className="rounded bg-surface-sunken px-1 py-0.5 text-micro text-ink">{rule.ruleId}</code>
                {' '}{rule.ruleName} — {rule.section}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h4 className="text-small font-semibold text-ink">বিশেষ সুবিধা সমন্বয়</h4>
          <p className="mt-1.5 text-small text-ink-muted">{trail.benefitAdjustment.treatment}</p>
        </section>

        <section>
          <h4 className="text-small font-semibold text-ink">ব্যবহৃত স্কেল</h4>
          <div className="mt-1.5 space-y-2 text-small">
            {trail.oldScale ? (
              <p className="text-ink-muted">
                <span className="text-ink">২০১৫:</span>{' '}
                <span className="font-bengali tabular-nums break-all">
                  {trail.oldScale.steps.map((s) => toBnDigits(s)).join('-')}
                </span>
              </p>
            ) : null}
            {trail.newScale ? (
              <p className="text-ink-muted">
                <span className="text-ink">২০২৬:</span>{' '}
                <span className="font-bengali tabular-nums break-all">
                  {trail.newScale.steps.map((s) => toBnDigits(s)).join('-')}
                </span>
              </p>
            ) : null}
          </div>
        </section>

        <section>
          <h4 className="text-small font-semibold text-ink">সূত্র</h4>
          <ul className="mt-1.5 space-y-1">
            {trail.sourceReferences.map((source, i) => (
              <li key={`${source.ruleId ?? source.label}-${i}`} className="text-micro text-ink-subtle">
                {source.verified ? citationLine(source) : `সূত্র যাচাই করা যায় নাই — ${source.label}`}
              </li>
            ))}
          </ul>
        </section>

        <button type="button" onClick={copyJson} className={secondaryButtonClass}>
          {copied ? 'কপি হইয়াছে' : 'JSON হিসাবে কপি করুন'}
        </button>
      </div>
    </details>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-bengali tabular-nums text-ink">{value}</dd>
    </div>
  );
}
