/**
 * Allowances — অনুচ্ছেদ ১২–৩০.
 *
 * Two rules shape this module:
 *
 * 1. An allowance is only computed when the Gazette gives both the rule and the
 *    amount. Where it points at an older memorandum instead (festival bonus,
 *    travel, risk allowance), nothing is computed — the user can type a figure
 *    and it is labelled "ব্যবহারকারীর দেওয়া পরিমাণ".
 * 2. Nothing here ever touches basic pay. Allowances are added to basic to make
 *    gross; they are never part of a pay fixation.
 *
 * The dates matter as much as the amounts: অনুচ্ছেদ ১(৩)(ঞ) keeps every
 * allowance at its 30 June 2026 figure until 31 December 2027, so the rates in
 * this order do not actually reach anyone's bank account until January 2028.
 */

import allowanceData from '../../data/payscale/allowanceRules.json';
import { REF, ref } from './sourceReference';
import { W, warn } from './validation';
import { taka, toBnDigits } from './format';
import type { AllowanceLine, Grade, Warning } from './types';

export const ALLOWANCES = allowanceData;
export const ALLOWANCE_RATES_EFFECTIVE_FROM = allowanceData.entitlementRule.newRatesEffectiveFrom;
export const ALLOWANCE_OLD_RATES_UNTIL = allowanceData.entitlementRule.oldRatesUntil;

export type HouseRentZone = 'dhaka' | 'major-city' | 'other';

export type AllowanceInput = {
  grade: Grade;
  /** Basic pay the allowance percentages apply to. */
  basic: number;
  houseRentZone?: HouseRentZone;
  /** Living in government accommodation removes house rent entirely (১৫(২)). */
  governmentAccommodation?: boolean;
  ageYears?: number;
  children?: number;
  specialNeedsChildren?: number;
  /** Grades 11–20 only, and only where lunch is not provided (১৯). */
  tiffinEligible?: boolean;
  /** Grades 11–20 only, and only in a city corporation area (২১). */
  transportEligible?: boolean;
  washingEligible?: boolean;
  chargeAllowance?: boolean;
  entertainmentTier?: string;
  hillArea?: 'none' | 'pahari-sadar' | 'pahari-other';
  haorArea?: boolean;
  trainingDeputation?: boolean;
  /** Figures the Gazette does not fix — typed in by the user. */
  userSupplied?: { id: string; name: string; amount: number }[];
};

function line(
  id: string,
  name: string,
  amount: number,
  basis: string,
  source: AllowanceLine['source'],
): AllowanceLine {
  return { id, name, amount, origin: 'gazette', basis, certainty: 'GAZETTE', source };
}

export function houseRentPercent(grade: Grade, zone: HouseRentZone): number | null {
  const band = allowanceData.houseRent.bands.find((b) => b.grades.includes(grade));
  if (!band) return null;
  return band.rates[zone] ?? null;
}

export function houseRentBandLabel(grade: Grade): string | null {
  return allowanceData.houseRent.bands.find((b) => b.grades.includes(grade))?.label ?? null;
}

export function medicalAllowance(ageYears: number | undefined): number | null {
  if (ageYears === undefined) return null;
  return ageYears <= 50 ? 3000 : 4000;
}

export function mobileAllowance(grade: Grade): number {
  return grade <= 5 ? 500 : 150;
}

/**
 * Builds the allowance lines the Gazette supports for this employee.
 *
 * Every line names its own basis, because "৪৫% of basic" and "৳৫০০ flat" are
 * different kinds of claim and a total that hides the difference is not
 * checkable.
 */
