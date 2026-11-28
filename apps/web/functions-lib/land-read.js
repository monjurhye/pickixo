/**
 * Reading land documents with Gemini, for the "কাগজ মিলিয়ে দেখুন" tool on
 * /bhumi-seba. Pure helpers here; the HTTP handler is
 * functions/api/land/read.js.
 *
 * Environment (Cloudflare Pages → Settings → Variables and Secrets):
 *   GEMINI_API_KEY      secret  key from a PAID (billing-enabled) Google AI
 *                               Studio project. The free tier lets Google use
 *                               and human-review what is sent, and its terms
 *                               forbid personal data — land papers are nothing
 *                               but personal data. Do not use a free-tier key.
 *   GEMINI_MODEL        text    optional, default below
 *   LAND_LIMITS         KV      optional binding; turns on the daily limits
 *   LAND_DAILY_PER_IP   text    optional, default 15 documents per IP per day
 *   LAND_DAILY_TOTAL    text    optional, default 300 documents per day overall
 *
 * Nothing a visitor uploads is stored or logged: the pages go to Gemini and
 * the extracted fields come straight back to the browser.
 */

export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_PAGES = 8;
/** Decoded bytes across all pages. Gemini's inline limit is 20 MB per request. */
export const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

export const DOC_TYPES = [
  'dolil',            // দলিল (the deed that made the seller owner, or the sale deed)
  'baya_dolil',       // বায়া দলিল (an earlier deed in the chain)
  'khatian',          // জরিপ খতিয়ান: CS, SA, RS, BS, city survey
  'namjari_khatian',  // নামজারি / মিউটেশন খতিয়ান
  'dcr',              // ডিসিআর
  'dakhila',          // ভূমি উন্নয়ন কর দাখিলা
  'warishan',         // ওয়ারিশান সনদ
  'other',
];

const PERSON = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', description: 'নাম, বাংলায়, যেমন লেখা আছে' },
    father_or_husband: { type: 'STRING', nullable: true, description: 'পিতা/স্বামীর নাম, থাকলে' },
    share: { type: 'STRING', nullable: true, description: 'অংশ, যেমন ০.৫০০ বা ১/৩, থাকলে' },
  },
  required: ['name'],
};

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    doc_type: { type: 'STRING', enum: DOC_TYPES },
    is_land_document: { type: 'BOOLEAN' },
    survey: { type: 'STRING', nullable: true, enum: ['CS', 'SA', 'RS', 'BS', 'BRS', 'CITY', 'PETI', 'DIARA', 'OTHER'] },
    division: { type: 'STRING', nullable: true },
    district: { type: 'STRING', nullable: true },
    upazila: { type: 'STRING', nullable: true },
    mouza: { type: 'STRING', nullable: true },
    jl_no: { type: 'STRING', nullable: true },
    khatian_numbers: { type: 'ARRAY', items: { type: 'STRING' } },
    dag_numbers: { type: 'ARRAY', items: { type: 'STRING' } },
    owners: { type: 'ARRAY', items: PERSON, description: 'খতিয়ান/দাখিলার মালিক; দলিলে গ্রহীতা (ক্রেতা)' },
    sellers: { type: 'ARRAY', items: PERSON, description: 'শুধু দলিলে: দাতা/বিক্রেতা' },
    area_value: { type: 'NUMBER', nullable: true, description: 'এই কাগজে হস্তান্তরিত বা মালিকের মোট জমির পরিমাণ' },
    area_unit: { type: 'STRING', nullable: true, enum: ['shotangsho', 'acre', 'katha', 'bigha', 'sqft', 'ojutangsho', 'other'] },
    deed_number: { type: 'STRING', nullable: true },
    deed_date: { type: 'STRING', nullable: true, description: 'YYYY-MM-DD যদি পড়া যায়' },
    deed_kind: { type: 'STRING', nullable: true, description: 'সাফ কবলা, হেবা, দান, বণ্টননামা, আমমোক্তারনামা ইত্যাদি' },
    sub_registry_office: { type: 'STRING', nullable: true },
    namjari_case_no: { type: 'STRING', nullable: true },
    tax_paid_upto: { type: 'STRING', nullable: true, description: 'দাখিলায়: কোন সন পর্যন্ত কর পরিশোধিত, যেমন 2025-2026 বা ১৪৩২' },
    tax_arrears: { type: 'NUMBER', nullable: true, description: 'দাখিলায় বকেয়া টাকা, থাকলে' },
    has_qr_code: { type: 'BOOLEAN' },
    unreadable_parts: { type: 'ARRAY', items: { type: 'STRING' }, description: 'যে অংশ পড়া যায়নি বা অনিশ্চিত' },
  },
  required: ['doc_type', 'is_land_document', 'khatian_numbers', 'dag_numbers', 'owners', 'sellers', 'has_qr_code', 'unreadable_parts'],
};

