/**
 * Types for the Bangladesh National Pay Scale 2026 calculator.
 *
 * Everything here describes what the Gazette (এস. আর. ও. নং ৩৪৭-আইন/২০২৬,
 * 17 September 2026) actually says. Where the Gazette is silent, the type
 * system makes that visible rather than letting a default slip through — see
 * `Certainty` and `Warning`, which exist so an unknown can travel through a
 * calculation without turning into a number somebody might act on.
 */

export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;

export const GRADES: readonly Grade[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
];

/** A grade's scale in one pay order: every step, exactly as printed. */
export type GradeScale = {
  grade: number;
  minimum: number;
  maximum: number;
  stepCount: number;
  steps: number[];
  /** True for a single-amount scale — "টাকা ১৫৬০০০ (নির্ধারিত)". */
  fixed: boolean;
  sourcePdfPage: number;
  sourcePage: string;
  sourceSection: string;
};

export type PayScaleFile = {
  gazette: GazetteMeta;
  scaleName: string;
  scaleYear: number;
  effectiveDate?: string;
  note?: string;
  grades: GradeScale[];
  specialFixedPay?: SpecialFixedPay[];
};

export type SpecialFixedPay = {
  id: string;
  posts: string;
  amount: number;
  sourcePdfPage: number;
  sourcePage: string;
  sourceSection: string;
};

export type GazetteMeta = {
  title: string;
  sro: string;
  publication?: string;
  gazetteDate: string;
  effectiveDate?: string;
  sourceFile: string;
  pdfPages?: number;
  printedPages?: string;
  issuedBy?: string;
  enablingAct?: string;
  signedBy?: string;
};

/** Where a number or a rule came from. Never invented: if a citation cannot be
 *  made confidently, `SourceRef.verified` is false and the UI says so. */
export type SourceRef = {
  ruleId?: string;
  label: string;
  article?: string;
  pdfPage?: number;
  printedPage?: string;
  quote?: string;
  verified: boolean;
};

export type Certainty =
  /** The Gazette states this outright. */
  | 'GAZETTE'
  /** Arithmetic on Gazette numbers, by a Gazette-stated method. */
  | 'DERIVED'
  /** A stated assumption the Gazette does not settle (e.g. rounding). */
  | 'ASSUMPTION'
  /** The Gazette does not settle this at all — no number is produced. */
  | 'UNDETERMINED';

export type WarningLevel = 'info' | 'warning' | 'blocker';

export type Warning = {
  code: string;
  level: WarningLevel;
  message: string;
  /** What the user can do about it, when there is something. */
  action?: string;
  source?: SourceRef;
};

/** One line of the "এই বেতন কীভাবে নির্ধারণ হলো?" explanation. */
export type FixationStep = {
  step: number;
  title: string;
  /** The value this step produced, when it produced one. */
  value?: number;
  /** Why the step happened — always a rule, never a restatement of the maths. */
  why: string;
  formula?: string;
  certainty: Certainty;
  source?: SourceRef;
};

export type EmployeeCategory =
  | 'regular'
  | 'prl'
  | 'retiring-2026-07-01'
  | 'suspended'
  | 'promoted-2026-07-01'
  | 'deputation'
  | 'on-leave';

export type FixationInput = {
  grade: Grade;
  /** মূল বেতন on 30 June 2026, in the 2015 scale. */
  currentBasic: number;
  category: EmployeeCategory;
  /** A post whose pay para 3(2) fixes outside the grade table. */
  specialFixedPayId?: string;
  /** What the employee was drawing as বিশেষ সুবিধা on 30 June 2026, if any.
   *  Recorded and reported — never added to or subtracted from the fixation. */
  specialBenefitAmount?: number;
  /** Para 9(2) proviso: a new joiner needs 6 months qualifying service before
   *  the 1 July increment. `undefined` means "not stated" and is warned about. */
  qualifyingServiceMonths?: number;
};

export type PhasePayment = {
  id: 'phase-1' | 'phase-2' | 'phase-3';
  label: string;
  from: string;
  to: string | null;
  /** Percentage of the increase paid in this phase, for this grade. */
  percent: number;
  /** Basic pay actually drawn during the phase. */
  payable: number;
  /** payable − currentBasic. */
  addedToCurrentBasic: number;
  certainty: Certainty;
  source: SourceRef;
  note?: string;
};

export type FixationResult = {
  ok: boolean;
  input: FixationInput;
  oldScale: GradeScale | null;
  newScale: GradeScale | null;
  /** Pay fixed under অনুচ্ছেদ ৫, before the 1 July 2026 increment. */
  fixedBasic: number | null;
  /** The para 5(খ) intermediate: new-scale minimum + difference. */
  fixationBase: number | null;
  /** How much of the old scale the employee had climbed. */
  stepDifference: number | null;
  /** Index (0-based) of the fixed step in the new scale. */
  fixedStepIndex: number | null;
  /** Pay after the অনুচ্ছেদ ৯(২) increment on 1 July 2026. */
  newBasic: number | null;
  incrementAmount: number | null;
  incrementApplied: boolean;
  monthlyIncrease: number | null;
  annualIncrease: number | null;
  percentIncrease: number | null;
  nextIncrementDate: string | null;
  nextIncrementAmount: number | null;
  phases: PhasePayment[];
  steps: FixationStep[];
  warnings: Warning[];
  sources: SourceRef[];
};

export type AllowanceLine = {
  id: string;
  name: string;
  amount: number;
  /** 'gazette' when both the rule and the amount come from the Gazette;
   *  'user' when the person typed the figure in themselves. */
  origin: 'gazette' | 'user';
  basis: string;
  certainty: Certainty;
  source?: SourceRef;
};

export type GrossSalaryResult = {
  basic: number;
  allowances: AllowanceLine[];
  totalAllowances: number;
  gross: number;
  deductions: AllowanceLine[];
  totalDeductions: number;
  net: number;
  warnings: Warning[];
};

export type IncrementResult = {
  ok: boolean;
  grade: Grade;
  currentBasic: number;
  currentStepIndex: number | null;
  incrementAmount: number | null;
  nextBasic: number | null;
  atMaximum: boolean;
  incrementDate: string;
  remainingSteps: number | null;
  projection: { date: string; basic: number }[];
  warnings: Warning[];
  sources: SourceRef[];
};

export type CheckerResult = {
  ok: boolean;
  expectedFixedBasic: number | null;
  expectedNewBasic: number | null;
  reportedBasic: number;
  difference: number | null;
  matches: boolean | null;
  /** Which of the two the reported figure matched, if either. */
  matchedAgainst: 'fixed' | 'after-increment' | null;
  verdict: string;
  warnings: Warning[];
  fixation: FixationResult;
};

/** Everything a calculation did, in a form somebody can check by hand. */
export type AuditTrail = {
  generatedAt: string;
  gazette: GazetteMeta;
  input: FixationInput;
  oldScale: { grade: number; minimum: number; maximum: number; steps: number[] } | null;
  newScale: { grade: number; minimum: number; maximum: number; steps: number[] } | null;
  applicableRules: { ruleId: string; ruleName: string; section: string }[];
  benefitAdjustment: {
    applicable: boolean;
    amountReported: number | null;
    treatment: string;
    ruleId: string;
  };
  fixationSteps: FixationStep[];
  result: {
    fixedBasic: number | null;
    newBasic: number | null;
    monthlyIncrease: number | null;
    percentIncrease: number | null;
  };
  warnings: Warning[];
  sourceReferences: SourceRef[];
};