export function calculateAllowances(input: AllowanceInput): {
  lines: AllowanceLine[];
  warnings: Warning[];
} {
  const lines: AllowanceLine[] = [];
  const warnings: Warning[] = [];
  const { grade, basic } = input;

  warnings.push(warn(
    W.ALLOWANCE_DEFERRED,
    'info',
    `অনুচ্ছেদ ১(৩)(ঞ) ও ১২: এই আদেশে নির্ধারিত ভাতার হার ১ জানুয়ারি ২০২৮ হইতে কার্যকর। ${ALLOWANCE_OLD_RATES_UNTIL === '2027-12-31' ? '৩১ ডিসেম্বর ২০২৭' : ALLOWANCE_OLD_RATES_UNTIL} পর্যন্ত ৩০ জুন ২০২৬ তারিখে প্রাপ্য অঙ্কেই ভাতা প্রদেয়।`,
    'অর্থাৎ নিচের ভাতার অঙ্কগুলি ভবিষ্যতের হার — এখনকার বেতন বিলের অঙ্ক নয়।',
    REF.allowanceEntitlement,
  ));

  // --- house rent (১৫) -----------------------------------------------------
  if (input.governmentAccommodation) {
    warnings.push(warn(
      W.ALLOWANCE_NOT_IN_GAZETTE,
      'info',
      'অনুচ্ছেদ ১৫(২): সরকারি বাসস্থানে বসবাসকারী কর্মচারী বাড়ি ভাড়া ভাতা প্রাপ্য হইবেন না।',
      undefined,
      REF.houseRent,
    ));
  } else if (input.houseRentZone) {
    const percent = houseRentPercent(grade, input.houseRentZone);
    if (percent === null) {
      warnings.push(warn(W.ALLOWANCE_NOT_IN_GAZETTE, 'warning', 'এই গ্রেডের জন্য বাড়ি ভাড়ার হার সারণিতে পাওয়া যায় নাই।'));
    } else {
      lines.push(line(
        'house-rent', 'বাড়ি ভাড়া ভাতা',
        Math.round((basic * percent) / 100),
        `মূল বেতনের ${toBnDigits(percent)}% — ${houseRentBandLabel(grade) ?? ''}`,
        REF.houseRent,
      ));
    }
  } else {
    warnings.push(warn(
      W.MISSING_GRADE,
      'warning',
      'বাড়ি ভাড়া ভাতার জন্য কর্মস্থলের এলাকা নির্বাচন করা হয় নাই।',
      'ঢাকা সিটি কর্পোরেশন / অন্যান্য সিটি কর্পোরেশন ও সাভার-কক্সবাজার পৌর এলাকা / অন্যান্য স্থান — যেটি প্রযোজ্য নির্বাচন করুন।',
      REF.houseRent,
    ));
  }

  // --- medical (১৩) --------------------------------------------------------
  const medical = medicalAllowance(input.ageYears);
  if (medical === null) {
    warnings.push(warn(
      W.MISSING_GRADE, 'warning',
      'চিকিৎসা ভাতার হার বয়সের উপর নির্ভরশীল (৫০ বৎসর পর্যন্ত ৳৩,০০০; তাহার পর ৳৪,০০০) — বয়স দেওয়া হয় নাই।',
      'বয়স লিখুন, অথবা এই ভাতা নিজে যোগ করুন।',
      ref({ ruleId: 'ALW-13', article: '১৩', label: 'অনুচ্ছেদ ১৩ — চিকিৎসা ভাতা' }),
    ));
  } else {
    lines.push(line('medical', 'চিকিৎসা ভাতা', medical,
      input.ageYears !== undefined && input.ageYears <= 50 ? '৫০ বৎসর বয়স পর্যন্ত — মাসিক নির্ধারিত' : '৫০ বৎসর ১ দিন হইতে পিআরএল শেষ পর্যন্ত — মাসিক নির্ধারিত',
      ref({ ruleId: 'ALW-13', article: '১৩', label: 'অনুচ্ছেদ ১৩ — চিকিৎসা ভাতা' })));
  }

  // --- education (১৮) ------------------------------------------------------
  if (input.children && input.children > 0) {
    const counted = Math.min(input.children, 2);
    lines.push(line('education', 'শিক্ষা সহায়ক ভাতা', counted * 500,
      `সন্তান প্রতি ৳৫০০, সর্বোচ্চ ২ সন্তান (গণনায় ${toBnDigits(counted)} জন)`,
      ref({ ruleId: 'ALW-18', article: '১৮', label: 'অনুচ্ছেদ ১৮ — শিক্ষা সহায়ক ভাতা' })));
    if (input.children > 2) {
      warnings.push(warn(W.ALLOWANCE_DEFERRED, 'info', 'অনুচ্ছেদ ১৮(১): অনধিক ২ সন্তানের জন্য সর্বোচ্চ মাসিক ৳১,০০০।'));
    }
  }

  // --- special needs child (২৮) -------------------------------------------
  if (input.specialNeedsChildren && input.specialNeedsChildren > 0) {
    const counted = Math.min(input.specialNeedsChildren, 2);
    lines.push(line('special-needs-child', 'বিশেষ চাহিদাসম্পন্ন (প্রতিবন্ধী) সন্তান ভাতা', counted * 3000,
      `সন্তান প্রতি ৳৩,০০০, অনধিক ২ সন্তান (গণনায় ${toBnDigits(counted)} জন)`,
      ref({ ruleId: 'ALW-28', article: '২৮', label: 'অনুচ্ছেদ ২৮' })));
  }

  // --- tiffin (১৯), transport (২১), mobile (২২), washing (২৩) -------------
  if (input.tiffinEligible) {
    if (grade >= 11) {
      lines.push(line('tiffin', 'টিফিন ভাতা', 500, 'মাসিক নির্ধারিত — ১১তম হইতে ২০তম গ্রেড',
        ref({ ruleId: 'ALW-19', article: '১৯', label: 'অনুচ্ছেদ ১৯' })));
    } else {
      warnings.push(warn(W.ALLOWANCE_NOT_IN_GAZETTE, 'warning',
        'অনুচ্ছেদ ১৯ অনুযায়ী টিফিন ভাতা কেবল ১১তম হইতে ২০তম গ্রেডের কর্মচারীর জন্য।'));
    }
  }
  if (input.transportEligible) {
    if (grade >= 11) {
      lines.push(line('transport', 'যাতায়াত ভাতা', 600, 'মাসিক নির্ধারিত — ১১তম-২০তম গ্রেড, সিটি কর্পোরেশন এলাকায় কর্মস্থল',
        ref({ ruleId: 'ALW-21', article: '২১', label: 'অনুচ্ছেদ ২১' })));
    } else {
      warnings.push(warn(W.ALLOWANCE_NOT_IN_GAZETTE, 'warning',
        'অনুচ্ছেদ ২১ অনুযায়ী যাতায়াত ভাতা কেবল ১১তম হইতে ২০তম গ্রেডের জন্য।'));
    }
  }
  lines.push(line('mobile', 'মোবাইল ভাতা', mobileAllowance(grade),
    grade <= 5 ? 'মাসিক নির্ধারিত — ৫ম গ্রেড ও তদূর্ধ্ব' : 'মাসিক নির্ধারিত — ৬ষ্ঠ হইতে ২০তম গ্রেড',
    ref({ ruleId: 'ALW-22', article: '২২', label: 'অনুচ্ছেদ ২২' })));
  if (input.washingEligible) {
    lines.push(line('washing', 'ধোলাই ভাতা', 300, 'মাসিক নির্ধারিত — যাঁহাদের ক্ষেত্রে প্রযোজ্য',
      ref({ ruleId: 'ALW-23', article: '২৩', label: 'অনুচ্ছেদ ২৩' })));
  }
  if (input.chargeAllowance) {
    lines.push(line('charge', 'কার্যভার ভাতা', 1500, 'মাসিক নির্ধারিত — চলতি বা অতিরিক্ত দায়িত্ব',
      ref({ ruleId: 'ALW-20', article: '২০', label: 'অনুচ্ছেদ ২০' })));
  }

  // --- entertainment (২৪) --------------------------------------------------
  if (input.entertainmentTier) {
    const tier = allowanceData.fixedAmountAllowances
      .find((a) => a.id === 'entertainment')?.tiers
      ?.find((t) => t.applies === input.entertainmentTier);
    if (tier) {
      lines.push(line('entertainment', 'আপ্যায়ন ভাতা', tier.amount, `মাসিক নির্ধারিত — ${tier.applies}`,
        ref({ ruleId: 'ALW-24', article: '২৪', label: 'অনুচ্ছেদ ২৪' })));
    }
  }

  // --- percentage allowances with caps (২৫, ২৬, ২৭) ------------------------
  if (input.hillArea && input.hillArea !== 'none') {
    const cap = input.hillArea === 'pahari-sadar' ? 5000 : 5500;
    const raw = Math.round((basic * 20) / 100);
    lines.push(line('pahari', 'পাহাড়ি ভাতা', Math.min(raw, cap),
      `মূল বেতনের ২০%, সর্বোচ্চ ${taka(cap)}${raw > cap ? ' (সীমা প্রযোজ্য)' : ''}`,
      ref({ ruleId: 'ALW-25', article: '২৫', label: 'অনুচ্ছেদ ২৫' })));
  }
  if (input.haorArea) {
    const raw = Math.round((basic * 20) / 100);
    lines.push(line('haor', 'হাওড়/দ্বীপ/চর ভাতা', Math.min(raw, 5000),
      `মূল বেতনের ২০%, সর্বোচ্চ ${taka(5000)}${raw > 5000 ? ' (সীমা প্রযোজ্য)' : ''}`,
      ref({ ruleId: 'ALW-26', article: '২৬', label: 'অনুচ্ছেদ ২৬' })));
  }
  if (input.trainingDeputation) {
    if (grade <= 9) {
      lines.push(line('training-deputation', 'প্রশিক্ষণ প্রতিষ্ঠানে প্রেষণ ভাতা', Math.round((basic * 10) / 100),
        'মূল বেতনের ১০% — ৯ম গ্রেড ও তদূর্ধ্ব, শুধু প্রশিক্ষণ কাজে প্রেষণ',
        ref({ ruleId: 'ALW-27', article: '২৭', label: 'অনুচ্ছেদ ২৭' })));
    } else {
      warnings.push(warn(W.ALLOWANCE_NOT_IN_GAZETTE, 'warning',
        'অনুচ্ছেদ ২৭ অনুযায়ী প্রেষণ ভাতা কেবল ৯ম গ্রেড ও তদূর্ধ্ব পর্যায়ের কর্মচারীর জন্য।'));
    }
  }

  // --- user-supplied figures ----------------------------------------------
  for (const item of input.userSupplied ?? []) {
    if (!Number.isFinite(item.amount) || item.amount <= 0) continue;
    lines.push({
      id: item.id,
      name: item.name,
      amount: item.amount,
      origin: 'user',
      basis: 'ব্যবহারকারীর দেওয়া পরিমাণ',
      certainty: 'ASSUMPTION',
    });
  }
  if ((input.userSupplied ?? []).some((i) => i.amount > 0)) {
    warnings.push(warn(
      W.ALLOWANCE_USER_SUPPLIED,
      'info',
      'আপনার নিজে লেখা ভাতার অঙ্ক গেজেট দ্বারা যাচাই করা হয় নাই; উহা “ব্যবহারকারীর দেওয়া পরিমাণ” হিসাবে চিহ্নিত।',
    ));
  }

  return { lines, warnings };
}

/** বাংলা নববর্ষ ভাতা — yearly, 15% of basic (অনুচ্ছেদ ১৪). Kept out of the
 *  monthly gross on purpose: it is paid once a year, not every month. */
export function banglaNoboborshoAllowance(basic: number): AllowanceLine {
  return {
    id: 'bangla-noboborsho',
    name: 'বাংলা নববর্ষ ভাতা (বাৎসরিক)',
    amount: Math.round((basic * 15) / 100),
    origin: 'gazette',
    basis: 'আহরিত মূল বেতনের ১৫% — বৎসরে একবার',
    certainty: 'GAZETTE',
    source: ref({ ruleId: 'ALW-14', article: '১৪', label: 'অনুচ্ছেদ ১৪ — বাংলা নববর্ষ ভাতা' }),
  };
}
