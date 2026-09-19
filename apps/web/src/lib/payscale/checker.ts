/**
 * "আমার বেতন ঠিক আছে কি?" — compares a figure somebody was actually given
 * against what this calculator derives from the Gazette.
 *
 * The wording is the point. A mismatch between this calculator and an official
 * fixation is a difference, not a government error: অনুচ্ছেদ ৩২(১০) makes the
 * accounts office's verified বেতন নির্ধারণী বিবরণী the operative document, and
 * there are inputs (higher grade, advance increments, promotion history) this
 * calculator is never told about. So it reports the difference and where to go
 * with it.
 */

import { fixSalary } from './salaryFixation';
import { taka } from './format';
import { W, warn } from './validation';
import type { CheckerResult, FixationInput, Warning } from './types';

export type CheckerInput = FixationInput & {
  /** The 2026 basic the employee has been told they will get. */
  reportedBasic: number;
};

export function checkFixation(input: CheckerInput): CheckerResult {
  const fixation = fixSalary(input);
  const warnings: Warning[] = [];

  if (!fixation.ok || fixation.newBasic === null || fixation.fixedBasic === null) {
    return {
      ok: false,
      expectedFixedBasic: fixation.fixedBasic,
      expectedNewBasic: fixation.newBasic,
      reportedBasic: input.reportedBasic,
      difference: null,
      matches: null,
      matchedAgainst: null,
      verdict: 'গেজেটে প্রয়োজনীয় তথ্য স্পষ্টভাবে পাওয়া যায় নাই অথবা প্রদত্ত তথ্য অসম্পূর্ণ, তাই তুলনা করা যাইতেছে না।',
      warnings: fixation.warnings,
      fixation,
    };
  }

  const matchedAfterIncrement = input.reportedBasic === fixation.newBasic;
  const matchedBeforeIncrement = input.reportedBasic === fixation.fixedBasic;
  const matches = matchedAfterIncrement || matchedBeforeIncrement;
  const diff = input.reportedBasic - fixation.newBasic;

  let verdict: string;
  if (matchedAfterIncrement) {
    verdict = `মিলিয়াছে। এই ক্যালকুলেটরের গেজেট-ভিত্তিক হিসাব অনুযায়ীও ১ জুলাই ২০২৬ তারিখে আপনার মূল বেতন ${taka(fixation.newBasic)} (অনুচ্ছেদ ৫ অনুযায়ী নির্ধারণ + অনুচ্ছেদ ৯(২) এর ১টি বেতনবৃদ্ধি)।`;
  } else if (matchedBeforeIncrement) {
    verdict = `আংশিক মিলিয়াছে। আপনার দেওয়া ${taka(input.reportedBasic)} অনুচ্ছেদ ৫ অনুযায়ী নির্ধারিত বেতনের সমান, তবে ইহাতে অনুচ্ছেদ ৯(২) এর ১ জুলাই ২০২৬ তারিখের বার্ষিক বেতনবৃদ্ধি যোগ হয় নাই। বেতনবৃদ্ধিসহ হয় ${taka(fixation.newBasic)}।`;
    warnings.push(warn(
      W.NO_INCREMENT_NEW_JOINER,
      'info',
      'অনুচ্ছেদ ৯(২) এর শর্তাংশ অনুযায়ী নতুন যোগদানকারীর কোয়ালিফাইং চাকরি ৬ মাসের কম হইলে বেতনবৃদ্ধি প্রাপ্য হন না — সেই ক্ষেত্রে এই অঙ্কই সঠিক হইতে পারে।',
    ));
  } else {
    verdict = `প্রদত্ত তথ্য অনুযায়ী এই ক্যালকুলেটরের হিসাবের সঙ্গে পার্থক্য পাওয়া গেছে: হিসাব অনুযায়ী ${taka(fixation.newBasic)}, আপনি লিখিয়াছেন ${taka(input.reportedBasic)} — পার্থক্য ${taka(Math.abs(diff))}। চূড়ান্ত বেতন নির্ধারণ সংশ্লিষ্ট কর্তৃপক্ষের pay fixation-এর ওপর নির্ভরশীল।`;
    warnings.push(warn(
      'CHECKER_MISMATCH',
      'warning',
      'পার্থক্যের সম্ভাব্য কারণ: উচ্চতর গ্রেড/টাইম স্কেল, অগ্রিম বেতনবৃদ্ধি, পদোন্নতি, ভিন্ন গ্রেড, অথবা ৩০ জুন ২০২৬ তারিখের মূল বেতনের অঙ্কে ভুল।',
      'সার্ভিস বহি ও iBAS++ এর বেতন নির্ধারণী বিবরণী মিলাইয়া দেখুন; প্রয়োজনে সংশ্লিষ্ট হিসাবরক্ষণ অফিসে যোগাযোগ করুন। অনুচ্ছেদ ৩২(১০) অনুযায়ী কম বা বেশি পরিশোধ হইলে তাহা সমন্বয়যোগ্য।',
    ));
  }

  return {
    ok: true,
    expectedFixedBasic: fixation.fixedBasic,
    expectedNewBasic: fixation.newBasic,
    reportedBasic: input.reportedBasic,
    difference: diff,
    matches,
    matchedAgainst: matchedAfterIncrement ? 'after-increment' : matchedBeforeIncrement ? 'fixed' : null,
    verdict,
    warnings: [...fixation.warnings, ...warnings],
    fixation,
  };
}
