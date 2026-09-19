/**
 * Citations.
 *
 * Every number this calculator shows has to be traceable to a place in the
 * Gazette. `ref()` builds a citation from data that is in the repo; `unverified()`
 * exists for the case where a claim cannot be tied to a specific article, and
 * makes that visible instead of inventing a page number.
 */

import rules from '../../data/payscale/payRules2026.json';
import benefits from '../../data/payscale/benefitRules.json';
import allowances from '../../data/payscale/allowanceRules.json';
import pension from '../../data/payscale/pensionRules.json';
import refs from '../../data/payscale/sourceReferences.json';
import { toBnDigits } from './format';
import type { SourceRef } from './types';

export const GAZETTE_META = refs.gazette;

export const GAZETTE_CITATION =
  `${GAZETTE_META.publication}, ${GAZETTE_META.gazetteDateBn} — ${GAZETTE_META.sro}`;

type RefInput = {
  ruleId?: string;
  article: string;
  label: string;
  pdfPage?: number;
  printedPage?: string;
  quote?: string;
};

export function ref(input: RefInput): SourceRef {
  const section = refs.sections.find((s) => s.article === input.article);
  return {
    ruleId: input.ruleId,
    label: input.label,
    article: input.article,
    pdfPage: input.pdfPage ?? section?.pdfPage,
    printedPage: input.printedPage ?? section?.printedPage,
    quote: input.quote,
    verified: true,
  };
}

/** For a statement the Gazette does not pin to an article. The UI renders
 *  these as "Source reference could not be confidently verified." */
export function unverified(label: string): SourceRef {
  return { label, verified: false };
}

/** Human-readable citation line, e.g.
 *  "গেজেট: … | অনুচ্ছেদ ৫(খ) | পৃষ্ঠা ২৫১৯৯ (PDF পৃষ্ঠা ৭)". */
export function citationLine(source: SourceRef): string {
  if (!source.verified) return 'সূত্র নিশ্চিতভাবে যাচাই করা যায় নাই।';
  const parts = [GAZETTE_META.sro];
  if (source.article) parts.push(`অনুচ্ছেদ ${source.article}`);
  if (source.printedPage) parts.push(`গেজেট পৃষ্ঠা ${toBnDigits(source.printedPage)}`);
  if (source.pdfPage) parts.push(`PDF পৃষ্ঠা ${toBnDigits(source.pdfPage)}`);
  return parts.join(' • ');
}

// --- named references used across the engine -------------------------------

const appointmentRule = (ruleId: string) =>
  rules.firstAppointmentRules.find((r) => r.ruleId === ruleId)?.statement;

