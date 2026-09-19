'use client';

import { useMemo, useState } from 'react';
import { calculateGross } from '@/lib/payscale/salaryCalculator';
import { banglaNoboborshoAllowance, houseRentBandLabel } from '@/lib/payscale/allowanceCalculator';
import { GRADES_LIST } from '@/lib/payscale/payScale';
import { fromBnDigits, gradeLabel, taka } from '@/lib/payscale/format';
import { Card, Field, Source, Stat, Warnings, buttonClass, inputClass, selectClass } from './Ui';
import { REF } from '@/lib/payscale/sourceReference';
import type { Grade } from '@/lib/payscale/types';
import type { HouseRentZone } from '@/lib/payscale/allowanceCalculator';

/**
 * Gross salary.
 *
 * Every line says where it came from. A figure the order fixes is marked as
 * such; a figure the user typed is marked "ব্যবহারকারীর দেওয়া পরিমাণ" and kept
 * visually distinct, because a gross total that mixes the two without saying so
 * looks more authoritative than it is.
 */

const ZONES: { value: HouseRentZone; label: string }[] = [
  { value: 'dhaka', label: 'ঢাকা উত্তর ও দক্ষিণ সিটি কর্পোরেশন এলাকা' },
  { value: 'major-city', label: 'খুলনা, রাজশাহী, চট্টগ্রাম, সিলেট, বরিশাল, নারায়ণগঞ্জ, কুমিল্লা, রংপুর, গাজীপুর, ময়মনসিংহ ও বগুড়া সিটি কর্পোরেশন এবং সাভার ও কক্সবাজার পৌর এলাকা' },
  { value: 'other', label: 'অন্যান্য স্থান' },
];

const USER_FIELDS = [
  { id: 'festival', name: 'উৎসব ভাতা (মাসিক ভিত্তিতে)', note: 'অনুচ্ছেদ ১৭ পূর্ববর্তী স্মারকের প্রতি নির্দেশ করিয়াছে — এই গেজেটে হার নাই' },
  { id: 'risk', name: 'ঝুঁকি ভাতা', note: 'অনুচ্ছেদ ২৯: মূল বেতনের শতাংশ হিসাবে নির্ধারিত হইবে না; অঙ্ক পৃথক স্মারকে' },
  { id: 'travel', name: 'ভ্রমণ ভাতা', note: 'অনুচ্ছেদ ১৬: প্রচলিত বিধিবিধান বলবৎ; হার পরে পুনর্নির্ধারিত হইবে' },
  { id: 'other', name: 'অন্যান্য ভাতা', note: '' },
] as const;

