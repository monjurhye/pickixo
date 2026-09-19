'use client';

import { useMemo, useState } from 'react';
import { checkFixation } from '@/lib/payscale/checker';
import { GRADES_LIST, getScale2015 } from '@/lib/payscale/payScale';
import { fromBnDigits, gradeLabel, taka, toBnDigits } from '@/lib/payscale/format';
import { SalaryFixationDetails } from './SalaryFixationDetails';
import { Card, Field, Stat, Warnings, buttonClass, inputClass, selectClass } from './Ui';
import type { CheckerInput } from '@/lib/payscale/checker';
import type { Grade } from '@/lib/payscale/types';

/**
 * "আমার বেতন ঠিক আছে কি?"
 *
 * The verdict wording is deliberate and tested: a mismatch is reported as a
 * difference between two calculations, never as an error by the government.
 * The authoritative document is the accounts office's verified বেতন নির্ধারণী
 * বিবরণী (অনুচ্ছেদ ৩২), and this tool does not see the inputs that most often
 * explain a gap — a higher grade, an advance increment, a promotion.
 */
export function CalculationChecker() {
  const [grade, setGrade] = useState('');
  const [basic, setBasic] = useState('');
  const [reported, setReported] = useState('');
  const [submitted, setSubmitted] = useState<CheckerInput | null>(null);

  const gradeNumber = grade === '' ? null : Number(grade);
  const scale = gradeNumber ? getScale2015(gradeNumber) : null;
  const result = useMemo(() => (submitted ? checkFixation(submitted) : null), [submitted]);

  return (
    <div className="space-y-5">
      <Card>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted({
              grade: (gradeNumber ?? Number.NaN) as Grade,
              currentBasic: basic === '' ? Number.NaN : Number(fromBnDigits(basic)),
              category: 'regular',
              reportedBasic: reported === '' ? Number.NaN : Number(fromBnDigits(reported)),
            });
          }}
        >
          <Field label="Grade" htmlFor="chk-grade" required>
            <select id="chk-grade" className={selectClass} value={grade}
                    onChange={(e) => { setGrade(e.target.value); setBasic(''); }}>
              <option value="">— নির্বাচন করুন —</option>
              {GRADES_LIST.map((g) => <option key={g.grade} value={g.grade}>{gradeLabel(g.grade)}</option>)}
            </select>
          </Field>

          {scale && !scale.fixed ? (
            <Field label="২০১৫ স্কেলের ধাপ" htmlFor="chk-step">
              <select id="chk-step" className={selectClass}
                      value={scale.steps.includes(Number(fromBnDigits(basic))) ? String(Number(fromBnDigits(basic))) : ''}
                      onChange={(e) => setBasic(e.target.value)}>
                <option value="">— ধাপ নির্বাচন করুন, অথবা নিচে অঙ্ক লিখুন —</option>
                {scale.steps.map((s, i) => (
                  <option key={s} value={s}>ধাপ {toBnDigits(i + 1)} — {taka(s)}</option>
                ))}
              </select>
            </Field>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="২০১৫ স্কেলের Basic (৩০ জুন ২০২৬)" htmlFor="chk-basic" required>
              <input id="chk-basic" inputMode="numeric" className={inputClass}
                     value={basic} onChange={(e) => setBasic(e.target.value)} placeholder="যেমন: ১৬৮০০" />
            </Field>
            <Field label="আপনাকে যে ২০২৬ Basic জানানো হইয়াছে" htmlFor="chk-reported" required
                   hint="বেতন নির্ধারণী বিবরণী বা অফিস হইতে প্রাপ্ত অঙ্ক">
              <input id="chk-reported" inputMode="numeric" className={inputClass}
                     value={reported} onChange={(e) => setReported(e.target.value)} placeholder="যেমন: ৩৫৩০০" />
            </Field>
          </div>

          <button type="submit" className={buttonClass}>মিলাইয়া দেখুন</button>
        </form>
      </Card>

      {result ? (
        <>
          <Card className={
            result.matches === null ? '' : result.matches ? 'border-success/30 bg-success/5' : 'border-warning/35 bg-warning/5'
          }>
            <h3 className="text-subheading text-ink">ফলাফল</h3>
            <p className="mt-2 text-body text-ink">{result.verdict}</p>

            {result.ok ? (
              <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                <Stat label="অনুচ্ছেদ ৫ অনুযায়ী নির্ধারিত" value={taka(result.expectedFixedBasic)} />
                <Stat label="বেতনবৃদ্ধিসহ (অনুচ্ছেদ ৯(২))" value={taka(result.expectedNewBasic)} tone="accent" />
                <Stat label="আপনার দেওয়া অঙ্ক" value={taka(result.reportedBasic)}
                      hint={result.difference !== null && result.difference !== 0
                        ? `পার্থক্য ${taka(Math.abs(result.difference))}` : 'মিলিয়াছে'} />
              </div>
            ) : null}
          </Card>

          {result.ok ? <SalaryFixationDetails result={result.fixation} /> : null}
          <Warnings items={result.warnings} title="বিবেচ্য বিষয়" />
        </>
      ) : null}
    </div>
  );
}
