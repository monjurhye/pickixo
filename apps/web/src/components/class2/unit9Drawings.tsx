/**
 * Unit 9 illustrations: where animals and birds live, what they eat, and the
 * "Hey Diddle, Diddle" rhyme.
 *
 * Original artwork — the NCTB pictures stay in the book. Animals already drawn
 * in earlier units (dog, cat, monkey, deer, crow, parrot) are reused by
 * key rather than redrawn, so a dog looks like the same dog everywhere.
 *
 * In this unit a picture is often an *answer* ("what does a tiger eat?" is
 * answered by a picture of meat), so each food and each home has to be
 * recognisable on its own: a drumstick, a blade of grass, a kennel.
 */
import { PALETTE } from './alphabetDrawings';
import { Bg } from './unit3Drawings';

const C = PALETTE;

type Draw = (animate: boolean) => React.ReactNode;

const NIGHT = '#2c4a8a';

function Stars() {
  return (
    <>
      {[[14, 14], [40, 8], [70, 16], [88, 8], [24, 36], [86, 34]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${(y as number) - 3} l1 2 l2.2 .3 l-1.6 1.5 l.4 2.2 l-2 -1 l-2 1 l.4 -2.2 l-1.6 -1.5 l2.2 -.3 Z`} fill={C.yellow} />
      ))}
    </>
  );
}

function Moon({ x = 72, y = 24, r = 14 }: { x?: number; y?: number; r?: number }) {
  return (
    <>
      <circle cx={x} cy={y} r={r} fill="#fff3b0" />
      <circle cx={x + r * 0.45} cy={y - r * 0.2} r={r * 0.9} fill={NIGHT} />
    </>
  );
}

function Tree({ x = 50, h = 38, r = 22 }: { x?: number; h?: number; r?: number }) {
  return (
    <g>
      <rect x={x - 4.5} y={92 - h} width="9" height={h} rx="3" fill={C.brown} />
      <circle cx={x} cy={92 - h - 6} r={r} fill="#3fa050" />
      <circle cx={x - r * 0.5} cy={92 - h + 2} r={r * 0.6} fill="#3fa050" />
      <circle cx={x + r * 0.5} cy={92 - h + 2} r={r * 0.6} fill="#3fa050" />
    </g>
  );
}

export const UNIT9_DRAWINGS: Record<string, Draw> = {
  /* --- animals not yet drawn --------------------------------------------- */
  cow: () => (
    <Bg tint="#eefaea">
      <path d="M84 50 q8 4 6 16" stroke="#8a5a3a" strokeWidth="4" strokeLinecap="round" fill="none" />
      <ellipse cx="52" cy="52" rx="32" ry="20" fill={C.white} stroke="#c9d2dc" strokeWidth="2.5" />
      <path d="M36 40 q10 -6 14 4 q-2 10 -12 8 q-6 -6 -2 -12 Z M62 52 q10 -6 16 4 q-4 10 -14 6 Z" fill="#8a5a3a" />
      <rect x="28" y="66" width="7" height="22" rx="3" fill={C.white} stroke="#c9d2dc" strokeWidth="2" />
      <rect x="44" y="68" width="7" height="20" rx="3" fill={C.white} stroke="#c9d2dc" strokeWidth="2" />
      <rect x="62" y="68" width="7" height="20" rx="3" fill={C.white} stroke="#c9d2dc" strokeWidth="2" />
      <rect x="76" y="66" width="7" height="22" rx="3" fill={C.white} stroke="#c9d2dc" strokeWidth="2" />
      <path d="M50 70 q4 8 8 0" fill="#f3b8b0" stroke="#e59a90" strokeWidth="1.5" />
      <path d="M22 40 q-14 -2 -14 12 q0 12 12 12 q10 0 12 -10 Z" fill="#8a5a3a" />
      <ellipse cx="12" cy="56" rx="7" ry="5" fill="#f3c2bc" />
      <path d="M18 34 q-6 -8 -2 -14 M26 34 q4 -8 0 -14" stroke={C.ink} strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="16" cy="46" r="1.8" fill={C.ink} />
    </Bg>
  ),

  tiger: () => (
    <Bg tint="#fff1e0">
      <path d="M14 56 q4 -18 26 -18 h30 q14 0 16 14 l-6 12 h-6 v14 h-8 v-12 h-28 v12 h-8 v-14 q-14 -2 -16 -8 Z" fill="#f08a2a" />
      <path d="M16 54 q-8 -4 -8 -14" stroke="#f08a2a" strokeWidth="6" strokeLinecap="round" fill="none" />
      <circle cx="82" cy="46" r="11" fill="#f08a2a" />
      <path d="M78 36 l-2 -8 l8 4 Z" fill="#f08a2a" />
      <path d="M28 40 v14 M38 38 v16 M48 38 v14 M58 40 v12 M68 42 v10" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
      <circle cx="85" cy="43" r="1.8" fill={C.ink} /><circle cx="90" cy="50" r="2.4" fill={C.ink} />
      <path d="M8 40 q-2 -6 2 -10" stroke={C.ink} strokeWidth="3" strokeLinecap="round" fill="none" />
    </Bg>
  ),

  hen: () => (
    <Bg tint="#fff6e6">
      <ellipse cx="46" cy="62" rx="28" ry="20" fill="#b9793a" />
      <path d="M18 56 q-10 -12 -2 -22 q8 8 10 20 Z" fill="#8a5424" />
      <circle cx="74" cy="42" r="12" fill="#b9793a" />
      <path d="M70 30 q4 -6 8 0 q4 -4 6 2 q-4 4 -14 -2 Z" fill="#e02b2b" />
      <path d="M84 44 l10 3 l-10 4 Z" fill={C.orange} />
      <circle cx="77" cy="40" r="2" fill={C.ink} />
      <path d="M38 82 v8 M54 82 v8 M34 90 h8 M50 90 h8" stroke={C.orange} strokeWidth="3" strokeLinecap="round" />
      <path d="M36 60 q10 10 24 0" stroke="#8a5424" strokeWidth="3" strokeLinecap="round" fill="none" />
    </Bg>
  ),

  /* --- where they live ---------------------------------------------------- */
  kennel: () => (
    <Bg tint="#eaf3ff">
      <path d="M12 46 L50 16 L88 46 Z" fill="#a9713f" stroke="#7a4d24" strokeWidth="3" strokeLinejoin="round" />
      <rect x="20" y="46" width="60" height="42" fill="#d7a566" stroke="#7a4d24" strokeWidth="3" />
      <path d="M38 88 V64 a12 12 0 0 1 24 0 V88 Z" fill="#3a2a1e" />
      <path d="M20 58 h60 M20 70 h60" stroke="#b98a4e" strokeWidth="2" />
    </Bg>
  ),

  cowshed: () => (
    <Bg tint="#eefaea">
      <path d="M6 42 L50 14 L94 42 Z" fill="#d9b86a" stroke="#a9873a" strokeWidth="3" strokeLinejoin="round" />
      <path d="M16 38 l-4 6 M28 32 l-4 8 M40 26 l-3 10 M52 24 l-1 12 M64 28 l2 10 M76 32 l4 8 M86 38 l4 6" stroke="#a9873a" strokeWidth="2" strokeLinecap="round" />
      <rect x="12" y="42" width="6" height="46" fill={C.brown} /><rect x="82" y="42" width="6" height="46" fill={C.brown} />
      <rect x="6" y="86" width="88" height="8" rx="3" fill="#7cc36a" />
    </Bg>
  ),

  tree: () => <Bg tint="#eaf7ff"><Tree /></Bg>,

  lair: () => (
    <Bg tint="#eef2f7">
      <path d="M6 84 q0 -50 44 -54 q44 4 44 54 Z" fill="#8c98a8" stroke="#6b7684" strokeWidth="3" strokeLinejoin="round" />
      <path d="M26 84 q0 -28 24 -30 q24 2 24 30 Z" fill="#2b3036" />
      <ellipse cx="14" cy="88" rx="10" ry="5" fill="#7a8696" /><ellipse cx="88" cy="88" rx="10" ry="5" fill="#7a8696" />
      <circle cx="44" cy="70" r="2.2" fill="#ffd60a" /><circle cx="56" cy="70" r="2.2" fill="#ffd60a" />
    </Bg>
  ),

  forest: () => (
    <Bg tint="#e6f4e6">
      <Tree x={22} h={34} r={16} /><Tree x={78} h={34} r={16} /><Tree x={50} h={46} r={20} />
      <rect x="0" y="88" width="100" height="12" fill="#5aa84a" />
    </Bg>
  ),

  'tree-hole': () => (
    <Bg tint="#eaf7ff">
      <path d="M36 92 q-2 -30 -6 -50 q-6 -8 -4 -16 h48 q2 8 -4 16 q-4 20 -6 50 Z" fill={C.brown} />
      <ellipse cx="50" cy="52" rx="9" ry="12" fill="#2b1d12" />
      <circle cx="50" cy="20" r="18" fill="#3fa050" /><circle cx="28" cy="28" r="12" fill="#3fa050" /><circle cx="72" cy="28" r="12" fill="#3fa050" />
    </Bg>
  ),

  /* --- what they eat ------------------------------------------------------ */
  meat: () => (
    <Bg tint="#fff0f0">
      <path d="M22 62 C14 40 34 20 56 26 C76 32 78 54 62 62 C50 68 34 74 22 62 Z" fill="#b5502e" stroke="#7a2f14" strokeWidth="3" />
      <path d="M62 62 L82 78" stroke="#f3e6d0" strokeWidth="7" strokeLinecap="round" />
      <circle cx="86" cy="82" r="5" fill="#f3e6d0" /><circle cx="80" cy="86" r="4" fill="#f3e6d0" />
      <path d="M34 34 q8 -4 14 2" stroke="#d98a66" strokeWidth="4" strokeLinecap="round" fill="none" />
    </Bg>
  ),

  grass: () => (
    <Bg tint="#eefaea">
      {[14, 28, 42, 56, 70, 84].map((x, i) => (
        <path key={x} d={`M${x} 90 q${i % 2 ? -8 : 8} -34 ${i % 2 ? -4 : 4} -60 q6 24 ${i % 2 ? 6 : -6} 60 Z`} fill={i % 2 ? '#3fa050' : '#56b862'} />
      ))}
    </Bg>
  ),

  fruits: () => (
    <Bg tint="#fffbe0">
      <path d="M12 40 q6 44 56 42 q-2 -10 -16 -14 q-20 -6 -22 -28 Z" fill={C.yellow} stroke={C.orange} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="72" cy="40" r="16" fill={C.red} />
      <path d="M72 26 q0 -8 6 -12" stroke={C.brown} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M74 22 q8 -6 14 -2 q-4 8 -14 2 Z" fill={C.green} />
    </Bg>
  ),

  nuts: () => (
    <Bg tint="#fff4e3">
      <path d="M14 46 q0 -14 14 -14 q8 0 12 6 q4 -6 12 -6 q14 0 14 14 q0 14 -14 14 q-8 0 -12 -6 q-4 6 -12 6 q-14 0 -14 -14 Z" fill="#d6a565" stroke="#a9713f" strokeWidth="3" strokeLinejoin="round" transform="rotate(-18 50 46)" />
      <ellipse cx="64" cy="76" rx="14" ry="10" fill="#a9713f" stroke="#7a4d24" strokeWidth="3" />
      <path d="M54 74 q10 -8 20 0" stroke="#d6a565" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </Bg>
  ),

  grains: () => (
    <Bg tint="#fff8e0">
      <path d="M12 52 h76 q-4 32 -38 34 q-34 -2 -38 -34 Z" fill="#e8dcc6" stroke={C.grey} strokeWidth="3" strokeLinejoin="round" />
      <path d="M14 52 q36 -26 72 0 Z" fill={C.white} />
      {[[36, 46], [48, 42], [60, 46], [42, 50], [54, 50], [70, 48], [28, 50]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="4" ry="1.8" fill="#f3eee2" stroke="#d6cdb8" strokeWidth="1" />
      ))}
    </Bg>
  ),

  insects: () => (
    <Bg tint="#eefaea">
      <ellipse cx="46" cy="58" rx="24" ry="9" fill="#5cb85c" />
      <circle cx="72" cy="50" r="8" fill="#5cb85c" />
      <circle cx="75" cy="48" r="1.8" fill={C.ink} />
      <path d="M72 44 q10 -14 22 -12 M74 42 q8 -18 20 -20" stroke={C.ink} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M34 62 l-10 22 l-8 -2 M50 64 l-6 22 h-8" stroke="#3f9e4d" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M40 52 q6 -22 20 -10 Z" fill="#8ed48e" />
    </Bg>
  ),

  /* --- the rhyme ---------------------------------------------------------- */
  fiddle: () => (
    <Bg tint="#fff4e3">
      <path d="M44 30 q-16 4 -12 18 q-8 8 -2 20 q10 14 24 4 q14 -4 8 -20 q6 -14 -8 -20 q-4 -4 -10 -2 Z" fill="#c9702f" stroke="#7a4d24" strokeWidth="3" strokeLinejoin="round" />
      <rect x="47" y="8" width="6" height="26" rx="2" fill="#5c3418" />
      <path d="M50 34 V70" stroke={C.grey} strokeWidth="1.6" />
      <path d="M40 46 q4 4 0 8 M60 46 q-4 4 0 8" stroke="#3a2a1e" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M78 22 L92 84" stroke={C.ink} strokeWidth="2.5" strokeLinecap="round" />
    </Bg>
  ),

  moon: () => (
    <Bg tint={NIGHT}>
      <Stars /><Moon x={50} y={50} r={24} />
    </Bg>
  ),

  dish: () => (
    <Bg tint="#eef2f7">
      <ellipse cx="50" cy="58" rx="38" ry="18" fill={C.white} stroke={C.grey} strokeWidth="3" />
      <ellipse cx="50" cy="56" rx="24" ry="10" fill="#eaf0f6" stroke={C.grey} strokeWidth="2" />
    </Bg>
  ),

  spoon: () => (
    <Bg tint="#eef2f7">
      <ellipse cx="50" cy="28" rx="15" ry="20" fill="#d3dae2" stroke="#9aa7b4" strokeWidth="3" />
      <path d="M46 46 L44 90 Q50 96 56 90 L54 46 Z" fill="#d3dae2" stroke="#9aa7b4" strokeWidth="3" strokeLinejoin="round" />
    </Bg>
  ),

  'rhyme-cat': () => (
    <Bg tint={NIGHT}>
      <Stars />
      <path d="M74 88 q18 -6 12 -26" stroke="#f08a2a" strokeWidth="7" strokeLinecap="round" fill="none" />
      <ellipse cx="46" cy="72" rx="20" ry="18" fill="#f08a2a" />
      <circle cx="46" cy="44" r="15" fill="#f08a2a" />
      <path d="M33 34 l-2 -14 l12 8 Z M59 34 l2 -14 l-12 8 Z" fill="#f08a2a" />
      <path d="M40 42 q3 -3 6 0 M50 42 q3 -3 6 0" stroke={C.ink} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M43 50 q5 4 10 0" stroke={C.ink} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M34 66 q10 -8 30 -4 l-2 14 q-14 2 -26 -2 Z" fill="#c9702f" stroke="#7a4d24" strokeWidth="2" />
      <path d="M22 56 L82 82" stroke={C.white} strokeWidth="2" strokeLinecap="round" />
    </Bg>
  ),

  'rhyme-cow': (animate) => (
    <Bg tint={NIGHT}>
      <Stars /><Moon x={62} y={62} r={17} />
      <g className={animate ? 'c2-bounce' : undefined}>
        <ellipse cx="42" cy="26" rx="20" ry="11" fill={C.white} />
        <circle cx="66" cy="20" r="8" fill={C.white} />
        <path d="M62 14 l-2 -6 M70 14 l2 -6" stroke={C.brown} strokeWidth="2.5" strokeLinecap="round" />
        <ellipse cx="38" cy="24" rx="6" ry="4" fill={C.ink} /><ellipse cx="50" cy="30" rx="4" ry="3" fill={C.ink} />
        <path d="M28 34 l-6 12 M36 36 l-2 12 M50 36 l4 10 M56 32 l10 8" stroke={C.white} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M22 24 q-8 4 -6 12" stroke={C.white} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </g>
    </Bg>
  ),

  'rhyme-dog': () => (
    <Bg tint={NIGHT}>
      <Stars />
      <path d="M0 84 q30 -12 100 0 V100 H0 Z" fill="#3b5fa8" />
      <ellipse cx="50" cy="70" rx="26" ry="14" fill="#c9924f" transform="rotate(-12 50 70)" />
      <circle cx="72" cy="58" r="13" fill="#c9924f" />
      <path d="M66 46 q-8 -6 -10 6 q4 6 10 2 Z" fill="#8a5a28" />
      <path d="M68 55 q3 -3 6 0 M77 56 q3 -3 6 0" stroke={C.ink} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M70 62 q7 10 14 0 Z" fill="#8a1f2a" />
      <path d="M26 60 l-10 -8 M28 74 l-8 6 M44 84 l-2 8 M58 82 l4 8" stroke="#c9924f" strokeWidth="5" strokeLinecap="round" />
    </Bg>
  ),

  'rhyme-dish': () => (
    <Bg tint={NIGHT}>
      <Stars />
      <path d="M0 86 q40 -14 100 0 V100 H0 Z" fill="#3b5fa8" />
      <ellipse cx="34" cy="54" rx="16" ry="20" fill={C.white} stroke={C.grey} strokeWidth="2.5" />
      <ellipse cx="34" cy="54" rx="9" ry="12" fill="#eaf0f6" />
      <circle cx="30" cy="48" r="1.8" fill={C.ink} /><circle cx="38" cy="48" r="1.8" fill={C.ink} />
      <path d="M30 58 q4 4 8 0" stroke={C.ink} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M28 72 l-4 14 M40 72 l6 12" stroke={C.white} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="68" cy="44" rx="7" ry="10" fill="#d3dae2" stroke="#9aa7b4" strokeWidth="2" />
      <path d="M66 52 L64 74 Q68 78 72 74 L70 52 Z" fill="#d3dae2" stroke="#9aa7b4" strokeWidth="2" />
      <path d="M62 78 l-6 8 M72 78 l6 8" stroke="#d3dae2" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 60 h6 M50 68 h4" stroke={C.white} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    </Bg>
  ),
};
