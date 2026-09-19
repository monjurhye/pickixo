/**
 * বকেয়া — arrears for 1 July 2026 onwards.
 *
 * This is the part people get wrong, and it always goes the same way: they
 * compute `new payable basic − 30 June 2026 basic` and expect that every month.
 * It is too high, because of a date mismatch in the order itself.
 *
 * Under the 2015 order the annual increment date was also 1 July. So on
 * 1 July 2026 an eligible employee moved one step up the **2015** scale and
 * drew July, August and September pay on that higher figure — while this order
 * fixes pay from the **30 June 2026** figure (অনুচ্ছেদ ২(খ)) and grants its own
 * single increment in the new scale (অনুচ্ছেদ ৯(২)). The 2015 increment is not
 * cancelled by any clause; it is simply superseded, and what was drawn on
 * account of it is money already paid.
 *
 * Three provisions make that net off:
 *
 *   • অনুচ্ছেদ ১(৩)(ঘ) — the July-onwards pay is payable as *arrears*, which
 *     means the difference between what is now due and what was drawn.
 *   • অনুচ্ছেদ ১৫(১) and ১(৩)(ঞ) — house rent and every other allowance stay at
 *     their **30 June 2026** amount. Anything drawn on the higher post-increment
 *     basic is therefore an over-payment.
 *   • অনুচ্ছেদ ৩২(১০) — "কম বা বেশি বেতন পরিশোধ হইয়া থাকিলে তাহা সমন্বয়যোগ্য হইবে".
 *
 * And বিশেষ সুবিধা is stricter still: অনুচ্ছেদ ১(৩)(ট) adjusts the **whole**
 * amount drawn in that window against the arrears, not merely the part the
 * increment added.
 *
 * What this module cannot do is know what somebody was actually paid. The 2015
 * basic it can derive, because this Gazette reprints the 2015 scale; the 2015
 * allowance rates it cannot, because the order repeals the 2015 order without
 * restating them. So those are inputs, and every one of them is labelled as
 * the user's own figure in the result.
 */

import { getScale2015, nextStep, stepIndexOf } from './payScale';
import { REF, ref } from './sourceReference';
import { W, warn } from './validation';
import { taka, toBnDigits } from './format';
import type { FixationResult, SourceRef, Warning } from './types';

/** অনুচ্ছেদ ১(৩)(ট)'s explicit adjustment window ends on the gazette date. */
export const ORDER_ISSUE_DATE = '2026-09-17';
export const ARREARS_START_DATE = '2026-07-01';

/** Months from 1 July 2026 to the order date, i.e. জুলাই–সেপ্টেম্বর ২০২৬. */
export const MONTHS_TO_ORDER_DATE = 3;

export const ARREARS_MONTHS = [
  { value: 1, label: 'জুলাই ২০২৬' },
  { value: 2, label: 'জুলাই–আগস্ট ২০২৬' },
  { value: 3, label: 'জুলাই–সেপ্টেম্বর ২০২৬ (আদেশ জারি পর্যন্ত)' },
  { value: 4, label: 'জুলাই–অক্টোবর ২০২৬' },
  { value: 5, label: 'জুলাই–নভেম্বর ২০২৬' },
  { value: 6, label: 'জুলাই–ডিসেম্বর ২০২৬' },
] as const;

export type ArrearsInput = {
  /** Months of old-scale pay drawn from 1 July 2026 onwards. */
  months: number;
  /**
   * Basic actually drawn each month from July 2026. Left undefined, the engine
   * uses the next step of the 2015 scale — that is what an eligible employee
   * would have moved to on 1 July 2026 under the old order.
   */
  drawnBasicPerMonth?: number;
  /** House rent actually drawn per month, July 2026 onwards. */
  drawnHouseRentPerMonth?: number;
  /** House rent actually payable — the 30 June 2026 amount (অনুচ্ছেদ ১৫(১)). */
  entitledHouseRentPerMonth?: number;
  /** বিশেষ সুবিধা drawn per month (অনুচ্ছেদ ১(৩)(ট) adjusts all of it). */
  drawnSpecialBenefitPerMonth?: number;
  /** Other allowances drawn per month, July 2026 onwards. */
  drawnOtherAllowancesPerMonth?: number;
  /** Other allowances payable — the 30 June 2026 amounts (অনুচ্ছেদ ১(৩)(ঞ)). */
  entitledOtherAllowancesPerMonth?: number;
};

