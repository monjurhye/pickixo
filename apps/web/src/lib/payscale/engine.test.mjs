/**
 * Tests for the National Pay Scale 2026 calculator.
 *
 *   cd apps/web
 *   npm run test:payscale
 *
 * Every assertion names the Gazette rule it is testing. The two cases that
 * matter most are the Gazette's own worked examples (অনুচ্ছেদ ৫, উদাহরণ ১ ও ২):
 * if the engine reproduces those, the fixation method is right; if it does not,
 * nothing else in the calculator is trustworthy.
 *
 * The data checks are not ceremony either. The scale tables were decoded from
 * a PDF whose embedded font carries no usable character map, so a single
 * mis-identified glyph would put a wrong taka figure in front of someone
 * working out their own salary. These tests re-derive the cross-checks the
 * Gazette contains internally — অনুচ্ছেদ ১১'s table restates the grade 1–7
 * ranges, অনুচ্ছেদ ১০(১) restates grade 9 — so a decoding error has to survive
 * two independent places in the document to get through.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const outDir = process.argv[2];
if (!outDir) {
  console.error('usage: node engine.test.mjs <compiled-dir>');
  process.exit(1);
}
const load = (name) => require(path.resolve(process.cwd(), outDir, 'lib/payscale', name));

const { fixSalary } = load('salaryFixation.js');
const payScale = load('payScale.js');
const { calculateIncrement } = load('incrementCalculator.js');
const allowances = load('allowanceCalculator.js');
const { calculateGross } = load('salaryCalculator.js');
const { checkFixation } = load('checker.js');
const { calculateFirstAppointment } = load('firstAppointment.js');
const { buildAuditTrail } = load('auditTrail.js');
const { encodeFixation, decodeFixation } = load('share.js');
const { findGradesForBasic } = load('validation.js');
const { formatBn, taka, toBnDigits } = load('format.js');

const rules = require(path.resolve(process.cwd(), outDir, 'data/payscale/payRules2026.json'));
const benefits = require(path.resolve(process.cwd(), outDir, 'data/payscale/benefitRules.json'));

let passed = 0;
const failures = [];
function test(rule, name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failures.push({ rule, name, message: error.message });
  }
}

// ---------------------------------------------------------------------------
// 1. Pay scale data integrity
// ---------------------------------------------------------------------------

test('অনুচ্ছেদ ৩(১)', 'both scales carry all 20 grades', () => {
  const g2015 = payScale.PAY_SCALE_2015.grades.map((g) => g.grade);
  const g2026 = payScale.PAY_SCALE_2026.grades.map((g) => g.grade);
  assert.deepEqual(g2015, [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]);
  assert.deepEqual(g2026, [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]);
});

test('অনুচ্ছেদ ৩(১)', 'every scale is strictly increasing and agrees with its own min/max', () => {
  for (const file of [payScale.PAY_SCALE_2015, payScale.PAY_SCALE_2026]) {
    for (const g of file.grades) {
      assert.equal(g.steps.length, g.stepCount, `grade ${g.grade} stepCount`);
      assert.equal(g.steps[0], g.minimum, `grade ${g.grade} minimum`);
      assert.equal(g.steps[g.steps.length - 1], g.maximum, `grade ${g.grade} maximum`);
      for (let i = 1; i < g.steps.length; i += 1) {
        assert.ok(g.steps[i] > g.steps[i - 1],
          `grade ${g.grade} step ${i} (${g.steps[i]}) must exceed ${g.steps[i - 1]}`);
      }
    }
  }
});

test('অনুচ্ছেদ ৩(১)', 'step-to-step increase stays in the 1%–6% band the Gazette actually prints', () => {
  // A decoding slip in one digit almost always throws a step outside this band,
  // which is what makes this a useful check rather than a tautology.
  for (const file of [payScale.PAY_SCALE_2015, payScale.PAY_SCALE_2026]) {
    for (const g of file.grades) {
      for (let i = 1; i < g.steps.length; i += 1) {
        const pct = (g.steps[i] / g.steps[i - 1] - 1) * 100;
        assert.ok(pct > 1 && pct < 6,
          `${file.scaleYear} grade ${g.grade} step ${i}: ${pct.toFixed(2)}% is outside 1–6%`);
      }
    }
  }
});

test('অনুচ্ছেদ ১১', "grade 1–7 ranges match the separate table in অনুচ্ছেদ ১১", () => {
  // The Gazette prints these ranges twice, in two different tables. Both were
  // decoded independently, so agreement is real corroboration.
  const expected = { 1: [156000, 156000], 2: [132000, 153000], 3: [113000, 148800],
                     4: [100000, 142400], 5: [86000, 139700], 6: [71000, 134000],
                     7: [58000, 126800] };
  for (const row of rules.fullPayServiceTable.rows) {
    const scale = payScale.getScale2026(row.grade);
    const [min, max] = expected[row.grade];
    assert.equal(scale.minimum, min, `grade ${row.grade} minimum`);
    assert.equal(scale.maximum, max, `grade ${row.grade} maximum`);
  }
});

test('অনুচ্ছেদ ১০(১)', 'grade 9 scale matches the ৪৪০০০-১০৫৯০০ quoted in অনুচ্ছেদ ১০(১)', () => {
  const g9 = payScale.getScale2026(9);
  assert.equal(g9.minimum, 44000);
  assert.equal(g9.maximum, 105900);
});

test('অনুচ্ছেদ ৩(১)', 'grades 1–11 start at exactly double the 2015 minimum', () => {
  for (let grade = 1; grade <= 11; grade += 1) {
    const old = payScale.getScale2015(grade);
    const fresh = payScale.getScale2026(grade);
    assert.equal(fresh.minimum, old.minimum * 2,
      `grade ${grade}: ${fresh.minimum} is not 2 × ${old.minimum}`);
  }
});

test('অনুচ্ছেদ ৩(১)', 'grades 12–20 start at more than double the 2015 minimum', () => {
  for (let grade = 12; grade <= 20; grade += 1) {
    const old = payScale.getScale2015(grade);
    const fresh = payScale.getScale2026(grade);
    assert.ok(fresh.minimum > old.minimum * 2,
      `grade ${grade}: ${fresh.minimum} should exceed 2 × ${old.minimum}`);
  }
});

test('অনুচ্ছেদ ৩(১)', 'grade 1 is a single fixed amount in both orders', () => {
  assert.equal(payScale.getScale2015(1).fixed, true);
  assert.equal(payScale.getScale2026(1).fixed, true);
  assert.equal(payScale.getScale2015(1).minimum, 78000);
  assert.equal(payScale.getScale2026(1).minimum, 156000);
});

test('অনুচ্ছেদ ৩(২)', 'the two posts fixed outside the grade table are present', () => {
  const posts = payScale.specialFixedPay();
  assert.equal(posts.length, 2);
  assert.equal(payScale.findSpecialFixedPay('cabinet-secretary').amount, 172000);
  assert.equal(payScale.findSpecialFixedPay('senior-secretary').amount, 164000);
});

// ---------------------------------------------------------------------------
// 2. The Gazette's own worked examples — অনুচ্ছেদ ৫
// ---------------------------------------------------------------------------

test('অনুচ্ছেদ ৫ উদাহরণ ১', 'grade 16 at the first step (৯৩০০) fixes at ২১৯০০', () => {
  const r = fixSalary({ grade: 16, currentBasic: 9300, category: 'regular' });
  assert.equal(r.ok, true);
  assert.equal(r.fixedBasic, 21900, 'অনুচ্ছেদ ৫(ক): first step maps to first step');
  assert.equal(r.stepDifference, 0);
});

test('অনুচ্ছেদ ৫ উদাহরণ ২', 'grade 11 at ১৩৭৯০ fixes at ২৬৩০০ via the difference method', () => {
  const r = fixSalary({ grade: 11, currentBasic: 13790, category: 'regular' });
  assert.equal(r.ok, true);
  assert.equal(r.stepDifference, 1290, '১৩৭৯০ − ১২৫০০');
  assert.equal(r.fixationBase, 26290, '২৫০০০ + ১২৯০');
  assert.equal(r.fixedBasic, 26300, 'অনুচ্ছেদ ৫(খ)(আ): next higher step');
});

test('অনুচ্ছেদ ৫ ও ৯(২)', "each worked example's figure is before the 1 July 2026 increment", () => {
  const ex1 = fixSalary({ grade: 16, currentBasic: 9300, category: 'regular' });
  assert.equal(ex1.fixedBasic, 21900);
  assert.equal(ex1.newBasic, 23000, 'অনুচ্ছেদ ৯(২) adds one step: ২১৯০০ → ২৩০০০');
  assert.equal(ex1.incrementAmount, 1100);

  const ex2 = fixSalary({ grade: 11, currentBasic: 13790, category: 'regular' });
  assert.equal(ex2.fixedBasic, 26300);
  assert.equal(ex2.newBasic, 27600, '২৬৩০০ → ২৭৬০০');
});

test('অনুচ্ছেদ ৫(খ)(অ)', 'an exact landing uses that step rather than stepping up', () => {
  // Grade 20, second step: 8670 − 8250 = 420; 20000 + 420 = 20420, which is not
  // a step, so construct one that is. 2026 grade 20 step 2 is 21000, i.e. a
  // difference of exactly 1000 from the minimum.
  const g15 = payScale.getScale2015(20);
  const r = fixSalary({ grade: 20, currentBasic: g15.minimum + 1000, category: 'regular' });
  assert.equal(r.fixationBase, 21000);
  assert.equal(r.fixedBasic, 21000, 'equal to a printed step → fix there');
});

test('অনুচ্ছেদ ৫(খ)', 'the top of a 2015 scale still lands inside the 2026 scale', () => {
  for (let grade = 2; grade <= 20; grade += 1) {
    const old = payScale.getScale2015(grade);
    const r = fixSalary({ grade, currentBasic: old.maximum, category: 'regular' });
    assert.equal(r.ok, true, `grade ${grade} should fix`);
    assert.ok(r.fixedBasic <= payScale.getScale2026(grade).maximum,
      `grade ${grade}: fixed pay must stay within the new scale`);
  }
});

test('অনুচ্ছেদ ৫', 'every printed 2015 step fixes to a printed 2026 step', () => {
  for (let grade = 1; grade <= 20; grade += 1) {
    const old = payScale.getScale2015(grade);
    const fresh = payScale.getScale2026(grade);
    for (const step of old.steps) {
      const r = fixSalary({ grade, currentBasic: step, category: 'regular' });
      assert.equal(r.ok, true, `grade ${grade} @ ${step}`);
      assert.ok(fresh.steps.includes(r.fixedBasic),
        `grade ${grade} @ ${step}: fixed ${r.fixedBasic} is not a step of the 2026 scale`);
      assert.ok(r.fixedBasic > step, `grade ${grade} @ ${step}: pay must not fall`);
    }
  }
});

// ---------------------------------------------------------------------------
// 3. Increment — অনুচ্ছেদ ৯
// ---------------------------------------------------------------------------

test('অনুচ্ছেদ ৯(১)', 'the increment date is 1 July', () => {
  const r = calculateIncrement({ grade: 13, currentBasic: 24000 });
  assert.equal(r.incrementDate, '2027-07-01');
});

test('অনুচ্ছেদ ৯(১)', 'an increment is the next printed step, not a percentage', () => {
  const scale = payScale.getScale2026(13);
  const r = calculateIncrement({ grade: 13, currentBasic: scale.steps[0] });
  assert.equal(r.nextBasic, scale.steps[1]);
  assert.equal(r.incrementAmount, scale.steps[1] - scale.steps[0]);
  // And the amount genuinely differs between steps, which is the point.
  const later = calculateIncrement({ grade: 13, currentBasic: scale.steps[10] });
  assert.notEqual(later.incrementAmount, r.incrementAmount);
});

test('অনুচ্ছেদ ৯(২)', 'at the top of the scale no increment is invented', () => {
  const scale = payScale.getScale2026(20);
  const r = fixSalary({ grade: 20, currentBasic: payScale.getScale2015(20).maximum, category: 'regular' });
  const top = calculateIncrement({ grade: 20, currentBasic: scale.maximum });
  assert.equal(top.atMaximum, true);
  assert.equal(top.incrementAmount, null, 'no figure where the Gazette gives no rule');
  assert.ok(top.warnings.some((w) => w.code === 'AT_SCALE_MAXIMUM'));
  assert.ok(r.ok);
});

test('অনুচ্ছেদ ৯(২) শর্তাংশ', 'a new joiner under 6 months qualifying service gets no increment', () => {
  const r = fixSalary({ grade: 14, currentBasic: 10200, category: 'regular', qualifyingServiceMonths: 3 });
  assert.equal(r.incrementApplied, false);
  assert.equal(r.newBasic, r.fixedBasic, 'pay stays at the fixed step');
  assert.ok(r.warnings.some((w) => w.code === 'NO_INCREMENT_NEW_JOINER'));

  const ok = fixSalary({ grade: 14, currentBasic: 10200, category: 'regular', qualifyingServiceMonths: 6 });
  assert.equal(ok.incrementApplied, true);
});

// ---------------------------------------------------------------------------
// 4. Transition percentages — অনুচ্ছেদ ১(৩)
// ---------------------------------------------------------------------------

test('অনুচ্ছেদ ১(৩)(ক)', 'grades 1–9 get 40% and grades 10–20 get 50% in phase 1', () => {
  const g9 = fixSalary({ grade: 9, currentBasic: 22000, category: 'regular' });
  const g10 = fixSalary({ grade: 10, currentBasic: 16000, category: 'regular' });
  assert.equal(g9.phases[0].percent, 40, '৯ম গ্রেড ও তদূর্ধ্ব');
  assert.equal(g10.phases[0].percent, 50, '১০ম-২০তম গ্রেড');
});

test('অনুচ্ছেদ ১(৩)(খ)', 'phase 2 is 70% and 75% on the same split', () => {
  const g9 = fixSalary({ grade: 9, currentBasic: 22000, category: 'regular' });
  const g10 = fixSalary({ grade: 10, currentBasic: 16000, category: 'regular' });
  assert.equal(g9.phases[1].percent, 70);
  assert.equal(g10.phases[1].percent, 75);
});

test('অনুচ্ছেদ ১(৩)', 'the percentage applies to the increase, never to basic pay', () => {
  const r = fixSalary({ grade: 16, currentBasic: 9300, category: 'regular' });
  const increase = r.newBasic - r.input.currentBasic;      // 23000 − 9300 = 13700
  assert.equal(increase, 13700);
  assert.equal(r.phases[0].addedToCurrentBasic, Math.round(increase * 0.5));
  assert.equal(r.phases[0].payable, 9300 + Math.round(increase * 0.5));
  // The phase-1 figure must be well below the new basic — if anyone ever makes
  // it a percentage of basic instead, this is what catches it.
  assert.ok(r.phases[0].payable < r.newBasic);
  assert.equal(r.phases[2].payable, r.newBasic, 'phase 3 is the full new basic');
});

test('অনুচ্ছেদ ১(৩)(গ)', 'phase 3 runs from 1 July 2027 with no end date', () => {
  const r = fixSalary({ grade: 12, currentBasic: 11300, category: 'regular' });
  assert.equal(r.phases[2].from, '2027-07-01');
  assert.equal(r.phases[2].to, null);
  assert.equal(r.phases[2].percent, 100);
});

// ---------------------------------------------------------------------------
// 5. The special benefit — অনুচ্ছেদ ১(৩)(ট)
// ---------------------------------------------------------------------------

test('অনুচ্ছেদ ১(৩)(ট)', 'the 2015 special benefit changes no figure in the fixation', () => {
  const without = fixSalary({ grade: 13, currentBasic: 15500, category: 'regular' });
  const with5pc = fixSalary({ grade: 13, currentBasic: 15500, category: 'regular', specialBenefitAmount: 775 });
  const withBig = fixSalary({ grade: 13, currentBasic: 15500, category: 'regular', specialBenefitAmount: 5000 });
  assert.equal(with5pc.fixedBasic, without.fixedBasic);
  assert.equal(withBig.fixedBasic, without.fixedBasic);
  assert.equal(withBig.newBasic, without.newBasic);
  assert.equal(withBig.fixationBase, without.fixationBase);
  assert.ok(with5pc.warnings.some((w) => w.code === 'SPECIAL_BENEFIT_ENTERED'),
    'it must still be reported, not silently ignored');
});

test('অনুচ্ছেদ ১(৩)(ট)', 'the rule data records no percentage for the special benefit', () => {
  assert.equal(benefits.specialBenefit2015.percentage, null);
  assert.equal(benefits.specialBenefit2015.affectsBasic, false);
  assert.equal(benefits.specialBenefit2015.affectsPayFixation, false);
  assert.equal(benefits.specialBenefit2015.affectsCorrespondingScale, false);
  assert.equal(benefits.specialBenefit2015.isSeparateBenefit, true);
});

test('অনুচ্ছেদ ১(৩)(ট)', 'no percentage rule claims to affect pay fixation', () => {
  for (const rule of benefits.percentageRules) {
    assert.equal(rule.affectsPayFixation, false, `${rule.ruleId} must not affect fixation`);
    assert.equal(rule.affectsCorrespondingScale, false, `${rule.ruleId} must not affect the corresponding scale`);
  }
});

test('অনুচ্ছেদ ১৪ / ২৭', 'the only 15% and 10% in the order are allowances, not fixation rules', () => {
  const fifteen = benefits.percentageRules.filter((r) => r.percentage === 15);
  const ten = benefits.percentageRules.filter((r) => r.percentage === 10);
  assert.equal(fifteen.length, 1);
  assert.equal(fifteen[0].ruleId, 'PCT-NOBOBORSHO-15');
  assert.equal(fifteen[0].percentageType, 'OF_BASIC_PAY');
  assert.equal(ten.length, 1);
  assert.equal(ten[0].ruleId, 'PCT-DEPUTATION-10');
});

// ---------------------------------------------------------------------------
// 6. Employee categories — অনুচ্ছেদ ৫(ঘ)–(ঝ)
// ---------------------------------------------------------------------------

test('অনুচ্ছেদ ৫(ঝ)', 'someone retiring on 1 July 2026 gets no fixation', () => {
  const r = fixSalary({ grade: 10, currentBasic: 20440, category: 'retiring-2026-07-01' });
  assert.equal(r.ok, false);
  assert.equal(r.newBasic, null, 'no number must be produced');
  assert.ok(r.warnings.some((w) => w.code === 'CATEGORY_NO_FIXATION' && w.level === 'blocker'));
});

test('অনুচ্ছেদ ৫(ছ)', 'a suspended employee gets no fixation until reinstatement', () => {
  const r = fixSalary({ grade: 12, currentBasic: 13100, category: 'suspended' });
  assert.equal(r.ok, false);
  assert.equal(r.fixedBasic, null);
});

test('অনুচ্ছেদ ৫(জ)', 'a PRL employee is fixed, but only for pension purposes', () => {
  const r = fixSalary({ grade: 9, currentBasic: 26760, category: 'prl' });
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => w.code === 'CATEGORY_PENSION_ONLY'));
});

test('অনুচ্ছেদ ৫(গ)', 'a post fixed by অনুচ্ছেদ ৩(২) bypasses the step method', () => {
  const r = fixSalary({ grade: 1, currentBasic: 78000, category: 'regular', specialFixedPayId: 'senior-secretary' });
  assert.equal(r.ok, true);
  assert.equal(r.newBasic, 164000);
  assert.equal(r.fixationBase, null, 'the difference method must not have run');
  assert.ok(r.warnings.some((w) => w.code === 'FIXED_PAY_POST'));
});

test('অনুচ্ছেদ ৫ ও ৯', 'grade 1 fixes at ১৫৬০০০ with no increment available', () => {
  const r = fixSalary({ grade: 1, currentBasic: 78000, category: 'regular' });
  assert.equal(r.fixedBasic, 156000);
  assert.equal(r.newBasic, 156000);
  assert.equal(r.incrementApplied, false);
  assert.ok(r.warnings.some((w) => w.code === 'AT_SCALE_MAXIMUM'));
});

// ---------------------------------------------------------------------------
// 7. Validation: missing and impossible input
// ---------------------------------------------------------------------------

test('validation', 'a missing grade or basic blocks the calculation', () => {
  const noGrade = fixSalary({ currentBasic: 16000, category: 'regular' });
  assert.equal(noGrade.ok, false);
  assert.ok(noGrade.warnings.some((w) => w.code === 'MISSING_GRADE' && w.level === 'blocker'));

  const noBasic = fixSalary({ grade: 10, category: 'regular' });
  assert.equal(noBasic.ok, false);
  assert.ok(noBasic.warnings.some((w) => w.code === 'MISSING_BASIC'));
});

test('validation', 'a basic below the grade scale is refused, not clamped', () => {
  const r = fixSalary({ grade: 10, currentBasic: 9000, category: 'regular' });
  assert.equal(r.ok, false);
  assert.equal(r.newBasic, null);
  assert.ok(r.warnings.some((w) => w.code === 'BASIC_BELOW_SCALE'));
});

test('validation', 'a basic that is not a printed step warns but still computes', () => {
  const r = fixSalary({ grade: 13, currentBasic: 15501, category: 'regular' });
  assert.equal(r.ok, true, 'অনুচ্ছেদ ৫(খ) arithmetic still applies');
  assert.ok(r.warnings.some((w) => w.code === 'BASIC_NOT_A_STEP'));
});

test('validation', 'a basic above the grade scale warns rather than pretending', () => {
  const r = fixSalary({ grade: 20, currentBasic: 25000, category: 'regular' });
  assert.ok(r.warnings.some((w) => w.code === 'BASIC_ABOVE_SCALE'));
});

test('smart finder', 'an ambiguous basic returns every candidate grade and refuses to pick', () => {
  // 2015 grade 14 and grade 18 share several step values.
  const shared = payScale.getScale2015(14).steps
    .find((s) => payScale.getScale2015(18).steps.includes(s));
  assert.ok(shared, 'the 2015 scales really do overlap');
  const { candidates, warnings } = findGradesForBasic(shared);
  assert.ok(candidates.length > 1);
  assert.ok(warnings.some((w) => w.code === 'MULTIPLE_GRADES'));
});

test('smart finder', 'an unknown basic produces no candidate', () => {
  const { candidates, warnings } = findGradesForBasic(12345);
  assert.equal(candidates.length, 0);
  assert.ok(warnings.some((w) => w.code === 'BASIC_NOT_A_STEP'));
});

// ---------------------------------------------------------------------------
// 8. Allowances — অনুচ্ছেদ ১২–৩০
// ---------------------------------------------------------------------------

test('অনুচ্ছেদ ১৫', 'house rent percentages follow the four grade bands and three zones', () => {
  assert.equal(allowances.houseRentPercent(20, 'dhaka'), 60);
  assert.equal(allowances.houseRentPercent(16, 'other'), 45);
  assert.equal(allowances.houseRentPercent(15, 'dhaka'), 50);
  assert.equal(allowances.houseRentPercent(10, 'major-city'), 40);
  assert.equal(allowances.houseRentPercent(9, 'dhaka'), 45);
  assert.equal(allowances.houseRentPercent(5, 'other'), 30);
  assert.equal(allowances.houseRentPercent(4, 'dhaka'), 40);
  assert.equal(allowances.houseRentPercent(1, 'other'), 25);
});

test('অনুচ্ছেদ ১৫(২)', 'government accommodation removes house rent entirely', () => {
  const { lines } = allowances.calculateAllowances({
    grade: 13, basic: 24000, houseRentZone: 'dhaka', governmentAccommodation: true,
  });
  assert.ok(!lines.some((l) => l.id === 'house-rent'));
});

test('অনুচ্ছেদ ১৩', 'medical allowance is 3000 up to 50 and 4000 after', () => {
  assert.equal(allowances.medicalAllowance(49), 3000);
  assert.equal(allowances.medicalAllowance(50), 3000);
  assert.equal(allowances.medicalAllowance(51), 4000);
  assert.equal(allowances.medicalAllowance(undefined), null, 'no age → no guess');
});

test('অনুচ্ছেদ ২২', 'mobile allowance is 500 for grades 1–5 and 150 for 6–20', () => {
  assert.equal(allowances.mobileAllowance(5), 500);
  assert.equal(allowances.mobileAllowance(6), 150);
  assert.equal(allowances.mobileAllowance(20), 150);
});

test('অনুচ্ছেদ ২৫ / ২৬', 'the 20% hill and haor allowances respect their caps', () => {
  const high = allowances.calculateAllowances({
    grade: 5, basic: 86000, hillArea: 'pahari-sadar', haorArea: true, houseRentZone: 'other',
  });
  const pahari = high.lines.find((l) => l.id === 'pahari');
  const haor = high.lines.find((l) => l.id === 'haor');
  assert.equal(pahari.amount, 5000, '20% of 86000 is 17200, capped at 5000');
  assert.equal(haor.amount, 5000);

  const low = allowances.calculateAllowances({ grade: 20, basic: 20000, hillArea: 'pahari-other' });
  assert.equal(low.lines.find((l) => l.id === 'pahari').amount, 4000, '20% of 20000, under the 5500 cap');
});

test('অনুচ্ছেদ ২৭', 'the 10% deputation allowance is refused below grade 9', () => {
  const ok = allowances.calculateAllowances({ grade: 9, basic: 44000, trainingDeputation: true });
  assert.equal(ok.lines.find((l) => l.id === 'training-deputation').amount, 4400);

  const no = allowances.calculateAllowances({ grade: 10, basic: 32000, trainingDeputation: true });
  assert.ok(!no.lines.some((l) => l.id === 'training-deputation'));
  assert.ok(no.warnings.some((w) => w.code === 'ALLOWANCE_NOT_IN_GAZETTE'));
});

test('অনুচ্ছেদ ১৯ / ২১', 'tiffin and transport are refused above grade 11', () => {
  const r = allowances.calculateAllowances({ grade: 9, basic: 44000, tiffinEligible: true, transportEligible: true });
  assert.ok(!r.lines.some((l) => l.id === 'tiffin'));
  assert.ok(!r.lines.some((l) => l.id === 'transport'));
});

test('অনুচ্ছেদ ১৪', 'the Bangla new year allowance is 15% of basic, yearly', () => {
  const line = allowances.banglaNoboborshoAllowance(24000);
  assert.equal(line.amount, 3600);
  assert.equal(line.certainty, 'GAZETTE');
});

test('অনুচ্ছেদ ১২', 'allowance results always carry the "not until 2028" warning', () => {
  const r = allowances.calculateAllowances({ grade: 13, basic: 24000, houseRentZone: 'dhaka' });
  assert.ok(r.warnings.some((w) => w.code === 'ALLOWANCE_DEFERRED'));
});

test('gross', 'gross is basic plus allowances, and user figures stay labelled', () => {
  const r = calculateGross({
    grade: 13, basic: 24000, houseRentZone: 'dhaka', ageYears: 40,
    userSupplied: [{ id: 'risk', name: 'ঝুঁকি ভাতা', amount: 1200 }],
    deductions: [{ id: 'gpf', name: 'জিপিএফ', amount: 2000 }],
  });
  const sum = r.allowances.reduce((a, l) => a + l.amount, 0);
  assert.equal(r.gross, 24000 + sum);
  assert.equal(r.net, r.gross - 2000);
  assert.equal(r.allowances.find((l) => l.id === 'risk').origin, 'user');
  assert.equal(r.allowances.find((l) => l.id === 'risk').basis, 'ব্যবহারকারীর দেওয়া পরিমাণ');
  assert.equal(r.deductions[0].origin, 'user');
});

// ---------------------------------------------------------------------------
// 9. Checker, audit trail, sharing, formatting
// ---------------------------------------------------------------------------

test('checker', 'a correct figure is confirmed', () => {
  const r = checkFixation({ grade: 16, currentBasic: 9300, category: 'regular', reportedBasic: 23000 });
  assert.equal(r.matches, true);
  assert.equal(r.matchedAgainst, 'after-increment');
});

test('checker', 'the pre-increment figure is recognised as partial, not wrong', () => {
  const r = checkFixation({ grade: 16, currentBasic: 9300, category: 'regular', reportedBasic: 21900 });
  assert.equal(r.matchedAgainst, 'fixed');
  assert.equal(r.matches, true);
});

test('checker', 'a mismatch is reported as a difference, never as a government error', () => {
  const r = checkFixation({ grade: 16, currentBasic: 9300, category: 'regular', reportedBasic: 25000 });
  assert.equal(r.matches, false);
  assert.equal(r.difference, 2000);
  assert.ok(r.verdict.includes('পার্থক্য পাওয়া গেছে'));
  assert.ok(!/ভুল করিয়াছে|সরকারের ভুল/.test(r.verdict));
  assert.ok(r.verdict.includes('চূড়ান্ত বেতন নির্ধারণ সংশ্লিষ্ট কর্তৃপক্ষের'));
});

test('audit', 'the audit trail names the rules that actually fired', () => {
  const trail = buildAuditTrail(fixSalary({ grade: 11, currentBasic: 13790, category: 'regular' }));
  const ids = trail.applicableRules.map((r) => r.ruleId);
  assert.ok(ids.includes('FIX-5-KHA'));
  assert.ok(ids.includes('FIX-5-KHA-AA'), 'example 2 lands on the next higher step');
  assert.ok(ids.includes('INC-9-2'));
  assert.equal(trail.benefitAdjustment.applicable, false);
  assert.equal(trail.result.newBasic, 27600);
  assert.ok(trail.sourceReferences.every((s) => s.verified === true));
});

test('audit', 'the first-step rule is recorded when it is the one that applied', () => {
  const trail = buildAuditTrail(fixSalary({ grade: 16, currentBasic: 9300, category: 'regular' }));
  assert.ok(trail.applicableRules.map((r) => r.ruleId).includes('FIX-5-KA'));
});

test('share', 'a shared link round-trips and carries nothing personal', () => {
  const input = { grade: 12, currentBasic: 13100, category: 'prl', specialBenefitAmount: 655 };
  const encoded = encodeFixation(input);
  assert.deepEqual(decodeFixation(new URLSearchParams(encoded)), input);
  assert.ok(!/name|nid|id=|phone/i.test(encoded));
});

test('share', 'a corrupt link yields no grade rather than a default one', () => {
  const decoded = decodeFixation(new URLSearchParams('g=99&b=abc'));
  assert.equal(decoded.grade, undefined);
  assert.equal(decoded.currentBasic, undefined);
});

test('format', 'numbers render in Bengali digits with lakh grouping', () => {
  assert.equal(toBnDigits('2026'), '২০২৬');
  assert.equal(formatBn(156000), '১,৫৬,০০০');
  assert.equal(formatBn(9300), '৯,৩০০');
  assert.equal(taka(21900), '৳২১,৯০০');
  assert.equal(taka(null), '—');
});

// ---------------------------------------------------------------------------
// 10. Explanation quality — every step has a reason and a source
// ---------------------------------------------------------------------------

test('explanation', 'each fixation step explains why and cites the Gazette', () => {
  const r = fixSalary({ grade: 11, currentBasic: 13790, category: 'regular' });
  assert.ok(r.steps.length >= 8);
  for (const step of r.steps) {
    assert.ok(step.why && step.why.length > 10, `step ${step.step} has no reason`);
    assert.ok(['GAZETTE', 'DERIVED', 'ASSUMPTION', 'UNDETERMINED'].includes(step.certainty));
  }
  assert.ok(r.steps.some((s) => s.title.includes('বিশেষ সুবিধা')),
    'the special benefit is addressed explicitly even when it does not apply');
});

test('explanation', 'the rounding of the transition percentage is declared, not hidden', () => {
  const r = fixSalary({ grade: 14, currentBasic: 12420, category: 'regular' });
  assert.ok(r.warnings.some((w) => w.code === 'ROUNDING_NOT_IN_GAZETTE'));
});

// ---------------------------------------------------------------------------
// 11. Arrears — অনুচ্ছেদ ১(৩)(ঘ), ১৫(১), ১(৩)(ট), ৩২(১০)
//
// The date mismatch these cover: the 2015 order's increment date was also
// 1 July, so an eligible employee drew July–September 2026 pay on a 2015 step
// one higher than the 30 June figure this order fixes from. That money was
// already paid and nets off the arrears.
// ---------------------------------------------------------------------------

const arrears = load('arrears.js');

test('অনুচ্ছেদ ২(খ)', 'the 1 July 2026 increment under the 2015 scale is derivable from the reprinted table', () => {
  // Gazette example 2's employee: grade 11, step 3 of the 2015 scale.
  assert.equal(arrears.oldScaleIncrementedBasic(11, 13790), 14480);
  assert.equal(arrears.oldScaleIncrementedBasic(16, 9300), 9770);
  assert.equal(arrears.oldScaleIncrementedBasic(1, 78000), null, 'a fixed scale has no next step');
  assert.equal(arrears.oldScaleIncrementedBasic(20, payScale.getScale2015(20).maximum), null,
    'nothing above the top step');
});

test('অনুচ্ছেদ ১(৩)(ঘ)', 'arrears are net of what was already drawn, not gross', () => {
  const fix = fixSalary({ grade: 11, currentBasic: 13790, category: 'regular' });
  const r = arrears.calculateArrears(fix, { months: 3 });
  assert.equal(r.ok, true);
  assert.equal(r.duePayableBasic, 20695, 'phase-1 payable: 13790 + 50% of 13810');
  assert.equal(r.drawnBasic, 14480, 'the 2015 scale step actually drawn from July');
  assert.equal(r.oldScaleIncrement, 690);
  assert.equal(r.total, (20695 - 14480) * 3, 'net arrears, three months');
  assert.equal(r.naiveTotal, (20695 - 13790) * 3, 'what it would be if the old increment were ignored');
  assert.equal(r.naiveTotal - r.total, 690 * 3, 'the gap is exactly the 2015 increment');
});

test('অনুচ্ছেদ ১৫(১)', 'house rent drawn above the 30 June 2026 amount is adjusted back', () => {
  const fix = fixSalary({ grade: 11, currentBasic: 13790, category: 'regular' });
  const withHra = arrears.calculateArrears(fix, {
    months: 3, drawnHouseRentPerMonth: 7240, entitledHouseRentPerMonth: 6895,
  });
  const plain = arrears.calculateArrears(fix, { months: 3 });
  assert.equal(plain.total - withHra.total, (7240 - 6895) * 3,
    'the excess house rent comes off the arrears');
  assert.ok(withHra.lines.some((l) => l.id === 'house-rent-excess'));
});

test('অনুচ্ছেদ ১(৩)(ট)', 'the whole special benefit is adjusted, not just the increment-driven part', () => {
  const fix = fixSalary({ grade: 11, currentBasic: 13790, category: 'regular' });
  const r = arrears.calculateArrears(fix, { months: 3, drawnSpecialBenefitPerMonth: 700 });
  const line = r.lines.find((l) => l.id === 'special-benefit');
  assert.equal(line.total, -700 * 3, 'all of it, every month');
  const plain = arrears.calculateArrears(fix, { months: 3 });
  assert.equal(plain.total - r.total, 700 * 3);
});

test('অনুচ্ছেদ ১(৩)(ট)', 'the special benefit from the fixation input is carried into the arrears', () => {
  const fix = fixSalary({
    grade: 11, currentBasic: 13790, category: 'regular', specialBenefitAmount: 700,
  });
  const r = arrears.calculateArrears(fix, { months: 3 });
  assert.ok(r.lines.some((l) => l.id === 'special-benefit' && l.total === -2100));
});

test('arrears', 'an employee with no 2015 increment available loses nothing', () => {
  const top = payScale.getScale2015(14).maximum;
  const fix = fixSalary({ grade: 14, currentBasic: top, category: 'regular' });
  const r = arrears.calculateArrears(fix, { months: 3 });
  assert.equal(r.oldScaleIncrement, null);
  assert.equal(r.drawnBasic, top, 'nothing extra was drawn, so nothing nets off');
  assert.equal(r.total, r.naiveTotal);
  assert.ok(r.warnings.some((w) => w.code === 'ARREARS_NO_OLD_INCREMENT'));
});

test('arrears', 'a user-supplied drawn basic overrides the derived one', () => {
  const fix = fixSalary({ grade: 11, currentBasic: 13790, category: 'regular' });
  const r = arrears.calculateArrears(fix, { months: 3, drawnBasicPerMonth: 13790 });
  assert.equal(r.drawnBasic, 13790, 'they did not get the 2015 increment');
  assert.equal(r.total, r.naiveTotal);
  assert.ok(r.lines.find((l) => l.id === 'basic-drawn').origin === 'user');
});

test('অনুচ্ছেদ ৩২(১০)', 'a net over-payment is reported as recoverable rather than as negative arrears', () => {
  const fix = fixSalary({ grade: 20, currentBasic: 8250, category: 'regular' });
  const r = arrears.calculateArrears(fix, {
    months: 3, drawnSpecialBenefitPerMonth: 99000,
  });
  assert.equal(r.recoverable, true);
  assert.ok(r.total < 0);
});

test('arrears', 'no fixation means no arrears figure', () => {
  const fix = fixSalary({ grade: 10, currentBasic: 20440, category: 'retiring-2026-07-01' });
  const r = arrears.calculateArrears(fix, { months: 3 });
  assert.equal(r.ok, false);
  assert.equal(r.total, null);
});

test('arrears', 'every result says the accounts office decides the final figure', () => {
  const fix = fixSalary({ grade: 13, currentBasic: 15500, category: 'regular' });
  const r = arrears.calculateArrears(fix, { months: 3 });
  assert.ok(r.warnings.some((w) => w.code === 'ARREARS_OFFICE_DECIDES'));
});

// ---------------------------------------------------------------------------
// 12. The AI layer must not be able to introduce a figure
// ---------------------------------------------------------------------------

const ai = load('aiExplain.js');

test('ai', 'the fact block carries the calculated figures and the special-benefit rule', () => {
  const r = fixSalary({ grade: 16, currentBasic: 9300, category: 'regular' });
  const facts = ai.factBlock(r);
  assert.ok(facts.includes('২১,৯০০'), 'the fixed basic must be in FACTS');
  assert.ok(facts.includes('২৩,০০০'), 'the new basic must be in FACTS');
  assert.ok(facts.includes('বিশেষ সুবিধা'), 'the special benefit must be addressed in FACTS');
});

test('ai', 'the system prompt forbids calculating and forbids blaming the government', () => {
  assert.ok(ai.AI_SYSTEM_PROMPT.includes('হিসাব করা নয়'));
  assert.ok(ai.AI_SYSTEM_PROMPT.includes('তৈরি করিবেন না'));
  assert.ok(ai.AI_SYSTEM_PROMPT.includes('ভুল করিয়াছে এমন কিছু বলিবেন না'));
  assert.ok(ai.AI_SYSTEM_PROMPT.length <= 2000, 'must fit the API system-prompt limit');
});

test('ai', 'a figure the engine produced is accepted, in either digit system', () => {
  const r = fixSalary({ grade: 16, currentBasic: 9300, category: 'regular' });
  const allowed = ai.allowedFigures(r);
  assert.deepEqual(ai.findInventedFigures('আপনার নতুন মূল বেতন ২৩,০০০ টাকা।', allowed), []);
  assert.deepEqual(ai.findInventedFigures('New basic pay is 23000 taka.', allowed), []);
  assert.deepEqual(ai.findInventedFigures('অনুচ্ছেদ ৫ অনুযায়ী ২০২৬ সালে ২১,৯০০ টাকা।', allowed), [],
    'years and article numbers must not be flagged');
});

test('ai', 'a fabricated salary figure is caught', () => {
  const r = fixSalary({ grade: 16, currentBasic: 9300, category: 'regular' });
  const allowed = ai.allowedFigures(r);
  const flagged = ai.findInventedFigures('আপনার নতুন মূল বেতন হইবে ৳৩১,৭৫০ টাকা।', allowed);
  assert.equal(flagged.length, 1);
  assert.ok(flagged[0].includes('৩১'), 'the invented amount itself is reported back');

  const latin = ai.findInventedFigures('Your new basic will be 31,750 taka.', allowed);
  assert.equal(latin.length, 1);
});

test('ai', 'scale steps the calculation used are allowed, other five-figure amounts are not', () => {
  const r = fixSalary({ grade: 11, currentBasic: 13790, category: 'regular' });
  const allowed = ai.allowedFigures(r);
  const step = payScale.getScale2026(11).steps[10];
  assert.deepEqual(ai.findInventedFigures(`স্কেলের একটি ধাপ ${step} টাকা।`, allowed), []);
  assert.equal(ai.findInventedFigures('অন্য একটি গ্রেডে ৯৯৯৯৯ টাকা।', allowed).length, 1);
});

// ---------------------------------------------------------------------------
// 13. First appointment — অনুচ্ছেদ ১০
// ---------------------------------------------------------------------------

const appt = (o) => calculateFirstAppointment({
  grade: 9, track: 'standard', qualification: 'none', joining: 'after-transition', ...o,
});

test('১০(১)', 'a plain appointment starts at the first step of the 2026 scale', () => {
  const r = appt({});
  assert.equal(r.ok, true);
  assert.equal(r.fixedBasic, 44000);
  assert.equal(r.advanceIncrements, 0);
  assert.equal(r.payOnJoining, 44000, 'joining after 30 June 2027 draws the full pay');
});

test('১০(১)(ক)', 'grade 9 with a qualifying degree gets one step', () => {
  const r = appt({ qualification: 'degree-one' });
  assert.equal(r.fixedBasic, 46200);
  assert.equal(r.fixedStepIndex, 1);
});

test('১০(১)(খ)', 'grade 9 with a Masters-level qualification gets two steps', () => {
  assert.equal(appt({ qualification: 'masters-two' }).fixedBasic, 48600);
});

test('১০(১)(গ)', 'grade 9 with a medical licence gets one step', () => {
  assert.equal(appt({ qualification: 'medical-licence' }).fixedBasic, 46200);
});

test('১০(১) শর্তাংশ', 'below grade 9 the degree increments do not apply', () => {
  const r = appt({ grade: 10, qualification: 'masters-two' });
  assert.equal(r.ok, true);
  assert.equal(r.fixedBasic, 32000);
  assert.ok(r.warnings.some((w) => w.code === 'APPOINTMENT_PROVISO'));
});

test('১০(২)', 'BCS cadre in grade 9 gets one extra increment', () => {
  assert.equal(appt({ track: 'bcs-cadre-9' }).fixedBasic, 46200);
});

test('১০(২)', 'the BCS increment is additional to a degree increment', () => {
  assert.equal(appt({ track: 'bcs-cadre-9', qualification: 'masters-two' }).fixedBasic, 51000);
});

test('১০(৩)', 'BPSC non-cadre in grade 9 stays on the first step, and says why', () => {
  const r = appt({ track: 'bpsc-non-cadre-9', qualification: 'degree-one' });
  assert.equal(r.fixedBasic, 44000);
  assert.ok(r.warnings.some((w) => w.code === 'APPOINTMENT_BPSC_NO_INCREMENT'));
});

test('১০(২)/(৩)', 'the grade-9 tracks are refused for any other grade', () => {
  const r = appt({ grade: 10, track: 'bcs-cadre-9' });
  assert.equal(r.ok, false);
  assert.equal(r.fixedBasic, null);
});

test('১০(১)(ঙ)', 'more increments than the scale has steps produces no number', () => {
  const r = appt({ grade: 1, qualification: 'masters-two' });
  assert.equal(r.ok, false);
  assert.equal(r.fixedBasic, null);
});

test('১০(৪)', 'joining 1 Jul–31 Dec 2026 draws 40% of the gap above the 2015 start (grade 9)', () => {
  const r = appt({ qualification: 'degree-one', joining: 'phase-1' });
  // 2015 start 22000; fixed 46200; gap 24200; 40% = 9680
  assert.equal(r.oldBase, 22000);
  assert.equal(r.joiningPercent, 40);
  assert.equal(r.payOnJoining, 22000 + 9680);
  assert.deepEqual(r.phases.map((p) => p.id), ['phase-1', 'phase-2', 'phase-3']);
  assert.equal(r.phases[2].payable, 46200);
});

test('১০(৪)', 'joining in 2027 H1 uses 75% for grade 10 and skips phase 1', () => {
  const r = appt({ grade: 10, joining: 'phase-2' });
  // 2015 start 16000; fixed 32000; gap 16000; 75% = 12000
  assert.equal(r.payOnJoining, 28000);
  assert.deepEqual(r.phases.map((p) => p.id), ['phase-2', 'phase-3']);
});

test('১০(৪)', 'the transition maths agrees with the fixation engine for the same gap', () => {
  const r = appt({ joining: 'phase-1' });
  const f = fixSalary({ grade: 9, currentBasic: 22000, category: 'regular' });
  // First step of grade 9 fixes at 44000 (+1 increment on 1 July 2026 there); 40% of
  // the gap must use the same percentage the fixation engine applies.
  assert.equal(r.phases[0].percent, f.phases[0].percent);
});

test('১০', 'every result step has a reason and a citation', () => {
  const r = appt({ track: 'bcs-cadre-9', qualification: 'degree-one', joining: 'phase-1' });
  for (const st of r.steps) {
    assert.ok(st.why && st.why.length > 10, `step ${st.step} has a reason`);
    assert.ok(st.source || st.certainty === 'UNDETERMINED', `step ${st.step} has a source`);
  }
});

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n${failures.length} failing:\n`);
  for (const f of failures) {
    console.error(`  ✗ [${f.rule}] ${f.name}\n    ${f.message}\n`);
  }
  console.error(`${passed} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`payscale: ${passed} checks passed`);
