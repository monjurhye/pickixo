'use client';

import { useEffect, useMemo, useState } from 'react';
import { fixSalary } from '@/lib/payscale/salaryFixation';
import { getScale2015, specialFixedPay, GRADES_LIST } from '@/lib/payscale/payScale';
import { findGradesForBasic } from '@/lib/payscale/validation';
import { encodeFixation, decodeFixation } from '@/lib/payscale/share';
import { formatBn, fromBnDigits, gradeLabel, taka, toBnDigits } from '@/lib/payscale/format';
import { SalaryResult } from './SalaryResult';
import { FirstAppointmentCalculator } from './FirstAppointmentCalculator';
import {
  Card, Field, ModeSwitch, Warnings, buttonClass, inputClass, secondaryButtonClass, selectClass,
} from './Ui';
import type { EmployeeCategory, FixationInput, Grade } from '@/lib/payscale/types';

/**
 * The main pay-fixation form.
 *
 * Two decisions worth naming:
 *
 * **Nothing is pre-selected.** Grade starts empty rather than at 1, because a
 * default grade produces a confident wrong answer for anyone who does not
 * notice it. The order's own instruction — ask rather than assume — is easier
 * to keep in a form that starts blank.
 *
 * **The step picker is the primary input.** Most people know which step of the
 * 2015 scale they are on better than they know the exact taka figure, and
 * picking a step removes a whole class of typos. Typing an amount is still
 * allowed, and an amount that is not a printed step is warned about rather
 * than corrected.
 */

const CATEGORIES: { value: EmployeeCategory; label: string }[] = [
  { value: 'regular', label: 'নিয়মিত কর্মরত' },
  { value: 'promoted-2026-07-01', label: '১ জুলাই ২০২৬ তারিখে পদোন্নতি পাইয়াছেন' },
  { value: 'deputation', label: 'প্রেষণে কর্মরত' },
  { value: 'on-leave', label: '১ জুলাই ২০২৬ তারিখে ছুটিতে ছিলেন' },
  { value: 'prl', label: 'অবসর-উত্তর ছুটিতে (পিআরএল)' },
  { value: 'retiring-2026-07-01', label: '১ জুলাই ২০২৬ তারিখে অবসরে যাইতেছেন' },
  { value: 'suspended', label: 'সাময়িকভাবে বরখাস্ত' },
];