export function GrossSalaryCalculator({ initialBasic, initialGrade }: { initialBasic?: number; initialGrade?: Grade }) {
  const [grade, setGrade] = useState(initialGrade ? String(initialGrade) : '');
  const [basic, setBasic] = useState(initialBasic ? String(initialBasic) : '');
  const [zone, setZone] = useState<HouseRentZone | ''>('');
  const [govHouse, setGovHouse] = useState(false);
  const [age, setAge] = useState('');
  const [children, setChildren] = useState('');
  const [specialChildren, setSpecialChildren] = useState('');
  const [tiffin, setTiffin] = useState(false);
  const [transport, setTransport] = useState(false);
  const [washing, setWashing] = useState(false);
  const [charge, setCharge] = useState(false);
  const [hill, setHill] = useState<'none' | 'pahari-sadar' | 'pahari-other'>('none');
  const [haor, setHaor] = useState(false);
  const [training, setTraining] = useState(false);
  const [userAmounts, setUserAmounts] = useState<Record<string, string>>({});
  const [deductions, setDeductions] = useState<Record<string, string>>({ tax: '', gpf: '' });
  const [ran, setRan] = useState(false);

  const num = (value: string) => (value === '' ? undefined : Number(fromBnDigits(value)));

  const result = useMemo(() => {
    if (!ran) return null;
    const gradeNumber = Number(grade);
    const basicNumber = Number(fromBnDigits(basic));
    if (!Number.isFinite(gradeNumber) || !Number.isFinite(basicNumber) || basicNumber <= 0) return null;
    return calculateGross({
      grade: gradeNumber as Grade,
      basic: basicNumber,
      ...(zone && !govHouse ? { houseRentZone: zone } : {}),
      governmentAccommodation: govHouse,
      ...(num(age) !== undefined ? { ageYears: num(age) } : {}),
      ...(num(children) !== undefined ? { children: num(children) } : {}),
      ...(num(specialChildren) !== undefined ? { specialNeedsChildren: num(specialChildren) } : {}),
      tiffinEligible: tiffin,
      transportEligible: transport,
      washingEligible: washing,
      chargeAllowance: charge,
      hillArea: hill,
      haorArea: haor,
      trainingDeputation: training,
      userSupplied: USER_FIELDS
        .map((f) => ({ id: f.id, name: f.name, amount: Number(fromBnDigits(userAmounts[f.id] ?? '')) || 0 }))
        .filter((f) => f.amount > 0),
      deductions: [
        { id: 'tax', name: 'আয়কর', amount: Number(fromBnDigits(deductions.tax ?? '')) || 0 },
        { id: 'gpf', name: 'সাধারণ ভবিষ্য তহবিল (জিপিএফ)', amount: Number(fromBnDigits(deductions.gpf ?? '')) || 0 },
      ].filter((d) => d.amount > 0),
    });
  }, [ran, grade, basic, zone, govHouse, age, children, specialChildren, tiffin, transport,
      washing, charge, hill, haor, training, userAmounts, deductions]);

  const gradeNumber = grade === '' ? null : Number(grade);

  return (
    <div className="space-y-5">
      <Card>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setRan(true); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Grade" htmlFor="gs-grade" required>
              <select id="gs-grade" className={selectClass} value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="">— নির্বাচন করুন —</option>
                {GRADES_LIST.map((g) => <option key={g.grade} value={g.grade}>{gradeLabel(g.grade)}</option>)}
              </select>
            </Field>
            <Field label="Basic Pay" htmlFor="gs-basic" required hint="জাতীয় বেতনস্কেল, ২০২৬ অনুযায়ী মূল বেতন">
              <input id="gs-basic" inputMode="numeric" className={inputClass}
                     value={basic} onChange={(e) => setBasic(e.target.value)} placeholder="যেমন: ৩২০০০" />
            </Field>
          </div>

          <fieldset className="rounded-control border border-border p-3.5">
            <legend className="px-1 text-small font-medium text-ink">গেজেট-সমর্থিত ভাতা</legend>
            <div className="mt-2 space-y-4">
              <Field label="বাড়ি ভাড়া — কর্মস্থলের এলাকা" htmlFor="gs-zone"
                     hint={gradeNumber ? (houseRentBandLabel(gradeNumber as Grade) ?? undefined) : undefined}>
                <select id="gs-zone" className={selectClass} value={zone} disabled={govHouse}
                        onChange={(e) => setZone(e.target.value as HouseRentZone | '')}>
                  <option value="">— নির্বাচন করুন —</option>
                  {ZONES.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
                </select>
              </Field>

              <Check label="সরকারি বাসস্থানে বসবাস করি (অনুচ্ছেদ ১৫(২) — বাড়ি ভাড়া ভাতা প্রাপ্য নহেন)"
                     checked={govHouse} onChange={setGovHouse} />

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="বয়স (বৎসর)" htmlFor="gs-age" hint="চিকিৎসা ভাতার জন্য">
                  <input id="gs-age" inputMode="numeric" className={inputClass}
                         value={age} onChange={(e) => setAge(e.target.value)} />
                </Field>
                <Field label="সন্তান সংখ্যা" htmlFor="gs-children" hint="শিক্ষা সহায়ক ভাতা — অনধিক ২">
                  <input id="gs-children" inputMode="numeric" className={inputClass}
                         value={children} onChange={(e) => setChildren(e.target.value)} />
                </Field>
                <Field label="প্রতিবন্ধী সন্তান" htmlFor="gs-special" hint="নিবন্ধিত — অনধিক ২">
                  <input id="gs-special" inputMode="numeric" className={inputClass}
                         value={specialChildren} onChange={(e) => setSpecialChildren(e.target.value)} />
                </Field>
              </div>

              <div className="space-y-2">
                <Check label="টিফিন ভাতা প্রযোজ্য (১১–২০ গ্রেড, বিনামূল্যে দুপুরের খাবার পাই না)" checked={tiffin} onChange={setTiffin} />
                <Check label="যাতায়াত ভাতা প্রযোজ্য (১১–২০ গ্রেড, সিটি কর্পোরেশন এলাকায় কর্মস্থল)" checked={transport} onChange={setTransport} />
                <Check label="ধোলাই ভাতা প্রযোজ্য" checked={washing} onChange={setWashing} />
                <Check label="চলতি/অতিরিক্ত দায়িত্ব পালন করিতেছি (কার্যভার ভাতা)" checked={charge} onChange={setCharge} />
                <Check label="হাওড়/দ্বীপ/চর এলাকায় নিযুক্ত" checked={haor} onChange={setHaor} />
                <Check label="প্রশিক্ষণ প্রতিষ্ঠানে প্রশিক্ষণ কাজে প্রেষণে কর্মরত (৯ম গ্রেড ও তদূর্ধ্ব)" checked={training} onChange={setTraining} />
              </div>

              <Field label="পার্বত্য এলাকা" htmlFor="gs-hill">
                <select id="gs-hill" className={selectClass} value={hill}
                        onChange={(e) => setHill(e.target.value as typeof hill)}>
                  <option value="none">প্রযোজ্য নয়</option>
                  <option value="pahari-sadar">পার্বত্য জেলা সদর ও সদর উপজেলা (সর্বোচ্চ ৳৫,০০০)</option>
                  <option value="pahari-other">অন্যান্য উপজেলা (সর্বোচ্চ ৳৫,৫০০)</option>
                </select>
              </Field>
            </div>
          </fieldset>

          <fieldset className="rounded-control border border-warning/30 bg-warning/5 p-3.5">
            <legend className="px-1 text-small font-medium text-ink">ব্যবহারকারীর দেওয়া পরিমাণ</legend>
            <p className="mt-1 text-micro text-ink-muted">
              এই ভাতাগুলির হার এই গেজেটে নির্ধারিত নাই, তাই হিসাব করা হয় না — আপনি নিজে অঙ্ক লিখিতে পারেন।
            </p>
            <div className="mt-3 space-y-3">
              {USER_FIELDS.map((f) => (
                <Field key={f.id} label={f.name} htmlFor={`gs-u-${f.id}`} hint={f.note || undefined}>
                  <input id={`gs-u-${f.id}`} inputMode="numeric" className={inputClass}
                         value={userAmounts[f.id] ?? ''}
                         onChange={(e) => setUserAmounts((prev) => ({ ...prev, [f.id]: e.target.value }))} />
                </Field>
              ))}
            </div>
          </fieldset>

          <fieldset className="rounded-control border border-border p-3.5">
            <legend className="px-1 text-small font-medium text-ink">কর্তন (ঐচ্ছিক)</legend>
            <p className="mt-1 text-micro text-ink-muted">
              অনুচ্ছেদ ৩১ অনুযায়ী আয়কর কর্মচারী নিজে পরিশোধ করিবেন; এই গেজেটে কোনও কর্তনের হার নাই।
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="আয়কর" htmlFor="gs-tax">
                <input id="gs-tax" inputMode="numeric" className={inputClass} value={deductions.tax ?? ''}
                       onChange={(e) => setDeductions((p) => ({ ...p, tax: e.target.value }))} />
              </Field>
              <Field label="জিপিএফ" htmlFor="gs-gpf">
                <input id="gs-gpf" inputMode="numeric" className={inputClass} value={deductions.gpf ?? ''}
                       onChange={(e) => setDeductions((p) => ({ ...p, gpf: e.target.value }))} />
              </Field>
            </div>
          </fieldset>

          <button type="submit" className={buttonClass}>গ্রস বেতন হিসাব করুন</button>
        </form>
      </Card>

      {result ? (
        <>
          <Card>
            <h3 className="text-subheading text-ink">গ্রস বেতন</h3>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              <Stat label="Basic Pay" value={taka(result.basic)} />
              <Stat label="মোট ভাতা" value={taka(result.totalAllowances)} />
              <Stat label="Gross Salary" value={taka(result.gross)} tone="accent" />
            </div>

            <table className="mt-4 w-full border-collapse text-small">
              <caption className="sr-only">ভাতার বিস্তারিত</caption>
              <tbody>
                <tr className="border-b border-border">
                  <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">Basic Pay</th>
                  <td className="py-2 pr-3 text-ink-subtle">মূল বেতন</td>
                  <td className="py-2 text-right font-bengali tabular-nums text-ink">{taka(result.basic)}</td>
                </tr>
                {result.allowances.map((a) => (
                  <tr key={a.id} className="border-b border-border">
                    <th scope="row" className="py-2 pr-3 text-left font-normal text-ink">
                      + {a.name}
                      {a.origin === 'user' ? (
                        <span className="ml-1.5 rounded bg-warning/15 px-1.5 py-0.5 text-micro text-warning">
                          ব্যবহারকারীর দেওয়া
                        </span>
                      ) : null}
                    </th>
                    <td className="py-2 pr-3 text-micro text-ink-subtle">{a.basis}</td>
                    <td className="py-2 text-right font-bengali tabular-nums text-ink">{taka(a.amount)}</td>
                  </tr>
                ))}
                <tr className="border-b-2 border-border-strong">
                  <th scope="row" className="py-2.5 pr-3 text-left font-semibold text-ink">= Gross Salary</th>
                  <td />
                  <td className="py-2.5 text-right font-bengali tabular-nums font-semibold text-ink">
                    {taka(result.gross)}
                  </td>
                </tr>
                {result.deductions.map((d) => (
                  <tr key={d.id} className="border-b border-border">
                    <th scope="row" className="py-2 pr-3 text-left font-normal text-ink">− {d.name}</th>
                    <td className="py-2 pr-3 text-micro text-ink-subtle">{d.basis}</td>
                    <td className="py-2 text-right font-bengali tabular-nums text-ink">{taka(d.amount)}</td>
                  </tr>
                ))}
                {result.deductions.length > 0 ? (
                  <tr>
                    <th scope="row" className="py-2.5 pr-3 text-left font-semibold text-ink">= Net Salary</th>
                    <td />
                    <td className="py-2.5 text-right font-bengali tabular-nums font-semibold text-ink">
                      {taka(result.net)}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            <p className="mt-3 rounded-control border border-border bg-surface-sunken px-3 py-2.5 text-small text-ink-muted">
              <span className="font-medium text-ink">বাৎসরিক:</span> বাংলা নববর্ষ ভাতা{' '}
              {taka(banglaNoboborshoAllowance(result.basic).amount)} — মূল বেতনের ১৫%, বৎসরে একবার
              (অনুচ্ছেদ ১৪)। ইহা মাসিক গ্রসে যোগ করা হয় নাই।
            </p>

            <Source source={REF.allowanceEntitlement} />
          </Card>

          <Warnings items={result.warnings} />
        </>
      ) : null}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-small text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
             className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-accent focus:ring-accent/30" />
      <span>{label}</span>
    </label>
  );
}
