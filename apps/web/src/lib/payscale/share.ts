/**
 * Shareable result links.
 *
 * Only the numbers needed to reproduce the calculation go in the URL: grade,
 * basic, category and the two optional inputs. No name, no NID, no employee
 * ID — a link somebody pastes into a Facebook group should not carry anything
 * about who they are.
 */

import { isGrade } from './payScale';
import type { EmployeeCategory, FixationInput, Grade } from './types';

const CATEGORIES: readonly EmployeeCategory[] = [
  'regular', 'prl', 'retiring-2026-07-01', 'suspended',
  'promoted-2026-07-01', 'deputation', 'on-leave',
];

export function encodeFixation(input: FixationInput): string {
  const params = new URLSearchParams();
  params.set('g', String(input.grade));
  params.set('b', String(input.currentBasic));
  if (input.category !== 'regular') params.set('c', input.category);
  if (input.specialFixedPayId) params.set('f', input.specialFixedPayId);
  if (input.specialBenefitAmount) params.set('sb', String(input.specialBenefitAmount));
  if (input.qualifyingServiceMonths !== undefined) params.set('qs', String(input.qualifyingServiceMonths));
  return params.toString();
}

/** Parses a shared link back into inputs. Anything unparseable is dropped
 *  rather than defaulted, so a corrupt link produces an empty form and not a
 *  confident wrong answer. */
export function decodeFixation(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): Partial<FixationInput> {
  const get = (key: string): string | undefined => {
    if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const out: Partial<FixationInput> = {};

  const grade = Number(get('g'));
  if (Number.isFinite(grade) && isGrade(grade)) out.grade = grade as Grade;

  const basic = Number(get('b'));
  if (Number.isInteger(basic) && basic > 0) out.currentBasic = basic;

  const category = get('c');
  if (category && (CATEGORIES as readonly string[]).includes(category)) {
    out.category = category as EmployeeCategory;
  } else {
    out.category = 'regular';
  }

  const fixedPay = get('f');
  if (fixedPay) out.specialFixedPayId = fixedPay;

  const specialBenefit = Number(get('sb'));
  if (Number.isFinite(specialBenefit) && specialBenefit > 0) out.specialBenefitAmount = specialBenefit;

  const qualifying = Number(get('qs'));
  if (Number.isInteger(qualifying) && qualifying >= 0) out.qualifyingServiceMonths = qualifying;

  return out;
}
