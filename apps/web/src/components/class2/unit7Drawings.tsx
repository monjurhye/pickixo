/**
 * Unit 7 illustrations: colours, shapes, sizes and road signs.
 *
 * Original artwork — the NCTB pictures stay in the book. Two rules matter more
 * here than in any other unit, because the picture *is* the fact being taught:
 *
 *   * A colour swatch must be exactly the colour it names, so every swatch is
 *     generated from one table (`COLOURS`) that the content file never sees.
 *   * Mr. Shape is built from real circles, squares, triangles and rectangles
 *     in a fixed layout, so "how many circles does he have?" has one answer
 *     that is true of the picture: 5 circles (face, two eyes, two hands),
 *     1 square (body), 3 triangles (nose and two feet), 4 rectangles (two arms,
 *     two legs).
 *
 * Road signs are simplified to the symbol a child needs to recognise, and are
 * drawn as the real sign types (red-bordered triangle = warning, red-bordered
 * circle = prohibition, blue circle = instruction).
 */
import { PALETTE } from './alphabetDrawings';
import { Bg, Person } from './unit3Drawings';

const C = PALETTE;

type Draw = (animate: boolean) => React.ReactNode;

/* -------------------------------------------------------------------------- */
/* Colours                                                                    */
/* -------------------------------------------------------------------------- */

/** The seven colours of Lesson 1, in the order the rainbow rhyme says them. */
export const COLOURS: Record<string, string> = {
  red: '#ef2b2b',
  orange: '#f47a20',
  yellow: '#ffd60a',
  green: '#1fa64a',
  blue: '#2f7fd8',
  violet: '#9b51c9',
  indigo: '#3f3fa0',
};

const colourDrawings: Record<string, Draw> = {};
Object.entries(COLOURS).forEach(([name, hex]) => {
  colourDrawings[`colour-${name}`] = () => (
    <Bg tint="#ffffff">
      <circle cx="50" cy="50" r="32" fill={hex} stroke="#00000022" strokeWidth="2" />
    </Bg>
  );
});

/* -------------------------------------------------------------------------- */
/* Mr. Shape                                                                  */
/* -------------------------------------------------------------------------- */

type Part = 'face' | 'body' | 'arms' | 'legs' | 'hands' | 'feet';