export function SalaryCalculator({ initialQuery }: { initialQuery?: Record<string, string> }) {
  const [mode, setMode] = useState<'existing' | 'new-joiner'>('existing');
  const shared = useMemo(() => (initialQuery ? decodeFixation(initialQuery) : {}), [initialQuery]);

  const [grade, setGrade] = useState<string>(shared.grade ? String(shared.grade) : '');
  const [basic, setBasic] = useState<string>(shared.currentBasic ? String(shared.currentBasic) : '');
  const [category, setCategory] = useState<EmployeeCategory>(shared.category ?? 'regular');
  const [fixedPost, setFixedPost] = useState<string>(shared.specialFixedPayId ?? '');
  const [specialBenefit, setSpecialBenefit] = useState<string>(
    shared.specialBenefitAmount ? String(shared.specialBenefitAmount) : '',
  );
  const [qualifying, setQualifying] = useState<string>(
    shared.qualifyingServiceMonths !== undefined ? String(shared.qualifyingServiceMonths) : '',
  );
  const [submitted, setSubmitted] = useState<FixationInput | null>(null);
  const [copied, setCopied] = useState(false);

  // A link that was shared already contains a complete calculation, so show it
  // rather than making the recipient press the button again.
  useEffect(() => {
    if (shared.grade && shared.currentBasic) {
      setSubmitted({
        grade: shared.grade,
        currentBasic: shared.currentBasic,
        category: shared.category ?? 'regular',
        ...(shared.specialFixedPayId ? { specialFixedPayId: shared.specialFixedPayId } : {}),
        ...(shared.specialBenefitAmount ? { specialBenefitAmount: shared.specialBenefitAmount } : {}),
        ...(shared.qualifyingServiceMonths !== undefined
          ? { qualifyingServiceMonths: shared.qualifyingServiceMonths } : {}),
      });
    }
  }, [shared]);

  const gradeNumber = grade === '' ? null : Number(grade);
  const scale = gradeNumber ? getScale2015(gradeNumber) : null;
  const basicNumber = basic === '' ? null : Number(fromBnDigits(basic));

  // Live hint while typing: which grades could this amount belong to?
  const finderHint = useMemo(() => {
    if (grade !== '' || basicNumber === null || !Number.isFinite(basicNumber)) return null;
    const { candidates } = findGradesForBasic(basicNumber);
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return `এই অঙ্কটি ${gradeLabel(candidates[0] as number)} এর একটি ধাপ।`;
    return `একাধিক সম্ভাব্য গ্রেড পাওয়া গেছে: ${candidates.map(gradeLabel).join(', ')}। আরও তথ্য প্রয়োজন — গ্রেড নির্বাচন করুন।`;
  }, [grade, basicNumber]);

  const result = useMemo(() => (submitted ? fixSalary(submitted) : null), [submitted]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsedBasic = basic === '' ? Number.NaN : Number(fromBnDigits(basic));
    const next: FixationInput = {
      grade: (gradeNumber ?? Number.NaN) as Grade,
      currentBasic: parsedBasic,
      category,
      ...(fixedPost ? { specialFixedPayId: fixedPost } : {}),
      ...(specialBenefit ? { specialBenefitAmount: Number(fromBnDigits(specialBenefit)) } : {}),
      ...(qualifying !== '' ? { qualifyingServiceMonths: Number(fromBnDigits(qualifying)) } : {}),
    };
    setSubmitted(next);
  }

  function reset() {
    setGrade(''); setBasic(''); setCategory('regular'); setFixedPost('');
    setSpecialBenefit(''); setQualifying(''); setSubmitted(null);
  }

  async function copyLink() {
    if (!submitted) return;
    const url = `${window.location.origin}${window.location.pathname}?${encodeFixation(submitted)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const modeSwitch = (
    <ModeSwitch
      label="কর্মচারীর ধরন"
      value={mode}
      onChange={setMode}
      options={[
        { value: 'existing', title: 'বিদ্যমান কর্মচারী', sub: '৩০ জুন ২০২৬ পর্যন্ত চাকরিতে আছেন' },
        { value: 'new-joiner', title: 'নূতন নিয়োগ', sub: '১ জুলাই ২০২৬ বা তাহার পরে যোগদান' },
      ] as const}
    />
  );

  if (mode === 'new-joiner') {
    return (
      <div className="space-y-5">
        {modeSwitch}
        <FirstAppointmentCalculator />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {modeSwitch}
      <Card className="ps-no-print">
        <form onSubmit={submit} className="space-y-5">
          <div>
            <h2 className="text-subheading text-ink">আপনার তথ্য দিন</h2>
            <p className="mt-0.5 text-small text-ink-muted">
              গ্রেড ও ৩০ জুন ২০২৬ তারিখের মূল বেতন দিলেই নতুন বেতন দেখা যাইবে।
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="বর্তমান গ্রেড" htmlFor="ps-grade" required
                   hint="৩০ জুন ২০২৬ তারিখে আপনার পদের গ্রেড">
              <select id="ps-grade" className={selectClass} value={grade}
                      onChange={(e) => { setGrade(e.target.value); setBasic(''); }}>
                <option value="">— নির্বাচন করুন —</option>
                {GRADES_LIST.map((g) => (
                  <option key={g.grade} value={g.grade}>
                    {gradeLabel(g.grade)} — {toBnDigits(g.minimum)}
                    {g.minimum === g.maximum ? ' (নির্ধারিত)' : `–${toBnDigits(g.maximum)}`}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="বর্তমান বেতনস্কেল (২০১৫)" htmlFor="ps-scale"
                   hint="গ্রেড বাছিলে নিজে নিজে আসিবে">
              <input id="ps-scale" readOnly tabIndex={-1}
                     className={`${inputClass} cursor-default bg-surface-sunken text-ink-muted`}
                     value={scale ? `${toBnDigits(scale.minimum)}–${toBnDigits(scale.maximum)}` : ''}
                     placeholder="—" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {scale && !scale.fixed ? (
              <Field label="বর্তমান ধাপ" htmlFor="ps-step"
                     hint="জানা থাকিলে এখান হইতে বাছুন">
                <select id="ps-step" className={selectClass}
                        value={basicNumber !== null && scale.steps.includes(basicNumber) ? String(basicNumber) : ''}
                        onChange={(e) => setBasic(e.target.value)}>
                  <option value="">— ধাপ বাছুন —</option>
                  {scale.steps.map((s, i) => (
                    <option key={s} value={s}>
                      ধাপ {toBnDigits(i + 1)} — {taka(s)}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <div className={scale && !scale.fixed ? undefined : 'sm:col-span-2'}>
              <Field label="মূল বেতন (৩০ জুন ২০২৬)" htmlFor="ps-basic" required
                     hint="শুধু মূল বেতন — বাড়ি ভাড়া, চিকিৎসা বা অন্য ভাতা যোগ করিবেন না">
                <input id="ps-basic" inputMode="numeric" className={inputClass}
                       value={basic} onChange={(e) => setBasic(e.target.value)}
                       placeholder="যেমন: ১৬০০০" />
              </Field>
            </div>
          </div>

          {finderHint ? (
            <p className="rounded-control border border-border bg-surface-sunken px-3 py-2 text-small text-ink-muted">
              {finderHint}
            </p>
          ) : null}

          <Field label="আপনার অবস্থা" htmlFor="ps-category"
                 hint="১ জুলাই ২০২৬ তারিখে আপনি কোন অবস্থায় ছিলেন">
            <select id="ps-category" className={selectClass} value={category}
                    onChange={(e) => setCategory(e.target.value as EmployeeCategory)}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>

          <details className="group rounded-control border border-border bg-surface-sunken">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3
                                text-small font-medium text-ink marker:hidden">
              অতিরিক্ত তথ্য (ঐচ্ছিক)
              <span aria-hidden="true" className="text-ink-subtle transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="space-y-4 border-t border-border px-3.5 py-4">
              <Field label="২০১৫ সালের বিশেষ সুবিধা" htmlFor="ps-benefit"
                     hint="৩০ জুন ২০২৬ তারিখে যে অঙ্ক পাইতেন। ইহা বেতন নির্ধারণে যোগ বা বিয়োগ হয় না।">
                <input id="ps-benefit" inputMode="numeric" className={inputClass}
                       value={specialBenefit} onChange={(e) => setSpecialBenefit(e.target.value)}
                       placeholder="যেমন: ৮০০" />
              </Field>

              <Field label="চাকরির মেয়াদ (মাস)" htmlFor="ps-qualifying"
                     hint="নূতন যোগদানকারী হইলে লিখুন। ৬ মাসের কম হইলে ১ জুলাই ২০২৬ এর বেতনবৃদ্ধি প্রাপ্য নহেন।">
                <input id="ps-qualifying" inputMode="numeric" className={inputClass}
                       value={qualifying} onChange={(e) => setQualifying(e.target.value)}
                       placeholder="খালি রাখিলে নিয়মিত কর্মচারী ধরা হইবে" />
              </Field>

              <Field label="নির্ধারিত বেতনের পদ" htmlFor="ps-fixed"
                     hint="অনুচ্ছেদ ৩(২) এর অধীন পদ হইলে বাছুন">
                <select id="ps-fixed" className={selectClass} value={fixedPost}
                        onChange={(e) => setFixedPost(e.target.value)}>
                  <option value="">— প্রযোজ্য নয় —</option>
                  {specialFixedPay().map((p) => (
                    <option key={p.id} value={p.id}>{p.posts} — {taka(p.amount)}</option>
                  ))}
                </select>
              </Field>
            </div>
          </details>

          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
            <button type="submit" className={`${buttonClass} w-full sm:w-auto`}>বেতন হিসাব করুন</button>
            {submitted ? (
              <>
                <button type="button" onClick={reset} className={secondaryButtonClass}>নূতন হিসাব</button>
                <button type="button" onClick={copyLink} className={secondaryButtonClass}>
                  {copied ? 'লিংক কপি হইয়াছে' : 'লিংক কপি করুন'}
                </button>
                <button type="button" onClick={() => window.print()} className={secondaryButtonClass}>
                  প্রিন্ট / PDF
                </button>
              </>
            ) : null}
          </div>
        </form>
      </Card>

      {result ? <SalaryResult result={result} /> : null}

      {!result ? (
        <Warnings items={[{
          code: 'NO_ASSUMPTIONS',
          level: 'info',
          message: 'এই ক্যালকুলেটর কোনও তথ্য অনুমান করে না — গ্রেড, ধাপ, সুবিধা বা বিভাগ কিছুই আগে হইতে ধরা নাই।',
          action: 'তথ্য অসম্পূর্ণ হইলে ফলাফলের বদলে কী তথ্য প্রয়োজন তাহা জানানো হইবে।',
        }]} />
      ) : null}
    </div>
  );
}
