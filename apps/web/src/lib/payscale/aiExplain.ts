/**
 * The AI explanation layer.
 *
 * The deterministic engine in `salaryFixation.ts` is the only thing allowed to
 * produce a number. This module lets an AI answer questions *about* a
 * calculation that has already happened — and then checks that it did not make
 * one up.
 *
 * Two mechanisms, because a system prompt alone is a request, not a guarantee:
 *
 *  1. `factBlock()` hands the model every figure the calculation produced, and
 *     the system prompt tells it those are the only figures that exist.
 *  2. `findInventedFigures()` reads the answer back and flags any money-sized
 *     number that is not among them. The UI shows that as a warning on the
 *     answer rather than hiding it, because a wrong salary figure presented
 *     confidently is the exact failure this whole project is built to avoid.
 */

import { oldScaleIncrementedBasic } from './arrears';
import { formatBn, taka, toBnDigits } from './format';
import type { FixationResult } from './types';

export const AI_SYSTEM_PROMPT = [
  'আপনি বাংলাদেশ সরকারের চাকরি (বেতন ও ভাতাদি) আদেশ, ২০২৬ (এস. আর. ও. নং ৩৪৭-আইন/২০২৬) ',
  'সম্পর্কে ব্যাখ্যাকারী। আপনার কাজ কেবল ব্যাখ্যা করা — হিসাব করা নয়।',
  '',
  'কঠোর নিয়ম:',
  '১. কোনও সংখ্যা নিজে গণনা, অনুমান বা তৈরি করিবেন না।',
  '২. কেবল FACTS অংশে দেওয়া সংখ্যাগুলিই ব্যবহার করিবেন, হুবহু।',
  '৩. FACTS-এ নাই এমন কোনও অঙ্ক প্রয়োজন হইলে লিখুন: "এই তথ্য হিসাবের মধ্যে নাই।"',
  '৪. গেজেটে যাহা নাই তাহা সম্পর্কে লিখুন: "গেজেটে এই বিষয়ে সুস্পষ্ট বিধান নাই।"',
  '৫. বিশেষ সুবিধা (১০%/১৫%) বেতন নির্ধারণে যোগ বা বিয়োগ হয় না — ইহা ১ জুলাই ২০২৬ হইতে বিলুপ্ত।',
  '৬. সরকার বা অফিস ভুল করিয়াছে এমন কিছু বলিবেন না।',
  '৭. বাংলায়, সংক্ষেপে (সর্বোচ্চ ৬ বাক্য), প্রযোজ্য অনুচ্ছেদ উল্লেখ করিয়া উত্তর দিন।',
].join('\n');

