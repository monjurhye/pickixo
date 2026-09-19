/**
 * Pay on first appointment — অনুচ্ছেদ ১০ of the 2026 Order.
 *
 * Someone appointed on or after 1 July 2026 has no 2015 pay to fix, so
 * অনুচ্ছেদ ৫ does not apply to them. They start at the first step of the 2026
 * scale for the post (১০(১), ১০(১)(ঙ)) and, if the post is grade 9 or above,
 * may carry advance increments on top:
 *
 *   ১০(১)(ক)  MBBS / architecture / engineering degree ......... 1
 *   ১০(১)(খ)  engineering/architecture Masters, physical
 *            planning degree, or law honours + Masters .......... 2
 *   ১০(১)(গ)  licence from a medical faculty ..................... 1
 *   ১০(২)    BCS cadre, direct entry to grade 9 ................ +1 more
 *   ১০(৩)    BPSC non-cadre, grade 9 ........................... first step
 *
 * The Gazette gives the *number* of advance increments, never a taka figure.
 * Following অনুচ্ছেদ ৯ an increment is a move to the next printed step, so that
 * is what is counted here — and the result says so, because it is an
 * assumption the Gazette does not spell out.
 *
 * ১০(৪) then applies the অনুচ্ছেদ ১(৩) transition percentages to people who
 * join before 1 July 2027: the pay is the pay they would have drawn had they
 * joined on 30 June 2026, plus the applicable share of the difference.
 */

import { getScale2015, getScale2026, isGrade, isNinthGradeOrAbove, nextStep } from './payScale';
import { REF } from './sourceReference';
import { W, hasBlocker, roundingWarning, warn } from './validation';
import { buildPhases, step } from './salaryFixation';
import { gradeLabel, toBnDigits } from './format';
import type {
  FixationStep, Grade, GradeScale, PhasePayment, SourceRef, Warning,
} from './types';

/** Which of ১০(১)(ক)/(খ)/(গ) the appointee relies on. One choice, not a
 *  checklist: the Gazette does not say the three add up, so the calculator
 *  does not let them. */
export type AppointmentQualification =
  | 'none'
  | 'degree-one'
  | 'masters-two'
  | 'medical-licence';

export type AppointmentTrack = 'standard' | 'bcs-cadre-9' | 'bpsc-non-cadre-9';

/** When the person joined, in terms of the অনুচ্ছেদ ১(৩) windows. */
export type JoiningWindow = 'phase-1' | 'phase-2' | 'after-transition';

export type FirstAppointmentInput = {
  /** Grade of the *post* in the 2026 scale. */
  grade: Grade;
  track: AppointmentTrack;
  qualification: AppointmentQualification;
  joining: JoiningWindow;
};

export type AdvanceLine = { label: string; count: number; source: SourceRef };

export type FirstAppointmentResult = {
  ok: boolean;
  input: FirstAppointmentInput;
  scale: GradeScale | null;
  /** The scale's first step — where অনুচ্ছেদ ১০(১) starts everyone. */
  startingBasic: number | null;
  advanceLines: AdvanceLine[];
  advanceIncrements: number;
  /** Pay in the 2026 scale after the advance increments. */
  fixedBasic: number | null;
  fixedStepIndex: number | null;
  /** 2015 starting pay of the grade — the "as if joined 30 June 2026" base. */
  oldBase: number | null;
  /** Percentage of (fixedBasic − oldBase) paid in the joining window, or 100. */
  joiningPercent: number | null;
  /** Basic pay actually drawn on the day of joining. */
  payOnJoining: number | null;
  phases: PhasePayment[];
  nextIncrementAmount: number | null;
  steps: FixationStep[];
  warnings: Warning[];
  sources: SourceRef[];
};

export const QUALIFICATION_ADVANCE: Record<AppointmentQualification, number> = {
  none: 0,
  'degree-one': 1,
  'masters-two': 2,
  'medical-licence': 1,
};

const JOINING_ORDER: JoiningWindow[] = ['phase-1', 'phase-2', 'after-transition'];

