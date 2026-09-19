/**
 * Gross and net salary.
 *
 * Deliberately thin: basic + allowances = gross, gross − deductions = net.
 * The Gazette fixes no deduction rates at all (অনুচ্ছেদ ৩১ tells employees to
 * assess and pay their own income tax under the Income Tax Act 2023, and says
 * nothing about GPF or other cuts), so every deduction here is user-supplied
 * and labelled as such rather than estimated.
 */

import { calculateAllowances, type AllowanceInput } from './allowanceCalculator';
import { W, warn } from './validation';
import type { AllowanceLine, GrossSalaryResult, Warning } from './types';

export type GrossInput = AllowanceInput & {
  /** Amounts the user typed in themselves, e.g. a risk allowance whose figure
   *  lives in a separate Finance Division memorandum. */
  deductions?: { id: string; name: string; amount: number }[];
};

export function calculateGross(input: GrossInput): GrossSalaryResult {
  const { lines, warnings } = calculateAllowances(input);
  return assembleGross(input.basic, lines, input.deductions ?? [], warnings);
}

/** Composes a gross/net breakdown from already-computed allowance lines. */
export function assembleGross(
  basic: number,
  allowances: AllowanceLine[],
  rawDeductions: { id: string; name: string; amount: number }[],
  carriedWarnings: Warning[] = [],
): GrossSalaryResult {
  const warnings = [...carriedWarnings];

  const deductions: AllowanceLine[] = rawDeductions
    .filter((d) => Number.isFinite(d.amount) && d.amount > 0)
    .map((d) => ({
      id: d.id,
      name: d.name,
      amount: d.amount,
      origin: 'user' as const,
      basis: 'ব্যবহারকারীর দেওয়া পরিমাণ',
      certainty: 'ASSUMPTION' as const,
    }));

  if (deductions.length > 0) {
    warnings.push(warn(
      W.ALLOWANCE_USER_SUPPLIED,
      'info',
      'এই গেজেটে কোনও কর্তনের হার (আয়কর, জিপিএফ বা অন্য কিছু) নির্ধারিত হয় নাই। কর্তনের অঙ্ক আপনার নিজের দেওয়া।',
    ));
  }

  const totalAllowances = allowances.reduce((sum, a) => sum + a.amount, 0);
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
  const gross = basic + totalAllowances;

  return {
    basic,
    allowances,
    totalAllowances,
    gross,
    deductions,
    totalDeductions,
    net: gross - totalDeductions,
    warnings,
  };
}

/** The 2015 vs 2026 comparison used by the comparison page. Basic and gross
 *  are reported separately because they move for different reasons — the scale
 *  changes basic now, while the allowance rates do not change until 2028. */
export type ComparisonRow = {
  label: string;
  old: string;
  fresh: string;
  note?: string;
};

export function difference(oldValue: number, newValue: number) {
  const monthly = newValue - oldValue;
  return {
    monthly,
    annual: monthly * 12,
    percent: oldValue > 0 ? (monthly / oldValue) * 100 : null,
  };
}
