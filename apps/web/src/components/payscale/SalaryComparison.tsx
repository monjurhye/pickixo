'use client';

import { useMemo, useState } from 'react';
import { fixSalary } from '@/lib/payscale/salaryFixation';
import { calculateAllowances, houseRentPercent } from '@/lib/payscale/allowanceCalculator';
import { GRADES_LIST, getScale2015 } from '@/lib/payscale/payScale';
import { difference } from '@/lib/payscale/salaryCalculator';
import { fromBnDigits, gradeLabel, percentBn, taka, toBnDigits } from '@/lib/payscale/format';
import { Card, Field, Stat, Warnings, buttonClass, inputClass, selectClass } from './Ui';
import type { Grade } from '@/lib/payscale/types';
import type { HouseRentZone } from '@/lib/payscale/allowanceCalculator';

/**
 * 2015 vs 2026.
 *
 * The comparison separates basic from gross on purpose. Basic changes on
 * 1 July 2026; the allowance *rates* in this order do not take effect until
 * 1 January 2028, and until then allowances stay at their 30 June 2026 amounts
 * (অনুচ্ছেদ ১(৩)(ঞ)). A single "your salary rises by X%" number would blur two
 * things that happen eighteen months apart, so there isn't one.
 *
 * The 2015 gross column is only filled in where the user supplies their actual
 * allowance figures — this order repeals the 2015 one and does not restate its
 * rates, so they cannot be derived here.
 */