/** Everything the deterministic engine produced, as plain text for the model. */
export function factBlock(result: FixationResult): string {
  if (!result.ok) {
    return [
      'FACTS:',
      `- গ্রেড: ${toBnDigits(result.input.grade)}`,
      '- এই ক্ষেত্রে বেতন নির্ধারণ করা যায় নাই।',
      ...result.warnings.map((w) => `- সতর্কতা: ${w.message}`),
    ].join('\n');
  }

  const lines = [
    'FACTS (এই সংখ্যাগুলিই একমাত্র সত্য — অন্য কোনও অঙ্ক লিখিবেন না):',
    `- গ্রেড: ${toBnDigits(result.input.grade)}`,
    `- ৩০ জুন ২০২৬ তারিখের মূল বেতন: ${taka(result.input.currentBasic)}`,
  ];
  if (result.oldScale) {
    lines.push(`- ২০১৫ স্কেল: ${taka(result.oldScale.minimum)} – ${taka(result.oldScale.maximum)}`);
  }
  if (result.newScale) {
    lines.push(`- অনুরূপ ২০২৬ স্কেল: ${taka(result.newScale.minimum)} – ${taka(result.newScale.maximum)}`);
  }
  if (result.stepDifference !== null) {
    lines.push(`- ধাপ পার্থক্য (অনুচ্ছেদ ৫(খ)): ${taka(result.stepDifference)}`);
  }
  if (result.fixationBase !== null) {
    lines.push(`- নির্ধারণ-ভিত্তি: ${taka(result.fixationBase)}`);
  }
  lines.push(
    `- অনুচ্ছেদ ৫ অনুযায়ী নির্ধারিত মূল বেতন: ${taka(result.fixedBasic)}`,
    result.incrementApplied
      ? `- অনুচ্ছেদ ৯(২) এর ১ জুলাই ২০২৬ তারিখের বেতনবৃদ্ধি: ${taka(result.incrementAmount)}`
      : '- অনুচ্ছেদ ৯(২) এর বেতনবৃদ্ধি এই ক্ষেত্রে যোগ হয় নাই।',
    `- নতুন মূল বেতন: ${taka(result.newBasic)}`,
    `- মাসিক বৃদ্ধি: ${taka(result.monthlyIncrease)}`,
    `- বার্ষিক বৃদ্ধি: ${taka(result.annualIncrease)}`,
    `- বৃদ্ধির হার: ${result.percentIncrease === null ? '—' : `${toBnDigits(result.percentIncrease.toFixed(2))}%`}`,
  );
  for (const phase of result.phases) {
    lines.push(
      `- ${phase.label} (${phase.from} হইতে ${phase.to ?? 'চলমান'}): বৃদ্ধির ${toBnDigits(phase.percent)}% `
      + `= ${taka(phase.addedToCurrentBasic)} যোগ, প্রাপ্য মূল বেতন ${taka(phase.payable)}`,
    );
  }
  if (result.nextIncrementAmount !== null) {
    lines.push(`- পরবর্তী ধাপে বার্ষিক বেতনবৃদ্ধি (প্রতি ১ জুলাই — অনুচ্ছেদ ৯(১)): ${taka(result.nextIncrementAmount)}`);
  }
  lines.push('- বিশেষ সুবিধা: বেতন নির্ধারণে কোনও প্রভাব নাই (অনুচ্ছেদ ১(৩)(ট) — বিলুপ্ত)।');
  const drawnFromJuly = oldScaleIncrementedBasic(result.input.grade, result.input.currentBasic);
  if (drawnFromJuly !== null) {
    lines.push(
      `- ১ জুলাই ২০২৬ তারিখে ২০১৫ স্কেলে ইনক্রিমেন্ট: ${taka(result.input.currentBasic)} হইতে `
      + `${taka(drawnFromJuly)} (বৃদ্ধি ${taka(drawnFromJuly - result.input.currentBasic)}) — `
      + 'জুলাই হইতে এই অঙ্কেই বেতন আহরিত হইয়াছে।',
    );
  }
  lines.push(
    '- বকেয়া (অনুচ্ছেদ ১(৩)(ঘ)) = প্রাপ্য বাদ ইতোমধ্যে আহরিত। ১ জুলাই ২০২৬ তারিখের পুরাতন '
    + 'স্কেলের ইনক্রিমেন্ট ইতোমধ্যে আহরিত, তাই উহা বকেয়া হইতে বাদ যায়।',
    '- বাড়ি ভাড়া ও অন্যান্য ভাতা ৩১ ডিসেম্বর ২০২৭ পর্যন্ত ৩০ জুন ২০২৬ তারিখের অঙ্কেই প্রাপ্য '
    + '(অনুচ্ছেদ ১৫(১), ১(৩)(ঞ)); বেশি আহরিত হইলে অনুচ্ছেদ ৩২(১০) অনুযায়ী সমন্বয়যোগ্য।',
  );
  for (const warning of result.warnings) {
    lines.push(`- সতর্কতা: ${warning.message}`);
  }
  return lines.join('\n');
}

/** Years and article/percentage numbers a correct answer may legitimately use. */
const ALWAYS_ALLOWED = new Set([
  '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023',
  '2024', '2025', '2026', '2027', '2028', '2029', '2030',
  '1979', '1959', '1871', '1970', '1978', '1981', '1988', '1994',
]);

function digitsOf(value: string | number): string {
  return String(value)
    .replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)))
    .replace(/[^0-9]/g, '');
}

/** Every figure the model is allowed to repeat, as bare digit strings. */
export function allowedFigures(result: FixationResult): Set<string> {
  const allowed = new Set<string>(ALWAYS_ALLOWED);
  const add = (value: number | null | undefined) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return;
    allowed.add(digitsOf(Math.round(value)));
    allowed.add(digitsOf(formatBn(value)));
    allowed.add(digitsOf(value.toFixed(2)));
  };

  add(result.input.currentBasic);
  add(result.input.specialBenefitAmount);
  add(result.fixedBasic);
  add(result.fixationBase);
  add(result.stepDifference);
  add(result.newBasic);
  add(result.incrementAmount);
  add(result.monthlyIncrease);
  add(result.annualIncrease);
  add(result.percentIncrease);
  add(result.nextIncrementAmount);
  for (const scale of [result.oldScale, result.newScale]) {
    if (!scale) continue;
    for (const step of scale.steps) add(step);
  }
  for (const phase of result.phases) {
    add(phase.payable);
    add(phase.addedToCurrentBasic);
    add(phase.percent);
  }
  return allowed;
}

/**
 * Money-sized numbers in `answer` that are not among the calculated figures.
 *
 * Only four digits and up: article numbers, grades and percentages are short
 * and are checked by the reader, whereas a five-figure taka amount is exactly
 * the thing somebody would act on without checking.
 */
export function findInventedFigures(answer: string, allowed: ReadonlySet<string>): string[] {
  const found = new Set<string>();
  const tokens = answer.match(/[০-৯0-9][০-৯0-9,]*/g) ?? [];
  for (const token of tokens) {
    const digits = digitsOf(token);
    if (digits.length < 4) continue;
    if (allowed.has(digits)) continue;
    if (digits.replace(/^0+/, '').length < 4) continue;
    found.add(token);
  }
  return [...found];
}