function empty(input: FirstAppointmentInput, warnings: Warning[]): FirstAppointmentResult {
  return {
    ok: false,
    input,
    scale: null,
    startingBasic: null,
    advanceLines: [],
    advanceIncrements: 0,
    fixedBasic: null,
    fixedStepIndex: null,
    oldBase: null,
    joiningPercent: null,
    payOnJoining: null,
    phases: [],
    nextIncrementAmount: null,
    steps: [],
    warnings,
    sources: [REF.appointmentStart],
  };
}

export function calculateFirstAppointment(input: FirstAppointmentInput): FirstAppointmentResult {
  const warnings: Warning[] = [];

  if (!isGrade(input.grade)) {
    warnings.push(warn(W.INVALID_GRADE, 'blocker', 'পদের গ্রেড নির্বাচন করা হয় নাই।', 'নিয়োগকৃত পদের গ্রেড (১–২০) নির্বাচন করুন।'));
    return empty(input, warnings);
  }

  const scale = getScale2026(input.grade);
  const oldScale = getScale2015(input.grade);
  if (!scale || !oldScale) {
    warnings.push(warn(W.INVALID_GRADE, 'blocker', 'এই গ্রেডের স্কেল পাওয়া যায় নাই।'));
    return empty(input, warnings);
  }

  if (input.track !== 'standard' && input.grade !== 9) {
    warnings.push(warn(
      W.APPOINTMENT_TRACK_GRADE,
      'blocker',
      `অনুচ্ছেদ ১০(২) ও ১০(৩) কেবল ৯ম গ্রেডে সরাসরি নিয়োগের ক্ষেত্রে প্রযোজ্য; আপনি ${gradeLabel(input.grade)} নির্বাচন করিয়াছেন।`,
      'গ্রেড ৯ নির্বাচন করুন, অথবা নিয়োগের ধরন “সাধারণ” করুন।',
      input.track === 'bcs-cadre-9' ? REF.appointmentBcs : REF.appointmentBpsc,
    ));
    return empty(input, warnings);
  }

  const startingBasic = scale.minimum;
  const steps: FixationStep[] = [];
  const advanceLines: AdvanceLine[] = [];

  steps.push(step(1, 'পদের গ্রেড ও ২০২৬ স্কেল',
    `অনুচ্ছেদ ১০(১): নিয়োগকৃত পদের জন্য জাতীয় বেতনস্কেল, ২০২৬ এ নির্ধারিত স্কেলে প্রারম্ভিক বেতন। ${gradeLabel(input.grade)} এর স্কেল টাকা ${toBnDigits(scale.minimum)}${scale.fixed ? ' (নির্ধারিত)' : `–${toBnDigits(scale.maximum)}`}।`,
    { source: REF.appointmentStart }));

  steps.push(step(2, 'প্রারম্ভিক ধাপ',
    'অনুচ্ছেদ ১০(১)(ঙ): বেতন প্রথমে সংশ্লিষ্ট স্কেলের প্রারম্ভিক ধাপে নির্ধারিত হইবে; প্রযোজ্য ক্ষেত্রে ইহার সহিত অতিরিক্ত বেতনবৃদ্ধি যোগ হইবে।',
    { value: startingBasic, source: REF.appointmentAdd }));

  // --- how many advance increments -----------------------------------------
  const ninthOrAbove = isNinthGradeOrAbove(input.grade);
  let qualificationCount = QUALIFICATION_ADVANCE[input.qualification];

  if (input.qualification !== 'none' && !ninthOrAbove) {
    warnings.push(warn(
      W.APPOINTMENT_PROVISO,
      'warning',
      `অনুচ্ছেদ ১০(১) এর শর্তাংশ অনুযায়ী দফা (ক), (খ) ও (গ) এর অগ্রিম বেতনবৃদ্ধি কেবল ৯ম গ্রেড (৪৪০০০–১০৫৯০০) বা তদূর্ধ্ব স্কেলের পদে প্রযোজ্য। ${gradeLabel(input.grade)} এ কোনও অগ্রিম বেতনবৃদ্ধি যোগ করা হয় নাই।`,
      undefined,
      REF.appointmentProviso,
    ));
    qualificationCount = 0;
  }

  if (input.track === 'bpsc-non-cadre-9') {
    if (input.qualification !== 'none') {
      warnings.push(warn(
        W.APPOINTMENT_BPSC_NO_INCREMENT,
        'warning',
        'অনুচ্ছেদ ১০(৩) বিপিএসসির সুপারিশে ৯ম গ্রেডের নন-ক্যাডার পদে নিয়োগপ্রাপ্তদের বেতন প্রারম্ভিক ধাপে নির্ধারণের কথা বলিয়াছে। ডিগ্রি বা লাইসেন্সভিত্তিক অগ্রিম বেতনবৃদ্ধি এই ক্ষেত্রে যোগ করা হয় নাই।',
        'ইহা গেজেটের একটি ব্যাখ্যা-সাপেক্ষ বিষয় — নিশ্চিত হইতে নিয়োগকারী কর্তৃপক্ষ বা হিসাবরক্ষণ অফিসের সহিত যোগাযোগ করুন।',
        REF.appointmentBpsc,
      ));
    }
    qualificationCount = 0;
  } else if (qualificationCount > 0) {
    advanceLines.push({
      label:
        input.qualification === 'masters-two' ? 'দফা (খ) — স্নাতকোত্তর/ফিজিক্যাল প্ল্যানিং/আইন'
        : input.qualification === 'medical-licence' ? 'দফা (গ) — চিকিৎসা অনুষদের লাইসেন্স'
        : 'দফা (ক) — এম.বি.বি.এস./ইঞ্জিনিয়ারিং/আর্কিটেকচার ডিগ্রি',
      count: qualificationCount,
      source:
        input.qualification === 'masters-two' ? REF.appointmentMasters
        : input.qualification === 'medical-licence' ? REF.appointmentLicence
        : REF.appointmentDegree,
    });
    warnings.push(warn(
      W.ADVANCE_INCREMENT_STACKING,
      'info',
      'অনুচ্ছেদ ১০(১)(ক), (খ) ও (গ) এর একাধিক সুবিধা একই ব্যক্তির ক্ষেত্রে যোগ হইবে কি না গেজেটে বলা নাই। এই ক্যালকুলেটর কেবল আপনার নির্বাচিত একটি দফা ধরিয়াছে।',
      undefined,
      REF.appointmentProviso,
    ));
  }

  if (input.qualification === 'degree-one' || input.qualification === 'medical-licence') {
    warnings.push(warn(
      W.ADVANCE_INCREMENT_STACKING,
      'info',
      'অনুচ্ছেদ ১০(১)(ঘ) অনুযায়ী পূর্ববর্তী কিছু স্মারক — যেমন বিসিএস (স্বাস্থ্য) ক্যাডারের প্রবেশ পদে উচ্চতর প্রারম্ভিক বেতন সংক্রান্ত স্বাস্থ্য ও পরিবার কল্যাণ মন্ত্রণালয়ের ও অর্থ বিভাগের বিধান — বলবৎ থাকিবে। ঐ ক্ষেত্রগুলিতে ফলাফল ভিন্ন হইতে পারে।',
      undefined,
      REF.appointmentSaving,
    ));
  }

  if (input.track === 'bcs-cadre-9') {
    advanceLines.push({
      label: 'অনুচ্ছেদ ১০(২) — বিসিএস ক্যাডার, ৯ম গ্রেড (অতিরিক্ত)',
      count: 1,
      source: REF.appointmentBcs,
    });
  }

  const advanceIncrements = advanceLines.reduce((sum, l) => sum + l.count, 0);

  if (advanceIncrements > 0) {
    warnings.push(warn(
      W.ADVANCE_INCREMENT_UNIT,
      'info',
      'অনুচ্ছেদ ১০ অগ্রিম বেতনবৃদ্ধির সংখ্যা বলিয়াছে, টাকার অঙ্ক বলে নাই। অনুচ্ছেদ ৯ অনুযায়ী বেতনবৃদ্ধি অর্থ স্কেলের পরবর্তী ধাপ — এই হিসাবে প্রতিটি অগ্রিম বেতনবৃদ্ধি একটি করিয়া ধাপ ধরা হইয়াছে।',
      'iBAS++ এর ফলাফলের সহিত মিলাইয়া দেখুন।',
      REF.appointmentAdd,
    ));
    warnings.push(warn(
      W.ADVANCE_INCREMENT_UNIT,
      'info',
      'অনুচ্ছেদ ১০(১)(চ): এই অগ্রিম বেতনবৃদ্ধি কেবল চাকরিতে প্রথম নিয়োগের সময় প্রাপ্য; পরবর্তী পদোন্নতিতে ইহা আবার প্রযোজ্য হইবে না।',
      undefined,
      REF.appointmentOnce,
    ));
  }

  // --- walk up the steps ------------------------------------------------------
  const targetIndex = advanceIncrements;
  const fixedBasic = scale.steps[targetIndex];
  if (fixedBasic === undefined) {
    warnings.push(warn(
      W.ADVANCE_NOT_ENOUGH_STEPS,
      'blocker',
      `${gradeLabel(input.grade)} এর স্কেলে মাত্র ${toBnDigits(scale.stepCount)}টি ধাপ আছে; ${toBnDigits(advanceIncrements)}টি অগ্রিম বেতনবৃদ্ধি যোগ করা যায় না। এই ক্ষেত্রে কী হইবে গেজেটে বলা নাই।`,
      'গ্রেড বা নির্বাচিত সুবিধা যাচাই করুন।',
      REF.appointmentAdd,
    ));
    return { ...empty(input, warnings), scale, startingBasic, advanceLines, advanceIncrements };
  }

  if (advanceIncrements > 0) {
    steps.push(step(3, `${toBnDigits(advanceIncrements)}টি অগ্রিম বেতনবৃদ্ধি`,
      advanceLines.map((l) => `${l.label}: ${toBnDigits(l.count)}টি`).join('; ')
      + '। প্রতিটি বৃদ্ধি স্কেলের পরবর্তী ধাপে উঠা (অনুচ্ছেদ ৯ এর অর্থে)।',
      {
        value: fixedBasic,
        formula: `${toBnDigits(startingBasic)} → ধাপ ${toBnDigits(targetIndex + 1)} = ${toBnDigits(fixedBasic)}`,
        certainty: 'ASSUMPTION',
        source: advanceLines[0]?.source ?? REF.appointmentAdd,
      }));
  } else {
    steps.push(step(3, 'অগ্রিম বেতনবৃদ্ধি প্রযোজ্য নয়',
      'নির্বাচিত তথ্য অনুযায়ী অনুচ্ছেদ ১০ এর কোনও অগ্রিম বেতনবৃদ্ধি যোগ হয় নাই; বেতন প্রারম্ভিক ধাপেই।',
      { value: fixedBasic, source: REF.appointmentStart }));
  }

  // --- ১০(৪): the transition share ---------------------------------------------
  const oldBase = oldScale.minimum;
  const after = nextStep(scale, targetIndex);
  const allPhases = buildPhases(input.grade, oldBase, fixedBasic, after ? after.value : null);
  const joinIndex = JOINING_ORDER.indexOf(input.joining);
  const phases = allPhases.slice(joinIndex).map((p) => ({ ...p }));

  let payOnJoining = fixedBasic;
  let joiningPercent = 100;

  if (input.joining === 'after-transition') {
    steps.push(step(4, 'সম্পূর্ণ ২০২৬ বেতন প্রদেয়',
      'অনুচ্ছেদ ১০(৪) কেবল ১ জুলাই ২০২৬ হইতে ৩০ জুন ২০২৭ পর্যন্ত নিয়োগের ক্ষেত্রে প্রযোজ্য। ১ জুলাই ২০২৭ বা তাহার পরে নিয়োগে ২০২৬ স্কেলের নির্ধারিত বেতনই প্রদেয়।',
      { value: fixedBasic, source: REF.appointmentTransition }));
  } else {
    const first = allPhases[joinIndex];
    if (first) {
      payOnJoining = first.payable;
      joiningPercent = first.percent;
    }
    steps.push(step(4, '৩০ জুন ২০২৬ তারিখে যোগদান করিলে প্রাপ্য বেতন (ভিত্তি)',
      `অনুচ্ছেদ ১০(৪): যোগদান ৩০ জুন ২০২৬ হইলে যাহা বর্তমান বেতন হইত — ${gradeLabel(input.grade)} এর ২০১৫ স্কেলের প্রারম্ভিক ধাপ।`,
      { value: oldBase, source: REF.appointmentTransition }));
    steps.push(step(5, 'পার্থক্য ও প্রযোজ্য শতাংশ',
      `অনুচ্ছেদ ১০(৪) ও ১(৩): ২০২৬ স্কেলে নির্ধারিত বেতন ও ভিত্তি-বেতনের পার্থক্যের ${toBnDigits(joiningPercent)}% ভিত্তি-বেতনের সহিত যোগ হয়।`,
      {
        value: payOnJoining,
        formula: `${toBnDigits(oldBase)} + (${toBnDigits(fixedBasic)} − ${toBnDigits(oldBase)}) × ${toBnDigits(joiningPercent)}% = ${toBnDigits(payOnJoining)}`,
        certainty: 'DERIVED',
        source: REF.appointmentTransition,
      }));

    warnings.push(warn(
      W.APPOINTMENT_OLD_BASE,
      'info',
      'অনুচ্ছেদ ১০(৪) এর “বর্তমান বেতন” হিসাবে এখানে ২০১৫ স্কেলের প্রারম্ভিক ধাপ ধরা হইয়াছে। ২০১৫ আদেশে ঐ পদে যদি অগ্রিম বেতনবৃদ্ধি প্রাপ্য হইত, সেই অঙ্ক এই গেজেটে নাই বলিয়া যোগ করা হয় নাই।',
      undefined,
      REF.appointmentTransition,
    ));
    warnings.push(roundingWarning());
  }

  steps.push(step(steps.length + 1, 'পরবর্তী বার্ষিক বেতনবৃদ্ধি',
    after
      ? 'অনুচ্ছেদ ৯(১): বার্ষিক বেতনবৃদ্ধির তারিখ প্রতি অর্থ বৎসরের প্রথম দিবস — ১ জুলাই। নতুন নিয়োগে ১ জুলাই ২০২৬ এর বেতনবৃদ্ধি (অনুচ্ছেদ ৯(২)) প্রযোজ্য নয়, কারণ উহা বিদ্যমান কর্মচারীর নির্ধারণের পর প্রযোজ্য।'
      : 'স্কেলের সর্বোচ্চ ধাপে থাকায় পরবর্তী ধাপ নাই।',
    {
      value: after ? after.value - fixedBasic : undefined,
      source: REF.incrementDate,
      certainty: after ? 'GAZETTE' : 'UNDETERMINED',
    }));

  const result: FirstAppointmentResult = {
    ok: true,
    input,
    scale,
    startingBasic,
    advanceLines,
    advanceIncrements,
    fixedBasic,
    fixedStepIndex: targetIndex,
    oldBase,
    joiningPercent,
    payOnJoining,
    phases,
    nextIncrementAmount: after ? after.value - fixedBasic : null,
    steps,
    warnings,
    sources: [
      REF.appointmentStart,
      REF.appointmentAdd,
      ...advanceLines.map((l) => l.source),
      ...(input.joining === 'after-transition' ? [] : [REF.appointmentTransition]),
    ],
  };
  return hasBlocker(warnings) ? empty(input, warnings) : result;
}
