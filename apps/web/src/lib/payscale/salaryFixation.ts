/**
 * The pay fixation engine — অনুচ্ছেদ ৫ and ৯ of the 2026 Order.
 *
 * This is deterministic and rule-driven. There is no universal formula in it,
 * because the Gazette does not contain one: pay is fixed by walking the printed
 * steps of two scales, and the answer depends on which step the employee is on.
 * In particular there is no percentage uplift of basic pay anywhere in this
 * file — the percentages in অনুচ্ছেদ ১(৩) apply to the *increase*, during a
 * transition, and are computed separately in `phases`.
 *
 * Where the Gazette is silent the engine returns null and a warning. That is
 * the whole design: a missing rule must not become a plausible number.
 */

import {
  findSpecialFixedPay,
  getScale2015,
  getScale2026,
  isNinthGradeOrAbove,
  nextStep,
  stepAtOrAbove,
  stepIndexOf,
} from './payScale';
import { REF } from './sourceReference';
import { W, categoryWarnings, hasBlocker, roundingWarning, validateFixationInput, warn } from './validation';
import { gradeLabel, taka, toBnDigits } from './format';
import type {
  FixationInput,
  FixationResult,
  FixationStep,
  GradeScale,
  PhasePayment,
  SourceRef,
  Warning,
} from './types';

export const EFFECTIVE_DATE = '2026-07-01';
export const NEXT_INCREMENT_DATE = '2027-07-01';

/** Percentage of the increase payable in each transition window
 *  (অনুচ্ছেদ ১(৩)(ক), (খ), (গ)). */
export const PHASE_PERCENT = {
  'phase-1': { gradeUpTo9: 40, gradeFrom10: 50, from: '2026-07-01', to: '2026-12-31' },
  'phase-2': { gradeUpTo9: 70, gradeFrom10: 75, from: '2027-01-01', to: '2027-06-30' },
} as const;

function empty(input: FixationInput, warnings: Warning[]): FixationResult {
  return {
    ok: false,
    input,
    oldScale: null,
    newScale: null,
    fixedBasic: null,
    fixationBase: null,
    stepDifference: null,
    fixedStepIndex: null,
    newBasic: null,
    incrementAmount: null,
    incrementApplied: false,
    monthlyIncrease: null,
    annualIncrease: null,
    percentIncrease: null,
    nextIncrementDate: null,
    nextIncrementAmount: null,
    phases: [],
    steps: [],
    warnings,
    sources: [REF.correspondingScale, REF.entitlement],
  };
}

export function step(
  n: number,
  title: string,
  why: string,
  opts: { value?: number; formula?: string; certainty?: FixationStep['certainty']; source?: SourceRef } = {},
): FixationStep {
  return {
    step: n,
    title,
    why,
    value: opts.value,
    formula: opts.formula,
    certainty: opts.certainty ?? 'GAZETTE',
    source: opts.source,
  };
}

export function buildPhases(grade: number, currentBasic: number, newBasic: number, incrementAfter: number | null): PhasePayment[] {
  const increase = newBasic - currentBasic;
  const ninthOrAbove = isNinthGradeOrAbove(grade);
  const out: PhasePayment[] = [];

  for (const id of ['phase-1', 'phase-2'] as const) {
    const spec = PHASE_PERCENT[id];
    const percent = ninthOrAbove ? spec.gradeUpTo9 : spec.gradeFrom10;
    const added = Math.round((increase * percent) / 100);
    out.push({
      id,
      label: id === 'phase-1' ? 'পর্যায় ১' : 'পর্যায় ২',
      from: spec.from,
      to: spec.to,
      percent,
      payable: currentBasic + added,
      addedToCurrentBasic: added,
      certainty: 'DERIVED',
      source: id === 'phase-1' ? REF.phase1 : REF.phase2,
    });
  }

  out.push({
    id: 'phase-3',
    label: 'পর্যায় ৩',
    from: '2027-07-01',
    to: null,
    percent: 100,
    payable: newBasic,
    addedToCurrentBasic: increase,
    certainty: 'GAZETTE',
    source: REF.phase3,
    note:
      incrementAfter === null
        ? 'অনুচ্ছেদ ১(৩)(গ): ১ জুলাই ২০২৭ হইতে বার্ষিক বেতনবৃদ্ধিসহ মূল বেতন শতভাগ প্রদেয়। এই স্কেলে পরবর্তী ধাপ না থাকায় ২০২৭ সালের বেতনবৃদ্ধির অঙ্ক নির্ণয় করা যায় নাই।'
        : `অনুচ্ছেদ ১(৩)(গ): ১ জুলাই ২০২৭ হইতে বার্ষিক বেতনবৃদ্ধিসহ মূল বেতন শতভাগ প্রদেয় — অর্থাৎ ${taka(newBasic)} + ${taka(incrementAfter - newBasic)} = ${taka(incrementAfter)}।`,
  });

  return out;
}

