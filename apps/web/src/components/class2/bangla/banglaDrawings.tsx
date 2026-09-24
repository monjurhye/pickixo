/**
 * Illustrations for Class 2 Bangla.
 *
 * Original artwork. The textbook's own pictures are not reused — the same
 * rule the English and Maths courses follow, and the reason both of those
 * ship drawings rather than scans.
 *
 * Two families, for the same reason `mathDrawings` splits the same way:
 *
 * **Generated**, where being right matters more than being pretty. A letter
 * card (`letter-ক`) and a letter-arithmetic card (`build-ক+া=কা`) are drawn
 * from the characters themselves, so the picture cannot disagree with the
 * JSON — the failure mode `validateChapter` exists to prevent is a conjunct
 * that is drawn as one letter and labelled as another, and a generated card
 * cannot produce it.
 *
 * **Fixed**, for the scenes — a lion, a river, the six seasons. These are
 * flat and simple on purpose: at 96px on a phone, a detailed drawing reads as
 * mud, and the child is meant to recognise the thing in about a second.
 *
 * Every name a content file can use is resolvable through `banglaIllustration`
 * and reported by `hasBanglaIllustration`, which the content test uses to
 * reject a lesson pointing at a picture that does not exist.
 */
import type { CSSProperties, ReactNode } from 'react';
import {
  BUILD_PATTERN, LETTER_PATTERN, isIllustrationName, type SceneName,
} from '@/data/class2/bangla/illustrations';

const C = {
  ink: '#2b3440',
  skin: '#f4c9a3',
  skinDeep: '#d9a06d',
  hair: '#2f2a28',
  red: '#ef5b5b',
  green: '#3f9e4d',
  blue: '#4a7fd6',
  sky: '#bfe3f7',
  water: '#7cc3e8',
  gold: '#f2b632',
  sand: '#e8d3a0',
  leaf: '#5fb56b',
  brown: '#a9713f',
  grey: '#9aa6b2',
  white: '#ffffff',
} as const;

type Draw = () => ReactNode;

/** Every scene sits on the same rounded tile, so a row of them lines up. */
function Tile({ tint, children, view = '0 0 100 100' }: {
  tint: string; children: ReactNode; view?: string;
}) {
  return (
    <svg viewBox={view} style={{ width: '100%', height: '100%' }} aria-hidden="true">
      <rect x="0" y="0" width="100" height="100" rx="18" fill={tint} />
      {children}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* People                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One child, parameterised.
 *
 * The book's cast (তুলি, রাজু, মিতু, তিথি, ঝিমিত, রাফি) are the same drawing
 * with a different shirt and hair, rather than six drawings — six separate
 * faces would be six chances for one of them to look like a different age.
 */
function Child({ shirt, long, tint, grown = false }: {
  shirt: string; long: boolean; tint: string; grown?: boolean;
}) {
  return (
    <Tile tint={tint}>
      <path d={grown ? 'M28 66 q22 -10 44 0 l5 30 q-27 8 -54 0 Z' : 'M32 64 q18 -9 36 0 l5 28 q-23 8 -46 0 Z'}
            fill={shirt} />
      <circle cx="50" cy="40" r={grown ? 19 : 20} fill={C.skin} />
      {long ? (
        <>
          <path d="M29 38 q3 -22 21 -22 q18 0 21 22 q-8 -9 -21 -9 q-13 0 -21 9 Z" fill={C.hair} />
          <path d="M27 38 q-4 16 1 26 q6 -12 4 -26 Z" fill={C.hair} />
          <path d="M73 38 q4 16 -1 26 q-6 -12 -4 -26 Z" fill={C.hair} />
        </>
      ) : (
        <path d="M30 35 q3 -19 20 -19 q17 0 20 19 q-5 -7 -20 -7 q-15 0 -20 7 Z" fill={C.hair} />
      )}
      <circle cx="43" cy="41" r="2.5" fill={C.ink} />
      <circle cx="57" cy="41" r="2.5" fill={C.ink} />
      <path d="M44 49 q6 5 12 0" stroke={C.ink} strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </Tile>
  );
}

/* -------------------------------------------------------------------------- */
/* Generated: letters and letter arithmetic                                   */
/* -------------------------------------------------------------------------- */

const LETTER_TINTS = ['#eaf3ff', '#eefaf1', '#fff1ee', '#fff8e0', '#f3eeff', '#eafbf8'];

/**
 * A single letter on a card.
 *
 * Coloured by a hash of the character so that অ and আ are visibly different
 * tiles — a pre-reader picking "the blue one" is using the only cue they
 * have, and two identical cards take that away.
 */
export function LetterCard({ ch }: { ch: string }) {
  const tint = LETTER_TINTS[(ch.codePointAt(0) ?? 0) % LETTER_TINTS.length]!;
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }} aria-hidden="true">
      <rect x="4" y="4" width="92" height="92" rx="16" fill={tint} stroke="#c9d6e4" strokeWidth="2" />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
            fontSize="52" fontWeight="700" fill={C.ink}>{ch}</text>
    </svg>
  );
}

/** U+25CC, the placeholder a combining mark is shown attached to. */
const DOTTED_CIRCLE = '◌';

/** Bangla dependent vowel signs (কারচিহ্ন), plus hasanta. */
const COMBINING = /^[া-্ৗ]/u;

/**
 * A piece of a build, as it should be *shown*.
 *
 * A কারচিহ্ন has no standalone form — "ি" on its own is a mark waiting for a
 * consonant. Text shapers usually insert a dotted circle for it, but whether
 * they do depends on the shaper and the font, so a card could show "◌ি" on
 * one phone and a stray floating mark on another. Attaching the dotted circle
 * ourselves makes all ten কার render the same everywhere, and it is the
 * convention the Unicode charts and the textbook's own tables use.
 *
 * Only the display string changes — `parts` stays the real characters, so
 * what `compose()` validates and what the card draws never diverge.
 */
function shownPart(part: string): string {
  return COMBINING.test(part) ? DOTTED_CIRCLE + part : part;
}

/**
 * The book's own letter arithmetic, drawn: pieces, a +, and the result.
 *
 * Rendered from the strings rather than from a picture of them, so this card
 * is right by construction whenever the JSON is — and `validateChapter` has
 * already proved the JSON is, because it composes the pieces itself.
 */
