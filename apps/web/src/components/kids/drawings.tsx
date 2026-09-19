/**
 * The drawings — one per picture-word in আমার বই.
 *
 * Split out from `art.tsx` for the same reason `alphabetDrawings.tsx` is split
 * from `Illustration.tsx`: this file is a long, flat table that grows every
 * time a word is drawn, and the component that renders it should not have to
 * be re-read every time.
 *
 * These are Pickixo's own drawings of the curriculum's words. The *words* are
 * NCTB's; the pictures are not, and no textbook artwork is traced or reused
 * (§24). Where the book's own illustration settles an ambiguous word, it was
 * checked and followed — শিং is a bull's head with horns rather than the
 * catfish, মিঞ is a black-and-white cat, ঋতু is the flame tree in flower —
 * because a picture that contradicts the source teaches the wrong word.
 *
 * House style, kept rigid so a grid of these reads as one set:
 *   * viewBox 0 0 100 100, subject filling most of it
 *   * flat fills, no gradients, no textures
 *   * one ink outline at stroke-width 3, round caps and joins
 *   * a small warm palette, reused
 *   * the most obvious possible version of the noun — a leaf is a leaf shape,
 *     not a branch in a landscape. A four-year-old has about a second.
 */
import type { ReactNode } from 'react';
import type { ArtKey } from '@/lib/kids/art-keys';

export const C = {
  ink: '#2b3440',
  red: '#ef5b5b',
  deepred: '#c8453f',
  orange: '#f79b4b',
  yellow: '#fbd14b',
  gold: '#e8a33d',
  green: '#5cb85c',
  leaf: '#3e9e55',
  darkleaf: '#2f7d42',
  teal: '#2eb8a6',
  blue: '#4a9ff5',
  deep: '#2f6fb5',
  navy: '#26507f',
  purple: '#9b7ede',
  pink: '#f58fb4',
  brown: '#a9714b',
  bark: '#7c5334',
  skin: '#f0c19a',
  cream: '#fff6e9',
  white: '#ffffff',
  grey: '#c9d2dc',
  slate: '#8795a5',
  dark: '#3d4654',
  /** For things that are "white" but sit on a white card and must still read. */
  pale: '#dfe7ee',
} as const;

