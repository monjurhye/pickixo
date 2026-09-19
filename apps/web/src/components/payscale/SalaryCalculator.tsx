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
  Card, Field, Warnings, buttonClass, inputClass, secondaryButtonClass, selectClass,
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
    <div role="tablist" aria-label="কর্মচারীর ধরন" className="ps-no-print flex flex-wrap gap-2">
      {([
        ['existing', 'বিদ্যমান কর্মচারী — অনুচ্ছেদ ৫ ও ৯'],
        ['new-joiner', 'নূতন নিয়োগ (১ জুলাই ২০২৬ বা পরে) — অনুচ্ছেদ ১০'],
      ] as const).map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={mode === value}
          onClick={() => setMode(value)}
          className={`rounded-control border px-3.5 py-2 text-small font-medium transition ${
            mode === value
              ? 'border-accent bg-accent-soft text-accent-ink'
              : 'border-border bg-surface text-ink-muted hover:border-border-strong'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
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
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="বর্তমান Grade" htmlFor="ps-grade" required
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

            <Field label="বর্তমান Pay Scale" htmlFor="ps-scale"
                   hint="গ্রেড নির্বাচন করিলে স্বয়ংক্রিয়ভাবে আসিবে">
              <input id="ps-scale" readOnly className={`${inputClass} bg-surface-sunken`}
                     value={scale ? `${toBnDigits(scale.minimum)}–${toBnDigits(scale.maximum)}` : ''}
                     placeholder="—" />
            </Field>
          </div>

          {scale && !scale.fixed ? (
            <Field label="বর্তমান Stage (ধাপ)" htmlFor="ps-step"
                   hint="২০১৫ স্কেলের কোন ধাপে আছেন — জানা থাকিলে এখান হইতে বাছুন">
              <select id="ps-step" className={selectClass}
                      value={basicNumber !== null && scale.steps.includes(basicNumber) ? String(basicNumber) : ''}
                      onChange={(e) => setBasic(e.target.value)}>
                <option value="">— ধাপ নির্বাচন করুন, অথবা নিচে অঙ্ক লিখুন —</option>
                {scale.steps.map((s, i) => (
                  <option key={s} value={s}>
                    ধাপ {toBnDigits(i + 1)} — {taka(s)}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          <Field label="বর্তমান Basic (৩০ জুন ২০২৬)" htmlFor="ps-basic" required
                 hint="শুধু মূল বেতন — বাড়ি ভাড়া, চিকিৎসা বা অন্য কোনও ভাতা যোগ করিবেন না">
            <input id="ps-basic" inputMode="numeric" className={inputClass}
                   value={basic} onChange={(e) => setBasic(e.target.value)}
                   placeholder="যেমন: ১৬০০০" />
          </Field>

          {finderHint ? (
            <p className="rounded-control border border-border bg-surface-sunken px-3 py-2 text-small text-ink-muted">
              {finderHint}
            </p>
          ) : null}

          <Field label="Employee Category" htmlFor="ps-category"
                 hint="১ জুলাই ২০২৬ তারিখে আপনার অবস্থা — অনুচ্ছেদ ৫(ঘ)–(ঝ) এ ভিন্ন বিধান রহিয়াছে">
            <select id="ps-category" className={selectClass} value={category}
                    onChange={(e) => setCategory(e.target.value as EmployeeCategory)}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>

          <details className="rounded-control border border-border bg-surface-sunken px-3.5 py-3">
            <summary className="cursor-pointer text-small font-medium text-ink">
              অতিরিক্ত তথ্য (ঐচ্ছিক)
            </summary>
            <div className="mt-3 space-y-4">
              <Field label="২০১৫ সালের অতিরিক্ত সুবিধা (বিশেষ সুবিধা)" htmlFor="ps-benefit"
                     hint="৩০ জুন ২০২৬ তারিখে যে অঙ্ক আহরণ করিতেন। ইহা বেতন নির্ধারণে যোগ বা বিয়োগ হয় না — অনুচ্ছেদ ১(৩)(ট)।">
                <input id="ps-benefit" inputMode="numeric" className={inputClass}
                       value={specialBenefit} onChange={(e) => setSpecialBenefit(e.target.value)}
                       placeholder="যেমন: ৮০০" />
              </Field>

              <Field label="কোয়ালিফাইং চাকরির মেয়াদ (মাস)" htmlFor="ps-qualifying"
                     hint="নতুন যোগদানকারী হইলে লিখুন। ৬ মাসের কম হইলে অনুচ্ছেদ ৯(২) অনুযায়ী বেতনবৃদ্ধি প্রাপ্য নহেন।">
                <input id="ps-qualifying" inputMode="numeric" className={inputClass}
                       value={qualifying} onChange={(e) => setQualifying(e.target.value)}
                       placeholder="খালি রাখিলে নিয়মিত কর্মচারী ধরা হইবে" />
              </Field>

              <Field label="নির্ধারিত বেতনের পদ" htmlFor="ps-fixed"
                     hint="অনুচ্ছেদ ৩(২) এর অধীন পদ হইলে নির্বাচন করুন">
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

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button type="submit" className={buttonClass}>বেতন হিসাব করুন</button>
            {submitted ? (
              <>
                <button type="button" onClick={reset} className={secondaryButtonClass}>নূতন হিসাব</button>
                <button type="button" onClick={copyLink} className={secondaryButtonClass}>
                  {copied ? 'লিংক কপি হইয়াছে' : 'ফলাফলের লিংক কপি করুন'}
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