export function BuildCard({ parts, result }: { parts: string[]; result: string }) {
  const cells = parts.length;
  const w = 34;
  const gap = 16;
  const totalW = cells * w + (cells - 1) * gap + gap + w + 18;
  const mid = 30;
  const nodes: ReactNode[] = [];
  let x = 6;

  parts.forEach((part, i) => {
    if (i > 0) {
      nodes.push(
        <text key={`p${i}`} x={x - gap / 2} y={mid} textAnchor="middle" dominantBaseline="central"
              fontSize="16" fontWeight="700" fill={C.grey}>+</text>,
      );
    }
    nodes.push(
      <g key={`c${i}`}>
        <rect x={x} y={mid - 16} width={w} height="32" rx="6" fill="#eef3fb" stroke="#c9d6e4" strokeWidth="1.2" />
        <text x={x + w / 2} y={mid} textAnchor="middle" dominantBaseline="central"
              fontSize="19" fontWeight="700" fill={C.ink}>{shownPart(part)}</text>
      </g>,
    );
    x += w + gap;
  });

  nodes.push(
    <text key="eq" x={x - gap / 2} y={mid} textAnchor="middle" dominantBaseline="central"
          fontSize="16" fontWeight="700" fill={C.grey}>=</text>,
    <g key="res">
      <rect x={x} y={mid - 18} width={w + 12} height="36" rx="7" fill="#fff3d6" stroke={C.gold} strokeWidth="1.6" />
      <text x={x + (w + 12) / 2} y={mid} textAnchor="middle" dominantBaseline="central"
            fontSize="21" fontWeight="700" fill="#8a5b06">{result}</text>
    </g>,
  );

  return (
    <svg viewBox={`0 0 ${totalW} 60`} style={{ width: '100%', height: '100%' }} aria-hidden="true">
      <rect x="0" y="0" width={totalW} height="60" rx="10" fill="#fbfcfe" />
      {nodes}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Fixed scenes                                                               */
/* -------------------------------------------------------------------------- */

/** A face with one expression — পাঠ ২'s আনন্দ / অবাক / দুঃখ / মজা. */
function Mood({ tint, mouth, brows = false, wide = false }: {
  tint: string; mouth: string; brows?: boolean; wide?: boolean;
}) {
  return (
    <Tile tint={tint}>
      <circle cx="50" cy="50" r="30" fill={C.gold} />
      <circle cx="40" cy="44" r={wide ? 5 : 3.2} fill={C.ink} />
      <circle cx="60" cy="44" r={wide ? 5 : 3.2} fill={C.ink} />
      {brows ? (
        <>
          <path d="M33 34 q7 -4 14 -1" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M67 34 q-7 -4 -14 -1" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" fill="none" />
        </>
      ) : null}
      <path d={mouth} stroke={C.ink} strokeWidth="3" strokeLinecap="round" fill="none" />
    </Tile>
  );
}

function Sign({ tint, children }: { tint: string; children: ReactNode }) {
  return <Tile tint={tint}>{children}</Tile>;
}

function Stick({ x, colour = C.ink, scale = 1 }: { x: number; colour?: string; scale?: number }) {
  return (
    <g transform={`translate(${x} 0) scale(${scale})`} stroke={colour} strokeWidth="3"
       strokeLinecap="round" fill="none">
      <circle cx="0" cy="34" r="7" fill={colour} stroke="none" />
      <line x1="0" y1="41" x2="0" y2="62" />
      <line x1="0" y1="47" x2="-10" y2="56" />
      <line x1="0" y1="47" x2="10" y2="56" />
      <line x1="0" y1="62" x2="-8" y2="78" />
      <line x1="0" y1="62" x2="8" y2="78" />
    </g>
  );
}

/** A four-legged animal, parameterised — the book's menagerie is large. */
function Beast({ tint, body, mane, tail = true, ears = 'round', stripes = false, spots = false }: {
  tint: string; body: string; mane?: string; tail?: boolean;
  ears?: 'round' | 'point' | 'long'; stripes?: boolean; spots?: boolean;
}) {
  return (
    <Tile tint={tint}>
      <ellipse cx="52" cy="60" rx="28" ry="16" fill={body} />
      <line x1="36" y1="72" x2="34" y2="86" stroke={body} strokeWidth="7" strokeLinecap="round" />
      <line x1="50" y1="74" x2="49" y2="86" stroke={body} strokeWidth="7" strokeLinecap="round" />
      <line x1="64" y1="72" x2="66" y2="86" stroke={body} strokeWidth="7" strokeLinecap="round" />
      {tail ? <path d="M79 56 q12 4 8 18" stroke={body} strokeWidth="4" fill="none" strokeLinecap="round" /> : null}
      {stripes ? (
        <g stroke="#6b4a1f" strokeWidth="2.6" strokeLinecap="round">
          <line x1="44" y1="48" x2="42" y2="60" /><line x1="54" y1="46" x2="53" y2="60" />
          <line x1="64" y1="48" x2="63" y2="60" />
        </g>
      ) : null}
      {spots ? (
        <g fill="#fff6e0">
          <circle cx="46" cy="56" r="3" /><circle cx="58" cy="52" r="3" /><circle cx="64" cy="62" r="3" />
        </g>
      ) : null}
      {mane ? <circle cx="28" cy="46" r="19" fill={mane} /> : null}
      <circle cx="28" cy="46" r="13" fill={body} />
      {ears === 'long' ? (
        <>
          <ellipse cx="22" cy="31" rx="3.5" ry="9" fill={body} />
          <ellipse cx="33" cy="31" rx="3.5" ry="9" fill={body} />
        </>
      ) : ears === 'point' ? (
        <>
          <path d="M18 38 L20 26 L28 33 Z" fill={body} />
          <path d="M38 38 L36 26 L28 33 Z" fill={body} />
        </>
      ) : (
        <>
          <circle cx="20" cy="36" r="5" fill={body} />
          <circle cx="36" cy="36" r="5" fill={body} />
        </>
      )}
      <circle cx="23" cy="45" r="2" fill={C.ink} />
      <circle cx="33" cy="45" r="2" fill={C.ink} />
      <circle cx="28" cy="52" r="2.4" fill={C.ink} />
    </Tile>
  );
}

function Season({ tint, children }: { tint: string; children: ReactNode }) {
  return (
    <Tile tint={tint}>
      <rect x="0" y="68" width="100" height="32" fill="#8fce8f" />
      {children}
    </Tile>
  );
}

/**
 * Keyed by `SceneName`, so the registry in `data/class2/bangla/illustrations.ts`
 * and the artwork here cannot drift: a name listed there with nothing drawn
 * for it, or a drawing here that content is not allowed to name, fails the
 * typecheck rather than reaching a child as an empty tile.
 */
const DRAWINGS: Record<SceneName, Draw> = {
  /* --- the cast ---------------------------------------------------------- */
  tuli: () => <Child shirt="#2eb8a6" long tint="#eafbf8" />,
  rafi: () => <Child shirt="#4a9ff5" long={false} tint="#eaf3ff" />,
  mitu: () => <Child shirt="#6fb6e8" long tint="#eaf6ff" />,
  raju: () => <Child shirt="#f4f6f8" long={false} tint="#f2f7fb" />,
  tithi: () => <Child shirt="#7fc4e6" long tint="#eaf8ff" />,
  jhimit: () => <Child shirt="#f0f3f6" long={false} tint="#eef3f8" />,
  tapu: () => <Child shirt="#f2c14e" long={false} tint="#fff8e6" />,
  ma: () => <Child shirt="#e4629a" long tint="#fdeef5" grown />,
  baba: () => <Child shirt="#f4f6f8" long={false} tint="#f1f4f7" grown />,
  teacher: () => <Child shirt="#8e7cc3" long tint="#f3eeff" grown />,
  friends: () => (
    <Tile tint="#eaf6ff">
      <Stick x={30} colour="#2eb8a6" />
      <Stick x={52} colour="#4a9ff5" />
      <Stick x={74} colour="#e4629a" />
    </Tile>
  ),

  /* --- school and things ------------------------------------------------- */
  school: () => (
    <Tile tint="#e9f4ff">
      <rect x="10" y="44" width="80" height="38" fill="#f2c14e" stroke="#c99a1e" strokeWidth="1.5" />
      <rect x="10" y="38" width="80" height="8" fill={C.red} />
      {[18, 34, 50, 66].map((x) => (
        <rect key={x} x={x} y="54" width="12" height="16" fill="#ffffff" stroke="#c99a1e" strokeWidth="1" />
      ))}
      <rect x="44" y="70" width="14" height="12" fill={C.brown} />
      <line x1="84" y1="12" x2="84" y2="44" stroke={C.grey} strokeWidth="2" />
      <path d="M84 14 h-20 v12 h20 Z" fill={C.green} />
      <circle cx="72" cy="20" r="4" fill={C.red} />
    </Tile>
  ),
  flag: () => (
    <Tile tint="#eefaf1">
      <line x1="24" y1="16" x2="24" y2="88" stroke={C.brown} strokeWidth="4" />
      <rect x="24" y="24" width="54" height="34" fill={C.green} />
      <circle cx="49" cy="41" r="11" fill={C.red} />
    </Tile>
  ),
  book: () => (
    <Tile tint="#fff6e6">
      <path d="M16 28 q18 -8 34 0 v46 q-16 -8 -34 0 Z" fill="#ffffff" stroke={C.brown} strokeWidth="2" />
      <path d="M84 28 q-18 -8 -34 0 v46 q16 -8 34 0 Z" fill="#fdf3dd" stroke={C.brown} strokeWidth="2" />
      <line x1="50" y1="28" x2="50" y2="74" stroke={C.brown} strokeWidth="2" />
    </Tile>
  ),
  bag: () => (
    <Tile tint="#fdeef5">
      <rect x="28" y="38" width="44" height="42" rx="8" fill="#c96a8a" />
      <path d="M38 38 q12 -16 24 0" stroke="#8d3f5b" strokeWidth="4" fill="none" />
      <rect x="28" y="54" width="44" height="12" fill="#8d3f5b" />
    </Tile>
  ),
  ball: () => (
    <Tile tint="#fff1ee">
      <circle cx="50" cy="52" r="26" fill={C.gold} stroke="#c99a1e" strokeWidth="2" />
      <path d="M24 52 h52 M50 26 v52" stroke="#c99a1e" strokeWidth="2" />
      <path d="M31 33 q19 19 38 38 M69 33 q-19 19 -38 38" stroke="#c99a1e" strokeWidth="1.4" fill="none" />
    </Tile>
  ),
  house: () => (
    <Tile tint="#fff8e6">
      <path d="M50 22 L88 50 H12 Z" fill={C.red} />
      <rect x="22" y="50" width="56" height="32" fill={C.sand} stroke={C.brown} strokeWidth="1.5" />
      <rect x="42" y="60" width="16" height="22" fill={C.brown} />
    </Tile>
  ),
  market: () => (
    <Tile tint="#fff4e3">
      <path d="M12 42 h76 l-8 -14 H20 Z" fill={C.red} />
      <rect x="18" y="42" width="64" height="38" fill={C.sand} />
      {[26, 44, 62].map((x, i) => (
        <circle key={x} cx={x + 6} cy="58" r="7" fill={[C.green, C.gold, '#e4629a'][i]} />
      ))}
      <rect x="18" y="68" width="64" height="12" fill={C.brown} />
    </Tile>
  ),

  /* --- moods (পাঠ ২) ------------------------------------------------------ */
  'mood-joy': () => <Mood tint="#eefaf1" mouth="M36 58 q14 16 28 0" />,
  'mood-surprise': () => <Mood tint="#eaf3ff" mouth="M50 62 m-7 0 a7 9 0 1 0 14 0 a7 9 0 1 0 -14 0" wide brows />,
  'mood-sad': () => <Mood tint="#eef2f7" mouth="M36 66 q14 -14 28 0" />,
  'mood-fun': () => <Mood tint="#fff1ee" mouth="M34 56 q16 20 32 0 Z" />,

  /* --- signs (পাঠ ৯) ------------------------------------------------------ */
  'sign-bin': () => (
    <Sign tint="#eefaf1">
      <rect x="10" y="10" width="80" height="80" rx="8" fill="#ffffff" stroke={C.ink} strokeWidth="3" />
      <circle cx="44" cy="28" r="5" fill={C.ink} />
      <path d="M44 34 v18 M44 40 l14 -6 M44 52 l-6 18 M44 52 l8 18" stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M60 46 h18 l-3 26 h-12 Z" fill="none" stroke={C.ink} strokeWidth="3" />
    </Sign>
  ),
  'sign-toilet': () => (
    <Sign tint="#eaf3ff">
      <rect x="10" y="10" width="80" height="80" rx="8" fill="#ffffff" stroke={C.ink} strokeWidth="3" />
      <g fill={C.ink}>
        <circle cx="36" cy="28" r="6" />
        <path d="M36 36 l-10 24 h20 Z" />
        <line x1="30" y1="60" x2="30" y2="76" stroke={C.ink} strokeWidth="4" />
        <line x1="42" y1="60" x2="42" y2="76" stroke={C.ink} strokeWidth="4" />
        <circle cx="66" cy="28" r="6" />
        <rect x="59" y="36" width="14" height="24" rx="3" />
        <line x1="62" y1="60" x2="62" y2="76" stroke={C.ink} strokeWidth="4" />
        <line x1="70" y1="60" x2="70" y2="76" stroke={C.ink} strokeWidth="4" />
      </g>
    </Sign>
  ),
  'sign-handwash': () => (
    <Sign tint="#eaf6ff">
      <circle cx="50" cy="50" r="40" fill={C.blue} />
      <path d="M34 30 h16 v10" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M50 40 v8" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 62 q18 12 36 0 q-4 12 -18 12 q-14 0 -18 -12 Z" fill="#ffffff" />
      <g stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round">
        <line x1="44" y1="50" x2="44" y2="56" /><line x1="50" y1="50" x2="50" y2="58" />
        <line x1="56" y1="50" x2="56" y2="56" />
      </g>
    </Sign>
  ),
  'sign-zebra': () => (
    <Sign tint="#fff1ee">
      <path d="M50 10 L92 86 H8 Z" fill="#ffffff" stroke={C.red} strokeWidth="6" strokeLinejoin="round" />
      <g fill={C.ink}>
        <rect x="32" y="70" width="6" height="8" /><rect x="42" y="70" width="6" height="8" />
        <rect x="52" y="70" width="6" height="8" /><rect x="62" y="70" width="6" height="8" />
        <circle cx="50" cy="42" r="5" />
        <path d="M50 48 l-7 18 M50 48 l7 18 M43 54 h14" stroke={C.ink} strokeWidth="3.4" strokeLinecap="round" fill="none" />
      </g>
    </Sign>
  ),
  'sign-together': () => (
    <Sign tint="#eafbf8">
      <circle cx="50" cy="50" r="34" fill="#ffffff" />
      {[0, 90, 180, 270].map((deg, i) => (
        <rect key={deg} x="46" y="16" width="8" height="26" rx="4"
              fill={[C.red, C.green, C.blue, C.gold][i]}
              transform={`rotate(${deg} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="10" fill="none" stroke={C.grey} strokeWidth="2" />
    </Sign>
  ),

  /* --- animals ----------------------------------------------------------- */
  lion: () => <Beast tint="#fff6e0" body="#e0a94f" mane="#b87a2a" />,
  mouse: () => (
    <Tile tint="#f6f1ea">
      <ellipse cx="54" cy="58" rx="22" ry="14" fill="#9b8579" />
      <circle cx="32" cy="52" r="11" fill="#9b8579" />
      <circle cx="26" cy="42" r="6" fill="#c7b2a6" />
      <circle cx="38" cy="40" r="6" fill="#c7b2a6" />
      <circle cx="27" cy="52" r="1.8" fill={C.ink} />
      <circle cx="23" cy="56" r="2" fill="#5c4a40" />
      <path d="M76 58 q16 2 14 16" stroke="#9b8579" strokeWidth="3" fill="none" strokeLinecap="round" />
    </Tile>
  ),
  'cat-white': () => <Beast tint="#eef2f7" body="#f2f4f7" ears="point" />,
  'cat-black': () => <Beast tint="#e9edf2" body="#4a4a52" ears="point" />,
  cow: () => <Beast tint="#eefaf1" body="#f0f2f4" spots ears="long" />,
  dog: () => <Beast tint="#fff4e3" body="#d9a05c" ears="long" />,
  goat: () => <Beast tint="#f4f7ef" body="#e8e2d2" ears="long" />,
  deer: () => <Beast tint="#fff8ea" body="#d9a05c" spots ears="point" />,
  fox: () => <Beast tint="#fff1e6" body="#e07a3c" ears="point" />,
  tiger: () => <Beast tint="#fff6e0" body="#f0a93f" stripes ears="round" />,
  duck: () => (
    <Tile tint="#eaf6ff">
      <ellipse cx="52" cy="62" rx="26" ry="16" fill="#ffffff" stroke="#d6dde4" strokeWidth="1.5" />
      <circle cx="32" cy="42" r="11" fill="#ffffff" stroke="#d6dde4" strokeWidth="1.5" />
      <path d="M24 44 q-12 2 -2 8 q6 2 10 -3 Z" fill={C.gold} />
      <circle cx="30" cy="39" r="2" fill={C.ink} />
      <path d="M0 84 q25 -8 50 0 q25 8 50 0 v16 H0 Z" fill={C.water} />
    </Tile>
  ),
  hen: () => (
    <Tile tint="#fff6e6">
      <ellipse cx="52" cy="60" rx="24" ry="18" fill="#f2e3c8" />
      <circle cx="34" cy="42" r="11" fill="#f2e3c8" />
      <path d="M30 30 q4 -8 8 0 q4 -8 6 2 Z" fill={C.red} />
      <path d="M24 44 l-8 4 8 4 Z" fill={C.gold} />
      <circle cx="31" cy="41" r="2" fill={C.ink} />
      <line x1="46" y1="78" x2="44" y2="88" stroke={C.gold} strokeWidth="3" />
      <line x1="58" y1="78" x2="60" y2="88" stroke={C.gold} strokeWidth="3" />
    </Tile>
  ),
  bird: () => (
    <Tile tint="#eaf6ff">
      <ellipse cx="52" cy="54" rx="20" ry="14" fill="#7fb2e0" />
      <circle cx="34" cy="42" r="10" fill="#7fb2e0" />
      <path d="M26 44 l-9 3 9 4 Z" fill={C.gold} />
      <circle cx="32" cy="40" r="2" fill={C.ink} />
      <path d="M50 48 q14 -10 24 2 q-12 6 -24 -2 Z" fill="#a9cdea" />
      <path d="M70 58 q14 4 16 14" stroke="#7fb2e0" strokeWidth="4" fill="none" strokeLinecap="round" />
    </Tile>
  ),
  crow: () => (
    <Tile tint="#eef2f7">
      <ellipse cx="52" cy="54" rx="21" ry="14" fill="#3c3f46" />
      <circle cx="33" cy="42" r="10" fill="#3c3f46" />
      <path d="M25 43 l-11 3 11 4 Z" fill="#8a8f98" />
      <circle cx="31" cy="40" r="2" fill="#ffffff" />
      <path d="M50 48 q15 -9 25 3 q-13 6 -25 -3 Z" fill="#20232a" />
      <path d="M72 58 q14 5 15 15" stroke="#3c3f46" strokeWidth="4" fill="none" strokeLinecap="round" />
    </Tile>
  ),
  ant: () => (
    <Tile tint="#f6f1ea">
      <circle cx="30" cy="54" r="10" fill="#3c3f46" />
      <circle cx="50" cy="54" r="8" fill="#3c3f46" />
      <ellipse cx="72" cy="54" rx="13" ry="10" fill="#3c3f46" />
      <g stroke="#3c3f46" strokeWidth="2.6" strokeLinecap="round">
        <path d="M46 48 l-6 -14 M52 48 l4 -14 M58 60 l6 14 M44 60 l-6 14 M50 62 l0 14" />
        <path d="M26 46 l-8 -14 M34 46 l4 -16" />
      </g>
      <circle cx="26" cy="52" r="1.8" fill="#ffffff" />
    </Tile>
  ),
  bee: () => (
    <Tile tint="#fff8e0">
      <ellipse cx="52" cy="56" rx="22" ry="15" fill={C.gold} />
      <g fill="#3c3f46">
        <rect x="42" y="43" width="7" height="26" rx="2" />
        <rect x="56" y="43" width="7" height="26" rx="2" />
      </g>
      <circle cx="28" cy="50" r="10" fill="#3c3f46" />
      <circle cx="25" cy="48" r="2" fill="#ffffff" />
      <path d="M22 40 l-5 -10 M31 38 l3 -11" stroke="#3c3f46" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="50" cy="36" rx="14" ry="8" fill="#ffffff" opacity="0.8" />
    </Tile>
  ),
  butterfly: () => (
    <Tile tint="#fdeef5">
      <ellipse cx="50" cy="50" rx="3.5" ry="22" fill="#4a4a52" />
      <path d="M48 36 q-26 -22 -32 2 q-4 18 14 20 q14 1 18 -12 Z" fill={C.red} />
      <path d="M52 36 q26 -22 32 2 q4 18 -14 20 q-14 1 -18 -12 Z" fill="#6f8ede" />
      <path d="M48 56 q-20 -6 -22 12 q-1 12 12 10 q10 -2 10 -14 Z" fill="#f08cb0" />
      <path d="M52 56 q20 -6 22 12 q1 12 -12 10 q-10 -2 -10 -14 Z" fill="#9db4ea" />
      <path d="M48 30 l-7 -12 M52 30 l7 -12" stroke="#4a4a52" strokeWidth="2.2" strokeLinecap="round" />
    </Tile>
  ),
  fish: () => (
    <Tile tint="#eaf6ff">
      <ellipse cx="46" cy="52" rx="26" ry="15" fill="#b8cdd9" stroke="#8fa8b8" strokeWidth="1.5" />
      <path d="M72 52 l18 -12 v24 Z" fill="#b8cdd9" stroke="#8fa8b8" strokeWidth="1.5" />
      <circle cx="30" cy="48" r="2.6" fill={C.ink} />
      <path d="M40 40 q8 -8 16 0" stroke="#8fa8b8" strokeWidth="2" fill="none" />
      <path d="M0 78 q25 -6 50 0 q25 6 50 0 v22 H0 Z" fill={C.water} opacity="0.6" />
    </Tile>
  ),
  /**
   * পক্ষিরাজ ঘোড়া — the flying horse of পাঠ ৪.
   *
   * Drawn with a neck, a muzzle and a mane rather than as a body with a head
   * stuck on it: without the neck the silhouette reads as a fish, and this is
   * the picture a child sees on eight of the story's twenty panels.
   */
  'horse-winged': () => (
    <Tile tint="#eef4ff">
      {/*
        Head, neck, body and legs as a single silhouette rather than as parts
        assembled from ellipses. At 96px a horse is read as one outline, and
        drawn as separate pieces it kept coming out as a bird — the head
        floating over a round body is a duck, whatever the legs are doing.
      */}
      <path
        d="M26 33 L22 41 L23 46 L31 47 L37 43
           L42 52 L44 62 L41 86 L47 86 L50 64
           L62 66 L66 86 L72 86 L74 62
           L82 56 L86 42 L80 40 L62 38 L50 33 L44 22
           L41 12 L36 21 L30 26 Z"
        fill="#ffffff" stroke="#b9c9dc" strokeWidth="1.8" strokeLinejoin="round"
      />
      <path d="M41 14 q6 9 8 20 q1 6 -1 10 q-2 -18 -9 -30 Z" fill="#c9d9ee" />
      <path d="M84 44 q9 6 8 19 q-6 -11 -13 -14 Z" fill="#c9d9ee" />
      <circle cx="32" cy="31" r="2.2" fill={C.ink} />
      <path d="M55 41 q11 -21 28 -16 q-6 4 -8 8 q7 -1 9 4 q-7 1 -10 6 q5 3 6 6 q-13 -4 -26 -8 Z"
            fill="#dce8fa" stroke="#a9c0e0" strokeWidth="1.4" strokeLinejoin="round" />
    </Tile>
  ),

  /* --- story props ------------------------------------------------------- */
  net: () => (
    <Tile tint="#f4f7ef">
      <rect x="14" y="24" width="72" height="56" rx="6" fill="#ffffff" stroke={C.grey} strokeWidth="1.5" />
      <g stroke={C.grey} strokeWidth="1.4">
        {[26, 38, 50, 62, 74].map((x) => <line key={`v${x}`} x1={x} y1="24" x2={x} y2="80" />)}
        {[36, 48, 60, 72].map((y) => <line key={`h${y}`} x1="14" y1={y} x2="86" y2={y} />)}
      </g>
    </Tile>
  ),
  sword: () => (
    <Tile tint="#eef2f7">
      <path d="M62 14 l10 8 -40 46 -12 4 4 -12 Z" fill="#cfd8e2" stroke="#93a2b2" strokeWidth="1.6" />
      <rect x="18" y="62" width="18" height="6" rx="3" fill={C.gold} transform="rotate(-45 27 65)" />
    </Tile>
  ),
  pot: () => (
    <Tile tint="#fff4e3">
      <path d="M26 46 q24 -14 48 0 q6 20 -4 32 q-20 8 -40 0 q-10 -12 -4 -32 Z" fill="#c9702f" stroke="#8a4a1c" strokeWidth="2" />
      <ellipse cx="50" cy="46" rx="24" ry="7" fill="#e08a4a" stroke="#8a4a1c" strokeWidth="2" />
    </Tile>
  ),
  'bee-swarm': () => (
    <Tile tint="#fff8e0">
      {([[30, 40], [52, 32], [70, 46], [42, 58], [64, 66]] as const).map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx="9" ry="6" fill={C.gold} />
          <rect x={x - 2} y={y - 6} width="4" height="12" fill="#3c3f46" />
          <ellipse cx={x} cy={y - 7} rx="7" ry="3.5" fill="#ffffff" opacity="0.85" />
        </g>
      ))}
    </Tile>
  ),

  /* --- nature and place -------------------------------------------------- */
  tree: () => (
    <Tile tint="#eefaf1">
      <rect x="45" y="54" width="10" height="34" fill={C.brown} />
      <circle cx="50" cy="40" r="22" fill={C.leaf} />
      <circle cx="33" cy="48" r="14" fill="#4da35c" />
      <circle cx="67" cy="48" r="14" fill="#4da35c" />
    </Tile>
  ),
  flower: () => (
    <Tile tint="#fff1ee">
      <line x1="50" y1="52" x2="50" y2="86" stroke={C.green} strokeWidth="4" />
      <path d="M50 66 q-16 -4 -18 -14 q16 0 18 14 Z" fill={C.green} />
      {[0, 72, 144, 216, 288].map((deg) => (
        <ellipse key={deg} cx="50" cy="32" rx="8" ry="14" fill={C.red}
                 transform={`rotate(${deg} 50 44)`} />
      ))}
      <circle cx="50" cy="44" r="7" fill={C.gold} />
    </Tile>
  ),
  river: () => (
    <Tile tint="#eaf6ff">
      <rect x="0" y="0" width="100" height="56" fill={C.sky} />
      <path d="M0 56 q20 -10 40 0 q20 10 60 -2 v46 H0 Z" fill={C.water} />
      <path d="M0 52 h100 v8 H0 Z" fill="#8fce8f" opacity="0.55" />
      <g stroke="#ffffff" strokeWidth="1.8" opacity="0.7" fill="none">
        <path d="M14 72 q8 -4 16 0 q8 4 16 0" /><path d="M52 82 q8 -4 16 0 q8 4 16 0" />
      </g>
    </Tile>
  ),
  boat: () => (
    <Tile tint="#eaf6ff">
      <rect x="0" y="0" width="100" height="62" fill={C.sky} />
      <path d="M0 62 h100 v38 H0 Z" fill={C.water} />
      <path d="M18 62 h64 l-10 14 H28 Z" fill={C.brown} />
      <line x1="50" y1="20" x2="50" y2="62" stroke="#7a5230" strokeWidth="3" />
      <path d="M50 24 l24 30 H50 Z" fill={C.red} />
    </Tile>
  ),
  pond: () => (
    <Tile tint="#eefaf1">
      <rect x="0" y="0" width="100" height="52" fill="#d8efd8" />
      <ellipse cx="50" cy="70" rx="42" ry="24" fill={C.water} />
      <ellipse cx="50" cy="70" rx="42" ry="24" fill="none" stroke="#5aa8cc" strokeWidth="2" />
      <ellipse cx="36" cy="64" rx="9" ry="5" fill={C.leaf} />
      <ellipse cx="62" cy="76" rx="8" ry="4.5" fill={C.leaf} />
    </Tile>
  ),
  field: () => (
    <Tile tint="#fff8e0">
      <rect x="0" y="0" width="100" height="50" fill={C.sky} />
      <rect x="0" y="50" width="100" height="50" fill="#e8c65a" />
      <g stroke="#b9912a" strokeWidth="2" strokeLinecap="round">
        {[14, 30, 46, 62, 78].map((x) => <path key={x} d={`M${x} 92 v-22 M${x} 70 l-5 -8 M${x} 70 l5 -8`} />)}
      </g>
    </Tile>
  ),
  village: () => (
    <Tile tint="#eefaf1">
      <rect x="0" y="0" width="100" height="52" fill={C.sky} />
      <rect x="0" y="52" width="100" height="48" fill="#8fce8f" />
      <path d="M22 52 L36 38 L50 52 Z" fill={C.red} />
      <rect x="26" y="52" width="20" height="18" fill={C.sand} />
      <path d="M56 52 L68 40 L80 52 Z" fill={C.brown} />
      <rect x="59" y="52" width="18" height="18" fill={C.sand} />
      <circle cx="14" cy="42" r="12" fill={C.leaf} />
      <rect x="12" y="50" width="4" height="16" fill={C.brown} />
    </Tile>
  ),
  city: () => (
    <Tile tint="#eef2f7">
      <rect x="0" y="0" width="100" height="60" fill="#cfe4f5" />
      <rect x="0" y="76" width="100" height="24" fill="#b6bfc9" />
      <rect x="10" y="26" width="20" height="50" fill="#8fa3b8" />
      <rect x="36" y="14" width="22" height="62" fill="#6f87a0" />
      <rect x="64" y="34" width="24" height="42" fill="#9fb2c6" />
      <g fill="#fff4c9">
        {[14, 22].map((x) => [32, 44, 56].map((y) => <rect key={`${x}${y}`} x={x} y={y} width="6" height="7" />))}
        {[40, 50].map((x) => [20, 32, 44, 56].map((y) => <rect key={`b${x}${y}`} x={x} y={y} width="6" height="7" />))}
        {[68, 78].map((x) => [40, 52, 64].map((y) => <rect key={`c${x}${y}`} x={x} y={y} width="6" height="7" />))}
      </g>
    </Tile>
  ),
  zoo: () => (
    <Tile tint="#fff8e6">
      <rect x="0" y="66" width="100" height="34" fill="#8fce8f" />
      <g stroke={C.brown} strokeWidth="3">
        {[16, 28, 40, 52, 64, 76, 88].map((x) => <line key={x} x1={x} y1="34" x2={x} y2="80" />)}
        <line x1="10" y1="42" x2="92" y2="42" /><line x1="10" y1="70" x2="92" y2="70" />
      </g>
      <ellipse cx="50" cy="58" rx="14" ry="9" fill="#f0a93f" />
      <circle cx="38" cy="52" r="7" fill="#f0a93f" />
    </Tile>
  ),
  park: () => (
    <Tile tint="#eefaf1">
      <rect x="0" y="70" width="100" height="30" fill="#8fce8f" />
      <line x1="24" y1="26" x2="24" y2="70" stroke={C.grey} strokeWidth="3" />
      <line x1="60" y1="26" x2="60" y2="70" stroke={C.grey} strokeWidth="3" />
      <line x1="20" y1="26" x2="64" y2="26" stroke={C.grey} strokeWidth="3" />
      <line x1="34" y1="26" x2="34" y2="54" stroke={C.brown} strokeWidth="2" />
      <line x1="48" y1="26" x2="48" y2="54" stroke={C.brown} strokeWidth="2" />
      <rect x="30" y="54" width="22" height="4" rx="2" fill={C.red} />
      <circle cx="82" cy="44" r="12" fill={C.leaf} />
      <rect x="80" y="52" width="4" height="18" fill={C.brown} />
    </Tile>
  ),
  potter: () => (
    <Tile tint="#fff4e3">
      <circle cx="50" cy="66" r="24" fill="#b98a5e" />
      <circle cx="50" cy="66" r="12" fill="#8a4a1c" />
      <path d="M38 44 q12 -12 24 0 q4 12 -2 18 q-10 5 -20 0 q-6 -6 -2 -18 Z" fill="#c9702f" stroke="#8a4a1c" strokeWidth="1.8" />
      <ellipse cx="50" cy="44" rx="12" ry="4" fill="#e08a4a" />
    </Tile>
  ),

  /* --- seasons (পাঠ ২১) --------------------------------------------------- */
  'season-grishmo': () => (
    <Season tint="#fff3cf">
      <circle cx="68" cy="26" r="15" fill={C.gold} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
        <line key={d} x1="68" y1="6" x2="68" y2="0" stroke={C.gold} strokeWidth="3"
              transform={`rotate(${d} 68 26)`} strokeLinecap="round" />
      ))}
      <path d="M8 68 q14 -16 28 0 Z" fill="#c9a24a" />
      <path d="M14 68 v-6 h12 v6" fill="#b98a5e" />
    </Season>
  ),
  'season-borsha': () => (
    <Season tint="#dfe9f5">
      <ellipse cx="46" cy="24" rx="26" ry="13" fill="#7f8ea0" />
      <ellipse cx="70" cy="28" rx="18" ry="10" fill="#93a2b2" />
      <g stroke="#5f9fd0" strokeWidth="2.4" strokeLinecap="round">
        {[22, 34, 46, 58, 70, 82].map((x) => <line key={x} x1={x} y1="42" x2={x - 5} y2="64" />)}
        {[28, 40, 52, 64, 76].map((x) => <line key={`b${x}`} x1={x} y1="50" x2={x - 4} y2="66" />)}
      </g>
    </Season>
  ),
  'season-shorot': () => (
    <Season tint="#dff0fb">
      <ellipse cx="34" cy="26" rx="18" ry="10" fill="#ffffff" />
      <ellipse cx="50" cy="22" rx="14" ry="9" fill="#ffffff" />
      <ellipse cx="72" cy="30" rx="16" ry="9" fill="#ffffff" />
      <g stroke="#f0f4f7" strokeWidth="3" strokeLinecap="round">
        {[16, 26, 36, 46, 56].map((x) => <line key={x} x1={x} y1="68" x2={x + 3} y2="50" />)}
      </g>
      {[16, 26, 36, 46, 56].map((x) => <ellipse key={`k${x}`} cx={x + 4} cy="48" rx="4" ry="7" fill="#ffffff" />)}
    </Season>
  ),
  'season-hemonto': () => (
    <Season tint="#fdf0cd">
      <rect x="0" y="52" width="100" height="24" fill="#e8c65a" />
      <g stroke="#b9912a" strokeWidth="2" strokeLinecap="round">
        {[10, 24, 38, 52, 66, 80, 92].map((x) => <path key={x} d={`M${x} 72 v-16 M${x} 56 l-4 -6 M${x} 56 l4 -6`} />)}
      </g>
      <path d="M62 84 l10 -20 10 20 Z" fill="#d8a93a" />
    </Season>
  ),
  'season-sheet': () => (
    <Season tint="#e7eef3">
      <rect x="0" y="0" width="100" height="70" fill="#dbe6ee" />
      <rect x="0" y="68" width="100" height="32" fill="#a9c6a9" />
      <rect x="44" y="34" width="8" height="34" fill={C.brown} />
      <path d="M48 34 q-18 -12 -24 2 q14 -4 24 4 Z" fill="#4da35c" />
      <path d="M48 34 q18 -12 24 2 q-14 -4 -24 4 Z" fill="#4da35c" />
      <circle cx="62" cy="46" r="5" fill="#d8a93a" />
      <g stroke="#ffffff" strokeWidth="2" opacity="0.8">
        <line x1="10" y1="20" x2="30" y2="20" /><line x1="66" y1="14" x2="88" y2="14" />
      </g>
    </Season>
  ),
  'season-bosonto': () => (
    <Season tint="#fdeef0">
      <rect x="46" y="44" width="8" height="24" fill={C.brown} />
      <circle cx="50" cy="34" r="20" fill="#5fb56b" />
      {[[36, 26], [50, 18], [64, 28], [42, 40], [60, 42]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4.5" fill={i % 2 ? '#f08cb0' : '#f2b632'} />
      ))}
      <path d="M12 26 q6 -6 12 0 q-6 -2 -12 0 Z" fill="#4a4a52" />
      <path d="M78 20 q6 -6 12 0 q-6 -2 -12 0 Z" fill="#4a4a52" />
    </Season>
  ),

  /* --- culture ----------------------------------------------------------- */
  'shaheed-minar': () => (
    <Tile tint="#eaf6ff">
      <rect x="0" y="76" width="100" height="24" fill="#c9d6e4" />
      <circle cx="58" cy="30" r="14" fill={C.red} />
      <rect x="26" y="30" width="10" height="46" fill="#ffffff" stroke="#c9d6e4" strokeWidth="1.4" />
      <rect x="40" y="22" width="10" height="54" fill="#ffffff" stroke="#c9d6e4" strokeWidth="1.4" />
      <rect x="54" y="16" width="10" height="60" fill="#ffffff" stroke="#c9d6e4" strokeWidth="1.4" />
      <rect x="68" y="30" width="10" height="46" fill="#ffffff" stroke="#c9d6e4" strokeWidth="1.4" />
    </Tile>
  ),
  boishakh: () => (
    <Tile tint="#fff1ee">
      <circle cx="50" cy="50" r="34" fill="#ffffff" stroke={C.red} strokeWidth="3" />
      <circle cx="50" cy="50" r="24" fill={C.red} />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
            fontSize="15" fontWeight="700" fill="#ffffff">১৪</text>
      {[0, 60, 120, 180, 240, 300].map((d) => (
        <path key={d} d="M50 12 l-4 -8 h8 Z" fill={C.red} transform={`rotate(${d} 50 50)`} />
      ))}
    </Tile>
  ),
  nagordola: () => (
    <Tile tint="#eaf6ff">
      <circle cx="50" cy="44" r="28" fill="none" stroke={C.brown} strokeWidth="3" />
      {[0, 60, 120, 180, 240, 300].map((d) => (
        <g key={d} transform={`rotate(${d} 50 44)`}>
          <line x1="50" y1="44" x2="50" y2="16" stroke={C.brown} strokeWidth="2" />
          <rect x="45" y="12" width="10" height="8" rx="2" fill={C.red} />
        </g>
      ))}
      <path d="M32 84 L50 46 L68 84 Z" fill="none" stroke={C.brown} strokeWidth="3" />
    </Tile>
  ),
  'nouka-baich': () => (
    <Tile tint="#eaf6ff">
      <rect x="0" y="0" width="100" height="58" fill={C.sky} />
      <path d="M0 58 h100 v42 H0 Z" fill={C.water} />
      <path d="M8 62 h72 l-12 12 H18 Z" fill={C.brown} />
      {[26, 38, 50, 62].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy="54" r="4" fill={[C.red, C.gold, C.green, C.blue][i]} />
          <line x1={x} y1="58" x2={x} y2="62" stroke={C.ink} strokeWidth="2" />
        </g>
      ))}
    </Tile>
  ),
  dhol: () => (
    <Tile tint="#fff4e3">
      <rect x="22" y="34" width="56" height="34" rx="6" fill="#c9702f" stroke="#8a4a1c" strokeWidth="2" />
      <ellipse cx="22" cy="51" rx="7" ry="17" fill="#f2e3c8" stroke="#8a4a1c" strokeWidth="2" />
      <ellipse cx="78" cy="51" rx="7" ry="17" fill="#f2e3c8" stroke="#8a4a1c" strokeWidth="2" />
      <g stroke="#8a4a1c" strokeWidth="1.6">
        {[30, 42, 54, 66].map((x) => <path key={x} d={`M${x} 36 l6 30`} />)}
      </g>
    </Tile>
  ),
  kite: () => (
    <Tile tint="#eaf6ff">
      <path d="M50 12 L76 44 L50 78 L24 44 Z" fill={C.red} stroke="#b83b3b" strokeWidth="1.6" />
      <path d="M50 12 v66 M24 44 h52" stroke="#b83b3b" strokeWidth="1.4" />
      <path d="M50 78 q-8 10 2 16 q10 6 4 -16" stroke={C.gold} strokeWidth="2.4" fill="none" />
    </Tile>
  ),
  muktijoddha: () => (
    <Tile tint="#eefaf1">
      <rect x="0" y="72" width="100" height="28" fill="#6fae6f" />
      <Stick x={34} colour="#3f6b3f" />
      <Stick x={62} colour="#4a7a4a" />
      <line x1="80" y1="20" x2="80" y2="72" stroke={C.brown} strokeWidth="3" />
      <rect x="56" y="22" width="24" height="16" fill={C.green} />
      <circle cx="68" cy="30" r="5" fill={C.red} />
    </Tile>
  ),
  nazrul: () => (
    <Tile tint="#fff8e6">
      <circle cx="50" cy="56" r="34" fill="#f5e3c0" />
      <circle cx="50" cy="42" r="19" fill={C.skin} />
      <path d="M30 40 q2 -22 20 -22 q18 0 20 22 q-6 -10 -20 -10 q-14 0 -20 10 Z" fill="#2f2a28" />
      <circle cx="43" cy="42" r="2.4" fill={C.ink} />
      <circle cx="57" cy="42" r="2.4" fill={C.ink} />
      <path d="M43 52 h14" stroke="#2f2a28" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 66 q18 -8 36 0 l4 24 H28 Z" fill="#3a3f46" />
      <path d="M44 66 q6 8 12 0 l-2 24 h-8 Z" fill="#ffffff" />
    </Tile>
  ),

  /* --- sports (পাঠ ২৮) ---------------------------------------------------- */
  run: () => (
    <Tile tint="#fff1ee">
      <g stroke={C.red} strokeWidth="3.4" strokeLinecap="round" fill="none">
        <circle cx="40" cy="28" r="8" fill={C.red} stroke="none" />
        <path d="M40 36 l6 22 M46 58 l-12 22 M46 58 l16 18 M40 42 l-16 8 M40 42 l20 -4" />
      </g>
      <g stroke={C.blue} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.65">
        <circle cx="74" cy="34" r="7" fill={C.blue} stroke="none" />
        <path d="M74 41 l4 18 M78 59 l-8 20 M78 59 l12 16 M74 46 l-12 6" />
      </g>
    </Tile>
  ),
  'rope-jump': () => (
    <Tile tint="#eafbf8">
      <path d="M22 40 q28 56 56 0" stroke="#e4629a" strokeWidth="3" fill="none" />
      <Stick x={50} colour="#2eb8a6" />
    </Tile>
  ),
  'long-jump': () => (
    <Tile tint="#fff8e0">
      <path d="M12 82 q30 -46 76 -14" stroke={C.grey} strokeWidth="2" strokeDasharray="4 4" fill="none" />
      <g stroke={C.blue} strokeWidth="3.4" strokeLinecap="round" fill="none">
        <circle cx="54" cy="34" r="8" fill={C.blue} stroke="none" />
        <path d="M54 42 l2 18 M56 60 l-16 12 M56 60 l16 6 M54 48 l-18 -6 M54 48 l18 -10" />
      </g>
      <rect x="0" y="84" width="100" height="16" fill={C.sand} />
    </Tile>
  ),
  'morog-lorai': () => (
    <Tile tint="#fff4e3">
      <g stroke={C.red} strokeWidth="3.2" strokeLinecap="round" fill="none">
        <circle cx="34" cy="30" r="7" fill={C.red} stroke="none" />
        <path d="M34 37 v18 M34 55 l-8 22 M34 46 l14 4 M34 55 l14 -8 l-2 8" />
      </g>
      <g stroke={C.blue} strokeWidth="3.2" strokeLinecap="round" fill="none">
        <circle cx="68" cy="30" r="7" fill={C.blue} stroke="none" />
        <path d="M68 37 v18 M68 55 l8 22 M68 46 l-14 4 M68 55 l-14 -8 l2 8" />
      </g>
    </Tile>
  ),
  'biscuit-run': () => (
    <Tile tint="#fff8e6">
      <line x1="8" y1="22" x2="92" y2="22" stroke={C.brown} strokeWidth="2.5" />
      {[26, 46, 66].map((x) => (
        <g key={x}>
          <line x1={x} y1="22" x2={x} y2="34" stroke={C.grey} strokeWidth="1.6" />
          <circle cx={x} cy="38" r="6" fill="#e0a94f" stroke="#b87a2a" strokeWidth="1.4" />
        </g>
      ))}
      <Stick x={50} colour="#3f9e4d" scale={0.9} />
    </Tile>
  ),
  'ball-throw': () => (
    <Tile tint="#eaf6ff">
      <circle cx="68" cy="26" r="11" fill={C.red} />
      <path d="M58 26 h20 M68 16 v20" stroke="#ffffff" strokeWidth="2" />
      <g stroke={C.blue} strokeWidth="3.4" strokeLinecap="round" fill="none">
        <circle cx="36" cy="36" r="8" fill={C.blue} stroke="none" />
        <path d="M36 44 v18 M36 62 l-10 20 M36 62 l10 20 M36 48 l16 -14 M36 48 l-14 6" />
      </g>
    </Tile>
  ),

  /* --- writing (পাঠ ১৪, ১৬) ------------------------------------------------ */
  handwriting: () => (
    <Tile tint="#fff8e6">
      <rect x="12" y="20" width="76" height="60" rx="4" fill="#ffffff" stroke="#d6dde4" strokeWidth="1.6" />
      <g stroke="#dfe6ec" strokeWidth="1.2">
        {[34, 46, 58, 70].map((y) => <line key={y} x1="18" y1={y} x2="82" y2={y} />)}
      </g>
      <path d="M22 44 q10 -14 18 0 q8 12 16 -2 q8 -12 18 2" stroke={C.blue} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M22 66 q12 -10 24 0 q10 8 20 -4" stroke={C.blue} strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </Tile>
  ),
  phone: () => (
    <Tile tint="#eef2f7">
      <rect x="32" y="12" width="36" height="76" rx="7" fill="#3a3f46" />
      <rect x="35" y="20" width="30" height="58" rx="2" fill="#ffffff" />
      <g fill="#cfe0f5">
        <rect x="39" y="26" width="22" height="6" rx="2" /><rect x="39" y="36" width="16" height="6" rx="2" />
        <rect x="39" y="46" width="20" height="6" rx="2" />
      </g>
      <circle cx="50" cy="83" r="2.6" fill="#8a8f98" />
    </Tile>
  ),
  signboard: () => (
    <Tile tint="#fdeef0">
      <rect x="12" y="26" width="76" height="40" rx="4" fill="#ffffff" stroke={C.red} strokeWidth="2.5" />
      <g fill={C.red}>
        <rect x="20" y="34" width="44" height="5" rx="2" /><rect x="20" y="44" width="58" height="4" rx="2" />
        <rect x="20" y="52" width="36" height="4" rx="2" />
      </g>
      <line x1="30" y1="66" x2="30" y2="86" stroke={C.brown} strokeWidth="3" />
      <line x1="70" y1="66" x2="70" y2="86" stroke={C.brown} strokeWidth="3" />
    </Tile>
  ),
  question: () => (
    <Tile tint="#f3eeff">
      <circle cx="50" cy="50" r="32" fill="#8e7cc3" />
      <text x="50" y="52" textAnchor="middle" dominantBaseline="central"
            fontSize="38" fontWeight="700" fill="#ffffff">?</text>
    </Tile>
  ),
  star: () => (
    <Tile tint="#fff8e0">
      <path d="M50 16 L61 42 L89 44 L67 61 L75 88 L50 72 L25 88 L33 61 L11 44 L39 42 Z" fill={C.gold} />
    </Tile>
  ),
};

/* -------------------------------------------------------------------------- */
/* Resolution                                                                 */
/* -------------------------------------------------------------------------- */

export function banglaIllustration(name: string): ReactNode | null {
  const fixed = DRAWINGS[name as SceneName];
  if (fixed) return fixed();

  const build = BUILD_PATTERN.exec(name);
  if (build) {
    return <BuildCard parts={build[1]!.split('+')} result={build[2]!} />;
  }

  const letter = LETTER_PATTERN.exec(name);
  if (letter) return <LetterCard ch={letter[1]!} />;

  return null;
}

/** Re-exported so callers need only one import to render and to check. */
export { isIllustrationName as hasBanglaIllustration };

/** Shared frame so an unrecognised name still renders something, never a gap. */
export function BanglaIllustration({ name, size = 96, className, label }: {
  name: string; size?: number; className?: string; label?: string;
}) {
  const node = banglaIllustration(name);
  const style: CSSProperties = { width: size, height: size, flexShrink: 0 };
  if (node) return <div style={style} className={className}>{node}</div>;
  return (
    <svg viewBox="0 0 100 100" style={style} className={className}
         role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <rect x="0" y="0" width="100" height="100" rx="18" fill="#eef2f7" />
      <circle cx="50" cy="50" r="28" fill="#ffffff" stroke="#c9d2dc" strokeWidth="3" />
      <text x="50" y="60" textAnchor="middle" fontSize="28" fontWeight="800" fill="#c9d2dc">?</text>
    </svg>
  );
}