const S = {
  stroke: C.ink,
  strokeWidth: 3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** A thinner line, for details that would clot at width 3. */
const T = {
  stroke: C.ink,
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

/**
 * Typed against `ArtKey`, so this table and the key list cannot drift: a key
 * listed but not drawn fails the build, and a drawing with no key fails too.
 */
export const DRAWINGS: Record<ArtKey, ReactNode> = {
  /* ====================================================================== */
  /* স্বরবর্ণ                                                               */
  /* ====================================================================== */

  আম: (
    <>
      <path d="M50 22c18 0 28 14 28 30S64 84 50 84 22 68 22 52 32 22 50 22Z" fill={C.yellow} {...S} />
      <path d="M50 22c-6-6-2-12 4-14" fill="none" {...S} />
      <path d="M54 8c8-2 14 2 14 2s-6 6-14 4" fill={C.leaf} {...S} />
      <path d="M38 40c4 8 4 16 0 24" fill="none" stroke={C.gold} strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  আনারস: (
    <>
      <path d="M36 14 50 4l14 10" fill={C.leaf} {...S} />
      <path d="M30 22 50 8l20 14" fill={C.green} {...S} />
      <rect x="28" y="30" width="44" height="58" rx="20" fill={C.gold} {...S} />
      <path d="M32 44 68 62M68 44 32 62M32 62 68 80M68 62 32 80" stroke={C.brown} strokeWidth={2.5} strokeLinecap="round" fill="none" />
    </>
  ),
  অজগর: (
    <>
      <path d="M14 76c14 0 14-16 28-16s14 16 28 16 16-8 16-20" fill="none" stroke={C.green} strokeWidth={13} strokeLinecap="round" />
      <path d="M14 76c14 0 14-16 28-16s14 16 28 16 16-8 16-20" fill="none" stroke={C.ink} strokeWidth={3} strokeLinecap="round" />
      <circle cx="84" cy="50" r="10" fill={C.green} {...S} />
      <circle cx="87" cy="47" r="2.2" fill={C.ink} />
      <path d="M92 54q6 2 8 6" fill="none" stroke={C.red} strokeWidth={2.5} strokeLinecap="round" />
    </>
  ),
  অলঙ্কার: (
    <>
      <path d="M26 34a24 24 0 0 0 48 0" fill="none" stroke={C.gold} strokeWidth={7} strokeLinecap="round" />
      <circle cx="50" cy="58" r="11" fill={C.yellow} {...S} />
      <circle cx="30" cy="48" r="5" fill={C.red} {...S} />
      <circle cx="70" cy="48" r="5" fill={C.red} {...S} />
      <circle cx="50" cy="58" r="4" fill={C.red} />
    </>
  ),
  ইট: (
    <>
      <rect x="14" y="36" width="72" height="30" rx="4" fill={C.red} {...S} />
      <path d="M14 51h72" stroke={C.ink} strokeWidth={2.5} />
      <path d="M38 36v15M62 51v15" stroke={C.ink} strokeWidth={2.5} />
    </>
  ),
  ইলিশ: (
    <>
      <path d="M18 50c14-18 44-18 58 0-14 18-44 18-58 0Z" fill={C.grey} {...S} />
      <path d="M76 50 92 36v28L76 50Z" fill={C.slate} {...S} />
      <circle cx="34" cy="46" r="3" fill={C.ink} />
      <path d="M46 36c4 8 4 20 0 28" fill="none" stroke={C.slate} strokeWidth={2.5} />
      <path d="M58 38c4 7 4 17 0 24" fill="none" stroke={C.slate} strokeWidth={2.5} />
    </>
  ),
  ঈগল: (
    <>
      <path d="M46 52 8 42q4 18 20 24t18-6Z" fill={C.bark} {...S} />
      <path d="M54 52 92 42q-4 18-20 24t-18-6Z" fill={C.bark} {...S} />
      <path d="M50 40c9 0 13 8 13 18s-5 22-13 22-13-12-13-22 4-18 13-18Z" fill={C.brown} {...S} />
      <path d="M50 42c7 0 9 6 9 13H41c0-7 2-13 9-13Z" fill={C.cream} {...S} />
      <circle cx="50" cy="28" r="12" fill={C.white} {...S} />
      <circle cx="55" cy="25" r="2.6" fill={C.ink} />
      <path d="M62 28c6 0 9 3 9 6-4 1-7 0-9-2Z" fill={C.gold} {...S} />
      <path d="M44 82v8M56 82v8" stroke={C.gold} strokeWidth={3.5} strokeLinecap="round" />
    </>
  ),
  ঈদ: (
    <>
      <path d="M62 20a30 30 0 1 0 0 60 34 34 0 0 1 0-60Z" fill={C.yellow} {...S} />
      <path d="M78 26l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill={C.yellow} {...S} />
    </>
  ),
  উট: (
    <>
      <path d="M22 70V54c0-10 8-14 16-14 6-10 18-10 24 0 10 0 14 6 14 14v16" fill={C.gold} {...S} />
      <path d="M76 54V32c0-6 8-6 8 0v10" fill={C.gold} {...S} />
      <circle cx="82" cy="28" r="8" fill={C.gold} {...S} />
      <circle cx="85" cy="26" r="2" fill={C.ink} />
      <path d="M28 70v16M44 70v16M60 70v16M74 70v16" {...S} />
    </>
  ),
  উড়োজাহাজ: (
    <>
      <path d="M12 54h58l16-10-6 10 6 10-16-10Z" fill={C.white} {...S} />
      <path d="M40 54 26 30h8l20 24Z" fill={C.blue} {...S} />
      <path d="M40 54 26 78h8l20-24Z" fill={C.deep} {...S} />
      <circle cx="64" cy="54" r="3" fill={C.blue} />
    </>
  ),
  /** ঊর্মিমালা — a row of waves, which is what the word means. */
  ঊর্মিমালা: (
    <>
      <path d="M6 44q11-14 22 0t22 0 22 0 22 0" fill="none" stroke={C.blue} strokeWidth={6} strokeLinecap="round" />
      <path d="M6 60q11-14 22 0t22 0 22 0 22 0" fill="none" stroke={C.deep} strokeWidth={6} strokeLinecap="round" />
      <path d="M6 76q11-14 22 0t22 0 22 0 22 0" fill="none" stroke={C.teal} strokeWidth={6} strokeLinecap="round" />
      <path d="M6 44q11-14 22 0t22 0 22 0 22 0M6 60q11-14 22 0t22 0 22 0 22 0M6 76q11-14 22 0t22 0 22 0 22 0" fill="none" stroke={C.ink} strokeWidth={1.6} />
    </>
  ),
  /** ঋতু — the flame tree in flower, as the book's own picture shows. */
  ঋতু: (
    <>
      <path d="M50 92V54" stroke={C.bark} strokeWidth={7} strokeLinecap="round" fill="none" />
      <path d="M50 62 30 48M50 70 70 54" stroke={C.bark} strokeWidth={4.5} strokeLinecap="round" fill="none" />
      <circle cx="32" cy="34" r="15" fill={C.red} {...S} />
      <circle cx="62" cy="26" r="16" fill={C.deepred} {...S} />
      <circle cx="52" cy="46" r="13" fill={C.red} {...S} />
      <circle cx="76" cy="44" r="11" fill={C.orange} {...S} />
      <circle cx="32" cy="34" r="4" fill={C.yellow} />
      <circle cx="62" cy="26" r="4" fill={C.yellow} />
      <circle cx="52" cy="46" r="4" fill={C.yellow} />
    </>
  ),
  /** একতারা — the one-stringed instrument: gourd body, long neck, one string. */
  /**
   * একতারা — gourd body, long bamboo neck, one string, side tuning peg.
   *
   * The peg sticking out sideways is what stops this reading as a pendulum:
   * it is the one detail that says "instrument" rather than "weight on a
   * string".
   */
  একতারা: (
    <>
      <path d="M50 44c13 0 20 12 20 24S62 90 50 90 30 80 30 68s7-24 20-24Z" fill={C.brown} {...S} />
      <ellipse cx="50" cy="70" rx="13" ry="12" fill={C.cream} {...S} />
      <path d="M42 46 40 12M58 46l2-34" stroke={C.bark} strokeWidth={5} strokeLinecap="round" fill="none" />
      <path d="M40 12q10-6 20 0" fill="none" stroke={C.bark} strokeWidth={5} strokeLinecap="round" />
      <path d="M60 18h14" stroke={C.gold} strokeWidth={4} strokeLinecap="round" fill="none" />
      <circle cx="76" cy="18" r="4" fill={C.gold} {...S} />
      <path d="M50 12v58" stroke={C.ink} strokeWidth={1.8} fill="none" />
    </>
  ),
  /** ঐরাবত — the white elephant of the stories. */
  /**
   * ঐরাবত — the white elephant.
   *
   * Built on exactly the same geometry as হাতি, because that one reads
   * instantly and the only difference that matters here is the colour. Pale
   * grey rather than pure white: white-on-white loses the whole silhouette,
   * and a shape a child cannot make out is not a picture.
   */
  ঐরাবত: (
    <>
      <ellipse cx="56" cy="56" rx="28" ry="24" fill={C.pale} {...S} />
      <circle cx="26" cy="46" r="17" fill={C.pale} {...S} />
      <ellipse cx="34" cy="42" rx="12" ry="14" fill={C.white} {...S} />
      <path d="M20 60c-6 12-2 24 6 26" fill="none" stroke={C.pale} strokeWidth={9} strokeLinecap="round" />
      <path d="M20 60c-6 12-2 24 6 26" fill="none" stroke={C.ink} strokeWidth={2.2} />
      <circle cx="21" cy="42" r="2.4" fill={C.ink} />
      {/* The tusk — what tells ঐরাবত from an ordinary elephant. */}
      <path d="M26 60q-8 6-6 14" fill="none" stroke={C.white} strokeWidth={6} strokeLinecap="round" />
      <path d="M26 60q-8 6-6 14" fill="none" stroke={C.ink} strokeWidth={1.8} />
      <path d="M40 78v12M56 80v10M72 78v12" stroke={C.pale} strokeWidth={9} strokeLinecap="round" fill="none" />
      <path d="M40 78v12M56 80v10M72 78v12" stroke={C.ink} strokeWidth={2.4} fill="none" />
    </>
  ),
  /** ঔষধ — a strip of tablets and a bottle. */
  ঔষধ: (
    <>
      <rect x="10" y="40" width="46" height="26" rx="6" fill={C.teal} {...S} />
      <circle cx="22" cy="53" r="6" fill={C.white} {...S} />
      <circle cx="33" cy="53" r="6" fill={C.white} {...S} />
      <circle cx="44" cy="53" r="6" fill={C.white} {...S} />
      <rect x="66" y="34" width="24" height="46" rx="5" fill={C.red} {...S} />
      <rect x="72" y="26" width="12" height="10" rx="2" fill={C.slate} {...S} />
      <path d="M78 48v14M71 55h14" stroke={C.white} strokeWidth={4} strokeLinecap="round" fill="none" />
    </>
  ),
  ওল: (
    <>
      <ellipse cx="50" cy="60" rx="28" ry="24" fill={C.purple} {...S} />
      <path d="M50 36c0-10-4-16-10-20" fill="none" {...S} />
      <path d="M40 16c10-4 16 0 16 0s-6 8-16 4" fill={C.leaf} {...S} />
      <path d="M34 58q16 8 32 0" fill="none" stroke={C.ink} strokeWidth={2.5} />
    </>
  ),
  ওড়না: (
    <>
      <path d="M16 30q18 14 34 0 16 14 34 0v18q-18 14-34 0-16 14-34 0Z" fill={C.pink} {...S} />
      <path d="M16 48v18q18 14 34 0 16 14 34 0V48" fill={C.red} {...S} />
    </>
  ),

  /* ====================================================================== */
  /* ক-বর্গ                                                                 */
  /* ====================================================================== */

  কলা: (
    <>
      <path d="M22 40c0 26 18 42 42 42 12 0 18-6 18-6-16 0-34-12-40-26S22 40 22 40Z" fill={C.yellow} {...S} />
      <path d="M22 40c-4-2-8 0-8 0l6 8" fill={C.leaf} {...S} />
    </>
  ),
  কলম: (
    <>
      <path d="M22 78 34 68l30-38 10 8-30 38Z" fill={C.blue} {...S} />
      <path d="M64 30l6-8a6 6 0 0 1 10 8l-6 8Z" fill={C.deep} {...S} />
      <path d="M22 78l4-12 8 2Z" fill={C.cream} {...S} />
    </>
  ),
  খাতা: (
    <>
      <rect x="20" y="18" width="60" height="66" rx="5" fill={C.white} {...S} />
      <rect x="20" y="18" width="14" height="66" rx="5" fill={C.orange} {...S} />
      <path d="M44 36h26M44 50h26M44 64h18" stroke={C.grey} strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  /** খরগোশ — side view, and the ears are the whole identity, so they are long. */
  খরগোশ: (
    <>
      <ellipse cx="56" cy="62" rx="26" ry="20" fill={C.white} {...S} />
      <circle cx="28" cy="52" r="16" fill={C.white} {...S} />
      <path d="M22 38V14c0-6 8-6 8 0v22" fill={C.white} {...S} />
      <path d="M34 38V18c0-6 8-6 8 0v20" fill={C.white} {...S} />
      <path d="M25 34V18c0-3 3-3 3 0v16M37 36V22c0-3 3-3 3 0v14" fill={C.pink} stroke="none" />
      <circle cx="24" cy="50" r="2.6" fill={C.ink} />
      <ellipse cx="14" cy="56" rx="5" ry="4" fill={C.pink} {...S} />
      <path d="M18 60q-3 4 0 6" {...T} />
      <circle cx="80" cy="60" r="9" fill={C.white} {...S} />
      <path d="M44 80v8M60 80v8" stroke={C.ink} strokeWidth={4} strokeLinecap="round" fill="none" />
    </>
  ),
  গাছ: (
    <>
      <path d="M44 88V54h12v34Z" fill={C.bark} {...S} />
      <circle cx="50" cy="38" r="26" fill={C.green} {...S} />
      <circle cx="32" cy="46" r="14" fill={C.leaf} {...S} />
      <circle cx="68" cy="46" r="14" fill={C.leaf} {...S} />
    </>
  ),
  গাড়ি: (
    <>
      <path d="M14 66V52l12-16h34l12 16h14v14Z" fill={C.red} {...S} />
      <path d="M32 40h22v12H26Z" fill={C.blue} {...S} />
      <circle cx="32" cy="70" r="9" fill={C.ink} />
      <circle cx="32" cy="70" r="3.5" fill={C.white} />
      <circle cx="70" cy="70" r="9" fill={C.ink} />
      <circle cx="70" cy="70" r="3.5" fill={C.white} />
    </>
  ),
  ঘর: (
    <>
      <path d="M50 16 88 46H12Z" fill={C.red} {...S} />
      <path d="M20 46h60v40H20Z" fill={C.cream} {...S} />
      <rect x="42" y="60" width="18" height="26" rx="2" fill={C.brown} {...S} />
      <rect x="26" y="56" width="12" height="12" rx="2" fill={C.blue} {...S} />
      <rect x="64" y="56" width="12" height="12" rx="2" fill={C.blue} {...S} />
    </>
  ),
  ঘড়ি: (
    <>
      <circle cx="50" cy="52" r="30" fill={C.white} {...S} />
      <circle cx="50" cy="52" r="23" fill={C.cream} stroke={C.grey} strokeWidth={2} />
      <path d="M50 52V34M50 52l14 9" {...S} />
      <circle cx="50" cy="52" r="3.5" fill={C.red} />
      <path d="M44 22V14h12v8" fill={C.grey} {...S} />
    </>
  ),
  ব্যাঙ: (
    <>
      <ellipse cx="50" cy="62" rx="28" ry="20" fill={C.green} {...S} />
      <circle cx="34" cy="38" r="11" fill={C.green} {...S} />
      <circle cx="66" cy="38" r="11" fill={C.green} {...S} />
      <circle cx="34" cy="37" r="4" fill={C.white} stroke={C.ink} strokeWidth={2} />
      <circle cx="66" cy="37" r="4" fill={C.white} stroke={C.ink} strokeWidth={2} />
      <circle cx="34" cy="37" r="1.8" fill={C.ink} />
      <circle cx="66" cy="37" r="1.8" fill={C.ink} />
      <path d="M40 66q10 8 20 0" fill="none" {...S} />
      <path d="M24 76l-8 8M76 76l8 8" {...S} />
    </>
  ),
  ঝিঙা: (
    <>
      <path d="M40 18c12 0 18 10 18 26s-2 40-10 40-14-22-14-40 0-26 6-26Z" fill={C.leaf} {...S} />
      <path d="M40 30c2 14 2 34 0 46M50 32c2 14 2 32 0 44" fill="none" stroke={C.green} strokeWidth={2.5} />
      <path d="M40 18c0-6 6-8 10-6" fill="none" {...S} />
    </>
  ),

  /* ====================================================================== */
  /* চ-বর্গ                                                                 */
  /* ====================================================================== */

  চড়ুই: (
    <>
      <ellipse cx="52" cy="54" rx="24" ry="19" fill={C.brown} {...S} />
      <circle cx="30" cy="40" r="13" fill={C.bark} {...S} />
      <path d="M52 44q16-6 26 4-14 10-26 4Z" fill={C.cream} {...S} />
      <circle cx="25" cy="38" r="2.4" fill={C.ink} />
      <path d="M18 42l-9 3 9 4Z" fill={C.gold} {...S} />
      <path d="M74 56l16-4-14 12Z" fill={C.bark} {...S} />
      <path d="M46 72v10M58 72v10" stroke={C.gold} strokeWidth={3} strokeLinecap="round" fill="none" />
    </>
  ),
  চশমা: (
    <>
      <circle cx="28" cy="52" r="17" fill={C.white} {...S} />
      <circle cx="72" cy="52" r="17" fill={C.white} {...S} />
      <path d="M45 50q5-5 10 0" fill="none" {...S} />
      <path d="M11 48 2 42M89 48l9-6" {...S} />
    </>
  ),
  /** ছাগল — swept-back horns, long face and the beard, which is what says goat. */
  ছাগল: (
    <>
      <ellipse cx="58" cy="56" rx="26" ry="19" fill={C.cream} {...S} />
      <ellipse cx="28" cy="48" rx="15" ry="13" fill={C.cream} {...S} />
      <path d="M22 36q-12-8-8-20 10 4 12 16M34 36q10-10 8-20-10 6-12 16" fill={C.slate} {...S} />
      <path d="M14 44q-8 0-10 4 6 5 12 2Z" fill={C.cream} {...S} />
      <circle cx="22" cy="46" r="2.4" fill={C.ink} />
      <ellipse cx="17" cy="56" rx="6" ry="5" fill={C.white} {...S} />
      <path d="M20 62q-2 12 4 16" fill="none" stroke={C.white} strokeWidth={7} strokeLinecap="round" />
      <path d="M20 62q-2 12 4 16" fill="none" stroke={C.ink} strokeWidth={2} />
      <path d="M44 74v14M58 74v14M74 72v16" stroke={C.ink} strokeWidth={5} strokeLinecap="round" fill="none" />
      <path d="M84 50q8 2 8 10" fill="none" stroke={C.cream} strokeWidth={5} strokeLinecap="round" />
      <path d="M84 50q8 2 8 10" fill="none" stroke={C.ink} strokeWidth={1.8} />
    </>
  ),
  ছাতা: (
    <>
      <path d="M8 54a42 42 0 0 1 84 0Z" fill={C.red} {...S} />
      <path d="M8 54q10-12 21 0 11-12 21 0 11-12 21 0 11-12 21 0" fill="none" {...S} />
      <path d="M50 54v28a8 8 0 0 0 14 5" fill="none" {...S} />
      <path d="M50 12V6" {...S} />
    </>
  ),
  জাহাজ: (
    <>
      <path d="M10 62h80l-10 20H20Z" fill={C.deep} {...S} />
      <rect x="28" y="40" width="44" height="22" rx="3" fill={C.white} {...S} />
      <rect x="44" y="26" width="18" height="14" rx="2" fill={C.cream} {...S} />
      <circle cx="38" cy="51" r="4" fill={C.blue} {...S} />
      <circle cx="54" cy="51" r="4" fill={C.blue} {...S} />
      <path d="M68 26v-12" stroke={C.ink} strokeWidth={3} strokeLinecap="round" fill="none" />
      <path d="M68 14h14l-6 5 6 5H68Z" fill={C.red} {...S} />
    </>
  ),
  জবা: (
    <>
      <circle cx="50" cy="46" r="10" fill={C.gold} {...S} />
      <path d="M50 36c8-16 26-14 26-2s-16 16-26 12Z" fill={C.red} {...S} />
      <path d="M50 36c-8-16-26-14-26-2s16 16 26 12Z" fill={C.red} {...S} />
      <path d="M50 56c10 14 26 8 26-4s-16-12-26-6Z" fill={C.deepred} {...S} />
      <path d="M50 56c-10 14-26 8-26-4s16-12 26-6Z" fill={C.deepred} {...S} />
      <path d="M50 52v36" stroke={C.leaf} strokeWidth={4} strokeLinecap="round" fill="none" />
      <circle cx="50" cy="46" r="4" fill={C.yellow} />
    </>
  ),
  ঝড়: (
    <>
      <path d="M22 40a16 16 0 0 1 30-7 14 14 0 0 1 24 9 12 12 0 0 1-2 24H28a14 14 0 0 1-6-26Z" fill={C.slate} {...S} />
      <path d="M52 68 38 90h12l-4 10" fill="none" stroke={C.yellow} strokeWidth={5} strokeLinecap="round" />
      <path d="M52 68 38 90h12l-4 10" fill="none" stroke={C.ink} strokeWidth={1.6} />
      <path d="M22 78q10-6 16 0M70 78q8-6 16 0" fill="none" stroke={C.grey} strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  ঝর্ণা: (
    <>
      <path d="M10 88q14-10 28 0t28 0 24 0" fill="none" stroke={C.blue} strokeWidth={5} strokeLinecap="round" />
      <path d="M22 14h56v10H22Z" fill={C.bark} {...S} />
      <path d="M30 24q4 34 0 54M46 24q4 34 0 54M62 24q4 34 0 54" fill="none" stroke={C.blue} strokeWidth={7} strokeLinecap="round" />
      <path d="M30 24q4 34 0 54M46 24q4 34 0 54M62 24q4 34 0 54" fill="none" stroke={C.ink} strokeWidth={1.4} />
      <path d="M8 24h84" stroke={C.ink} strokeWidth={3} strokeLinecap="round" fill="none" />
    </>
  ),
  /** মিঞসাহেব — an elderly man in a white panjabi and cap, as in the book. */
  মিঞসাহেব: (
    <>
      <circle cx="50" cy="28" r="15" fill={C.skin} {...S} />
      <path d="M35 24a15 15 0 0 1 30 0Z" fill={C.white} {...S} />
      <path d="M38 34q12 14 24 0 2 12-12 13T38 34Z" fill={C.white} {...S} />
      <circle cx="44" cy="27" r="2.2" fill={C.ink} />
      <circle cx="56" cy="27" r="2.2" fill={C.ink} />
      <path d="M26 88V64c0-12 10-18 24-18s24 6 24 18v24Z" fill={C.white} {...S} />
      <path d="M50 48v40" stroke={C.grey} strokeWidth={2} fill="none" />
      <path d="M78 58v34" stroke={C.bark} strokeWidth={4} strokeLinecap="round" fill="none" />
      <path d="M78 58q6-4 8 0" fill="none" {...S} />
    </>
  ),
  /** মিঞ — the black-and-white cat from the book's own picture. */
  মিঞ: (
    <>
      <ellipse cx="46" cy="62" rx="26" ry="18" fill={C.white} {...S} />
      <path d="M30 50c-6 6-6 16 0 22" fill={C.dark} {...S} />
      <circle cx="30" cy="40" r="14" fill={C.white} {...S} />
      <path d="M20 30l-2-12 12 6Z" fill={C.dark} {...S} />
      <path d="M40 30l2-12-12 6Z" fill={C.white} {...S} />
      <circle cx="25" cy="40" r="2.4" fill={C.ink} />
      <circle cx="36" cy="40" r="2.4" fill={C.ink} />
      <path d="M30 45q-3 3-6 2M30 45q3 3 6 2" {...T} />
      <path d="M72 62q12-6 8-22" fill="none" stroke={C.dark} strokeWidth={6} strokeLinecap="round" />
      <path d="M72 62q12-6 8-22" fill="none" stroke={C.ink} strokeWidth={1.6} />
      <path d="M32 78v8M48 78v8M62 76v10" stroke={C.ink} strokeWidth={4} strokeLinecap="round" fill="none" />
    </>
  ),

  /* ====================================================================== */
  /* ট-বর্গ                                                                 */
  /* ====================================================================== */

  টিয়া: (
    <>
      <ellipse cx="50" cy="52" rx="20" ry="26" fill={C.green} {...S} />
      <circle cx="50" cy="26" r="14" fill={C.leaf} {...S} />
      <path d="M62 24c8 0 12 5 12 9s-6 8-12 6Z" fill={C.red} {...S} />
      <circle cx="55" cy="23" r="2.4" fill={C.ink} />
      <path d="M36 44q-8 14-2 26" fill={C.darkleaf} {...S} />
      <path d="M50 78q4 12 0 18" fill="none" stroke={C.leaf} strokeWidth={7} strokeLinecap="round" />
      <path d="M50 78q4 12 0 18" fill="none" stroke={C.ink} strokeWidth={1.6} />
    </>
  ),
  টমেটো: (
    <>
      <circle cx="50" cy="56" r="28" fill={C.red} {...S} />
      <path d="M50 30 38 20M50 30l12-10M50 30V16" stroke={C.leaf} strokeWidth={4} strokeLinecap="round" fill="none" />
      <circle cx="50" cy="30" r="5" fill={C.leaf} {...S} />
      <path d="M36 46q6 10 4 20" fill="none" stroke={C.deepred} strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  /** ঠোঁট — a mouth: cupid's bow on top, fuller lower lip, one parting line. */
  ঠোঁট: (
    <>
      <path d="M14 50q10-16 22-6 6-8 14-8t14 8q12-10 22 6Z" fill={C.red} {...S} />
      <path d="M14 50q14 26 36 26t36-26Z" fill={C.deepred} {...S} />
      <path d="M14 50h72" stroke={C.ink} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      <path d="M34 60q16 6 32 0" fill="none" stroke={C.red} strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  ঠেলাগাড়ি: (
    <>
      <path d="M18 56h48l-6 22H24Z" fill={C.brown} {...S} />
      <path d="M66 56 84 32" stroke={C.bark} strokeWidth={5} strokeLinecap="round" fill="none" />
      <path d="M78 32h12" stroke={C.bark} strokeWidth={5} strokeLinecap="round" fill="none" />
      <circle cx="36" cy="84" r="9" fill={C.dark} {...S} />
      <circle cx="36" cy="84" r="3" fill={C.white} />
      <circle cx="60" cy="84" r="9" fill={C.dark} {...S} />
      <circle cx="60" cy="84" r="3" fill={C.white} />
      <path d="M30 56v22M48 56v22" stroke={C.bark} strokeWidth={2.4} fill="none" />
    </>
  ),
  ডাব: (
    <>
      <path d="M50 20c18 0 28 14 28 32S66 86 50 86 22 70 22 52 32 20 50 20Z" fill={C.green} {...S} />
      <path d="M50 20c-4-8 0-12 0-12s6 4 6 12" fill={C.leaf} {...S} />
      <path d="M34 42q6 20 4 34" fill="none" stroke={C.leaf} strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  ডিম: (
    <>
      <path d="M50 16c16 0 26 22 26 38S64 84 50 84 24 70 24 54 34 16 50 16Z" fill={C.cream} {...S} />
      <path d="M38 44q6 10 4 22" fill="none" stroke={C.grey} strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  ঢোল: (
    <>
      <path d="M22 34h56l8 16-8 16H22l-8-16Z" fill={C.brown} {...S} />
      <ellipse cx="22" cy="50" rx="8" ry="16" fill={C.cream} {...S} />
      <ellipse cx="78" cy="50" rx="8" ry="16" fill={C.cream} {...S} />
      <path d="M26 38 74 62M26 62 74 38" stroke={C.gold} strokeWidth={2.5} fill="none" />
      <path d="M30 24l-6-8M70 24l6-8" stroke={C.bark} strokeWidth={4} strokeLinecap="round" fill="none" />
    </>
  ),
  ঢাকনা: (
    <>
      <ellipse cx="50" cy="66" rx="36" ry="9" fill={C.grey} {...S} />
      <path d="M14 66a36 26 0 0 1 72 0Z" fill={C.slate} {...S} />
      <path d="M50 40v-10" stroke={C.ink} strokeWidth={4} strokeLinecap="round" fill="none" />
      <circle cx="50" cy="26" r="7" fill={C.brown} {...S} />
    </>
  ),
  হরিণ: (
    <>
      <ellipse cx="54" cy="58" rx="24" ry="17" fill={C.gold} {...S} />
      <circle cx="28" cy="40" r="12" fill={C.gold} {...S} />
      <path d="M22 30l-6-14 4 2 4-8M34 30l6-14-4 2-4-8" fill="none" stroke={C.bark} strokeWidth={3.5} strokeLinecap="round" />
      <circle cx="23" cy="39" r="2.4" fill={C.ink} />
      <circle cx="46" cy="52" r="3" fill={C.cream} />
      <circle cx="58" cy="60" r="3" fill={C.cream} />
      <circle cx="68" cy="52" r="3" fill={C.cream} />
      <path d="M40 74v12M54 74v12M68 74v12" stroke={C.ink} strokeWidth={4} strokeLinecap="round" fill="none" />
    </>
  ),
  বীণা: (
    <>
      <ellipse cx="34" cy="70" rx="18" ry="16" fill={C.brown} {...S} />
      <ellipse cx="34" cy="70" rx="8" ry="7" fill={C.cream} {...S} />
      <path d="M46 62 82 26" stroke={C.bark} strokeWidth={8} strokeLinecap="round" fill="none" />
      <circle cx="84" cy="22" r="9" fill={C.brown} {...S} />
      <path d="M44 66 80 30M48 70 84 34" stroke={C.ink} strokeWidth={1.6} fill="none" />
    </>
  ),

  /* ====================================================================== */
  /* ত-বর্গ                                                                 */
  /* ====================================================================== */

  তবলা: (
    <>
      <path d="M20 46h34v30a8 8 0 0 1-8 8H28a8 8 0 0 1-8-8Z" fill={C.brown} {...S} />
      <ellipse cx="37" cy="46" rx="17" ry="8" fill={C.cream} {...S} />
      <circle cx="37" cy="46" r="6" fill={C.dark} />
      <path d="M60 52h28v22a7 7 0 0 1-7 7H67a7 7 0 0 1-7-7Z" fill={C.slate} {...S} />
      <ellipse cx="74" cy="52" rx="14" ry="7" fill={C.cream} {...S} />
      <circle cx="74" cy="52" r="5" fill={C.dark} />
    </>
  ),
  তিমি: (
    <>
      <path d="M12 56c0-16 20-26 40-26s34 10 34 22-14 22-34 22S12 68 12 56Z" fill={C.deep} {...S} />
      <path d="M86 52 98 40v30L86 62Z" fill={C.navy} {...S} />
      <circle cx="30" cy="50" r="3" fill={C.ink} />
      <path d="M22 62q14 8 30 4" fill="none" stroke={C.navy} strokeWidth={2.5} />
      <path d="M44 30q2-14 10-18-2 10 2 16" fill="none" stroke={C.blue} strokeWidth={3.5} strokeLinecap="round" />
    </>
  ),
  থালা: (
    <>
      <ellipse cx="50" cy="56" rx="38" ry="22" fill={C.grey} {...S} />
      <ellipse cx="50" cy="54" rx="26" ry="14" fill={C.white} {...S} />
    </>
  ),
  থলে: (
    <>
      <path d="M24 38h52l6 46a6 6 0 0 1-6 7H24a6 6 0 0 1-6-7Z" fill={C.orange} {...S} />
      <path d="M36 38V28a14 14 0 0 1 28 0v10" fill="none" {...S} />
    </>
  ),
  দোয়েল: (
    <>
      <ellipse cx="52" cy="52" rx="20" ry="16" fill={C.dark} {...S} />
      <circle cx="32" cy="38" r="12" fill={C.dark} {...S} />
      <path d="M50 48q14-4 22 4-12 8-22 4Z" fill={C.white} {...S} />
      <circle cx="28" cy="36" r="2.4" fill={C.white} />
      <path d="M21 40l-9 2 9 4Z" fill={C.gold} {...S} />
      <path d="M70 56 92 44 78 70Z" fill={C.dark} {...S} />
      <path d="M46 68v12M58 68v12" stroke={C.gold} strokeWidth={3} strokeLinecap="round" fill="none" />
    </>
  ),
  দরজা: (
    <>
      <rect x="24" y="12" width="52" height="78" rx="4" fill={C.brown} {...S} />
      <rect x="32" y="20" width="36" height="28" rx="3" fill={C.bark} {...S} />
      <rect x="32" y="56" width="36" height="26" rx="3" fill={C.bark} {...S} />
      <circle cx="66" cy="52" r="4" fill={C.gold} {...S} />
    </>
  ),
  ধান: (
    <>
      <path d="M50 92V44" stroke={C.leaf} strokeWidth={4} strokeLinecap="round" fill="none" />
      <path d="M50 44q-14-4-18-16 14 0 18 10M50 56q-14-4-18-16 14 0 18 10M50 68q-14-4-18-16 14 0 18 10" fill={C.gold} {...S} />
      <path d="M50 44q14-4 18-16-14 0-18 10M50 56q14-4 18-16-14 0-18 10M50 68q14-4 18-16-14 0-18 10" fill={C.yellow} {...S} />
      <path d="M50 76q16 4 22 14" fill="none" stroke={C.leaf} strokeWidth={4} strokeLinecap="round" />
    </>
  ),
  ধনুক: (
    <>
      <path d="M28 12q34 38 0 76" fill="none" stroke={C.bark} strokeWidth={7} strokeLinecap="round" />
      <path d="M28 12 28 88" stroke={C.ink} strokeWidth={2.4} fill="none" />
      <path d="M28 50h56" stroke={C.brown} strokeWidth={4} strokeLinecap="round" fill="none" />
      <path d="M84 50 72 43v14Z" fill={C.grey} {...S} />
      <path d="M34 50l-8-6M34 50l-8 6" stroke={C.cream} strokeWidth={3} strokeLinecap="round" fill="none" />
    </>
  ),
  /**
   * নদী — a band of water between two green banks, with a boat on it.
   *
   * Drawn flat and horizontal rather than winding into the distance: at 96px a
   * perspective river reads as an abstract shape, while a blue band with banks
   * above and below reads as water immediately. The boat settles it.
   */
  নদী: (
    <>
      <path d="M4 14h92v26q-14 8-30 4T4 40Z" fill={C.leaf} {...S} />
      <path d="M4 40q30 12 62 4t30-4v30q-16 8-32 4t-30-4-30 4Z" fill={C.blue} {...S} />
      <path d="M4 70q14-8 30-4t30 4 32-4v26H4Z" fill={C.green} {...S} />
      <path d="M22 54q14 5 26 0M54 62q12 4 24 0" fill="none" stroke={C.white} strokeWidth={3} strokeLinecap="round" />
      <path d="M40 48h22l-4 8H44Z" fill={C.brown} {...S} />
      <path d="M51 48V34" stroke={C.bark} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      <path d="M51 36h12L51 46Z" fill={C.red} {...S} />
    </>
  ),
  নৌকা: (
    <>
      <path d="M10 66h80l-12 18H22Z" fill={C.brown} {...S} />
      <path d="M50 66V18" stroke={C.bark} strokeWidth={4} strokeLinecap="round" fill="none" />
      <path d="M50 22h30L52 56Z" fill={C.red} {...S} />
      <path d="M6 88q14-8 28 0t28 0 32 0" fill="none" stroke={C.blue} strokeWidth={4} strokeLinecap="round" />
    </>
  ),

  /* ====================================================================== */
  /* প-বর্গ                                                                 */
  /* ====================================================================== */

  পাখি: (
    <>
      <ellipse cx="52" cy="54" rx="21" ry="17" fill={C.blue} {...S} />
      <circle cx="31" cy="40" r="12" fill={C.deep} {...S} />
      <path d="M50 48q15-5 23 4-13 9-23 4Z" fill={C.teal} {...S} />
      <circle cx="27" cy="38" r="2.4" fill={C.white} />
      <path d="M20 42l-9 2 9 4Z" fill={C.gold} {...S} />
      <path d="M72 58 92 50 78 72Z" fill={C.deep} {...S} />
      <path d="M46 70v10M58 70v10" stroke={C.gold} strokeWidth={3} strokeLinecap="round" fill="none" />
    </>
  ),
  পাতা: (
    <>
      <path d="M50 88C20 70 18 34 50 10c32 24 30 60 0 78Z" fill={C.green} {...S} />
      <path d="M50 88V16" stroke={C.darkleaf} strokeWidth={3} strokeLinecap="round" fill="none" />
      <path d="M50 34 32 26M50 50 28 42M50 66 32 60M50 34l18-8M50 50l22-8M50 66l18-6" stroke={C.darkleaf} strokeWidth={2.2} strokeLinecap="round" fill="none" />
    </>
  ),
  ফুল: (
    <>
      <circle cx="50" cy="30" r="13" fill={C.pink} {...S} />
      <circle cx="30" cy="44" r="13" fill={C.pink} {...S} />
      <circle cx="70" cy="44" r="13" fill={C.pink} {...S} />
      <circle cx="38" cy="66" r="13" fill={C.pink} {...S} />
      <circle cx="62" cy="66" r="13" fill={C.pink} {...S} />
      <circle cx="50" cy="50" r="12" fill={C.yellow} {...S} />
      <path d="M50 78v18" stroke={C.leaf} strokeWidth={4} strokeLinecap="round" fill="none" />
    </>
  ),
  ফড়িং: (
    <>
      <path d="M46 46q-24-14-38-2 14 12 38 6Z" fill={C.teal} opacity={0.75} {...S} />
      <path d="M54 46q24-14 38-2-14 12-38 6Z" fill={C.teal} opacity={0.75} {...S} />
      <path d="M50 34c5 0 8 6 8 20s-3 40-8 40-8-24-8-40 3-20 8-20Z" fill={C.blue} {...S} />
      <circle cx="50" cy="26" r="11" fill={C.deep} {...S} />
      <circle cx="45" cy="24" r="3" fill={C.white} />
      <circle cx="55" cy="24" r="3" fill={C.white} />
    </>
  ),
  বানর: (
    <>
      <ellipse cx="50" cy="66" rx="22" ry="20" fill={C.brown} {...S} />
      <circle cx="50" cy="36" r="18" fill={C.brown} {...S} />
      <circle cx="28" cy="34" r="8" fill={C.brown} {...S} />
      <circle cx="72" cy="34" r="8" fill={C.brown} {...S} />
      <ellipse cx="50" cy="40" rx="12" ry="11" fill={C.skin} {...S} />
      <circle cx="45" cy="34" r="2.4" fill={C.ink} />
      <circle cx="55" cy="34" r="2.4" fill={C.ink} />
      <path d="M45 44q5 4 10 0" {...T} />
      <path d="M72 72q14 4 12 16" fill="none" stroke={C.brown} strokeWidth={5} strokeLinecap="round" />
    </>
  ),
  /** বক — the egret: white body with a visible wing, S-neck, dagger bill. */
  বক: (
    <>
      <ellipse cx="50" cy="54" rx="26" ry="17" fill={C.cream} {...S} />
      <path d="M32 50q18-8 34 2-16 10-34 2Z" fill={C.white} {...S} />
      <path d="M46 40q-4-18 10-24" fill="none" stroke={C.cream} strokeWidth={9} strokeLinecap="round" />
      <path d="M46 40q-4-18 10-24" fill="none" stroke={C.ink} strokeWidth={2.2} />
      <circle cx="60" cy="16" r="9" fill={C.cream} {...S} />
      <circle cx="63" cy="14" r="2.2" fill={C.ink} />
      <path d="M68 18l16 4-16 5Z" fill={C.gold} {...S} />
      <path d="M42 70v16M56 70v16" stroke={C.gold} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <path d="M8 88q18-6 34 0t34 0" fill="none" stroke={C.blue} strokeWidth={4} strokeLinecap="round" />
    </>
  ),
  ভালুক: (
    <>
      <ellipse cx="50" cy="64" rx="26" ry="22" fill={C.bark} {...S} />
      <circle cx="50" cy="34" r="19" fill={C.bark} {...S} />
      <circle cx="30" cy="20" r="9" fill={C.bark} {...S} />
      <circle cx="70" cy="20" r="9" fill={C.bark} {...S} />
      <ellipse cx="50" cy="40" rx="11" ry="9" fill={C.skin} {...S} />
      <circle cx="43" cy="32" r="2.4" fill={C.ink} />
      <circle cx="57" cy="32" r="2.4" fill={C.ink} />
      <ellipse cx="50" cy="38" rx="4" ry="3" fill={C.ink} />
    </>
  ),
  ভেড়া: (
    <>
      <circle cx="34" cy="56" r="13" fill={C.white} {...S} />
      <circle cx="52" cy="46" r="15" fill={C.white} {...S} />
      <circle cx="70" cy="56" r="13" fill={C.white} {...S} />
      <circle cx="52" cy="66" r="15" fill={C.white} {...S} />
      <ellipse cx="26" cy="42" rx="11" ry="12" fill={C.dark} {...S} />
      <circle cx="22" cy="40" r="2.2" fill={C.white} />
      <path d="M40 80v8M56 80v8M68 78v10" stroke={C.dark} strokeWidth={4} strokeLinecap="round" fill="none" />
    </>
  ),
  ময়ূর: (
    <>
      {/* A fanned tail with eye-spots behind the bird — the thing a child
          actually pictures when they hear ময়ূর. */}
      <path d="M50 74a40 40 0 0 1 0-56 40 40 0 0 1 0 56Z" fill={C.teal} {...S} />
      {[[26, 44], [34, 28], [50, 20], [66, 28], [74, 44], [38, 54], [62, 54]].map(
        ([x, y]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r={7} fill={C.green} {...S} />
            <circle cx={x} cy={y} r={3} fill={C.navy} />
          </g>
        ),
      )}
      <ellipse cx="50" cy="76" rx="11" ry="14" fill={C.deep} {...S} />
      <path d="M50 64q-3-14 0-20" fill="none" stroke={C.deep} strokeWidth={7} strokeLinecap="round" />
      <path d="M50 64q-3-14 0-20" fill="none" stroke={C.ink} strokeWidth={2} />
      <circle cx="50" cy="40" r="8" fill={C.navy} {...S} />
      <circle cx="53" cy="38" r="2" fill={C.white} />
      <path d="M57 41l7 2-7 2Z" fill={C.gold} {...S} />
      <path d="M50 32v-6M46 30l-2-5M54 30l2-5" stroke={C.teal} strokeWidth={2.4} strokeLinecap="round" fill="none" />
    </>
  ),
  মাছি: (
    <>
      <path d="M46 42q-22-12-34 2 16 10 34 4Z" fill={C.grey} opacity={0.8} {...S} />
      <path d="M54 42q22-12 34 2-16 10-34 4Z" fill={C.grey} opacity={0.8} {...S} />
      <ellipse cx="50" cy="60" rx="15" ry="20" fill={C.dark} {...S} />
      <circle cx="50" cy="34" r="13" fill={C.slate} {...S} />
      <circle cx="44" cy="32" r="4" fill={C.red} {...S} />
      <circle cx="56" cy="32" r="4" fill={C.red} {...S} />
      <path d="M42 24l-4-8M58 24l4-8" {...T} />
    </>
  ),

  /* ====================================================================== */
  /* অন্তঃস্থ ও ঊষ্ম                                                        */
  /* ====================================================================== */

  যব: (
    <>
      <path d="M50 92V40" stroke={C.leaf} strokeWidth={4} strokeLinecap="round" fill="none" />
      <path d="M50 40q-12-2-15-14 12 0 15 8M50 54q-12-2-15-14 12 0 15 8M50 68q-12-2-15-14 12 0 15 8" fill={C.gold} {...S} />
      <path d="M50 40q12-2 15-14-12 0-15 8M50 54q12-2 15-14-12 0-15 8M50 68q12-2 15-14-12 0-15 8" fill={C.yellow} {...S} />
      <path d="M50 26v-14M44 20l-6-10M56 20l6-10" stroke={C.gold} strokeWidth={2.4} strokeLinecap="round" fill="none" />
    </>
  ),
  /** যাঁতা — the two-stone hand quern, with its upright handle. */
  যাঁতা: (
    <>
      <ellipse cx="50" cy="74" rx="36" ry="12" fill={C.slate} {...S} />
      <path d="M14 74V62a36 12 0 0 1 72 0v12" fill={C.grey} {...S} />
      <ellipse cx="50" cy="56" rx="32" ry="11" fill={C.slate} {...S} />
      <ellipse cx="50" cy="54" rx="9" ry="4" fill={C.dark} {...S} />
      <path d="M74 50V26" stroke={C.bark} strokeWidth={5} strokeLinecap="round" fill="none" />
      <circle cx="74" cy="22" r="5" fill={C.brown} {...S} />
    </>
  ),
  /** রাজহাঁস — bigger than the duck, with the long S-curved neck that names it. */
  রাজহাঁস: (
    <>
      <ellipse cx="48" cy="66" rx="30" ry="18" fill={C.white} {...S} />
      <path d="M36 54q-10-22 4-30 12-6 18 2" fill="none" stroke={C.white} strokeWidth={12} strokeLinecap="round" />
      <path d="M36 54q-10-22 4-30 12-6 18 2" fill="none" stroke={C.ink} strokeWidth={2.4} />
      <circle cx="60" cy="24" r="10" fill={C.white} {...S} />
      <circle cx="64" cy="21" r="2.2" fill={C.ink} />
      <path d="M69 26h14q-2 8-14 6Z" fill={C.orange} {...S} />
      <path d="M30 62q16-10 30-2" fill="none" stroke={C.grey} strokeWidth={3} strokeLinecap="round" />
      <path d="M8 86q18-9 34 0t34 0" fill="none" stroke={C.blue} strokeWidth={5} strokeLinecap="round" />
    </>
  ),
  রংধনু: (
    <>
      <path d="M8 84a42 42 0 0 1 84 0" fill="none" stroke={C.red} strokeWidth={9} />
      <path d="M17 84a33 33 0 0 1 66 0" fill="none" stroke={C.orange} strokeWidth={9} />
      <path d="M26 84a24 24 0 0 1 48 0" fill="none" stroke={C.yellow} strokeWidth={9} />
      <path d="M35 84a15 15 0 0 1 30 0" fill="none" stroke={C.green} strokeWidth={9} />
      <path d="M8 84a42 42 0 0 1 84 0M44 84a6 6 0 0 1 12 0" fill="none" stroke={C.ink} strokeWidth={2} />
    </>
  ),
  /** লাটিম — a spinning top: wide shoulder, cone down to a metal tip. */
  লাটিম: (
    <>
      <path d="M20 40a30 14 0 0 1 60 0l-30 38Z" fill={C.red} {...S} />
      <ellipse cx="50" cy="40" rx="30" ry="11" fill={C.orange} {...S} />
      <path d="M50 78v12" stroke={C.slate} strokeWidth={6} strokeLinecap="round" fill="none" />
      <path d="M50 78v12" stroke={C.ink} strokeWidth={2} fill="none" />
      {/* Bands round the cone, the way a wooden top is painted. */}
      <path d="M31 52q19 9 38 0M37 64q13 7 26 0" fill="none" stroke={C.yellow} strokeWidth={3.5} strokeLinecap="round" />
    </>
  ),
  লিচু: (
    <>
      <circle cx="38" cy="58" r="20" fill={C.deepred} {...S} />
      <circle cx="68" cy="66" r="16" fill={C.red} {...S} />
      <path d="M38 38V20M68 50V30" stroke={C.leaf} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <path d="M38 22q12-10 20-4-8 10-20 8" fill={C.leaf} {...S} />
      <circle cx="30" cy="52" r="2" fill={C.deepred} stroke={C.ink} strokeWidth={1.2} />
      <circle cx="44" cy="50" r="2" fill={C.deepred} stroke={C.ink} strokeWidth={1.2} />
      <circle cx="38" cy="64" r="2" fill={C.deepred} stroke={C.ink} strokeWidth={1.2} />
    </>
  ),
  /** শাপলা — the water lily: a ring of pointed petals open on a lily pad. */
  শাপলা: (
    <>
      <ellipse cx="22" cy="78" rx="18" ry="7" fill={C.leaf} {...S} />
      <ellipse cx="76" cy="80" rx="16" ry="6" fill={C.green} {...S} />
      {[-70, -45, -20, 0, 20, 45, 70].map((a) => (
        <path
          key={a}
          d="M50 58 44 26q6-10 12 0Z"
          fill={C.white}
          transform={`rotate(${a} 50 58)`}
          {...S}
        />
      ))}
      {[-50, -25, 0, 25, 50].map((a) => (
        <path
          key={`i${a}`}
          d="M50 58 45 36q5-8 10 0Z"
          fill={C.pink}
          transform={`rotate(${a} 50 58)`}
          {...S}
        />
      ))}
      <circle cx="50" cy="58" r="8" fill={C.yellow} {...S} />
      <path d="M6 88q16-6 30 0t30 0 28 0" fill="none" stroke={C.blue} strokeWidth={4} strokeLinecap="round" />
    </>
  ),
  শসা: (
    <>
      <path d="M24 72c-8-8-6-28 8-40s34-14 42-6-2 28-14 40-28 14-36 6Z" fill={C.green} {...S} />
      <path d="M36 62q12-14 26-22" fill="none" stroke={C.darkleaf} strokeWidth={3} strokeLinecap="round" />
      <path d="M44 70q12-14 26-22" fill="none" stroke={C.darkleaf} strokeWidth={3} strokeLinecap="round" />
      <path d="M72 26q6-6 10-4" fill="none" {...S} />
    </>
  ),
  ষাঁড়: (
    <>
      <ellipse cx="56" cy="62" rx="26" ry="20" fill={C.brown} {...S} />
      <circle cx="28" cy="46" r="15" fill={C.brown} {...S} />
      <path d="M16 38q-10-10-2-18 8 4 10 14M40 38q10-10 2-18-8 4-10 14" fill={C.cream} {...S} />
      <circle cx="23" cy="46" r="2.4" fill={C.ink} />
      <ellipse cx="18" cy="56" rx="7" ry="5" fill={C.skin} {...S} />
      <path d="M40 80v10M56 80v10M72 78v12" stroke={C.ink} strokeWidth={5} strokeLinecap="round" fill="none" />
      <path d="M82 60q10 4 8 16" fill="none" stroke={C.bark} strokeWidth={3.5} strokeLinecap="round" />
    </>
  ),
  মহিষ: (
    <>
      <ellipse cx="56" cy="62" rx="26" ry="20" fill={C.dark} {...S} />
      <circle cx="28" cy="48" r="15" fill={C.dark} {...S} />
      <path d="M16 40q-14-4-14-16 12 2 18 12M40 40q14-4 14-16-12 2-18 12" fill={C.slate} {...S} />
      <circle cx="23" cy="48" r="2.4" fill={C.white} />
      <ellipse cx="18" cy="58" rx="7" ry="5" fill={C.slate} {...S} />
      <path d="M40 80v10M56 80v10M72 78v12" stroke={C.ink} strokeWidth={5} strokeLinecap="round" fill="none" />
    </>
  ),
  সিংহ: (
    <>
      {/* The mane is the whole point — a ring of lobes, not a plain disc,
          or a lion is just a cat. */}
      {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((a) => (
        <circle
          key={a}
          cx={50 + 30 * Math.cos((a * Math.PI) / 180)}
          cy={52 + 30 * Math.sin((a * Math.PI) / 180)}
          r={11}
          fill={C.gold}
          {...S}
        />
      ))}
      <circle cx="50" cy="52" r="30" fill={C.gold} {...S} />
      <circle cx="34" cy="34" r="7" fill={C.brown} {...S} />
      <circle cx="66" cy="34" r="7" fill={C.brown} {...S} />
      <circle cx="50" cy="52" r="21" fill={C.cream} {...S} />
      <circle cx="42" cy="47" r="2.8" fill={C.ink} />
      <circle cx="58" cy="47" r="2.8" fill={C.ink} />
      <path d="M45 57h10l-5 5Z" fill={C.ink} {...S} />
      <path d="M50 62q-5 4-9 2M50 62q5 4 9 2" {...T} />
    </>
  ),
  সাবান: (
    <>
      <rect x="16" y="46" width="68" height="30" rx="14" fill={C.pink} {...S} />
      <path d="M16 60q34 14 68 0" fill="none" stroke={C.white} strokeWidth={3} />
      <circle cx="32" cy="28" r="9" fill={C.white} {...S} />
      <circle cx="52" cy="20" r="6" fill={C.white} {...S} />
      <circle cx="68" cy="30" r="7" fill={C.white} {...S} />
    </>
  ),
  হাঁস: (
    <>
      <ellipse cx="50" cy="62" rx="30" ry="20" fill={C.cream} {...S} />
      <path d="M38 48q-2-16 8-22" fill="none" stroke={C.cream} strokeWidth={14} strokeLinecap="round" />
      <path d="M38 48q-2-16 8-22" fill="none" stroke={C.ink} strokeWidth={2.4} />
      <circle cx="48" cy="24" r="12" fill={C.cream} {...S} />
      <circle cx="52" cy="21" r="2.4" fill={C.ink} />
      <path d="M58 26h16q-3 8-16 6Z" fill={C.orange} {...S} />
      <path d="M46 58q16-10 30-2" fill="none" stroke={C.gold} strokeWidth={3} strokeLinecap="round" />
      <path d="M78 58 92 52 84 68Z" fill={C.cream} {...S} />
      <path d="M8 86q18-9 34 0t34 0" fill="none" stroke={C.blue} strokeWidth={5} strokeLinecap="round" />
    </>
  ),
  হাতি: (
    <>
      <ellipse cx="56" cy="56" rx="28" ry="24" fill={C.slate} {...S} />
      <circle cx="26" cy="46" r="17" fill={C.slate} {...S} />
      <ellipse cx="34" cy="42" rx="12" ry="14" fill={C.grey} {...S} />
      <path d="M20 60c-6 12-2 24 6 26" fill="none" stroke={C.slate} strokeWidth={9} strokeLinecap="round" />
      <path d="M20 60c-6 12-2 24 6 26" fill="none" stroke={C.ink} strokeWidth={2.2} />
      <circle cx="21" cy="42" r="2.4" fill={C.ink} />
      <path d="M14 54l-9 3" stroke={C.cream} strokeWidth={4} strokeLinecap="round" fill="none" />
      <path d="M40 78v12M56 80v10M72 78v12" stroke={C.ink} strokeWidth={6} strokeLinecap="round" fill="none" />
    </>
  ),
  বিড়াল: (
    <>
      <ellipse cx="46" cy="62" rx="26" ry="18" fill={C.orange} {...S} />
      <circle cx="30" cy="40" r="14" fill={C.orange} {...S} />
      <path d="M20 30l-2-12 12 6ZM40 30l2-12-12 6Z" fill={C.orange} {...S} />
      <circle cx="25" cy="40" r="2.4" fill={C.ink} />
      <circle cx="36" cy="40" r="2.4" fill={C.ink} />
      <path d="M30 45q-3 3-6 2M30 45q3 3 6 2" {...T} />
      <path d="M72 62q12-6 8-22" fill="none" stroke={C.orange} strokeWidth={6} strokeLinecap="round" />
      <path d="M72 62q12-6 8-22" fill="none" stroke={C.ink} strokeWidth={1.6} />
      <path d="M32 78v8M48 78v8M62 76v10" stroke={C.ink} strokeWidth={4} strokeLinecap="round" fill="none" />
    </>
  ),
  /** আষাঢ় — the monsoon month: heavy cloud and falling rain. */
  আষাঢ়: (
    <>
      <path d="M20 46a17 17 0 0 1 32-7 15 15 0 0 1 26 10 12 12 0 0 1-4 23H26a14 14 0 0 1-6-26Z" fill={C.slate} {...S} />
      <path d="M28 78l-6 14M44 78l-6 14M60 78l-6 14M76 78l-6 14" stroke={C.blue} strokeWidth={4.5} strokeLinecap="round" fill="none" />
    </>
  ),

  /* ====================================================================== */
  /* বিশেষ বর্ণ                                                             */
  /* ====================================================================== */

  ময়না: (
    <>
      <ellipse cx="52" cy="54" rx="21" ry="17" fill={C.dark} {...S} />
      <circle cx="31" cy="38" r="13" fill={C.dark} {...S} />
      <path d="M36 30q8-4 12 2-8 4-12 0Z" fill={C.yellow} {...S} />
      <circle cx="27" cy="36" r="2.4" fill={C.white} />
      <path d="M19 40l-10 2 10 5Z" fill={C.gold} {...S} />
      <path d="M72 58 94 48 80 74Z" fill={C.dark} {...S} />
      <path d="M46 70v10M58 70v10" stroke={C.gold} strokeWidth={3} strokeLinecap="round" fill="none" />
      <path d="M10 84h34" stroke={C.bark} strokeWidth={5} strokeLinecap="round" fill="none" />
    </>
  ),
  আয়না: (
    <>
      <rect x="22" y="12" width="56" height="76" rx="12" fill={C.gold} {...S} />
      <rect x="31" y="21" width="38" height="58" rx="7" fill={C.blue} opacity={0.25} {...S} />
      <path d="M38 70 62 30" stroke={C.white} strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.9} />
      <path d="M46 74 60 50" stroke={C.white} strokeWidth={3.5} strokeLinecap="round" fill="none" opacity={0.9} />
    </>
  ),
  মৎস্য: (
    <>
      <path d="M14 42c14-14 40-14 52 0-12 14-38 14-52 0Z" fill={C.slate} {...S} />
      <path d="M66 42 84 30v24L66 42Z" fill={C.grey} {...S} />
      <circle cx="28" cy="39" r="2.6" fill={C.ink} />
      <path d="M22 70c14-14 40-14 52 0-12 14-38 14-52 0Z" fill={C.grey} {...S} />
      <path d="M74 70 92 58v24L74 70Z" fill={C.slate} {...S} />
      <circle cx="36" cy="67" r="2.6" fill={C.ink} />
    </>
  ),
  /** চিৎপটাং — flat on the back, legs in the air, as the book draws it. */
  চিৎপটাং: (
    <>
      <path d="M14 78h72" stroke={C.grey} strokeWidth={4} strokeLinecap="round" fill="none" />
      <circle cx="26" cy="64" r="12" fill={C.skin} {...S} />
      <path d="M16 56a12 12 0 0 1 20 0Z" fill={C.dark} {...S} />
      <circle cx="24" cy="62" r="2" fill={C.ink} />
      <circle cx="31" cy="62" r="2" fill={C.ink} />
      <path d="M38 58h26v18H38Z" fill={C.red} {...S} />
      <path d="M64 70 84 44" stroke={C.deep} strokeWidth={9} strokeLinecap="round" fill="none" />
      <path d="M62 76 80 60" stroke={C.deep} strokeWidth={9} strokeLinecap="round" fill="none" />
      <path d="M84 44l8-4M80 60l9-3" stroke={C.dark} strokeWidth={6} strokeLinecap="round" fill="none" />
      <path d="M40 58 30 42" stroke={C.red} strokeWidth={7} strokeLinecap="round" fill="none" />
      <circle cx="28" cy="38" r="5" fill={C.skin} {...S} />
    </>
  ),
  /** শিং — a bull's head, horns forward, which is the book's own picture. */
  শিং: (
    <>
      <path d="M22 44q-16-6-16-20 14 0 20 14" fill={C.dark} {...S} />
      <path d="M78 44q16-6 16-20-14 0-20 14" fill={C.dark} {...S} />
      <ellipse cx="50" cy="56" rx="26" ry="28" fill={C.deepred} {...S} />
      <ellipse cx="50" cy="74" rx="15" ry="12" fill={C.brown} {...S} />
      <circle cx="44" cy="76" r="2.6" fill={C.ink} />
      <circle cx="56" cy="76" r="2.6" fill={C.ink} />
      <circle cx="40" cy="50" r="3.2" fill={C.ink} />
      <circle cx="60" cy="50" r="3.2" fill={C.ink} />
      <path d="M24 48q-12 2-14 10 10 4 16-2M76 48q12 2 14 10-10 4-16-2" fill={C.deepred} {...S} />
    </>
  ),
  আংটি: (
    <>
      <ellipse cx="50" cy="66" rx="22" ry="24" fill="none" stroke={C.gold} strokeWidth={9} />
      <ellipse cx="50" cy="66" rx="22" ry="24" fill="none" stroke={C.ink} strokeWidth={2} />
      <path d="M38 40 50 20l12 20-12 10Z" fill={C.pink} {...S} />
      <path d="M38 40h24M50 20v30" stroke={C.ink} strokeWidth={1.8} fill="none" />
    </>
  ),
  /** দুঃখী — a crying child, as the book's picture shows. */
  দুঃখী: (
    <>
      <circle cx="50" cy="48" r="26" fill={C.skin} {...S} />
      <path d="M24 42a26 26 0 0 1 52 0q-10-8-26-8t-26 8Z" fill={C.dark} {...S} />
      <path d="M36 46q5-4 10 0M54 46q5-4 10 0" {...T} />
      <circle cx="41" cy="52" r="2.6" fill={C.ink} />
      <circle cx="59" cy="52" r="2.6" fill={C.ink} />
      <path d="M41 58q-2 8-1 12M59 58q2 8 1 12" fill="none" stroke={C.blue} strokeWidth={3.5} strokeLinecap="round" />
      <path d="M42 68q8-7 16 0" fill="none" {...S} />
      <path d="M26 90V82c0-6 10-10 24-10s24 4 24 10v8" fill={C.red} {...S} />
    </>
  ),
  চাঁদ: (
    <>
      <path d="M64 16a34 34 0 1 0 0 68 40 40 0 0 1 0-68Z" fill={C.yellow} {...S} />
      <circle cx="82" cy="24" r="4" fill={C.yellow} {...S} />
      <circle cx="88" cy="44" r="3" fill={C.yellow} {...S} />
    </>
  ),
  কাঁঠাল: (
    <>
      <path d="M50 14c20 0 32 20 32 40S68 90 50 90 18 74 18 54s12-40 32-40Z" fill={C.leaf} {...S} />
      <path d="M50 10v-6" stroke={C.bark} strokeWidth={4} strokeLinecap="round" fill="none" />
      <path d="M32 32l4 6M46 26l4 6M60 32l4 6M26 48l4 6M40 44l4 6M56 44l4 6M70 48l4 6M32 64l4 6M48 62l4 6M64 64l4 6M40 78l4 6M58 78l4 6" stroke={C.darkleaf} strokeWidth={3} strokeLinecap="round" fill="none" />
    </>
  ),

  /* ====================================================================== */
  /* শব্দ গঠন                                                               */
  /* ====================================================================== */

  বল: (
    <>
      <circle cx="50" cy="52" r="30" fill={C.white} {...S} />
      <path d="M50 32 62 41l-5 15H43l-5-15Z" fill={C.ink} />
      <path d="M50 22v10M24 44l14-3M76 44l-14-3M36 78l7-14M64 78l-7-14" stroke={C.ink} strokeWidth={2.5} fill="none" />
    </>
  ),
  বই: (
    <>
      <path d="M50 30C40 22 26 22 16 26v46c10-4 24-4 34 4Z" fill={C.white} {...S} />
      <path d="M50 30c10-8 24-8 34-4v46c-10-4-24-4-34 4Z" fill={C.cream} {...S} />
      <path d="M24 38h18M24 48h18M58 38h18M58 48h18" stroke={C.grey} strokeWidth={2.5} strokeLinecap="round" />
    </>
  ),
  মই: (
    <>
      <path d="M32 14 22 88M68 14l10 74" stroke={C.brown} strokeWidth={7} strokeLinecap="round" fill="none" />
      <path d="M31 30h38M29 46h42M27 62h46M25 78h50" stroke={C.brown} strokeWidth={6} strokeLinecap="round" fill="none" />
    </>
  ),
  ফল: (
    <>
      <circle cx="38" cy="56" r="20" fill={C.red} {...S} />
      <circle cx="66" cy="62" r="15" fill={C.orange} {...S} />
      <path d="M38 36c0-8-2-12-6-14" fill="none" {...S} />
      <path d="M32 22c8-4 14 0 14 0s-6 6-14 4" fill={C.leaf} {...S} />
    </>
  ),
  জগ: (
    <>
      <path d="M28 32h38v50a6 6 0 0 1-6 6H34a6 6 0 0 1-6-6Z" fill={C.blue} opacity={0.35} {...S} />
      <path d="M66 44h10a8 8 0 0 1 0 22H66" fill="none" {...S} />
      <path d="M28 32h38l-6-8H34Z" fill={C.blue} opacity={0.5} {...S} />
      <path d="M30 60q18 8 34 0v20a6 6 0 0 1-6 6H36a6 6 0 0 1-6-6Z" fill={C.blue} opacity={0.5} />
    </>
  ),
  খই: (
    <>
      <ellipse cx="50" cy="74" rx="34" ry="12" fill={C.white} {...S} />
      <circle cx="34" cy="62" r="9" fill={C.cream} {...S} />
      <circle cx="52" cy="56" r="10" fill={C.white} {...S} />
      <circle cx="68" cy="64" r="8" fill={C.cream} {...S} />
      <circle cx="44" cy="68" r="7" fill={C.white} {...S} />
    </>
  ),
  কলস: (
    <>
      <path d="M36 24h28v8H36Z" fill={C.gold} {...S} />
      <path d="M40 32c-16 6-22 18-22 30 0 16 14 26 32 26s32-10 32-26c0-12-6-24-22-30Z" fill={C.orange} {...S} />
      <path d="M22 56q28 12 56 0" fill="none" stroke={C.gold} strokeWidth={3} />
    </>
  ),
};