export type ArrearsLine = {
  id: string;
  label: string;
  /** Per month; negative means it reduces the arrears. */
  perMonth: number;
  total: number;
  origin: 'gazette' | 'derived' | 'user';
  note: string;
  source?: SourceRef;
};

export type ArrearsResult = {
  ok: boolean;
  months: number;
  /** Basic payable each month under অনুচ্ছেদ ১(৩)(ক). */
  duePayableBasic: number | null;
  /** Basic actually drawn each month. */
  drawnBasic: number | null;
  /** The 2015-scale increment that landed on 1 July 2026, when derivable. */
  oldScaleIncrement: number | null;
  /** What arrears would look like if the 2015 increment were ignored. */
  naiveTotal: number | null;
  lines: ArrearsLine[];
  total: number | null;
  /** True when the netting comes out negative — an over-payment to recover. */
  recoverable: boolean;
  warnings: Warning[];
  sources: SourceRef[];
};

const REF_ARREARS = ref({
  ruleId: 'TRANS-1-3-GHA',
  article: '১(৩)',
  label: 'অনুচ্ছেদ ১(৩)(ঘ) — বকেয়া',
});
const REF_ADJUSTABLE = ref({
  ruleId: 'FIX-32-10',
  article: '৩২',
  label: 'অনুচ্ছেদ ৩২(১০) — কম বা বেশি পরিশোধ সমন্বয়যোগ্য',
  quote: 'এই প্রক্রিয়ায় কম বা বেশি বেতন পরিশোধ হইয়া থাকিলে তাহা সমন্বয়যোগ্য হইবে।',
});
const REF_HRA_FROZEN = ref({
  ruleId: 'ALW-15',
  article: '১৫',
  label: 'অনুচ্ছেদ ১৫(১) — ৩০ জুন ২০২৬ তারিখের অঙ্কে বাড়ি ভাড়া',
});
const REF_ALW_FROZEN = ref({
  ruleId: 'TRANS-1-3-NYA',
  article: '১(৩)',
  label: 'অনুচ্ছেদ ১(৩)(ঞ) — ভাতাদি ৩০ জুন ২০২৬ তারিখের অঙ্কে',
});

/**
 * The step an eligible employee moved to on 1 July 2026 under the 2015 order.
 *
 * Derived from the 2015 scale this Gazette reprints, so it is a Gazette figure
 * rather than an assumption — but *whether* a given employee got it depends on
 * qualifying service and on not already being at the top of the scale, which
 * is why the caller can override it.
 */
export function oldScaleIncrementedBasic(grade: number, currentBasic: number): number | null {
  const scale = getScale2015(grade);
  if (!scale || scale.fixed) return null;
  const index = stepIndexOf(scale, currentBasic);
  if (index < 0) return null;
  const next = nextStep(scale, index);
  return next ? next.value : null;
}

function empty(months: number, warnings: Warning[]): ArrearsResult {
  return {
    ok: false,
    months,
    duePayableBasic: null,
    drawnBasic: null,
    oldScaleIncrement: null,
    naiveTotal: null,
    lines: [],
    total: null,
    recoverable: false,
    warnings,
    sources: [REF_ARREARS, REF_ADJUSTABLE],
  };
}

