'use client';

import { useMemo, useState } from 'react';
import { calculateIncrement } from '@/lib/payscale/incrementCalculator';
import { GRADES_LIST, getScale2026 } from '@/lib/payscale/payScale';
import { formatDateBn, fromBnDigits, gradeLabel, percentBn, taka, toBnDigits } from '@/lib/payscale/format';
import { Card, Field, Source, Stat, Warnings, buttonClass, inputClass, selectClass } from './Ui';
import { REF } from '@/lib/payscale/sourceReference';
import type { Grade } from '@/lib/payscale/types';

/**
 * Increment calculator — অনুচ্ছেদ ৯.
 *
 * Shows the increment as an amount *and* as a percentage, but the percentage
 * is labelled as derived, not as a rule: the order fixes no increment rate at
 * all, and the effective percentage is different at every step of every scale.
 * Anyone who has been told "increments are 5%" should be able to see here that
 * their own step is not exactly that.
 */
export function IncrementCalculator() {
  const [grade, setGrade] = useState('');
  const [basic, setBasic] = useState('');
  const [year, setYear] = useState('2027');
  const [submitted, setSubmitted] = useState<{ grade: Grade; basic: number; year: number } | null>(null);

  const gradeNumber = grade === '' ? null : Number(grade);
  const scale = gradeNumber ? getScale2026(gradeNumber) : null;

  const result = useMemo(
    () => (submitted
      ? calculateIncrement({
          grade: submitted.grade,
          currentBasic: submitted.basic,
          nextIncrementYear: submitted.year,
        })
      : null),
    [submitted],
  );

  return (
    <div className="space-y-5">
      <Card>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted({
              grade: (gradeNumber ?? Number.NaN) as Grade,
              basic: basic === '' ? Number.NaN : Number(fromBnDigits(basic)),
              year: Number(year) || 2027,
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Grade" htmlFor="inc-grade" required>
              <select id="inc-grade" className={selectClass} value={grade}
                      onChange={(e) => { setGrade(e.target.value); setBasic(''); }}>
                <option value="">— নির্বাচন করুন —</option>
                {GRADES_LIST.map((g) => (
                  <option key={g.grade} value={g.grade}>{gradeLabel(g.grade)}</option>
                ))}
              </select>
            </Field>

            <Field label="পরবর্তী বেতনবৃদ্ধির অর্থবছর" htmlFor="inc-year"
                   hint="অনুচ্ছেদ ৯(১): তারিখ সর্বদা ১ জুলাই">
              <select id="inc-year" className={selectClass} value={year}
                      onChange={(e) => setYear(e.target.value)}>
                {[2027, 2028, 2029, 2030].map((y) => (
                  <option key={y} value={y}>{formatDateBn(`${y}-07-01`)}</option>
                ))}
              </select>
            </Field>
          </div>

          {scale && !scale.fixed ? (
            <Field label="বর্তমান Stage (২০২৬ স্কেলের ধাপ)" htmlFor="inc-step">
              <select id="inc-step" className={selectClass}
                      value={scale.steps.includes(Number(fromBnDigits(basic))) ? String(Number(fromBnDigits(basic))) : ''}
                      onChange={(e) => setBasic(e.target.value)}>
                <option value="">— ধাপ নির্বাচন করুন, অথবা নিচে অঙ্ক লিখুন —</option>
                {scale.steps.map((s, i) => (
                  <option key={s} value={s}>ধাপ {toBnDigits(i + 1)} — {taka(s)}</option>
                ))}
              </select>
            </Field>
          ) : null}

          <Field label="বর্তমান Basic (২০২৬ স্কেলে)" htmlFor="inc-basic" required>
            <input id="inc-basic" inputMode="numeric" className={inputClass}
                   value={basic} onChange={(e) => setBasic(e.target.value)}
                   placeholder="যেমন: ৩২০০০" />
          </Field>

          <button type="submit" className={buttonClass}>বেতনবৃদ্ধি হিসাব করুন</button>
        </form>
      </Card>

      {result ? (
        <>
          {result.ok && !result.atMaximum ? (
            <Card>
              <h3 className="text-subheading text-ink">বার্ষিক বেতনবৃদ্ধি</h3>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                <Stat label="বর্তমান Basic" value={taka(result.currentBasic)}
                      hint={result.currentStepIndex !== null
                        ? `ধাপ ${toBnDigits(result.currentStepIndex + 1)}` : undefined} />
                <Stat label="বেতনবৃদ্ধির পরিমাণ" value={taka(result.incrementAmount)} tone="accent"
                      hint={result.incrementAmount !== null
                        ? `কার্যত ${percentBn((result.incrementAmount / result.currentBasic) * 100)} — গেজেটে কোনও হার নির্ধারিত নাই`
                        : undefined} />
                <Stat label="পরবর্তী Basic" value={taka(result.nextBasic)} />
                <Stat label="বেতনবৃদ্ধির তারিখ" value={formatDateBn(result.incrementDate)}
                      hint="প্রতি অর্থ বৎসর শুরুর প্রথম দিবস" />
              </div>

              <p className="mt-3 text-small text-ink-muted">
                এই গ্রেডে আরও {toBnDigits(result.remainingSteps ?? 0)}টি ধাপ বাকি আছে; সর্বোচ্চ Basic{' '}
                <span className="font-bengali tabular-nums">{taka(getScale2026(result.grade)?.maximum ?? 0)}</span>।
              </p>

              {result.projection.length > 0 ? (
                <div className="mt-4">
                  <h4 className="text-small font-semibold text-ink">পরবর্তী কয়েক বৎসর</h4>
                  <ul className="mt-2 divide-y divide-border border-y border-border">
                    {result.projection.map((p) => (
                      <li key={p.date} className="flex items-baseline justify-between gap-4 py-2 text-small">
                        <span className="text-ink-muted">{formatDateBn(p.date)}</span>
                        <span className="font-bengali tabular-nums text-ink">{taka(p.basic)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-micro text-ink-subtle">
                    ধরা হইয়াছে প্রতি ১ জুলাই একটি করিয়া ধাপ অগ্রসর হইবে এবং কোনও পদোন্নতি বা
                    উচ্চতর গ্রেড হইবে না।
                  </p>
                </div>
              ) : null}

              <Source source={REF.incrementDate} />
            </Card>
          ) : null}

          <Warnings items={result.warnings} />
        </>
      ) : null}
    </div>
  );
}
