/**
 * Input validation and the warning vocabulary.
 *
 * The rule this module exists to enforce: when something needed to compute a
 * figure is missing or ambiguous, the calculator asks for it or says it cannot
 * be sure. It never picks a value. So `blockers()` genuinely stops a
 * calculation, while the rest of the warnings travel alongside a result the
 * user can still read.
 */

import { getScale2015, gradesContainingBasic, isGrade, stepIndexOf } from './payScale';
import { REF } from './sourceReference';
import { formatBn, gradeLabel, taka, toBnDigits } from './format';
import type { FixationInput, Grade, Warning } from './types';

export const W = {
  MISSING_GRADE: 'MISSING_GRADE',
  INVALID_GRADE: 'INVALID_GRADE',
  MISSING_BASIC: 'MISSING_BASIC',
  INVALID_BASIC: 'INVALID_BASIC',
  BASIC_BELOW_SCALE: 'BASIC_BELOW_SCALE',
  BASIC_ABOVE_SCALE: 'BASIC_ABOVE_SCALE',
  BASIC_NOT_A_STEP: 'BASIC_NOT_A_STEP',
  MULTIPLE_GRADES: 'MULTIPLE_GRADES',
  FIXATION_ABOVE_TOP_STEP: 'FIXATION_ABOVE_TOP_STEP',
  AT_SCALE_MAXIMUM: 'AT_SCALE_MAXIMUM',
  SPECIAL_BENEFIT_ENTERED: 'SPECIAL_BENEFIT_ENTERED',
  SPECIAL_BENEFIT_UNKNOWN: 'SPECIAL_BENEFIT_UNKNOWN',
  ROUNDING_NOT_IN_GAZETTE: 'ROUNDING_NOT_IN_GAZETTE',
  CATEGORY_NO_FIXATION: 'CATEGORY_NO_FIXATION',
  CATEGORY_PENSION_ONLY: 'CATEGORY_PENSION_ONLY',
  CATEGORY_PROMOTION: 'CATEGORY_PROMOTION',
  CATEGORY_DEPUTATION: 'CATEGORY_DEPUTATION',
  CATEGORY_ON_LEAVE: 'CATEGORY_ON_LEAVE',
  CATEGORY_SUSPENDED: 'CATEGORY_SUSPENDED',
  QUALIFYING_SERVICE_UNKNOWN: 'QUALIFYING_SERVICE_UNKNOWN',
  NO_INCREMENT_NEW_JOINER: 'NO_INCREMENT_NEW_JOINER',
  FIXED_PAY_POST: 'FIXED_PAY_POST',
  ALLOWANCE_USER_SUPPLIED: 'ALLOWANCE_USER_SUPPLIED',
  ALLOWANCE_NOT_IN_GAZETTE: 'ALLOWANCE_NOT_IN_GAZETTE',
  ALLOWANCE_DEFERRED: 'ALLOWANCE_DEFERRED',
  EXCLUDED_SERVICE: 'EXCLUDED_SERVICE',
  APPOINTMENT_PROVISO: 'APPOINTMENT_PROVISO',
  APPOINTMENT_TRACK_GRADE: 'APPOINTMENT_TRACK_GRADE',
  APPOINTMENT_BPSC_NO_INCREMENT: 'APPOINTMENT_BPSC_NO_INCREMENT',
  ADVANCE_INCREMENT_UNIT: 'ADVANCE_INCREMENT_UNIT',
  ADVANCE_INCREMENT_STACKING: 'ADVANCE_INCREMENT_STACKING',
  ADVANCE_NOT_ENOUGH_STEPS: 'ADVANCE_NOT_ENOUGH_STEPS',
  APPOINTMENT_OLD_BASE: 'APPOINTMENT_OLD_BASE',
} as const;

export function warn(
  code: string,
  level: Warning['level'],
  message: string,
  action?: string,
  source?: Warning['source'],
): Warning {
  return { code, level, message, action, source };
}

export function blockers(warnings: readonly Warning[]): Warning[] {
  return warnings.filter((w) => w.level === 'blocker');
}

export function hasBlocker(warnings: readonly Warning[]): boolean {
  return warnings.some((w) => w.level === 'blocker');
}

/**
 * Checks a grade + basic pair against the 2015 scale.
 *
 * A basic that is not one of the printed steps is a warning, not an error:
 * people really do hold non-step pay after an advance increment or a court
 * order, and অনুচ্ছেদ ৫(খ) is arithmetic that still works on such an amount.
 * What the calculator will not do is quietly move it to the nearest step.
 */