export const REF = {
  correspondingScale: ref({
    ruleId: rules.correspondingScaleRule.ruleId,
    article: '৩',
    label: 'অনুরূপ স্কেল (corresponding scale)',
    quote: rules.correspondingScaleRule.statement,
  }),
  entitlement: ref({
    ruleId: rules.entitlementRule.ruleId,
    article: '৪',
    label: 'জাতীয় বেতনস্কেল, ২০২৬ এর প্রাপ্যতা',
    quote: rules.entitlementRule.statement,
  }),
  fixationFirstStep: ref({
    ruleId: 'FIX-5-KA',
    article: '৫',
    label: 'অনুচ্ছেদ ৫(ক) — প্রারম্ভিক ধাপ',
  }),
  fixationDifference: ref({
    ruleId: 'FIX-5-KHA',
    article: '৫',
    label: 'অনুচ্ছেদ ৫(খ) — পার্থক্য পদ্ধতি',
  }),
  fixationExactStep: ref({
    ruleId: 'FIX-5-KHA-A',
    article: '৫',
    label: 'অনুচ্ছেদ ৫(খ)(অ) — সমান ধাপ',
  }),
  fixationNextStep: ref({
    ruleId: 'FIX-5-KHA-AA',
    article: '৫',
    label: 'অনুচ্ছেদ ৫(খ)(আ) — পরবর্তী উচ্চতর ধাপ',
  }),
  fixedPayPosts: ref({
    ruleId: 'FIX-5-GA',
    article: '৩(২)',
    label: 'অনুচ্ছেদ ৩(২) ও ৫(গ) — নির্ধারিত বেতন',
  }),
  incrementDate: ref({
    ruleId: 'INC-9-1',
    article: '৯',
    label: 'অনুচ্ছেদ ৯(১) — বার্ষিক বেতনবৃদ্ধির তারিখ',
    quote: rules.incrementRules[0]?.statement,
  }),
  incrementOnFixation: ref({
    ruleId: 'INC-9-2',
    article: '৯',
    label: 'অনুচ্ছেদ ৯(২) — নির্ধারণের পর ১টি বেতনবৃদ্ধি',
    quote: rules.incrementRules[1]?.statement,
  }),
  phase1: ref({
    ruleId: 'TRANS-1-3-KA',
    article: '১(৩)',
    label: 'অনুচ্ছেদ ১(৩)(ক) — ৪০%/৫০%',
    quote: rules.transitionRules[0]?.sourceText,
  }),
  phase2: ref({
    ruleId: 'TRANS-1-3-KHA',
    article: '১(৩)',
    label: 'অনুচ্ছেদ ১(৩)(খ) — ৭০%/৭৫%',
    quote: rules.transitionRules[1]?.sourceText,
  }),
  phase3: ref({
    ruleId: 'TRANS-1-3-GA',
    article: '১(৩)',
    label: 'অনুচ্ছেদ ১(৩)(গ) — শতভাগ',
    quote: rules.transitionRules[2]?.sourceText,
  }),
  specialBenefit: ref({
    ruleId: benefits.specialBenefit2015.ruleId,
    article: '১(৩)',
    label: 'অনুচ্ছেদ ১(৩)(ট) — বিশেষ সুবিধা বিলুপ্তি',
    quote: benefits.specialBenefit2015.sourceText,
  }),
  allowanceEntitlement: ref({
    ruleId: allowances.entitlementRule.ruleId,
    article: '১২',
    label: 'অনুচ্ছেদ ১২ — ভাতাদির প্রাপ্যতা',
    quote: allowances.entitlementRule.statement,
  }),
  houseRent: ref({
    ruleId: allowances.houseRent.ruleId,
    article: '১৫',
    label: 'অনুচ্ছেদ ১৫ — বাড়ি ভাড়া ভাতা',
  }),
  pensionTable: ref({
    ruleId: pension.netPensionTable.ruleId,
    article: '৮',
    label: 'অনুচ্ছেদ ৮(১)(খ) — নিট পেনশন সারণি',
  }),
  higherGrade: ref({
    ruleId: 'HG-6-1',
    article: '৬',
    label: 'অনুচ্ছেদ ৬ — উচ্চতর গ্রেডের প্রাপ্যতা',
  }),
  appointmentStart: ref({
    ruleId: 'APP-10-1',
    article: '১০(১)',
    label: 'অনুচ্ছেদ ১০(১) — নিয়োগে প্রারম্ভিক বেতন',
    pdfPage: 11,
    printedPage: '25203',
    quote: appointmentRule('APP-10-1'),
  }),
  appointmentProviso: ref({
    ruleId: rules.firstAppointmentProviso.ruleId,
    article: '১০(১)',
    label: 'অনুচ্ছেদ ১০(১) শর্তাংশ — ৯ম গ্রেড বা তদূর্ধ্ব',
    pdfPage: 11,
    printedPage: '25203',
    quote: rules.firstAppointmentProviso.statement,
  }),
  appointmentDegree: ref({
    ruleId: 'APP-10-1-KA',
    article: '১০(১)(ক)',
    label: 'অনুচ্ছেদ ১০(১)(ক) — এম.বি.বি.এস./ইঞ্জিনিয়ারিং/আর্কিটেকচার: ১টি অগ্রিম বেতনবৃদ্ধি',
    pdfPage: 11,
    printedPage: '25203',
    quote: appointmentRule('APP-10-1-KA'),
  }),
  appointmentMasters: ref({
    ruleId: 'APP-10-1-KHA',
    article: '১০(১)(খ)',
    label: 'অনুচ্ছেদ ১০(১)(খ) — ফিজিক্যাল প্ল্যানিং/আইনে স্নাতকোত্তর: ২টি অগ্রিম বেতনবৃদ্ধি',
    pdfPage: 11,
    printedPage: '25203',
    quote: appointmentRule('APP-10-1-KHA'),
  }),
  appointmentLicence: ref({
    ruleId: 'APP-10-1-GA',
    article: '১০(১)(গ)',
    label: 'অনুচ্ছেদ ১০(১)(গ) — চিকিৎসা অনুষদের লাইসেন্স: ১টি অগ্রিম বেতনবৃদ্ধি',
    pdfPage: 11,
    printedPage: '25203',
    quote: appointmentRule('APP-10-1-GA'),
  }),
  appointmentAdd: ref({
    ruleId: 'APP-10-1-UNG',
    article: '১০(১)(ঙ)',
    label: 'অনুচ্ছেদ ১০(১)(ঙ) — প্রারম্ভিক ধাপ + অতিরিক্ত বেতনবৃদ্ধি',
    pdfPage: 12,
    printedPage: '25204',
  }),
  appointmentSaving: ref({
    ruleId: 'APP-10-1-GHA',
    article: '১০(১)(ঘ)',
    label: 'অনুচ্ছেদ ১০(১)(ঘ) — পূর্ববর্তী স্মারকসমূহ বলবৎ (বিসিএস স্বাস্থ্য ইত্যাদি)',
    pdfPage: 12,
    printedPage: '25204',
  }),
  appointmentOnce: ref({
    ruleId: 'APP-10-1-CHA',
    article: '১০(১)(চ)',
    label: 'অনুচ্ছেদ ১০(১)(চ) — অগ্রিম বেতনবৃদ্ধি কেবল প্রথম নিয়োগে',
    pdfPage: 12,
    printedPage: '25204',
    quote: appointmentRule('APP-10-1-CHA'),
  }),
  appointmentBcs: ref({
    ruleId: 'APP-10-2',
    article: '১০(২)',
    label: 'অনুচ্ছেদ ১০(২) — বিসিএস ক্যাডার, ৯ম গ্রেড: ১টি অতিরিক্ত অগ্রিম বেতনবৃদ্ধি',
    pdfPage: 12,
    printedPage: '25204',
    quote: appointmentRule('APP-10-2'),
  }),
  appointmentBpsc: ref({
    ruleId: 'APP-10-3',
    article: '১০(৩)',
    label: 'অনুচ্ছেদ ১০(৩) — বিপিএসসি নন-ক্যাডার, ৯ম গ্রেড: প্রারম্ভিক ধাপ',
    pdfPage: 12,
    printedPage: '25204',
    quote: appointmentRule('APP-10-3'),
  }),
  appointmentTransition: ref({
    ruleId: 'APP-10-4',
    article: '১০(৪)',
    label: 'অনুচ্ছেদ ১০(৪) — ১ জুলাই ২০২৬–৩০ জুন ২০২৭ এর নিয়োগে শতাংশ প্রদান',
    pdfPage: 12,
    printedPage: '25204',
    quote: appointmentRule('APP-10-4'),
  }),
  exclusions: ref({
    ruleId: rules.exclusions.ruleId,
    article: '১(৪)',
    label: 'অনুচ্ছেদ ১(৪) — প্রযোজ্যতার বাহিরে',
  }),
} as const;
