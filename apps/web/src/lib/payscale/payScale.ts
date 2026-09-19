/**
 * Access to the two pay scales, and the small amount of arithmetic that is
 * purely about steps.
 *
 * The JSON these read was generated from the Gazette PDF by
 * `scripts/payscale/decode_gazette.py`; it is not typed in by hand, and the
 * generator is in the repo so the numbers can be regenerated and diffed.
 */

import scale2015 from '../../data/payscale/payScale2015.json';
import scale2026 from '../../data/payscale/payScale2026.json';
import sourceRefs from '../../data/payscale/sourceReferences.json';
import type { Grade, GradeScale, PayScaleFile, SpecialFixedPay } from './types';

export const PAY_SCALE_2015 = scale2015 as PayScaleFile;
export const PAY_SCALE_2026 = scale2026 as PayScaleFile;
export const GAZETTE = sourceRefs.gazette;
export const GAZETTE_SECTIONS = sourceRefs.sections;
export const EXTRACTION_METHOD = sourceRefs.extractionMethod;

export function getScale2015(grade: number): GradeScale | null {
  return PAY_SCALE_2015.grades.find((g) => g.grade === grade) ?? null;
}

export function getScale2026(grade: number): GradeScale | null {
  return PAY_SCALE_2026.grades.find((g) => g.grade === grade) ?? null;
}

/** Grade rows for a picker: grade number plus its 2015 range. */
export const GRADES_LIST: { grade: number; minimum: number; maximum: number }[] =
  PAY_SCALE_2015.grades.map((g) => ({ grade: g.grade, minimum: g.minimum, maximum: g.maximum }));

export function specialFixedPay(): SpecialFixedPay[] {
  return PAY_SCALE_2026.specialFixedPay ?? [];
}

export function findSpecialFixedPay(id: string): SpecialFixedPay | null {
  return specialFixedPay().find((p) => p.id === id) ?? null;
}

export function isGrade(value: number): value is Grade {
  return Number.isInteger(value) && value >= 1 && value <= 20;
}

/** Index of an exact step, or -1. Pay is always fixed *on* a step, so an
 *  amount that is not a step is a meaningful thing to detect, not to round. */
export function stepIndexOf(scale: GradeScale, amount: number): number {
  return scale.steps.indexOf(amount);
}

/** The first step greater than or equal to `amount`, which is what
 *  অনুচ্ছেদ ৫(খ)(অ)/(আ) together describe. Null when the amount is above the
 *  top step — a case the Gazette does not legislate for, so it is reported
 *  rather than clamped. */
export function stepAtOrAbove(
  scale: GradeScale,
  amount: number,
): { index: number; value: number; exact: boolean } | null {
  for (let i = 0; i < scale.steps.length; i += 1) {
    const step = scale.steps[i];
    if (step === undefined) continue;
    if (step === amount) return { index: i, value: step, exact: true };
    if (step > amount) return { index: i, value: step, exact: false };
  }
  return null;
}

/** The step after `index`, or null at the top of the scale. */
export function nextStep(scale: GradeScale, index: number): { index: number; value: number } | null {
  const value = scale.steps[index + 1];
  if (value === undefined) return null;
  return { index: index + 1, value };
}

/** Where an amount sits inside a scale, for a "your pay stage" readout. */
export function describeStage(scale: GradeScale, amount: number): string | null {
  const index = stepIndexOf(scale, amount);
  if (index < 0) return null;
  return `${index + 1} / ${scale.stepCount}`;
}

/**
 * Every 2015 grade whose scale contains `basic` as a step.
 *
 * Used by the "smart salary finder": an amount alone does not identify a
 * grade, and several grades really can share a step value, so this returns
 * all of them and the caller refuses to choose.
 */
export function gradesContainingBasic(basic: number): number[] {
  return PAY_SCALE_2015.grades
    .filter((g) => g.steps.includes(basic))
    .map((g) => g.grade);
}

/** The 40%/50% split in অনুচ্ছেদ ১(৩): "৯ম গ্রেড ও তদূর্ধ্ব" is grades 1–9. */
export function isNinthGradeOrAbove(grade: number): boolean {
  return grade <= 9;
}