export const PROMPT = `তুমি বাংলাদেশের জমির কাগজ পড়ছ। ছবিগুলো একটাই কাগজের পাতা।
কাজ: কাগজটা কোন ধরনের তা চিনে নাও, আর নিচের তথ্যগুলো যেমন লেখা আছে ঠিক তেমন বের করো।
নিয়ম:
- কিছু অনুমান করবে না। যা পড়া যায় না বা কাগজে নেই, তা null বা খালি তালিকা দাও, এবং unreadable_parts-এ লিখো।
- নাম বাংলায়, কাগজে যেমন বানান আছে তেমন। "মোঃ", "শ্রী" ইত্যাদি রেখে দাও।
- দাগ ও খতিয়ান নম্বর সংখ্যা হিসেবে যেমন লেখা (বাংলা বা ইংরেজি অঙ্ক), একাধিক থাকলে সবগুলো আলাদা করে।
- দলিলে: sellers = দাতা/বিক্রেতা, owners = গ্রহীতা/ক্রেতা। area_value = দলিলে হস্তান্তরিত জমি।
- খতিয়ান ও নামজারি খতিয়ানে: owners = মালিকদের নাম ও অংশ, area_value = খতিয়ানে মোট জমি।
- দাখিলায়: owners = যাদের নামে দাখিলা, tax_paid_upto = কোন বছর পর্যন্ত পরিশোধ।
- জমির কাগজ না হলে is_land_document = false এবং doc_type = "other"।`;

const b64Bytes = (b64) => Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);

/** Validate the browser's request body. Returns { pages } or { error }. */
export function validatePages(body) {
  const pages = Array.isArray(body?.pages) ? body.pages : null;
  if (!pages || pages.length === 0) return { error: 'কোনো পাতা পাওয়া যায়নি।' };
  if (pages.length > MAX_PAGES) return { error: `একটা কাগজে সর্বোচ্চ ৮টা পাতা দিন।` };
  let total = 0;
  for (const p of pages) {
    if (!p || typeof p.data !== 'string' || !ALLOWED_TYPES.includes(p.mimeType)) {
      return { error: 'শুধু JPG, PNG, WEBP ছবি বা PDF দিন।' };
    }
    if (!/^[A-Za-z0-9+/]+=*$/.test(p.data)) return { error: 'ফাইলটা পড়া যায়নি।' };
    total += b64Bytes(p.data);
  }
  if (total > MAX_TOTAL_BYTES) return { error: 'ফাইল খুব বড়। মোট ১৫ MB-এর কম রাখুন।' };
  return { pages: pages.map((p) => ({ mimeType: p.mimeType, data: p.data })) };
}

export function geminiRequest(pages) {
  return {
    contents: [{
      role: 'user',
      parts: [
        ...pages.map((p) => ({ inline_data: { mime_type: p.mimeType, data: p.data } })),
        { text: PROMPT },
      ],
    }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  };
}

/** Pull the JSON out of a generateContent response. Returns null if absent. */
export function parseGemini(json) {
  const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!text) return null;
  try {
    const out = JSON.parse(text);
    return out && typeof out === 'object' && DOC_TYPES.includes(out.doc_type) ? out : null;
  } catch {
    return null;
  }
}

/** Day key in Bangladesh time (UTC+6), so limits reset at local midnight. */
export function dayKey(now = new Date()) {
  return new Date(now.getTime() + 6 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Count one document against the per-IP and overall daily limits.
 * KV is eventually consistent, so this is a cost guard, not an exact meter.
 */
export async function takeQuota(env, ip, now = new Date()) {
  const kv = env.LAND_LIMITS;
  if (!kv) return { ok: true };
  const day = dayKey(now);
  const perIp = Number(env.LAND_DAILY_PER_IP) || 15;
  const total = Number(env.LAND_DAILY_TOTAL) || 300;
  const ipKey = `ip:${day}:${ip}`;
  const allKey = `all:${day}`;
  const [ipCount, allCount] = await Promise.all([kv.get(ipKey), kv.get(allKey)]).then((v) => v.map((x) => Number(x) || 0));
  if (allCount >= total) return { ok: false, error: 'আজকের মতো সবার জন্য নির্ধারিত সীমা শেষ। আগামীকাল আবার চেষ্টা করুন।' };
  if (ipCount >= perIp) return { ok: false, error: `একজন দিনে সর্বোচ্চ ${String(perIp).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[d])}টা কাগজ পড়াতে পারেন। আগামীকাল আবার চেষ্টা করুন।` };
  const ttl = { expirationTtl: 2 * 24 * 3600 };
  await Promise.all([kv.put(ipKey, String(ipCount + 1), ttl), kv.put(allKey, String(allCount + 1), ttl)]);
  return { ok: true };
}