function MrShape({ hl, s = 1 }: { hl?: Part; s?: number }) {
  const fill = (part: Part, colour: string) => (hl === part ? colour : C.white);
  const stroke = (part: Part) => (hl && hl !== part ? C.grey : C.ink);
  return (
    <g transform={`translate(${50 - 50 * s} ${50 - 50 * s}) scale(${s})`}>
      {/* legs: rectangles */}
      <rect x="40" y="58" width="6" height="22" fill={fill('legs', C.blue)} stroke={stroke('legs')} strokeWidth="1.6" />
      <rect x="54" y="58" width="6" height="22" fill={fill('legs', C.blue)} stroke={stroke('legs')} strokeWidth="1.6" />
      {/* feet: triangles */}
      <path d="M46 80 L46 85 L32 85 Z" fill={fill('feet', C.green)} stroke={stroke('feet')} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M54 80 L54 85 L68 85 Z" fill={fill('feet', C.green)} stroke={stroke('feet')} strokeWidth="1.6" strokeLinejoin="round" />
      {/* arms: rectangles */}
      <rect x="28" y="30" width="6" height="24" fill={fill('arms', C.orange)} stroke={stroke('arms')} strokeWidth="1.6" />
      <rect x="66" y="30" width="6" height="24" fill={fill('arms', C.orange)} stroke={stroke('arms')} strokeWidth="1.6" />
      {/* hands: circles */}
      <circle cx="31" cy="58" r="3.6" fill={fill('hands', C.red)} stroke={stroke('hands')} strokeWidth="1.6" />
      <circle cx="69" cy="58" r="3.6" fill={fill('hands', C.red)} stroke={stroke('hands')} strokeWidth="1.6" />
      {/* body: square */}
      <rect x="36" y="30" width="28" height="28" fill={fill('body', C.purple)} stroke={stroke('body')} strokeWidth="1.6" />
      {/* face: circle, two round eyes, a triangle nose, a smile */}
      <circle cx="50" cy="17" r="12" fill={fill('face', C.yellow)} stroke={stroke('face')} strokeWidth="1.6" />
      <circle cx="45.5" cy="14" r="2" fill={C.white} stroke={C.ink} strokeWidth="1.2" />
      <circle cx="54.5" cy="14" r="2" fill={C.white} stroke={C.ink} strokeWidth="1.2" />
      <path d="M50 16 L47.6 20.4 L52.4 20.4 Z" fill={C.white} stroke={C.ink} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M44.5 23 q5.5 4.5 11 0" fill="none" stroke={C.ink} strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/* Sizes                                                                      */
/* -------------------------------------------------------------------------- */

function Tree({ h, x = 50 }: { h: number; x?: number }) {
  return (
    <g>
      <rect x={x - 4} y={90 - h} width="8" height={h} rx="3" fill={C.brown} />
      <circle cx={x} cy={90 - h - 4} r={12 + h / 9} fill={C.green} />
    </g>
  );
}

function DogShape({ fat }: { fat: boolean }) {
  const ry = fat ? 20 : 9;
  return (
    <g>
      <ellipse cx="46" cy={64 - (fat ? 0 : 2)} rx={fat ? 30 : 26} ry={ry} fill="#e58a4f" />
      <rect x="24" y="72" width="6" height="16" rx="3" fill="#c9702f" />
      <rect x="58" y="72" width="6" height="16" rx="3" fill="#c9702f" />
      <circle cx="80" cy="50" r="10" fill="#e58a4f" />
      <path d="M76 42 q-6 -6 -8 4 q4 6 8 2 Z" fill="#c9702f" />
      <circle cx="83" cy="48" r="1.8" fill={C.ink} />
      <circle cx="89" cy="52" r="2.4" fill={C.ink} />
      <path d="M18 60 q-10 -8 -8 -16" stroke="#e58a4f" strokeWidth="5" strokeLinecap="round" fill="none" />
    </g>
  );
}

function Cow({ fat }: { fat: boolean }) {
  const rx = fat ? 28 : 15;
  return (
    <g>
      <ellipse cx="50" cy="58" rx={rx} ry={fat ? 22 : 20} fill="#e69a92" />
      <rect x={50 - rx + 4} y="72" width="6" height="18" rx="3" fill="#c97f77" />
      <rect x={50 + rx - 10} y="72" width="6" height="18" rx="3" fill="#c97f77" />
      <ellipse cx="50" cy="30" rx={fat ? 14 : 9} ry="12" fill="#e69a92" />
      <path d={`M${50 - (fat ? 14 : 9)} 22 q-8 -6 -4 -12 M${50 + (fat ? 14 : 9)} 22 q8 -6 4 -12`} stroke={C.ink} strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="50" cy="36" rx={fat ? 8 : 6} ry="5" fill="#f3c2bc" />
      <circle cx={fat ? 44 : 46} cy="28" r="1.6" fill={C.ink} /><circle cx={fat ? 56 : 54} cy="28" r="1.6" fill={C.ink} />
    </g>
  );
}

function PotShape({ w }: { w: number }) {
  return (
    <g>
      <path d={`M${50 - w} 40 h${2 * w} q${w * 0.35} ${w * 0.9} -${w * 0.2} ${w * 1.7} q-${w * 0.6} 10 -${w * 1.6} 0 q-${w * 0.55} -${w * 0.8} -${w * 0.2} -${w * 1.7} Z`} fill="#e58a5b" />
      <rect x={50 - w * 0.7} y={36} width={w * 1.4} height="8" rx="4" fill="#f0a072" />
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/* Road signs                                                                 */
/* -------------------------------------------------------------------------- */

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <Bg tint="#f3f5f8">
      <path d="M50 12 L90 80 H10 Z" fill={C.white} stroke="#e02b2b" strokeWidth="7" strokeLinejoin="round" />
      {children}
    </Bg>
  );
}

function Prohibit({ children, slash = false }: { children?: React.ReactNode; slash?: boolean }) {
  return (
    <Bg tint="#f3f5f8">
      <circle cx="50" cy="50" r="35" fill={C.white} stroke="#e02b2b" strokeWidth="8" />
      {children}
      {slash ? <path d="M26 74 L74 26" stroke="#e02b2b" strokeWidth="8" strokeLinecap="round" /> : null}
    </Bg>
  );
}

function Light({ on }: { on: 'red' | 'yellow' | 'green' }) {
  const dim = '#4a5058';
  return (
    <Bg tint="#eaf0f6">
      <rect x="32" y="8" width="36" height="84" rx="10" fill="#2b3036" />
      <circle cx="50" cy="26" r="9.5" fill={on === 'red' ? '#ef2b2b' : dim} />
      <circle cx="50" cy="50" r="9.5" fill={on === 'yellow' ? '#ffd60a' : dim} />
      <circle cx="50" cy="74" r="9.5" fill={on === 'green' ? '#1fa64a' : dim} />
    </Bg>
  );
}

/* -------------------------------------------------------------------------- */

export const UNIT7_DRAWINGS: Record<string, Draw> = {
  ...colourDrawings,

  /* --- Lesson 1: things with a colour ------------------------------------ */
  rose: () => (
    <Bg tint="#fff1ee">
      <path d="M50 52 V90" stroke={C.leaf} strokeWidth="4" strokeLinecap="round" />
      <path d="M50 76 q-16 -2 -18 -14 q14 0 18 14 Z" fill={C.green} />
      <circle cx="50" cy="36" r="20" fill="#e02b2b" />
      <path d="M40 34 q10 -12 20 0 q-8 10 -16 4 q-2 -8 8 -8" stroke="#a51616" strokeWidth="3" strokeLinecap="round" fill="none" />
    </Bg>
  ),
  parrot: () => (
    <Bg tint="#eefbf3">
      <path d="M8 74 H92" stroke={C.brown} strokeWidth="5" strokeLinecap="round" />
      <path d="M52 14 C74 16 78 44 66 64 L50 70 C42 52 40 30 52 14 Z" fill="#2fb14f" />
      <circle cx="52" cy="26" r="11" fill="#2fb14f" />
      <circle cx="49" cy="24" r="2.4" fill={C.ink} />
      <path d="M42 28 q-8 2 -8 10 q8 0 10 -6 Z" fill="#e02b2b" />
      <path d="M64 60 q12 12 8 26 q-10 -8 -14 -24 Z" fill="#1c7f36" />
    </Bg>
  ),
  sky: () => (
    <Bg tint="#bfe0ff">
      <path d="M22 66 a14 14 0 0 1 8 -24 a18 18 0 0 1 34 -4 a14 14 0 0 1 14 28 Z" fill={C.white} />
      <path d="M0 100 V88 q50 -8 100 0 V100 Z" fill="#2f7fd8" opacity="0.35" />
    </Bg>
  ),
  balloon: () => (
    <Bg tint="#f6eeff">
      <path d="M50 12 C72 12 78 36 66 54 C60 62 56 64 50 66 C44 64 40 62 34 54 C22 36 28 12 50 12 Z" fill="#9b51c9" />
      <path d="M46 66 l4 6 l4 -6 Z" fill="#7a3ea6" />
      <path d="M50 72 q-8 8 0 14 q6 4 0 10" stroke={C.grey} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M38 28 q4 -8 12 -8" stroke="#d3a6ee" strokeWidth="4" strokeLinecap="round" fill="none" />
    </Bg>
  ),
  kite: () => (
    <Bg tint="#eaf3ff">
      <path d="M50 8 L78 36 L50 66 L22 36 Z" fill="#3f3fa0" stroke="#2b2b7a" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M50 8 V66 M22 36 H78" stroke="#6a6ad0" strokeWidth="2" />
      <path d="M50 66 q-10 10 0 18 q10 6 0 14" stroke={C.grey} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M46 78 l-6 4 l6 2 Z M54 88 l6 4 l-6 2 Z" fill={C.red} />
    </Bg>
  ),

  /* --- Lesson 2: the rainbow --------------------------------------------- */
  rainbow: () => (
    <Bg tint="#e6f4ff">
      {Object.values(COLOURS).map((hex, i) => (
        <path key={hex} d={`M${8 + i * 4.6} 78 a${42 - i * 4.6} ${42 - i * 4.6} 0 0 1 ${84 - i * 9.2} 0`}
              fill="none" stroke={hex} strokeWidth="4.8" />
      ))}
      <path d="M4 82 a8 8 0 0 1 4 -14 a10 10 0 0 1 18 2 a7 7 0 0 1 2 12 Z" fill={C.white} />
      <path d="M96 82 a8 8 0 0 0 -4 -14 a10 10 0 0 0 -18 2 a7 7 0 0 0 -2 12 Z" fill={C.white} />
    </Bg>
  ),

  /* --- Lessons 3 and 4: shapes -------------------------------------------- */
  'shape-circle': () => <Bg tint="#fff1ee"><circle cx="50" cy="50" r="32" fill="#ef2b2b" /></Bg>,
  'shape-square': () => <Bg tint="#eef3fb"><rect x="20" y="20" width="60" height="60" fill="#4d7fc2" /></Bg>,
  'shape-triangle': () => <Bg tint="#eefaf1"><path d="M50 14 L88 82 H12 Z" fill="#1fa64a" strokeLinejoin="round" /></Bg>,
  'shape-rectangle': () => <Bg tint="#fff4ea"><rect x="8" y="28" width="84" height="44" fill="#f47a20" /></Bg>,

  'grand-clock': () => (
    <Bg tint="#f3f5f8">
      <rect x="26" y="8" width="48" height="46" fill="#4d7fc2" />
      <circle cx="50" cy="31" r="18" fill="#ef2b2b" stroke={C.white} strokeWidth="1.5" />
      <path d="M50 31 L40 22 M50 31 L58 40" stroke={C.white} strokeWidth="2.4" strokeLinecap="round" />
      <rect x="32" y="54" width="36" height="38" fill="#f47a20" />
      <path d="M50 58 V78 M42 74 L50 88 L58 74 Z" stroke="#1fa64a" strokeWidth="5" strokeLinejoin="round" fill="#1fa64a" />
    </Bg>
  ),

  'mr-shape': () => <Bg tint="#f3f5f8"><MrShape /></Bg>,
  'part-face': () => <Bg tint="#f3f5f8"><MrShape hl="face" /></Bg>,
  'part-body': () => <Bg tint="#f3f5f8"><MrShape hl="body" /></Bg>,
  'part-arms': () => <Bg tint="#f3f5f8"><MrShape hl="arms" /></Bg>,
  'part-legs': () => <Bg tint="#f3f5f8"><MrShape hl="legs" /></Bg>,
  'part-hands': () => <Bg tint="#f3f5f8"><MrShape hl="hands" /></Bg>,
  'part-feet': () => <Bg tint="#f3f5f8"><MrShape hl="feet" /></Bg>,

  /* --- Lesson 5: sizes ---------------------------------------------------- */
  'size-tall': () => <Bg tint="#eaf7ff"><Tree h={70} /></Bg>,
  'size-short': () => <Bg tint="#eaf7ff"><Tree h={26} /></Bg>,
  'size-big': () => (
    <Bg tint="#eef2f7">
      <ellipse cx="46" cy="52" rx="30" ry="22" fill="#8c98a8" />
      <rect x="22" y="64" width="9" height="24" rx="4" fill="#7a8696" /><rect x="52" y="64" width="9" height="24" rx="4" fill="#7a8696" />
      <circle cx="76" cy="40" r="14" fill="#8c98a8" />
      <path d="M86 44 q10 6 6 26 q-2 6 -6 2 q0 -12 -6 -20 Z" fill="#7a8696" />
      <ellipse cx="66" cy="40" rx="8" ry="12" fill="#a4afbd" />
      <circle cx="80" cy="36" r="1.8" fill={C.ink} />
    </Bg>
  ),
  'size-small': () => (
    <Bg tint="#eef2f7">
      <ellipse cx="46" cy="70" rx="14" ry="9" fill="#9aa3ae" />
      <circle cx="62" cy="66" r="7" fill="#9aa3ae" />
      <circle cx="58" cy="58" r="4" fill="#b5bdc7" />
      <circle cx="65" cy="65" r="1.4" fill={C.ink} />
      <path d="M32 72 q-14 6 -12 -6 q6 -6 12 4" stroke="#b5a0a0" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </Bg>
  ),
  'size-fat': () => <Bg tint="#fff1e6"><DogShape fat /></Bg>,
  'size-thin': () => <Bg tint="#fff1e6"><DogShape fat={false} /></Bg>,

  'man-tall': () => (
    <Bg tint="#eaf3ff"><g transform="translate(0 -6)"><Person shirt={C.green} /></g></Bg>
  ),
  'man-short': () => (
    <Bg tint="#eaf3ff"><g transform="translate(20 34) scale(0.6)"><Person shirt={C.green} /></g></Bg>
  ),
  'pot-big': () => <Bg tint="#fff4e3"><g transform="translate(0 -6) scale(1 1.15)"><PotShape w={34} /></g></Bg>,
  'pot-small': () => <Bg tint="#fff4e3"><g transform="translate(14 20) scale(0.55)"><PotShape w={34} /></g></Bg>,
  'cow-fat': () => <Bg tint="#f3fbef"><Cow fat /></Bg>,
  'cow-thin': () => <Bg tint="#f3fbef"><Cow fat={false} /></Bg>,

  /* --- Lesson 6: road signs ----------------------------------------------- */
  'light-red': () => <Light on="red" />,
  'light-yellow': () => <Light on="yellow" />,
  'light-green': () => <Light on="green" />,

  'traffic-light': () => (
    <Bg tint="#eaf3ff">
      <path d="M50 8 L92 50 L50 92 L8 50 Z" fill="#ffd60a" stroke="#2b3036" strokeWidth="4" strokeLinejoin="round" />
      <rect x="38" y="24" width="24" height="52" rx="8" fill="#2b3036" />
      <circle cx="50" cy="36" r="6" fill="#ef2b2b" /><circle cx="50" cy="50" r="6" fill="#ffd60a" /><circle cx="50" cy="64" r="6" fill="#1fa64a" />
    </Bg>
  ),

  'road-signal-ahead': () => (
    <Warning>
      <rect x="43" y="38" width="14" height="30" rx="4" fill="#2b3036" />
      <circle cx="50" cy="45" r="3" fill="#ef2b2b" /><circle cx="50" cy="53" r="3" fill="#ffd60a" /><circle cx="50" cy="61" r="3" fill="#1fa64a" />
    </Warning>
  ),
  'road-no-horn': () => (
    <Prohibit slash>
      <path d="M32 44 h10 l14 -8 v28 l-14 -8 h-10 Z" fill="#2b3036" />
      <path d="M60 42 q6 8 0 16" stroke="#2b3036" strokeWidth="3" strokeLinecap="round" fill="none" />
    </Prohibit>
  ),
  'road-do-not-enter': () => (
    <Bg tint="#f3f5f8">
      <circle cx="50" cy="50" r="38" fill="#e02b2b" />
      <rect x="24" y="43" width="52" height="14" rx="2" fill={C.white} />
    </Bg>
  ),
  'road-school-ahead': () => (
    <Warning>
      <circle cx="41" cy="44" r="4" fill="#2b3036" /><path d="M41 49 v14 l-5 8 M41 63 l5 8 M41 52 l-6 6" stroke="#2b3036" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="58" cy="48" r="3.4" fill="#2b3036" /><path d="M58 52 v11 l-4 7 M58 63 l4 7 M58 55 l5 5" stroke="#2b3036" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </Warning>
  ),
  'road-u-turn': () => (
    <Warning>
      <path d="M40 72 V48 a11 11 0 0 1 22 0 V60 M54 54 l8 8 l8 -8" stroke="#2b3036" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Warning>
  ),
  'road-no-u-turn': () => (
    <Prohibit slash>
      <path d="M38 66 V46 a12 12 0 0 1 24 0 V58 M55 52 l7 7 l7 -7" stroke="#2b3036" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Prohibit>
  ),
  'road-no-parking': () => (
    <Bg tint="#f3f5f8">
      <circle cx="50" cy="50" r="38" fill="#2f6fc0" stroke="#e02b2b" strokeWidth="7" />
      <path d="M26 74 L74 26" stroke="#e02b2b" strokeWidth="8" strokeLinecap="round" />
    </Bg>
  ),
  'road-turn': () => (
    <Bg tint="#f3f5f8">
      <circle cx="28" cy="50" r="22" fill="#2f6fc0" /><circle cx="72" cy="50" r="22" fill="#2f6fc0" />
      <path d="M20 62 V44 a8 8 0 0 1 8 -8 h8 M32 30 l6 6 l-6 6" stroke={C.white} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M80 62 V44 a8 8 0 0 0 -8 -8 h-8 M68 30 l-6 6 l6 6" stroke={C.white} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Bg>
  ),
  'road-zebra-crossing': () => (
    <Warning>
      <circle cx="52" cy="40" r="4" fill="#2b3036" /><path d="M52 45 v12 l-6 9 M52 57 l6 9 M52 48 l7 4 M52 48 l-6 5" stroke="#2b3036" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M26 74 h48 M22 70 h56" stroke="#2b3036" strokeWidth="3" strokeDasharray="6 4" />
    </Warning>
  ),
};
