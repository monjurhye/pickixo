/**
 * Which words Pickixo has drawn a picture for.
 *
 * Kept here, apart from the drawings themselves, because `rounds.ts` has to
 * know whether a picture exists before it builds a picture question — and
 * `rounds.ts` is pure logic that is compiled and tested outside React, so it
 * cannot import a `.tsx` file full of JSX.
 *
 * `drawings.tsx` types its table as `Record<ArtKey, ReactNode>`, so the two
 * cannot drift: a key listed here without a drawing fails the build, and a
 * drawing with no key here fails it too.
 *
 * **Every picture-word in the curriculum is drawn.** The list below is
 * generated from the lesson data and checked against it by
 * `content.test.mjs`, so a word added to a lesson without a drawing fails the
 * tests rather than reaching a child as a blank card.
 */

export const ART_WORDS = [
  // ক খ গ ঘ ঙ  (banjonborno-1)
  'কলম', 'কলা', 'খরগোশ', 'খাতা', 'গাছ', 'গাড়ি', 'ঘর', 'ঘড়ি', 'ব্যাঙ', 'ঝিঙা',
  // চ ছ জ ঝ ঞ  (banjonborno-2)
  'চড়ুই', 'চশমা', 'ছাগল', 'ছাতা', 'জাহাজ', 'জবা', 'ঝড়', 'ঝর্ণা', 'মিঞসাহেব', 'মিঞ',
  // ট ঠ ড ঢ ণ  (banjonborno-3)
  'টিয়া', 'টমেটো', 'ঠোঁট', 'ঠেলাগাড়ি', 'ডাব', 'ডিম', 'ঢোল', 'ঢাকনা', 'হরিণ', 'বীণা',
  // ত থ দ ধ ন  (banjonborno-4)
  'তবলা', 'তিমি', 'থালা', 'থলে', 'দোয়েল', 'দরজা', 'ধান', 'ধনুক', 'নদী', 'নৌকা',
  // প ফ ব ভ ম  (banjonborno-5)
  'পাখি', 'পাতা', 'ফুল', 'ফড়িং', 'বানর', 'বক', 'ভালুক', 'ভেড়া', 'ময়ূর', 'মাছি',
  // য র ল শ  (banjonborno-6)
  'যব', 'যাঁতা', 'রাজহাঁস', 'রংধনু', 'লাটিম', 'লিচু', 'শাপলা', 'শসা',
  // ষ স হ ড় ঢ়  (banjonborno-7)
  'ষাঁড়', 'মহিষ', 'সিংহ', 'সাবান', 'হাঁস', 'হাতি', 'বিড়াল', 'আষাঢ়',
  // য় ৎ ং ঃ ঁ  (banjonborno-8)
  'ময়না', 'আয়না', 'মৎস্য', 'চিৎপটাং', 'শিং', 'আংটি', 'দুঃখী', 'চাঁদ', 'কাঁঠাল',
  // দুই বর্ণের শব্দ  (shobdo-gothon-1)
  'বল', 'বই', 'মই', 'ফল', 'জগ', 'খই',
  // তিন বর্ণের শব্দ  (shobdo-gothon-2)
  'কলস',
  // অ আ ই ঈ  (shoroborno-1)
  'অজগর', 'অলঙ্কার', 'আম', 'আনারস', 'ইট', 'ইলিশ', 'ঈগল', 'ঈদ',
  // উ ঊ ঋ  (shoroborno-2)
  'উট', 'উড়োজাহাজ', 'ঊর্মিমালা', 'ঋতু',
  // এ ঐ ও ঔ  (shoroborno-3)
  'একতারা', 'ঐরাবত', 'ওল', 'ওড়না', 'ঔষধ',
] as const;

export type ArtKey = (typeof ART_WORDS)[number];

const KEYS: ReadonlySet<string> = new Set(ART_WORDS);

/** Whether this word can be shown as a picture. */
export function hasArtWord(word: string | null | undefined): boolean {
  return Boolean(word && KEYS.has(word));
}