/**
 * Fix pay in the 2026 scale for one employee.
 *
 * Order of operations, straight from the Gazette:
 *   ৪  → the corresponding scale for the grade
 *   ৫(ক)/৫(খ) → the step in that scale
 *   ৯(২) → one annual increment on 1 July 2026
 *   ১(৩) → what is actually paid during the transition
 */
export function fixSalary(input: FixationInput): FixationResult {
  const warnings: Warning[] = [
    ...validateFixationInput(input),
    ...categoryWarnings(input.category),
  ];

  // The special benefit is recorded but never enters the arithmetic. This is
  // the single most misunderstood part of the order, so it is reported even
  // when the user leaves it blank.
  if (input.specialBenefitAmount && input.specialBenefitAmount > 0) {
    warnings.push(warn(
      W.SPECIAL_BENEFIT_ENTERED,
      'info',
      `আপনি ৩০ জুন ২০২৬ তারিখে আহরিত বিশেষ সুবিধা ${taka(input.specialBenefitAmount)} লিখিয়াছেন। অনুচ্ছেদ ১(৩)(ট) অনুযায়ী ইহা ১ জুলাই ২০২৬ হইতে বিলুপ্ত এবং বেতন নির্ধারণের কোনও ধাপে ইহা যোগ বা বিয়োগ হয় না।`,
      'ইহা বকেয়ার সহিত সমন্বয় হইবে — মূল বেতনের সহিত নয়।',
      REF.specialBenefit,
    ));
  }

  if (hasBlocker(warnings)) return empty(input, warnings);

  // --- a post whose pay অনুচ্ছেদ ৩(২) fixes outside the grade table --------
  if (input.specialFixedPayId) {
    const post = findSpecialFixedPay(input.specialFixedPayId);
    if (!post) {
      warnings.push(warn(W.FIXED_PAY_POST, 'blocker', 'নির্বাচিত নির্ধারিত-বেতনের পদটি পাওয়া যায় নাই।'));
      return empty(input, warnings);
    }
    warnings.push(warn(
      W.FIXED_PAY_POST,
      'warning',
      `অনুচ্ছেদ ৫(গ) অনুযায়ী ${post.posts} এর ক্ষেত্রে অনুচ্ছেদ ৫ এর দফা (ক) ও (খ) প্রযোজ্য নহে; বেতন ${taka(post.amount)} (নির্ধারিত)।`,
      'নির্ধারিত বেতনের পদে ধাপভিত্তিক বার্ষিক বেতনবৃদ্ধির কোনও বিধান এই গেজেটে নাই।',
      REF.fixedPayPosts,
    ));
    const result = empty(input, warnings);
    return {
      ...result,
      ok: true,
      fixedBasic: post.amount,
      newBasic: post.amount,
      monthlyIncrease: post.amount - input.currentBasic,
      annualIncrease: (post.amount - input.currentBasic) * 12,
      percentIncrease: ((post.amount - input.currentBasic) / input.currentBasic) * 100,
      phases: buildPhases(input.grade, input.currentBasic, post.amount, null),
      steps: [
        step(1, 'নির্ধারিত বেতনের পদ', `${post.posts} — অনুচ্ছেদ ৩(২) অনুযায়ী বেতন টাকার অঙ্কে নির্ধারিত।`, {
          value: post.amount, source: REF.fixedPayPosts,
        }),
        step(2, 'বেতন নির্ধারণের পদ্ধতি প্রযোজ্য নয়', 'অনুচ্ছেদ ৫(গ): এই পদসমূহের ক্ষেত্রে দফা (ক) ও (খ) প্রযোজ্য হইবে না।', {
          source: REF.fixedPayPosts,
        }),
      ],
      sources: [REF.fixedPayPosts, REF.phase1, REF.phase2, REF.phase3],
    };
  }

  const oldScale = getScale2015(input.grade);
  const newScale = getScale2026(input.grade);
  if (!oldScale || !newScale) {
    warnings.push(warn(W.INVALID_GRADE, 'blocker', 'এই গ্রেডের স্কেল পাওয়া যায় নাই।'));
    return empty(input, warnings);
  }

  const steps: FixationStep[] = [];
  const currentBasic = input.currentBasic;
  const currentStepIndex = stepIndexOf(oldScale, currentBasic);

  steps.push(step(1, 'বর্তমান গ্রেড ও স্কেল',
    `অনুচ্ছেদ ৩(১) এর সারণিতে ${gradeLabel(input.grade)} এর বর্তমান (২০১৫) স্কেল টাকা ${toBnDigits(oldScale.minimum)}–${toBnDigits(oldScale.maximum)}।`,
    { source: REF.correspondingScale }));

  steps.push(step(2, '৩০ জুন ২০২৬ তারিখের মূল বেতন',
    currentStepIndex >= 0
      ? `অনুচ্ছেদ ২(খ): “বর্তমান বেতন” অর্থ ৩০ জুন ২০২৬ তারিখে প্রাপ্ত বা প্রাপ্য মূল বেতন। ইহা স্কেলের ${toBnDigits(currentStepIndex + 1)} নং ধাপ।`
      : 'অনুচ্ছেদ ২(খ): “বর্তমান বেতন” অর্থ ৩০ জুন ২০২৬ তারিখে প্রাপ্ত বা প্রাপ্য মূল বেতন। এই অঙ্ক স্কেলের কোনও মুদ্রিত ধাপের সহিত মিলে নাই।',
    { value: currentBasic, source: REF.correspondingScale }));

  steps.push(step(3, '২০১৫ সালের বিশেষ সুবিধা / Adjustment',
    'অনুচ্ছেদ ১(৩)(ট): জাতীয় বেতনস্কেল, ২০২৬ কার্যকর হইবার তারিখ হইতে বিশেষ সুবিধা বিলুপ্ত। ইহা মূল বেতনের অংশ নয় এবং বেতন নির্ধারণে যোগ বা বিয়োগ হয় না।',
    { value: 0, source: REF.specialBenefit }));

  steps.push(step(4, 'অনুরূপ স্কেল (Corresponding Scale)',
    `অনুচ্ছেদ ৪ অনুযায়ী ${gradeLabel(input.grade)} এর অনুরূপ ২০২৬ স্কেল টাকা ${toBnDigits(newScale.minimum)}–${toBnDigits(newScale.maximum)}।`,
    { source: REF.entitlement }));

  // --- অনুচ্ছেদ ৫(ক) / ৫(খ) -----------------------------------------------
  let fixedBasic: number;
  let fixedStepIndex: number;
  let fixationBase: number;
  let stepDifference: number;

  if (currentBasic === oldScale.minimum) {
    stepDifference = 0;
    fixationBase = newScale.minimum;
    fixedBasic = newScale.minimum;
    fixedStepIndex = 0;
    steps.push(step(5, 'প্রযোজ্য নির্ধারণ বিধি — অনুচ্ছেদ ৫(ক)',
      'আপনি বর্তমান স্কেলের প্রারম্ভিক ধাপে আছেন, তাই অনুরূপ স্কেলের প্রারম্ভিক ধাপেই বেতন নির্ধারিত হইবে।',
      { value: fixedBasic, formula: `${toBnDigits(newScale.minimum)} (অনুরূপ স্কেলের প্রারম্ভিক ধাপ)`, source: REF.fixationFirstStep }));
  } else {
    stepDifference = currentBasic - oldScale.minimum;
    fixationBase = newScale.minimum + stepDifference;
    const landing = stepAtOrAbove(newScale, fixationBase);

    steps.push(step(5, 'প্রযোজ্য নির্ধারণ বিধি — অনুচ্ছেদ ৫(খ)',
      'আপনার মূল বেতন বর্তমান স্কেলের সর্বনিম্ন ধাপের উচ্চতর, তাই প্রথমে উভয় ধাপের পার্থক্য নির্ণয় করিয়া উহা অনুরূপ স্কেলের প্রারম্ভিক ধাপের সহিত যোগ করিতে হইবে।',
      {
        value: fixationBase,
        formula: `(${toBnDigits(currentBasic)} − ${toBnDigits(oldScale.minimum)}) = ${toBnDigits(stepDifference)}; ${toBnDigits(newScale.minimum)} + ${toBnDigits(stepDifference)} = ${toBnDigits(fixationBase)}`,
        source: REF.fixationDifference,
      }));

    if (!landing) {
      warnings.push(warn(
        W.FIXATION_ABOVE_TOP_STEP,
        'blocker',
        `নির্ধারণ-ভিত্তি ${taka(fixationBase)} অনুরূপ স্কেলের সর্বোচ্চ ধাপ ${taka(newScale.maximum)} অতিক্রম করিয়াছে। এই পরিস্থিতিতে কী হইবে সে সম্পর্কে গেজেটে সুস্পষ্ট বিধান নাই।`,
        'এই তথ্যের ভিত্তিতে নির্দিষ্ট বেতন নির্ধারণ নিশ্চিত করা যাইতেছে না। গ্রেড ও মূল বেতন যাচাই করুন, অথবা হিসাবরক্ষণ অফিসের সহিত যোগাযোগ করুন।',
        REF.fixationDifference,
      ));
      const partial = empty(input, warnings);
      return { ...partial, oldScale, newScale, fixationBase, stepDifference, steps };
    }

    fixedBasic = landing.value;
    fixedStepIndex = landing.index;
    steps.push(step(6, landing.exact ? 'ধাপ নির্বাচন — অনুচ্ছেদ ৫(খ)(অ)' : 'ধাপ নির্বাচন — অনুচ্ছেদ ৫(খ)(আ)',
      landing.exact
        ? 'যোগফল অনুরূপ স্কেলের একটি ধাপের সমান হওয়ায় ঐ ধাপেই বেতন নির্ধারিত হইবে।'
        : 'অনুরূপ স্কেলে ঐ অঙ্কের সমান কোনও ধাপ না থাকায় পরবর্তী উচ্চতর ধাপে বেতন নির্ধারিত হইবে।',
      {
        value: fixedBasic,
        formula: landing.exact ? undefined : `${toBnDigits(fixationBase)} → পরবর্তী উচ্চতর ধাপ ${toBnDigits(fixedBasic)}`,
        source: landing.exact ? REF.fixationExactStep : REF.fixationNextStep,
      }));
  }

  // --- অনুচ্ছেদ ৯(২): one annual increment on 1 July 2026 ------------------
  const nextAfterFixation = nextStep(newScale, fixedStepIndex);
  let incrementApplied = true;
  let incrementAmount: number | null = null;
  let newBasic = fixedBasic;
  let newStepIndex = fixedStepIndex;

  if (input.qualifyingServiceMonths !== undefined && input.qualifyingServiceMonths < 6) {
    incrementApplied = false;
    warnings.push(warn(
      W.NO_INCREMENT_NEW_JOINER,
      'warning',
      `অনুচ্ছেদ ৯(২) এর শর্তাংশ: কোয়ালিফাইং চাকরির মেয়াদ নূ্যনতম ৬ মাস হইলে বার্ষিক বেতনবৃদ্ধি প্রাপ্য। আপনার দেওয়া মেয়াদ ${toBnDigits(input.qualifyingServiceMonths)} মাস।`,
      undefined,
      REF.incrementOnFixation,
    ));
  } else if (!nextAfterFixation) {
    incrementApplied = false;
    warnings.push(warn(
      W.AT_SCALE_MAXIMUM,
      'warning',
      `নির্ধারিত বেতন ${taka(fixedBasic)} ইতোমধ্যে অনুরূপ স্কেলের সর্বোচ্চ ধাপ। সর্বোচ্চ ধাপে পৌঁছানোর পর বার্ষিক বেতনবৃদ্ধি সম্পর্কে গেজেটে বিধান নাই।`,
      'এই ক্ষেত্রে ১ জুলাই ২০২৬ তারিখের বেতনবৃদ্ধি যোগ করা হয় নাই।',
      REF.incrementOnFixation,
    ));
  } else {
    incrementAmount = nextAfterFixation.value - fixedBasic;
    newBasic = nextAfterFixation.value;
    newStepIndex = nextAfterFixation.index;
  }

  steps.push(step(7, '১ জুলাই ২০২৬ তারিখে ১টি বার্ষিক বেতনবৃদ্ধি',
    incrementApplied
      ? 'অনুচ্ছেদ ৯(২): অনুচ্ছেদ ৫ মোতাবেক প্রথমে বেতন নির্ধারণ করিয়া ১ জুলাই ২০২৬ তারিখে ১টি বার্ষিক বেতনবৃদ্ধি প্রদেয়। বৃদ্ধির অঙ্ক = স্কেলের পরবর্তী ধাপ − নির্ধারিত ধাপ (গেজেটে কোনও শতকরা হার নাই)।'
      : 'অনুচ্ছেদ ৯(২) এর বেতনবৃদ্ধি এই ক্ষেত্রে যোগ করা হয় নাই — কারণ উপরের সতর্কবার্তায় বলা হইয়াছে।',
    { value: incrementApplied ? newBasic : undefined, formula: incrementAmount !== null ? `${toBnDigits(fixedBasic)} + ${toBnDigits(incrementAmount)} = ${toBnDigits(newBasic)}` : undefined, source: REF.incrementOnFixation }));

  const monthlyIncrease = newBasic - currentBasic;
  const percentIncrease = (monthlyIncrease / currentBasic) * 100;
  const afterNext = nextStep(newScale, newStepIndex);

  steps.push(step(8, 'মাসিক বৃদ্ধি',
    'জাতীয় বেতনস্কেল, ২০২৬ এ নির্ধারিত মূল বেতন হইতে ৩০ জুন ২০২৬ তারিখের মূল বেতন বিয়োগ করিয়া মোট বৃদ্ধি নির্ণীত — ইহাই অনুচ্ছেদ ১(৩) এ উল্লিখিত “বেতনবৃদ্ধি বাবদ মোট অঙ্ক”।',
    { value: monthlyIncrease, formula: `${toBnDigits(newBasic)} − ${toBnDigits(currentBasic)} = ${toBnDigits(monthlyIncrease)}`, certainty: 'DERIVED', source: REF.phase1 }));

  steps.push(step(9, 'পরবর্তী বার্ষিক বেতনবৃদ্ধি',
    afterNext
      ? 'অনুচ্ছেদ ৯(১): বার্ষিক বেতনবৃদ্ধির তারিখ প্রতি অর্থ বৎসর শুরুর প্রথম দিবস — অর্থাৎ ১ জুলাই।'
      : 'অনুচ্ছেদ ৯(১) অনুযায়ী তারিখ ১ জুলাই, তবে আপনি স্কেলের সর্বোচ্চ ধাপে থাকায় পরবর্তী ধাপ নাই।',
    { value: afterNext ? afterNext.value - newBasic : undefined, source: REF.incrementDate,
      certainty: afterNext ? 'GAZETTE' : 'UNDETERMINED' }));

  warnings.push(roundingWarning());

  return {
    ok: true,
    input,
    oldScale,
    newScale,
    fixedBasic,
    fixationBase,
    stepDifference,
    fixedStepIndex,
    newBasic,
    incrementAmount,
    incrementApplied,
    monthlyIncrease,
    annualIncrease: monthlyIncrease * 12,
    percentIncrease,
    nextIncrementDate: afterNext ? NEXT_INCREMENT_DATE : null,
    nextIncrementAmount: afterNext ? afterNext.value - newBasic : null,
    phases: buildPhases(input.grade, currentBasic, newBasic, afterNext ? afterNext.value : null),
    steps,
    warnings,
    sources: [
      REF.correspondingScale,
      REF.entitlement,
      currentBasic === oldScale.minimum ? REF.fixationFirstStep : REF.fixationDifference,
      REF.incrementOnFixation,
      REF.phase1,
      REF.phase2,
      REF.phase3,
      REF.specialBenefit,
    ],
  };
}

/** Convenience for the grade landing pages: fix pay from the first step. */
export function fixFromScaleMinimum(grade: FixationInput['grade']): FixationResult | null {
  const scale: GradeScale | null = getScale2015(grade);
  if (!scale) return null;
  return fixSalary({ grade, currentBasic: scale.minimum, category: 'regular' });
}