export function validateFixationInput(input: Partial<FixationInput>): Warning[] {
  const out: Warning[] = [];

  if (input.grade === undefined || input.grade === null) {
    out.push(warn(W.MISSING_GRADE, 'blocker', 'গ্রেড নির্বাচন করা হয় নাই।', 'আপনার বর্তমান গ্রেড (১–২০) নির্বাচন করুন।'));
  } else if (!isGrade(input.grade)) {
    out.push(warn(W.INVALID_GRADE, 'blocker', `গ্রেড ${toBnDigits(String(input.grade))} বৈধ নহে।`, 'গ্রেড ১ হইতে ২০ এর মধ্যে হইতে হইবে।'));
  }

  const basic = input.currentBasic;
  if (basic === undefined || basic === null || Number.isNaN(basic)) {
    out.push(warn(W.MISSING_BASIC, 'blocker', '৩০ জুন ২০২৬ তারিখের মূল বেতন দেওয়া হয় নাই।', 'আপনার বর্তমান মূল বেতন (Basic Pay) লিখুন — ভাতা বাদে।'));
  } else if (!Number.isFinite(basic) || basic <= 0 || !Number.isInteger(basic)) {
    out.push(warn(W.INVALID_BASIC, 'blocker', 'মূল বেতন একটি ধনাত্মক পূর্ণসংখ্যা হইতে হইবে।'));
  }

  if (input.grade !== undefined && isGrade(input.grade) && typeof basic === 'number' && Number.isFinite(basic) && basic > 0) {
    const scale = getScale2015(input.grade);
    if (!scale) {
      out.push(warn(W.INVALID_GRADE, 'blocker', 'এই গ্রেডের ২০১৫ স্কেল পাওয়া যায় নাই।'));
    } else if (basic < scale.minimum) {
      out.push(warn(
        W.BASIC_BELOW_SCALE,
        'blocker',
        `${gradeLabel(input.grade)} এর ২০১৫ স্কেলের সর্বনিম্ন ধাপ ${taka(scale.minimum)}; আপনার দেওয়া ${taka(basic)} উহার কম।`,
        'গ্রেড বা মূল বেতন পুনরায় যাচাই করুন।',
        REF.correspondingScale,
      ));
    } else if (basic > scale.maximum) {
      out.push(warn(
        W.BASIC_ABOVE_SCALE,
        'warning',
        `${gradeLabel(input.grade)} এর ২০১৫ স্কেলের সর্বোচ্চ ধাপ ${taka(scale.maximum)}; আপনার দেওয়া ${taka(basic)} উহার বেশি।`,
        'উচ্চতর গ্রেড/টাইম স্কেল প্রাপ্ত হইলে সেই গ্রেড নির্বাচন করুন। গ্রেড সঠিক হইলে ফলাফল নিশ্চিত নহে।',
        REF.correspondingScale,
      ));
    } else if (stepIndexOf(scale, basic) < 0) {
      out.push(warn(
        W.BASIC_NOT_A_STEP,
        'warning',
        `${taka(basic)} ${gradeLabel(input.grade)} এর ২০১৫ স্কেলের কোনও ধাপের সহিত মিলে নাই।`,
        'সার্ভিস বহি বা সর্বশেষ বেতন বিল হইতে মূল বেতন যাচাই করুন। গেজেটের ৫(খ) পদ্ধতি এই অঙ্কেও প্রয়োগ করা হইয়াছে, তবে ধাপ না মিলিলে ফলাফল নিশ্চিত নহে।',
        REF.fixationDifference,
      ));
    }
  }

  return out;
}

/**
 * The "smart salary finder": which grades could a bare basic belong to?
 *
 * Returns the candidates rather than a guess. If more than one grade has that
 * step — and several do, because the 2015 scales overlap — the caller must ask
 * for more information instead of choosing.
 */
export function findGradesForBasic(basic: number): {
  candidates: number[];
  warnings: Warning[];
} {
  const candidates = gradesContainingBasic(basic);
  const warnings: Warning[] = [];
  if (candidates.length === 0) {
    warnings.push(warn(
      W.BASIC_NOT_A_STEP,
      'warning',
      `${taka(basic)} ২০১৫ বেতনস্কেলের কোনও গ্রেডের ধাপ হিসাবে পাওয়া যায় নাই।`,
      'মূল বেতনের অঙ্কটি যাচাই করুন, অথবা গ্রেড নিজে নির্বাচন করুন।',
    ));
  } else if (candidates.length > 1) {
    warnings.push(warn(
      W.MULTIPLE_GRADES,
      'warning',
      `একাধিক সম্ভাব্য গ্রেড পাওয়া গেছে: ${candidates.map(gradeLabel).join(', ')}। আরও তথ্য প্রয়োজন।`,
      'আপনার পদের গ্রেড নির্বাচন করুন — কেবল মূল বেতন দিয়া গ্রেড নিশ্চিত করা সম্ভব নয়।',
    ));
  }
  return { candidates, warnings };
}

