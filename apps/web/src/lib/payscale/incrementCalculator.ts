/**
 * Annual increment — অনুচ্ছেদ ৯.
 *
 * The Gazette gives no increment percentage, and this module does not compute
 * one: an increment is simply the move to the next printed step of the scale,
 * so the amount falls out of the table. The consequence is that the increment
 * is different at every step, which is why a "5% a year" shortcut would be
 * wrong almost everywhere.
 */

import { getScale2026, nextStep, stepAtOrAbove, stepIndexOf } from './payScale';
import { REF } from './sourceReference';
import { W, warn } from './validation';
import { gradeLabel, taka, toBnDigits } from './format';
import type { Grade, IncrementResult, Warning } from './types';

export const INCREMENT_DATE_RULE = 'প্রতি অর্থ বৎসর শুরুর প্রথম দিবস (১ জুলাই)';

function julyOf(year: number): string {
  return `${year}-07-01`;
}

export type IncrementInput = {
  grade: Grade;
  /** Basic pay in the 2026 scale. */
  currentBasic: number;
  /** Financial year in which the next increment falls. Defaults to 2027,
   *  the first ordinary increment after the 2026 fixation. */
  nextIncrementYear?: number;
  /** How many future years to project. */
  projectYears?: number;
};

export function calculateIncrement(input: IncrementInput): IncrementResult {
  const warnings: Warning[] = [];
  const year = input.nextIncrementYear ?? 2027;
  const scale = getScale2026(input.grade);

  const base: IncrementResult = {
    ok: false,
    grade: input.grade,
    currentBasic: input.currentBasic,
    currentStepIndex: null,
    incrementAmount: null,
    nextBasic: null,
    atMaximum: false,
    incrementDate: julyOf(year),
    remainingSteps: null,
    projection: [],
    warnings,
    sources: [REF.incrementDate, REF.incrementOnFixation],
  };

  if (!scale) {
    warnings.push(warn(W.INVALID_GRADE, 'blocker', 'এই গ্রেডের ২০২৬ স্কেল পাওয়া যায় নাই।'));
    return base;
  }
  if (!Number.isFinite(input.currentBasic) || input.currentBasic <= 0) {
    warnings.push(warn(W.INVALID_BASIC, 'blocker', 'মূল বেতন একটি ধনাত্মক সংখ্যা হইতে হইবে।'));
    return base;
  }
  if (scale.fixed) {
    warnings.push(warn(
      W.AT_SCALE_MAXIMUM,
      'warning',
      `${gradeLabel(input.grade)} এর বেতন টাকার অঙ্কে নির্ধারিত (${taka(scale.minimum)}); এই স্কেলে কোনও ধাপ নাই, তাই বার্ষিক বেতনবৃদ্ধির অঙ্ক নির্ণয় করা যায় না।`,
      undefined,
      REF.incrementDate,
    ));
    return { ...base, atMaximum: true };
  }
  if (input.currentBasic < scale.minimum || input.currentBasic > scale.maximum) {
    warnings.push(warn(
      W.BASIC_ABOVE_SCALE,
      'blocker',
      `${taka(input.currentBasic)} ${gradeLabel(input.grade)} এর ২০২৬ স্কেলের (${taka(scale.minimum)}–${taka(scale.maximum)}) বাহিরে।`,
      'গ্রেড ও মূল বেতন যাচাই করুন।',
    ));
    return base;
  }

  let index = stepIndexOf(scale, input.currentBasic);
  if (index < 0) {
    const landing = stepAtOrAbove(scale, input.currentBasic);
    warnings.push(warn(
      W.BASIC_NOT_A_STEP,
      'warning',
      `${taka(input.currentBasic)} এই স্কেলের কোনও মুদ্রিত ধাপ নহে।`,
      landing
        ? `হিসাবের জন্য পরবর্তী উচ্চতর ধাপ ${taka(landing.value)} ধরা হইয়াছে; অঙ্কটি যাচাই করুন।`
        : 'মূল বেতনের অঙ্কটি যাচাই করুন।',
    ));
    if (!landing) return base;
    index = landing.index;
  }

  const next = nextStep(scale, index);
  if (!next) {
    warnings.push(warn(
      W.AT_SCALE_MAXIMUM,
      'warning',
      `আপনি ${gradeLabel(input.grade)} এর সর্বোচ্চ ধাপে (${taka(scale.maximum)}) রহিয়াছেন। সর্বোচ্চ ধাপে পৌঁছানোর পর বার্ষিক বেতনবৃদ্ধি সম্পর্কে গেজেটে সুস্পষ্ট বিধান নাই।`,
      undefined,
      REF.incrementDate,
    ));
    return {
      ...base, ok: true, currentStepIndex: index, atMaximum: true, remainingSteps: 0,
      projection: [],
    };
  }

  const projectYears = input.projectYears ?? 5;
  const projection: { date: string; basic: number }[] = [];
  let cursor = index;
  for (let i = 0; i < projectYears; i += 1) {
    const upcoming = nextStep(scale, cursor);
    if (!upcoming) break;
    projection.push({ date: julyOf(year + i), basic: upcoming.value });
    cursor = upcoming.index;
  }

  return {
    ok: true,
    grade: input.grade,
    currentBasic: input.currentBasic,
    currentStepIndex: index,
    incrementAmount: next.value - input.currentBasic,
    nextBasic: next.value,
    atMaximum: false,
    incrementDate: julyOf(year),
    remainingSteps: scale.stepCount - 1 - index,
    projection,
    warnings,
    sources: [REF.incrementDate, REF.incrementOnFixation],
  };
}

/** "৩ / ১৯" — which step of the scale a basic sits on. */
export function stageLabel(grade: Grade, basic: number): string | null {
  const scale = getScale2026(grade);
  if (!scale) return null;
  const index = stepIndexOf(scale, basic);
  if (index < 0) return null;
  return `${toBnDigits(index + 1)} / ${toBnDigits(scale.stepCount)}`;
}