export function SalaryComparison() {
  const [grade, setGrade] = useState('');
  const [basic, setBasic] = useState('');
  const [zone, setZone] = useState<HouseRentZone>('other');
  const [oldAllowances, setOldAllowances] = useState('');
  const [ran, setRan] = useState(false);

  const gradeNumber = grade === '' ? null : Number(grade);
  const scale = gradeNumber ? getScale2015(gradeNumber) : null;

  const data = useMemo(() => {
    if (!ran || gradeNumber === null) return null;
    const basicNumber = Number(fromBnDigits(basic));
    if (!Number.isFinite(basicNumber) || basicNumber <= 0) return null;

    const fixation = fixSalary({
      grade: gradeNumber as Grade, currentBasic: basicNumber, category: 'regular',
    });
    if (!fixation.ok || fixation.newBasic === null) return { fixation, allowances: null };

    const allowances = calculateAllowances({
      grade: gradeNumber as Grade, basic: fixation.newBasic, houseRentZone: zone,
    });
    return { fixation, allowances };
  }, [ran, gradeNumber, basic, zone]);

  return (
    <div className="space-y-5">
      <Card>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setRan(true); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Grade" htmlFor="cmp-grade" required>
              <select id="cmp-grade" className={selectClass} value={grade}
                      onChange={(e) => { setGrade(e.target.value); setBasic(''); }}>
                <option value="">— নির্বাচন করুন —</option>
                {GRADES_LIST.map((g) => <option key={g.grade} value={g.grade}>{gradeLabel(g.grade)}</option>)}
              </select>
            </Field>
            <Field label="২০১৫ স্কেলের Basic" htmlFor="cmp-basic" required>
              {scale && !scale.fixed ? (
                <select id="cmp-basic" className={selectClass} value={basic}
                        onChange={(e) => setBasic(e.target.value)}>
                  <option value="">— ধাপ নির্বাচন করুন —</option>
                  {scale.steps.map((s, i) => (
                    <option key={s} value={s}>ধাপ {toBnDigits(i + 1)} — {taka(s)}</option>
                  ))}
                </select>
              ) : (
                <input id="cmp-basic" inputMode="numeric" className={inputClass}
                       value={basic} onChange={(e) => setBasic(e.target.value)} />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="কর্মস্থলের এলাকা" htmlFor="cmp-zone" hint="২০২৬ এর বাড়ি ভাড়ার হারের জন্য">
              <select id="cmp-zone" className={selectClass} value={zone}
                      onChange={(e) => setZone(e.target.value as HouseRentZone)}>
                <option value="dhaka">ঢাকা সিটি কর্পোরেশন</option>
                <option value="major-city">অন্যান্য সিটি কর্পোরেশন ও সাভার/কক্সবাজার পৌর এলাকা</option>
                <option value="other">অন্যান্য স্থান</option>
              </select>
            </Field>
            <Field label="বর্তমানে আহরিত মোট ভাতা (ঐচ্ছিক)" htmlFor="cmp-old-allow"
                   hint="২০১৫ আদেশের ভাতার হার এই গেজেটে নাই — জানা থাকিলে নিজে লিখুন">
              <input id="cmp-old-allow" inputMode="numeric" className={inputClass}
                     value={oldAllowances} onChange={(e) => setOldAllowances(e.target.value)} />
            </Field>
          </div>

          <button type="submit" className={buttonClass}>তুলনা করুন</button>
        </form>
      </Card>

      {data?.fixation.ok && data.fixation.newBasic !== null ? (
        <ComparisonResult
          grade={gradeNumber as Grade}
          zone={zone}
          fixation={data.fixation}
          newAllowanceTotal={(data.allowances?.lines ?? []).reduce((sum, l) => sum + l.amount, 0)}
          oldAllowanceTotal={oldAllowances === '' ? null : Number(fromBnDigits(oldAllowances))}
        />
      ) : null}

      {data ? <Warnings items={data.fixation.warnings} /> : null}
    </div>
  );
}

function ComparisonResult({
  grade, zone, fixation, newAllowanceTotal, oldAllowanceTotal,
}: {
  grade: Grade;
  zone: HouseRentZone;
  fixation: ReturnType<typeof fixSalary>;
  newAllowanceTotal: number;
  oldAllowanceTotal: number | null;
}) {
  const oldBasic = fixation.input.currentBasic;
  const newBasic = fixation.newBasic ?? 0;
  const basicDiff = difference(oldBasic, newBasic);

  const oldGross = oldAllowanceTotal === null ? null : oldBasic + oldAllowanceTotal;
  const newGross = newBasic + newAllowanceTotal;
  const grossDiff = oldGross === null ? null : difference(oldGross, newGross);

  const rows: { label: string; old: string; fresh: string; note?: string }[] = [
    { label: 'Grade', old: gradeLabel(grade), fresh: gradeLabel(grade), note: 'অনুরূপ স্কেল এক-এক (১:১)' },
    {
      label: 'Scale',
      old: fixation.oldScale ? `${toBnDigits(fixation.oldScale.minimum)}–${toBnDigits(fixation.oldScale.maximum)}` : '—',
      fresh: fixation.newScale ? `${toBnDigits(fixation.newScale.minimum)}–${toBnDigits(fixation.newScale.maximum)}` : '—',
    },
    { label: 'Basic', old: taka(oldBasic), fresh: taka(newBasic), note: 'অনুচ্ছেদ ৫ + ৯(২)' },
    {
      label: 'Benefit (বিশেষ সুবিধা)',
      old: 'আহরিত হইত',
      fresh: 'বিলুপ্ত',
      note: 'অনুচ্ছেদ ১(৩)(ট) — বকেয়ার সহিত সমন্বয়যোগ্য',
    },
    {
      label: 'বাড়ি ভাড়ার হার',
      old: 'এই গেজেটে উল্লেখ নাই',
      fresh: `মূল বেতনের ${toBnDigits(houseRentPercent(grade, zone) ?? 0)}%`,
      note: '১ জানুয়ারি ২০২৮ হইতে কার্যকর',
    },
    {
      label: 'Gross (মাসিক)',
      old: oldGross === null ? 'তথ্য প্রয়োজন' : taka(oldGross),
      fresh: taka(newGross),
      note: '২০২৬ এর ভাতা ১ জানুয়ারি ২০২৮ হইতে',
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-subheading text-ink">২০১৫ বনাম ২০২৬</h3>
        <div className="mt-3 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[32rem] border-collapse text-small">
            <thead>
              <tr className="border-b border-border-strong text-left text-micro text-ink-subtle">
                <th scope="col" className="py-2 pr-3 font-medium">বিষয়</th>
                <th scope="col" className="py-2 pr-3 font-medium">২০১৫</th>
                <th scope="col" className="py-2 font-medium">২০২৬</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-border align-top last:border-0">
                  <th scope="row" className="py-2.5 pr-3 text-left font-medium text-ink">
                    {row.label}
                    {row.note ? <span className="block text-micro font-normal text-ink-subtle">{row.note}</span> : null}
                  </th>
                  <td className="py-2.5 pr-3 font-bengali tabular-nums text-ink-muted">{row.old}</td>
                  <td className="py-2.5 font-bengali tabular-nums text-ink">{row.fresh}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h3 className="text-subheading text-ink">Basic salary increase</h3>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          <Stat label="মাসিক পার্থক্য" value={taka(basicDiff.monthly)} tone="accent" />
          <Stat label="বার্ষিক পার্থক্য" value={taka(basicDiff.annual)} />
          <Stat label="শতকরা পার্থক্য" value={percentBn(basicDiff.percent)} />
        </div>
        <p className="mt-2 text-small text-ink-muted">
          ইহা কেবল মূল বেতনের বৃদ্ধি। অনুচ্ছেদ ১(৩) অনুযায়ী এই বৃদ্ধির সম্পূর্ণ অঙ্ক
          ১ জুলাই ২০২৭ তারিখ হইতে প্রদেয়।
        </p>
      </Card>

      <Card>
        <h3 className="text-subheading text-ink">Gross salary increase</h3>
        {grossDiff ? (
          <>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              <Stat label="মাসিক পার্থক্য" value={taka(grossDiff.monthly)} />
              <Stat label="বার্ষিক পার্থক্য" value={taka(grossDiff.annual)} />
              <Stat label="শতকরা পার্থক্য" value={percentBn(grossDiff.percent)} />
            </div>
            <p className="mt-2 text-small text-ink-muted">
              ২০১৫ এর গ্রস আপনার দেওয়া ভাতার অঙ্কের ভিত্তিতে — “ব্যবহারকারীর দেওয়া পরিমাণ”।
              ২০২৬ এর ভাতা ১ জানুয়ারি ২০২৮ হইতে কার্যকর, তাই এই তুলনা ঐ তারিখের পরের অবস্থা দেখায়।
            </p>
          </>
        ) : (
          <p className="mt-2 text-small text-ink-muted">
            গ্রস বেতনের তুলনা করিতে হইলে ২০১৫ স্কেলে আপনি বর্তমানে যে মোট ভাতা আহরণ করেন তাহা
            লিখিতে হইবে। এই গেজেট ২০১৫ আদেশের ভাতার হার পুনরায় উল্লেখ করে নাই, তাই উহা এখান হইতে
            নির্ণয় করা সম্ভব নয়।
          </p>
        )}
      </Card>
    </div>
  );
}