export function calculateArrears(fixation: FixationResult, input: ArrearsInput): ArrearsResult {
  const warnings: Warning[] = [];
  const months = Math.max(1, Math.round(input.months || MONTHS_TO_ORDER_DATE));

  const phase1 = fixation.phases.find((p) => p.id === 'phase-1');
  if (!fixation.ok || !phase1) {
    warnings.push(warn(
      'ARREARS_NO_FIXATION',
      'blocker',
      'বেতন নির্ধারণ না হইলে বকেয়া হিসাব করা যায় না।',
      'উপরে গ্রেড ও ৩০ জুন ২০২৬ তারিখের মূল বেতন দিয়া প্রথমে বেতন নির্ধারণ করুন।',
    ));
    return empty(months, warnings);
  }

  const grade = fixation.input.grade;
  const currentBasic = fixation.input.currentBasic;
  const duePayableBasic = phase1.payable;

  const derivedDrawn = oldScaleIncrementedBasic(grade, currentBasic);
  const drawnBasic = input.drawnBasicPerMonth ?? derivedDrawn ?? currentBasic;
  const oldScaleIncrement = derivedDrawn === null ? null : derivedDrawn - currentBasic;

  if (input.drawnBasicPerMonth === undefined) {
    if (derivedDrawn === null) {
      warnings.push(warn(
        'ARREARS_NO_OLD_INCREMENT',
        'warning',
        `${toBnDigits(grade)} নং গ্রেডে আপনার ৩০ জুন ২০২৬ তারিখের মূল বেতনের পরবর্তী ধাপ নির্ণয় করা যায় নাই, তাই ধরা হইয়াছে জুলাই ২০২৬ হইতে আপনি ${taka(currentBasic)} ই আহরণ করিতেছিলেন।`,
        'আপনি ১ জুলাই ২০২৬ তারিখে ২০১৫ স্কেলে ইনক্রিমেন্ট পাইয়া থাকিলে প্রকৃত আহরিত মূল বেতন নিজে লিখুন।',
      ));
    } else {
      warnings.push(warn(
        'ARREARS_OLD_INCREMENT_ASSUMED',
        'info',
        `ধরা হইয়াছে ১ জুলাই ২০২৬ তারিখে ২০১৫ স্কেলে আপনার ১টি ইনক্রিমেন্ট হইয়াছিল — ${taka(currentBasic)} হইতে ${taka(derivedDrawn)} (বৃদ্ধি ${taka(derivedDrawn - currentBasic)})।`,
        'ইনক্রিমেন্ট না পাইয়া থাকিলে (যেমন কোয়ালিফাইং চাকরি পূর্ণ হয় নাই) প্রকৃত আহরিত মূল বেতন নিজে লিখুন।',
        REF.correspondingScale,
      ));
    }
  }

  const lines: ArrearsLine[] = [];

  lines.push({
    id: 'basic-due',
    label: 'প্রাপ্য মূল বেতন (অনুচ্ছেদ ১(৩)(ক))',
    perMonth: duePayableBasic,
    total: duePayableBasic * months,
    origin: 'gazette',
    note: `৩০ জুন ২০২৬ তারিখের মূল বেতন ${taka(currentBasic)} + বৃদ্ধির ${toBnDigits(phase1.percent)}%`,
    source: REF.phase1,
  });

  lines.push({
    id: 'basic-drawn',
    label: 'ইতোমধ্যে আহরিত মূল বেতন',
    perMonth: -drawnBasic,
    total: -drawnBasic * months,
    origin: input.drawnBasicPerMonth === undefined ? 'derived' : 'user',
    note: oldScaleIncrement && input.drawnBasicPerMonth === undefined
      ? `২০১৫ স্কেলের পরবর্তী ধাপ — ১ জুলাই ২০২৬ তারিখের ইনক্রিমেন্ট ${taka(oldScaleIncrement)} সহ`
      : 'আপনার দেওয়া পরিমাণ',
    source: REF_ARREARS,
  });

  const hraDrawn = input.drawnHouseRentPerMonth ?? 0;
  const hraDue = input.entitledHouseRentPerMonth ?? 0;
  if (hraDrawn > 0 || hraDue > 0) {
    const excess = hraDrawn - hraDue;
    if (excess !== 0) {
      lines.push({
        id: 'house-rent-excess',
        label: excess > 0 ? 'অতিরিক্ত আহরিত বাড়ি ভাড়া (সমন্বয়যোগ্য)' : 'কম আহরিত বাড়ি ভাড়া',
        perMonth: -excess,
        total: -excess * months,
        origin: 'user',
        note: 'অনুচ্ছেদ ১৫(১): বাড়ি ভাড়া ৩১ ডিসেম্বর ২০২৭ পর্যন্ত ৩০ জুন ২০২৬ তারিখের অঙ্কেই প্রাপ্য — ইনক্রিমেন্টের কারণে বাড়িলে তাহা অতিরিক্ত',
        source: REF_HRA_FROZEN,
      });
    }
  } else {
    warnings.push(warn(
      W.ALLOWANCE_USER_SUPPLIED,
      'warning',
      'বাড়ি ভাড়ার অঙ্ক দেওয়া হয় নাই, তাই বাড়ি ভাড়ার সমন্বয় হিসাবে ধরা হয় নাই।',
      'অনুচ্ছেদ ১৫(১) অনুযায়ী বাড়ি ভাড়া ৩০ জুন ২০২৬ তারিখের অঙ্কেই প্রাপ্য। জুলাই হইতে ইনক্রিমেন্টসহ মূল বেতনের উপর বাড়ি ভাড়া পাইয়া থাকিলে দুইটি অঙ্কই লিখুন।',
      REF_HRA_FROZEN,
    ));
  }

  const otherDrawn = input.drawnOtherAllowancesPerMonth ?? 0;
  const otherDue = input.entitledOtherAllowancesPerMonth ?? 0;
  if (otherDrawn !== otherDue) {
    const excess = otherDrawn - otherDue;
    lines.push({
      id: 'other-allowance-excess',
      label: excess > 0 ? 'অতিরিক্ত আহরিত অন্যান্য ভাতা (সমন্বয়যোগ্য)' : 'কম আহরিত অন্যান্য ভাতা',
      perMonth: -excess,
      total: -excess * months,
      origin: 'user',
      note: 'অনুচ্ছেদ ১(৩)(ঞ): ভাতাদি ৩১ ডিসেম্বর ২০২৭ পর্যন্ত ৩০ জুন ২০২৬ তারিখে প্রাপ্য অঙ্কেই প্রদেয়',
      source: REF_ALW_FROZEN,
    });
  }

  const specialBenefit = input.drawnSpecialBenefitPerMonth ?? fixation.input.specialBenefitAmount ?? 0;
  if (specialBenefit > 0) {
    lines.push({
      id: 'special-benefit',
      label: 'আহরিত বিশেষ সুবিধা (সম্পূর্ণ সমন্বয়যোগ্য)',
      perMonth: -specialBenefit,
      total: -specialBenefit * months,
      origin: 'user',
      note: 'অনুচ্ছেদ ১(৩)(ট): ১ জুলাই ২০২৬ হইতে আদেশ জারির তারিখ পর্যন্ত আহরিত বিশেষ সুবিধা সম্পূর্ণটাই বকেয়ার সহিত সমন্বয় হইবে — কেবল ইনক্রিমেন্টজনিত অংশ নয়',
      source: REF.specialBenefit,
    });
    if (months > MONTHS_TO_ORDER_DATE) {
      warnings.push(warn(
        'SPECIAL_BENEFIT_AFTER_ORDER',
        'info',
        `অনুচ্ছেদ ১(৩)(ট) সুস্পষ্টভাবে ১ জুলাই ২০২৬ হইতে আদেশ জারির তারিখ (১৭ সেপ্টেম্বর ২০২৬) পর্যন্ত সময়ের বিশেষ সুবিধা সমন্বয়ের কথা বলিয়াছে। আপনি ${toBnDigits(months)} মাস নির্বাচন করিয়াছেন।`,
        'উক্ত তারিখের পরেও বিশেষ সুবিধা আহরিত হইয়া থাকিলে তাহা অনুচ্ছেদ ৩২(১০) অনুযায়ী “বেশি পরিশোধ” হিসাবে সমন্বয়যোগ্য।',
        REF_ADJUSTABLE,
      ));
    }
  } else {
    warnings.push(warn(
      W.SPECIAL_BENEFIT_UNKNOWN,
      'info',
      'বিশেষ সুবিধার অঙ্ক দেওয়া হয় নাই, তাই উহা বকেয়া হইতে বাদ যায় নাই।',
      'জুলাই ২০২৬ হইতে বিশেষ সুবিধা আহরণ করিয়া থাকিলে মাসিক অঙ্কটি লিখুন — অনুচ্ছেদ ১(৩)(ট) অনুযায়ী সম্পূর্ণটাই বকেয়ার সহিত সমন্বয় হইবে।',
      REF.specialBenefit,
    ));
  }

  const total = lines.reduce((sum, line) => sum + line.total, 0);
  const naiveTotal = (duePayableBasic - currentBasic) * months;

  warnings.push(warn(
    'ARREARS_OFFICE_DECIDES',
    'warning',
    'বকেয়ার চূড়ান্ত অঙ্ক হিসাবরক্ষণ অফিস নির্ধারণ করিবে।',
    'অনুচ্ছেদ ৩২(১০): প্রতিপাদনকৃত বেতন নির্ধারণী বিবরণীর ভিত্তিতে বেতন পরিশোধ হইবে এবং কম বা বেশি পরিশোধ হইয়া থাকিলে তাহা সমন্বয়যোগ্য।',
    REF_ADJUSTABLE,
  ));

  return {
    ok: true,
    months,
    duePayableBasic,
    drawnBasic,
    oldScaleIncrement,
    naiveTotal,
    lines,
    total,
    recoverable: total < 0,
    warnings,
    sources: [REF.phase1, REF_ARREARS, REF_HRA_FROZEN, REF_ALW_FROZEN, REF.specialBenefit, REF_ADJUSTABLE],
  };
}
