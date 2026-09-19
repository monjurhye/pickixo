/**
 * The audit trail.
 *
 * A calculation that cannot be checked by hand is not much use to somebody
 * arguing about their own pay, so every result can be turned into a record of
 * what went in, which rules fired, what each step produced and what the
 * calculator was unsure about.
 */

import rules from '../../data/payscale/payRules2026.json';
import benefits from '../../data/payscale/benefitRules.json';
import { GAZETTE_META } from './sourceReference';
import type { AuditTrail, FixationResult, GazetteMeta } from './types';

export function buildAuditTrail(result: FixationResult, now = new Date()): AuditTrail {
  const applicable: { ruleId: string; ruleName: string; section: string }[] = [];

  applicable.push({
    ruleId: rules.correspondingScaleRule.ruleId,
    ruleName: rules.correspondingScaleRule.ruleName,
    section: rules.correspondingScaleRule.sourceSection,
  });
  applicable.push({
    ruleId: rules.entitlementRule.ruleId,
    ruleName: rules.entitlementRule.ruleName,
    section: rules.entitlementRule.sourceSection,
  });

  if (result.input.specialFixedPayId) {
    const fixed = rules.payFixationRules.find((r) => r.ruleId === 'FIX-5-GA');
    if (fixed) applicable.push({ ruleId: fixed.ruleId, ruleName: fixed.ruleName, section: fixed.sourceSection });
  } else if (result.stepDifference === 0) {
    const first = rules.payFixationRules.find((r) => r.ruleId === 'FIX-5-KA');
    if (first) applicable.push({ ruleId: first.ruleId, ruleName: first.ruleName, section: first.sourceSection });
  } else {
    const diff = rules.payFixationRules.find((r) => r.ruleId === 'FIX-5-KHA');
    if (diff) applicable.push({ ruleId: diff.ruleId, ruleName: diff.ruleName, section: diff.sourceSection });
    const exact = result.fixationBase !== null && result.fixedBasic === result.fixationBase;
    applicable.push(
      exact
        ? { ruleId: 'FIX-5-KHA-A', ruleName: 'যোগফলের সমান ধাপে নির্ধারণ', section: 'অনুচ্ছেদ ৫(খ)(অ)' }
        : { ruleId: 'FIX-5-KHA-AA', ruleName: 'পরবর্তী উচ্চতর ধাপে নির্ধারণ', section: 'অনুচ্ছেদ ৫(খ)(আ)' },
    );
  }

  if (result.incrementApplied) {
    const inc = rules.incrementRules.find((r) => r.ruleId === 'INC-9-2');
    if (inc) applicable.push({ ruleId: inc.ruleId, ruleName: inc.ruleName, section: inc.sourceSection });
  }
  for (const t of rules.transitionRules.slice(0, 3)) {
    applicable.push({ ruleId: t.ruleId, ruleName: t.ruleName, section: t.sourceSection });
  }

  return {
    generatedAt: now.toISOString(),
    gazette: GAZETTE_META as unknown as GazetteMeta,
    input: result.input,
    oldScale: result.oldScale
      ? {
          grade: result.oldScale.grade,
          minimum: result.oldScale.minimum,
          maximum: result.oldScale.maximum,
          steps: result.oldScale.steps,
        }
      : null,
    newScale: result.newScale
      ? {
          grade: result.newScale.grade,
          minimum: result.newScale.minimum,
          maximum: result.newScale.maximum,
          steps: result.newScale.steps,
        }
      : null,
    applicableRules: applicable,
    benefitAdjustment: {
      applicable: false,
      amountReported: result.input.specialBenefitAmount ?? null,
      treatment: benefits.specialBenefit2015.plainAnswer,
      ruleId: benefits.specialBenefit2015.ruleId,
    },
    fixationSteps: result.steps,
    result: {
      fixedBasic: result.fixedBasic,
      newBasic: result.newBasic,
      monthlyIncrease: result.monthlyIncrease,
      percentIncrease: result.percentIncrease,
    },
    warnings: result.warnings,
    sourceReferences: result.sources,
  };
}

export function auditTrailToJson(trail: AuditTrail): string {
  return JSON.stringify(trail, null, 2);
}
