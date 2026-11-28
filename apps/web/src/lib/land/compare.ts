/**
 * Cross-checking land documents against each other.
 *
 * Input: the fields Gemini read from each uploaded document (and the visitor
 * may have corrected). Output, in Bangla: which documents are still needed,
 * what agrees, what disagrees, and what could not be checked.
 *
 * Pure and deterministic, so it runs in the browser and in tests. It never
 * says a title is clean; it only reports agreement between papers.
 */

export type DocType =
  | 'dolil' | 'baya_dolil' | 'khatian' | 'namjari_khatian' | 'dcr' | 'dakhila' | 'warishan' | 'other';

export type AreaUnit = 'shotangsho' | 'acre' | 'katha' | 'bigha' | 'sqft' | 'ojutangsho' | 'other';

export interface Person { name: string; father_or_husband?: string | null; share?: string | null }

export interface DocFields {
  doc_type: DocType;
  is_land_document: boolean;
  survey?: string | null;
  mouza?: string | null;
  jl_no?: string | null;
  upazila?: string | null;
  district?: string | null;
  khatian_numbers: string[];
  dag_numbers: string[];
  owners: Person[];
  sellers: Person[];
  area_value?: number | null;
  area_unit?: AreaUnit | null;
  deed_number?: string | null;
  deed_date?: string | null;
  deed_kind?: string | null;
  tax_paid_upto?: string | null;
  tax_arrears?: number | null;
  has_qr_code: boolean;
  unreadable_parts: string[];
}

export interface Doc { id: string; fields: DocFields }

export interface Finding { text: string; detail?: string }

export interface Analysis {
  present: { type: DocType; label: string; count: number }[];
  missing: Finding[];
  matched: Finding[];
  mismatched: Finding[];
  unchecked: Finding[];
  warnings: Finding[];
}

export const DOC_LABELS: Record<DocType, string> = {
  dolil: 'দলিল',
  baya_dolil: 'বায়া দলিল',
  khatian: 'জরিপ খতিয়ান',
  namjari_khatian: 'নামজারি খতিয়ান',
  dcr: 'ডিসিআর',
  dakhila: 'খাজনার দাখিলা',
  warishan: 'ওয়ারিশান সনদ',
  other: 'অন্য কাগজ',
};

// --- normalising -----------------------------------------------------------

const BN = '০১২৩৪৫৬৭৮৯';
export const asciiDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));

const TITLES = [
  'মোহাম্মদ', 'মোছাম্মৎ', 'মোসাম্মৎ', 'মোছাঃ', 'মোসাঃ', 'মোস্তাঃ', 'মোঃ', 'মো:', 'মো.', 'মোহা:', 'মোহাঃ',
  'শ্রীমতি', 'শ্রীমতী', 'শ্রী', 'মৃত', 'মরহুম', 'মরহুমা', 'বেগম', 'মিসেস', 'জনাব',
  'md', 'mst', 'mohammad', 'mrs', 'late',
];

export function normName(raw: string): string {
  let s = raw.normalize('NFC').toLowerCase();
  for (const t of TITLES) s = s.split(t.normalize('NFC')).join(' ');
  return s.replace(/[\s.,:;()\-–'"`ঃ]+/g, '');
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n]!;
}

/** Same person, allowing for titles, spacing and a one-letter misreading. */
export function sameName(a: string, b: string): boolean {
  const x = normName(a), y = normName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  if (s.length >= 4 && l.includes(s)) return true;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length) >= 0.85;
}

export const normNum = (s: string) =>
  asciiDigits(s.normalize('NFC')).replace(/\s+/g, '').replace(/^0+(?=\d)/, '').toLowerCase();

const normPlace = (s: string) => s.normalize('NFC').replace(/[\s.,\-]+/g, '').toLowerCase();

const SQFT: Record<Exclude<AreaUnit, 'other'>, number> = {
  sqft: 1, ojutangsho: 4.356, katha: 720, shotangsho: 435.6, bigha: 14400, acre: 43560,
};

export function toShotangsho(value?: number | null, unit?: AreaUnit | null): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0 || !unit || unit === 'other') return null;
  return (value * SQFT[unit]) / SQFT.shotangsho;
}

const fmt = (n: number) => asciiToBn(String(Math.round(n * 100) / 100));
export const asciiToBn = (s: string) => s.replace(/[0-9]/g, (d) => BN.charAt(Number(d)));
const names = (ps: Person[]) => ps.map((p) => p.name).join(', ');
const list = (xs: string[]) => xs.map((x) => asciiToBn(x)).join(', ');