/** Warnings attached to an employee category, all of which change what the
 *  Gazette lets the calculator claim. */
export function categoryWarnings(category: FixationInput['category']): Warning[] {
  switch (category) {
    case 'retiring-2026-07-01':
      return [warn(
        W.CATEGORY_NO_FIXATION,
        'blocker',
        'অনুচ্ছেদ ৫(ঝ) অনুযায়ী ১ জুলাই ২০২৬ তারিখে যিনি অবসরে যাইবেন, তিনি জাতীয় বেতনস্কেল, ২০২৬ অনুযায়ী বেতন নির্ধারণের সুবিধা প্রাপ্য হইবেন না।',
        undefined,
        REF.entitlement,
      )];
    case 'prl':
      return [warn(
        W.CATEGORY_PENSION_ONLY,
        'warning',
        'অনুচ্ছেদ ৫(জ) অনুযায়ী অবসর-উত্তর ছুটিতে থাকা কর্মচারীর বেতন শুধু পেনশন নির্ধারণের জন্য অনুরূপ স্কেলে নির্ধারিত হইবে; ছুটির বেতন বর্তমান বেতনস্কেলের ভিত্তিতেই চলিবে।',
        'নিচের হিসাব পেনশন নির্ধারণের ভিত্তি হিসাবে দেখুন, মাসিক প্রাপ্য বেতন হিসাবে নয়।',
      )];
    case 'promoted-2026-07-01':
      return [warn(
        W.CATEGORY_PROMOTION,
        'warning',
        'অনুচ্ছেদ ৫(ঘ) অনুযায়ী প্রথমে নিম্নপদে বেতন নির্ধারণ করিয়া পরে পদোন্নতিপ্রাপ্ত পদে প্রচলিত বিধিবিধান অনুযায়ী নির্ধারণ করিতে হইবে।',
        'এই ক্যালকুলেটর নিম্নপদে নির্ধারণ পর্যন্ত হিসাব দেখাইতেছে। পদোন্নতিপ্রাপ্ত পদের চূড়ান্ত নির্ধারণ এই গেজেটে বর্ণিত নাই।',
      )];
    case 'deputation':
      return [warn(
        W.CATEGORY_DEPUTATION,
        'info',
        'অনুচ্ছেদ ৫(ঙ) অনুযায়ী প্রেষণে কর্মরত না থাকিলে মূল অফিসে যে বেতন প্রাপ্য হইতেন সেই ভিত্তিতে নির্ধারণ হইবে।',
        'মূল অফিসের প্রাপ্য মূল বেতন লিখুন, প্রেষণে আহরিত বেতন নয়।',
      )];
    case 'on-leave':
      return [warn(
        W.CATEGORY_ON_LEAVE,
        'info',
        'অনুচ্ছেদ ৫(চ) অনুযায়ী ছুটিতে না থাকিলে বর্তমান বেতন যাহা হইত সেই ভিত্তিতে নির্ধারণ হইবে; নির্ধারণজনিত আর্থিক সুবিধা ছুটির সময়ের জন্য প্রাপ্য হইবেন না।',
      )];
    case 'suspended':
      return [warn(
        W.CATEGORY_SUSPENDED,
        'blocker',
        'অনুচ্ছেদ ৫(ছ) অনুযায়ী সাময়িক বরখাস্ত কর্মচারীর বেতন পুনর্বহাল ও কাজে যোগদানের পূর্বে নির্ধারণ করা হইবে না।',
        'পুনর্বহালের পর প্রথমে ৩০ জুন ২০২৬ তারিখে বর্তমান বেতনস্কেলে নির্ধারণ করিয়া অতঃপর অনুরূপ স্কেলে নির্ধারণ হইবে।',
      )];
    case 'regular':
    default:
      return [];
  }
}

/** Shown wherever a percentage of the increase is computed. */
export function roundingWarning(): Warning {
  return warn(
    W.ROUNDING_NOT_IN_GAZETTE,
    'info',
    'অনুচ্ছেদ ১(৩) এর শতকরা হিসাবের ভগ্নাংশ কীভাবে রাউন্ড হইবে গেজেটে বলা নাই।',
    `এই ক্যালকুলেটর নিকটতম পূর্ণ টাকায় রাউন্ড করিয়াছে (${formatBn(0)} দশমিক)। iBAS++ এর ফলাফল সামান্য ভিন্ন হইতে পারে।`,
  );
}
