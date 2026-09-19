'use client';

import { useMemo, useState } from 'react';
import {
  ARREARS_MONTHS, MONTHS_TO_ORDER_DATE, calculateArrears, oldScaleIncrementedBasic,
} from '@/lib/payscale/arrears';
import { fromBnDigits, taka, toBnDigits } from '@/lib/payscale/format';
import { Card, Field, Source, Stat, Warnings, inputClass, selectClass } from './Ui';
import type { FixationResult } from '@/lib/payscale/types';

/**
 * বকেয়া হিসাব — the arrears for July 2026 onwards.
 *
 * The headline this shows is the *net* figure, and it deliberately shows the
 * naive figure beside it, because the gap between them is the whole point: the
 * 1 July 2026 increment under the old scale was already drawn, so it comes off
 * the arrears rather than adding to them.
 *
 * Only the 2015 basic is derived (this Gazette reprints the 2015 scale). The
 * allowance figures are the user's own and are marked as such, because the
 * order repeals the 2015 order without restating its rates.
 */
export function ArrearsCalculator({ result }: { result: FixationResult }) {
  const [months, setMonths] = useState(String(MONTHS_TO_ORDER_DATE));
  const [drawnBasic, setDrawnBasic] = useState('');
  const [hraDrawn, setHraDrawn] = useState('');
  const [hraDue, setHraDue] = useState('');
  const [specialBenefit, setSpecialBenefit] = useState(
    result.input.specialBenefitAmount ? String(result.input.specialBenefitAmount) : '',
  );
  const [otherDrawn, setOtherDrawn] = useState('');
  const [otherDue, setOtherDue] = useState('');

  const num = (value: string) => (value.trim() === '' ? undefined : Number(fromBnDigits(value)));

  const derived = result.ok
    ? oldScaleIncrementedBasic(result.input.grade, result.input.currentBasic)
    : null;

  const arrears = useMemo(() => calculateArrears(result, {
    months: Number(months) || MONTHS_TO_ORDER_DATE,
    ...(num(drawnBasic) !== undefined ? { drawnBasicPerMonth: num(drawnBasic) } : {}),
    ...(num(hraDrawn) !== undefined ? { drawnHouseRentPerMonth: num(hraDrawn) } : {}),
    ...(num(hraDue) !== undefined ? { entitledHouseRentPerMonth: num(hraDue) } : {}),
    ...(num(specialBenefit) !== undefined ? { drawnSpecialBenefitPerMonth: num(specialBenefit) } : {}),
    ...(num(otherDrawn) !== undefined ? { drawnOtherAllowancesPerMonth: num(otherDrawn) } : {}),
    ...(num(otherDue) !== undefined ? { entitledOtherAllowancesPerMonth: num(otherDue) } : {}),
  }), [result, months, drawnBasic, hraDrawn, hraDue, specialBenefit, otherDrawn, otherDue]);

  if (!result.ok) return null;

  return (
    <Card>
      <h3 className="text-subheading text-ink">বকেয়া কত পাইবেন (জুলাই ২০২৬ হইতে)</h3>
      <p className="mt-1 text-small text-ink-muted">
        ১ জুলাই ২০২৬ তারিখে ২০১৫ স্কেলেও একটি ইনক্রিমেন্ট হইয়াছিল, এবং জুলাই হইতে সেই বর্ধিত
        বেতনেই বেতন-ভাতা আহরিত হইয়াছে। অনুচ্ছেদ ১(৩)(ঘ) অনুযায়ী বকেয়া মানে{' '}
        <span className="font-medium text-ink">প্রাপ্য বাদ আহরিত</span> — তাই ঐ আহরিত অংশ বাদ যাইবে।
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="কত মাসের বকেয়া" htmlFor="ar-months"
               hint="আদেশ জারির তারিখ ১৭ সেপ্টেম্বর ২০২৬ — সাধারণত জুলাই, আগস্ট ও সেপ্টেম্বর">
          <select id="ar-months" className={selectClass} value={months}
                  onChange={(e) => setMonths(e.target.value)}>
            {ARREARS_MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </Field>

        <Field label="জুলাই ২০২৬ হইতে আহরিত মূল বেতন" htmlFor="ar-drawn"
               hint={derived
                 ? `খালি রাখিলে ধরা হইবে ${taka(derived)} — ২০১৫ স্কেলের পরবর্তী ধাপ`
                 : 'আপনার বেতন বিল অনুযায়ী মাসিক মূল বেতন'}>
          <input id="ar-drawn" inputMode="numeric" className={inputClass}
                 value={drawnBasic} onChange={(e) => setDrawnBasic(e.target.value)}
                 placeholder={derived ? String(derived) : ''} />
        </Field>

        <Field label="জুলাই হইতে আহরিত বাড়ি ভাড়া (মাসিক)" htmlFor="ar-hra-drawn"
               hint="বেতন বিল অনুযায়ী — ইনক্রিমেন্টসহ বেতনের উপর হিসাব হইয়া থাকিতে পারে">
          <input id="ar-hra-drawn" inputMode="numeric" className={inputClass}
                 value={hraDrawn} onChange={(e) => setHraDrawn(e.target.value)} />
        </Field>

        <Field label="৩০ জুন ২০২৬ তারিখের বাড়ি ভাড়া (মাসিক)" htmlFor="ar-hra-due"
               hint="অনুচ্ছেদ ১৫(১) অনুযায়ী ৩১ ডিসেম্বর ২০২৭ পর্যন্ত এই অঙ্কই প্রাপ্য">
          <input id="ar-hra-due" inputMode="numeric" className={inputClass}
                 value={hraDue} onChange={(e) => setHraDue(e.target.value)} />
        </Field>

        <Field label="জুলাই হইতে আহরিত বিশেষ সুবিধা (মাসিক)" htmlFor="ar-sb"
               hint="অনুচ্ছেদ ১(৩)(ট): সম্পূর্ণটাই বকেয়ার সহিত সমন্বয় হইবে">
          <input id="ar-sb" inputMode="numeric" className={inputClass}
                 value={specialBenefit} onChange={(e) => setSpecialBenefit(e.target.value)} />
        </Field>

        <Field label="অন্যান্য ভাতা — আহরিত / ৩০ জুন ২০২৬ এর প্রাপ্য" htmlFor="ar-other-drawn"
               hint="ভিন্ন হইলে দুইটিই লিখুন; না হইলে খালি রাখুন">
          <div className="flex gap-2">
            <input id="ar-other-drawn" inputMode="numeric" className={inputClass}
                   value={otherDrawn} onChange={(e) => setOtherDrawn(e.target.value)}
                   aria-label="আহরিত অন্যান্য ভাতা" placeholder="আহরিত" />
            <input inputMode="numeric" className={inputClass}
                   value={otherDue} onChange={(e) => setOtherDue(e.target.value)}
                   aria-label="প্রাপ্য অন্যান্য ভাতা" placeholder="প্রাপ্য" />
          </div>
        </Field>
      </div>

      {arrears.ok && arrears.total !== null ? (
        <>
          <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
            <Stat
              label={arrears.recoverable ? 'নিট ফেরতযোগ্য' : 'নিট বকেয়া (মোট)'}
              value={taka(Math.abs(arrears.total))}
              tone="accent"
              hint={`${toBnDigits(arrears.months)} মাসের জন্য`}
            />
            <Stat
              label="মাসিক নিট বকেয়া"
              value={taka(Math.round(arrears.total / arrears.months))}
            />
            <Stat
              label="ইনক্রিমেন্ট বাদ না দিলে হইত"
              value={taka(arrears.naiveTotal)}
              hint={
                arrears.naiveTotal !== null
                  ? `পার্থক্য ${taka(arrears.naiveTotal - arrears.total)} — ইহাই ইতোমধ্যে আহরিত`
                  : undefined
              }
            />
          </div>

          {arrears.oldScaleIncrement !== null && arrears.oldScaleIncrement > 0 ? (
            <p className="mt-3 rounded-control border border-accent/25 bg-accent-soft px-3 py-2.5 text-small text-accent-ink">
              ১ জুলাই ২০২৬ তারিখে ২০১৫ স্কেলে আপনার ইনক্রিমেন্ট ছিল{' '}
              <span className="font-bengali tabular-nums font-medium">{taka(arrears.oldScaleIncrement)}</span>।
              এই আদেশে বেতন নির্ধারণ হয় ৩০ জুন ২০২৬ তারিখের বেতন হইতে (অনুচ্ছেদ ২(খ)) এবং নূতন
              স্কেলে আলাদা ১টি ইনক্রিমেন্ট দেওয়া হয় (অনুচ্ছেদ ৯(২)) — তাই পুরাতন ইনক্রিমেন্টটি
              বকেয়ার হিসাবে বাদ যায়।
            </p>
          ) : null}

          <div className="mt-4 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[34rem] border-collapse text-small">
              <caption className="sr-only">বকেয়ার বিস্তারিত হিসাব</caption>
              <thead>
                <tr className="border-b border-border-strong text-left text-micro text-ink-subtle">
                  <th scope="col" className="py-2 pr-3 font-medium">বিষয়</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">মাসিক</th>
                  <th scope="col" className="py-2 text-right font-medium">
                    {toBnDigits(arrears.months)} মাসে
                  </th>
                </tr>
              </thead>
              <tbody>
                {arrears.lines.map((line) => (
                  <tr key={line.id} className="border-b border-border align-top last:border-0">
                    <th scope="row" className="py-2.5 pr-3 text-left font-normal text-ink">
                      {line.label}
                      {line.origin === 'user' ? (
                        <span className="ml-1.5 rounded bg-warning/15 px-1.5 py-0.5 text-micro text-warning">
                          ব্যবহারকারীর দেওয়া
                        </span>
                      ) : null}
                      {line.origin === 'derived' ? (
                        <span className="ml-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-micro text-accent-ink">
                          স্কেল হইতে নির্ণীত
                        </span>
                      ) : null}
                      <span className="mt-0.5 block text-micro font-normal text-ink-subtle">{line.note}</span>
                    </th>
                    <td className="py-2.5 pr-3 text-right font-bengali tabular-nums text-ink-muted">
                      {line.perMonth < 0 ? '− ' : ''}{taka(Math.abs(line.perMonth))}
                    </td>
                    <td className="py-2.5 text-right font-bengali tabular-nums text-ink">
                      {line.total < 0 ? '− ' : ''}{taka(Math.abs(line.total))}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border-strong">
                  <th scope="row" className="py-2.5 pr-3 text-left font-semibold text-ink">
                    {arrears.recoverable ? '= নিট ফেরতযোগ্য' : '= নিট বকেয়া'}
                  </th>
                  <td className="py-2.5 pr-3 text-right font-bengali tabular-nums text-ink-muted">
                    {taka(Math.round(arrears.total / arrears.months))}
                  </td>
                  <td className="py-2.5 text-right font-bengali tabular-nums font-semibold text-ink">
                    {taka(Math.abs(arrears.total))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <Source source={arrears.sources[1] ?? arrears.sources[0]!} />
        </>
      ) : null}

      <div className="mt-4">
        <Warnings items={arrears.warnings} />
      </div>
    </Card>
  );
}