// --- dates -----------------------------------------------------------------

/** The Bangladesh fiscal year now, e.g. 2026 for July 2026 – June 2027. */
export function fiscalStart(now: Date): number {
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * Turn "2025-2026", "২০২৫-২৬", "১৪৩২" or "১৪৩২-৩৩" into the Gregorian year the
 * paid period ends in, or null. A Bengali year N runs from mid-April of N+593.
 */
export function paidUptoYear(raw: string): number | null {
  const nums = (asciiDigits(raw).match(/\d{2,4}/g) || []).map(Number);
  if (nums.length === 0) return null;
  const first = nums[0]!;
  let last = nums[nums.length - 1]!;
  if (last < 100) last = Math.floor(first / 100) * 100 + last; // "2025-26" or "১৪৩২-৩৩"
  if (last >= 1300 && last < 1500) return last + 594; // Bengali year ends in April of +594
  if (last >= 1900 && last < 2200) return last;
  return null;
}

// --- the analysis ----------------------------------------------------------

const REQUIRED: { type: DocType; why: string }[] = [
  { type: 'dolil', why: 'বিক্রেতা কীভাবে মালিক হয়েছেন, তার প্রমাণ।' },
  { type: 'khatian', why: 'সর্বশেষ জরিপে (বিএস বা আরএস) জমি কার নামে রেকর্ড, তা দেখার জন্য।' },
  { type: 'namjari_khatian', why: 'বিক্রেতার নামে নামজারি হয়েছে কিনা।' },
  { type: 'dakhila', why: 'খাজনা হালনাগাদ কিনা।' },
];

const RECOMMENDED: { type: DocType; why: string }[] = [
  { type: 'baya_dolil', why: 'মালিকানার পুরো ধারা মিলিয়ে দেখার জন্য।' },
  { type: 'dcr', why: 'নামজারির ফি পরিশোধের রসিদ।' },
];

function latestDeed(deeds: Doc[]): Doc | undefined {
  return [...deeds].sort((a, b) => (b.fields.deed_date || '').localeCompare(a.fields.deed_date || ''))[0];
}

const anyNameIn = (people: Person[], pool: Person[]) =>
  people.filter((p) => pool.some((q) => sameName(p.name, q.name)));

export function analyze(docs: Doc[], now = new Date()): Analysis {
  const land = docs.filter((d) => d.fields.is_land_document && d.fields.doc_type !== 'other');
  const of = (t: DocType) => land.filter((d) => d.fields.doc_type === t);
  const out: Analysis = { present: [], missing: [], matched: [], mismatched: [], unchecked: [], warnings: [] };

  for (const d of docs) {
    if (!d.fields.is_land_document || d.fields.doc_type === 'other') {
      out.warnings.push({ text: 'একটা ফাইল জমির কাগজ বলে চেনা যায়নি, তাই মেলানোয় ধরা হয়নি।' });
    }
    if (d.fields.unreadable_parts.length) {
      out.warnings.push({
        text: `${DOC_LABELS[d.fields.doc_type]}-এর কিছু অংশ পড়া যায়নি।`,
        detail: d.fields.unreadable_parts.join('; '),
      });
    }
  }

  const types = Object.keys(DOC_LABELS) as DocType[];
  out.present = types.filter((t) => t !== 'other' && of(t).length)
    .map((t) => ({ type: t, label: DOC_LABELS[t], count: of(t).length }));

  for (const r of REQUIRED) if (!of(r.type).length) out.missing.push({ text: DOC_LABELS[r.type], detail: r.why });
  for (const r of RECOMMENDED) if (!of(r.type).length) out.missing.push({ text: `${DOC_LABELS[r.type]} (ভালো হয়)`, detail: r.why });

  const deed = latestDeed(of('dolil'));
  const owner = deed?.fields.owners ?? [];
  const namjari = of('namjari_khatian');
  const khatians = of('khatian');
  const dakhilas = of('dakhila');
  const bayas = of('baya_dolil');

  const inherited = [deed, ...khatians, ...namjari].some((d) =>
    d && (/ওয়ারিশ|ওয়ারিশ|উত্তরাধিকার|বণ্টন|বন্টন/.test(d.fields.deed_kind || '')
      || d.fields.owners.some((p) => /মৃত|মরহুম/.test(p.name))));
  if (inherited && !of('warishan').length) {
    out.missing.unshift({ text: DOC_LABELS.warishan, detail: 'কাগজে উত্তরাধিকার বা মৃত মালিকের উল্লেখ আছে; সব ওয়ারিশ কারা, তা দেখার জন্য।' });
  }

  // 1. The seller's name across documents.
  if (!deed) out.unchecked.push({ text: 'দলিল নেই, তাই বর্তমান মালিক কে তা মেলানো যায়নি।' });
  else if (!owner.length) out.unchecked.push({ text: 'দলিলে গ্রহীতার নাম পড়া যায়নি।' });
  else {
    const who = names(owner);
    for (const [docs2, label] of [[namjari, 'নামজারি খতিয়ানে'], [dakhilas, 'খাজনার দাখিলায়']] as const) {
      if (!docs2.length) continue;
      const pool = docs2.flatMap((d) => d.fields.owners);
      const hit = anyNameIn(owner, pool);
      if (hit.length) out.matched.push({ text: `দলিলের মালিক ${label}ও আছেন`, detail: names(hit) });
      else out.mismatched.push({ text: `দলিলের মালিক (${who}) ${label} নেই`, detail: `${label} আছে: ${names(pool) || 'কোনো নাম পড়া যায়নি'}` });
    }
    if (khatians.length) {
      const pool = khatians.flatMap((d) => d.fields.owners);
      const chain = [...owner, ...(deed.fields.sellers || []), ...bayas.flatMap((b) => [...b.fields.owners, ...b.fields.sellers])];
      const hit = anyNameIn(pool, chain);
      if (hit.length) out.matched.push({ text: 'জরিপ খতিয়ানের মালিক দলিলের ধারায় আছেন', detail: names(hit) });
      else out.mismatched.push({
        text: 'জরিপ খতিয়ানের মালিককে দলিল বা বায়া দলিলের কোথাও পাওয়া যায়নি',
        detail: `খতিয়ানে: ${names(pool) || '—'}। মালিকানা কীভাবে হাত বদলেছে, তার কাগজ লাগবে।`,
      });
    }
  }

  // 2. The chain: the baya deed's buyer should be this deed's seller.
  if (deed && bayas.length) {
    const sellers = deed.fields.sellers;
    const bayaBuyers = bayas.flatMap((b) => b.fields.owners);
    if (!sellers.length || !bayaBuyers.length) out.unchecked.push({ text: 'দলিল ও বায়া দলিলের নাম পুরো পড়া যায়নি, ধারা মেলানো যায়নি।' });
    else if (anyNameIn(sellers, bayaBuyers).length) out.matched.push({ text: 'দলিলের দাতা বায়া দলিলের গ্রহীতা: মালিকানার ধারা মিলেছে', detail: names(sellers) });
    else out.mismatched.push({ text: 'দলিলের দাতা বায়া দলিলের গ্রহীতা নন', detail: `দাতা: ${names(sellers)}; বায়া দলিলের গ্রহীতা: ${names(bayaBuyers)}` });
  }

  // 3. Dag numbers.
  const dagSets = land.filter((d) => d.fields.dag_numbers.length && d.fields.doc_type !== 'dakhila')
    .map((d) => ({ label: DOC_LABELS[d.fields.doc_type], set: new Set(d.fields.dag_numbers.map(normNum)) }));
  if (dagSets.length < 2) out.unchecked.push({ text: 'দাগ নম্বর মেলাতে অন্তত দুটো কাগজে দাগ নম্বর লাগবে।' });
  else {
    const common = [...dagSets[0]!.set].filter((x) => dagSets.every((s) => s.set.has(x)));
    if (common.length) out.matched.push({ text: 'দাগ নম্বর সব কাগজে মিলেছে', detail: list(common) });
    else out.mismatched.push({
      text: 'সব কাগজে একই দাগ নম্বর নেই',
      detail: dagSets.map((s) => `${s.label}: ${list([...s.set])}`).join(' | '),
    });
  }

  // 4. Mouza and JL number.
  for (const [key, label] of [['mouza', 'মৌজা'], ['jl_no', 'জেএল নম্বর']] as const) {
    const vals = land.map((d) => ({ label: DOC_LABELS[d.fields.doc_type], v: d.fields[key] }))
      .filter((x): x is { label: string; v: string } => Boolean(x.v));
    if (vals.length < 2) continue;
    const norm = key === 'jl_no' ? normNum : normPlace;
    if (new Set(vals.map((x) => norm(x.v))).size === 1) out.matched.push({ text: `${label} সব কাগজে এক`, detail: vals[0]!.v });
    else out.mismatched.push({ text: `${label} আলাদা`, detail: vals.map((x) => `${x.label}: ${x.v}`).join(' | ') });
  }

  // 5. Khatian number on the deed vs the khatian documents.
  if (deed?.fields.khatian_numbers.length && (khatians.length || namjari.length)) {
    const onDeed = new Set(deed.fields.khatian_numbers.map(normNum));
    const docsK = [...khatians, ...namjari].flatMap((d) => d.fields.khatian_numbers.map(normNum));
    const hit = docsK.filter((k) => onDeed.has(k));
    if (hit.length) out.matched.push({ text: 'দলিলে লেখা খতিয়ান নম্বর খতিয়ানের সাথে মিলেছে', detail: list(hit) });
    else out.unchecked.push({
      text: 'দলিলের খতিয়ান নম্বর আপলোড করা খতিয়ানে নেই',
      detail: `দলিলে: ${list([...onDeed])}; খতিয়ানে: ${list(docsK) || '—'}। দলিল অন্য জরিপের খতিয়ান উল্লেখ করতে পারে, তাই এটা নিশ্চিত গরমিল নয়।`,
    });
  }

  // 6. Area: the deed vs the mutation.
  const deedArea = deed ? toShotangsho(deed.fields.area_value, deed.fields.area_unit) : null;
  const njArea = namjari.map((d) => toShotangsho(d.fields.area_value, d.fields.area_unit)).find((x) => x != null) ?? null;
  if (deedArea != null && njArea != null) {
    const diff = Math.abs(deedArea - njArea) / Math.max(deedArea, njArea);
    if (diff <= 0.01) out.matched.push({ text: 'দলিল আর নামজারিতে জমির পরিমাণ এক', detail: `${fmt(deedArea)} শতাংশ` });
    else if (njArea < deedArea) out.mismatched.push({ text: 'নামজারিতে দলিলের চেয়ে কম জমি', detail: `দলিলে ${fmt(deedArea)}, নামজারিতে ${fmt(njArea)} শতাংশ` });
    else out.warnings.push({ text: 'নামজারিতে দলিলের চেয়ে বেশি জমি', detail: `দলিলে ${fmt(deedArea)}, নামজারিতে ${fmt(njArea)} শতাংশ। অন্য দলিলের জমিও একই খতিয়ানে থাকতে পারে; মিলিয়ে দেখুন।` });
  } else if (deed && namjari.length) {
    out.unchecked.push({ text: 'দলিল বা নামজারিতে জমির পরিমাণ পড়া যায়নি, তাই মেলানো যায়নি।' });
  }

  // 7. Land tax.
  for (const d of dakhilas) {
    const upto = d.fields.tax_paid_upto ? paidUptoYear(d.fields.tax_paid_upto) : null;
    const need = fiscalStart(now) + 1;
    if (d.fields.tax_arrears && d.fields.tax_arrears > 0) {
      out.mismatched.push({ text: 'দাখিলায় বকেয়া খাজনা আছে', detail: `${asciiToBn(String(d.fields.tax_arrears))} টাকা` });
    } else if (upto == null) {
      out.unchecked.push({ text: 'দাখিলায় কোন বছর পর্যন্ত খাজনা দেওয়া, তা পড়া যায়নি।' });
    } else if (upto >= need) {
      out.matched.push({ text: 'খাজনা চলতি অর্থবছর পর্যন্ত পরিশোধিত', detail: d.fields.tax_paid_upto || undefined });
    } else {
      out.mismatched.push({ text: 'খাজনা হালনাগাদ নয়', detail: `দাখিলায় পরিশোধ: ${d.fields.tax_paid_upto}। চলতি অর্থবছর: ${asciiToBn(`${need - 1}-${need}`)}` });
    }
  }

  // 8. Warning signs.
  if (deed && /আমমোক্তার|পাওয়ার/.test(deed.fields.deed_kind || '')) {
    out.warnings.push({ text: 'দলিলটা আমমোক্তারনামা', detail: 'আমমোক্তারনামা দিয়ে বিক্রিতে জালিয়াতির ঝুঁকি বেশি। মূল মালিক জীবিত ও রাজি কিনা নিশ্চিত হন।' });
  }
  if ([...namjari, ...khatians].some((d) => d.fields.has_qr_code)) {
    out.warnings.push({ text: 'খতিয়ানে QR কোড আছে', detail: 'ফোনের ক্যামেরায় স্ক্যান করুন। যে লিংক খোলে তা .gov.bd কিনা আর তথ্য কাগজের সাথে মেলে কিনা দেখুন।' });
  }

  return out;
}
