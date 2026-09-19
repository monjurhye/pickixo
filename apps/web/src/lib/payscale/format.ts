/**
 * Bengali number and date formatting.
 *
 * The Gazette is written in Bengali and so is this calculator, so numbers are
 * shown in Bengali digits with the Bangladeshi grouping (১২,৩৪,৫৬৭ — lakh and
 * crore, not thousands all the way up). `Intl` with the `bn-BD` locale gets
 * both right; the manual fallback exists because older mobile browsers ship
 * incomplete locale data and silently fall back to Latin digits.
 */

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

export function toBnDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

export function fromBnDigits(value: string): string {
  return value.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d as (typeof BN_DIGITS)[number])));
}

/** Indian/Bangladeshi digit grouping: last three, then pairs. */
function groupBd(digits: string): string {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${tail}`;
}

export function formatBn(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const negative = value < 0;
  const rounded = Math.round(Math.abs(value) * 100) / 100;
  const [whole = '0', fraction] = String(rounded).split('.');
  const grouped = groupBd(whole);
  const body = fraction ? `${grouped}.${fraction}` : grouped;
  return `${negative ? '−' : ''}${toBnDigits(body)}`;
}

/** Money, with the taka sign. */
export function taka(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `৳${formatBn(value)}`;
}

export function percentBn(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${toBnDigits(value.toFixed(digits))}%`;
}

const BN_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
] as const;

/** An ISO date (YYYY-MM-DD) as "১ জুলাই ২০২৬". Parsed by hand rather than
 *  through Date, so the result never shifts by a day with the timezone. */
export function formatDateBn(iso: string | null | undefined): string {
  if (!iso) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, y, m, d] = match;
  const month = BN_MONTHS[Number(m) - 1];
  if (!month || !y || !d) return iso;
  return `${toBnDigits(String(Number(d)))} ${month} ${toBnDigits(y)}`;
}

export function gradeLabel(grade: number): string {
  return `গ্রেড-${toBnDigits(grade)}`;
}

/** "৮৬০০০-৮৯৫০০-…" as printed in the Gazette table. */
export function scaleLabel(steps: readonly number[]): string {
  return steps.map((s) => toBnDigits(s)).join('-');
}

export function scaleRangeLabel(min: number, max: number): string {
  return min === max
    ? `${toBnDigits(min)} (নির্ধারিত)`
    : `${toBnDigits(min)}–${toBnDigits(max)}`;
}
