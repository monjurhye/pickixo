/**
 * Unit 3 illustrations: classroom commands, instructions and requests.
 *
 * Original artwork, like the rest of the set — the NCTB pictures stay in the
 * book. Same house style as Illustration.tsx: flat fills, no gradients, round
 * joins, a thick stroke that survives being shrunk to a thumbnail.
 *
 * Commands are actions, so most of these are one child doing one thing. The
 * test for each is the same as for the alphabet words: could a seven-year-old
 * say the command from the picture alone? That is why every pose changes only
 * the one part of the body the command is about.
 */
import { PALETTE } from './alphabetDrawings';

const C = PALETTE;

type Draw = (animate: boolean) => React.ReactNode;

function Bg({ tint, children }: { tint: string; children: React.ReactNode }) {
  return (
    <>
      <rect x="0" y="0" width="100" height="100" rx="18" fill={tint} />
      {children}
    </>
  );
}

const HAIR = '#2f2a28';

/**
 * One child, drawn from the front. Only the arms, the legs and the mouth
 * vary, so a set of these reads as the same child doing different things.
 */
function Person({
  shirt = C.red, armL = 'M38 54 q-8 8 -8 20', armR = 'M62 54 q8 8 8 20',
  sit = false, mouth = 'smile', dx = 0, dy = 0, armClass,
}: {
  shirt?: string; armL?: string; armR?: string; sit?: boolean;
  mouth?: 'smile' | 'flat'; dx?: number; dy?: number; armClass?: string;
}) {
  return (
    <g transform={`translate(${dx} ${dy})`}>
      {sit ? (
        <>
          <rect x="39" y="76" width="7" height="12" rx="3.5" fill={C.deep} />
          <rect x="54" y="76" width="7" height="12" rx="3.5" fill={C.deep} />
        </>
      ) : (
        <>
          <rect x="40" y="74" width="7" height="20" rx="3.5" fill={C.deep} />
          <rect x="53" y="74" width="7" height="20" rx="3.5" fill={C.deep} />
        </>
      )}
      <path d="M36 48 q14 -6 28 0 l3 28 q-17 6 -34 0 Z" fill={shirt} />
      <path d={armL} stroke={C.skin} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d={armR} stroke={C.skin} strokeWidth="6" strokeLinecap="round" fill="none"
            className={armClass} />
      <circle cx="50" cy="32" r="15" fill={C.skin} />
      <path d="M35 30 q2 -16 15 -16 q13 0 15 16 q-7 -6 -15 -6 q-8 0 -15 6 Z" fill={HAIR} />
      <circle cx="44" cy="34" r="2.2" fill={C.ink} />
      <circle cx="56" cy="34" r="2.2" fill={C.ink} />
      {mouth === 'smile' ? (
        <path d="M45 40 q5 5 10 0" stroke={C.ink} strokeWidth="2.2"
              strokeLinecap="round" fill="none" />
      ) : (
        <path d="M46 41 h8" stroke={C.ink} strokeWidth="2.2" strokeLinecap="round" />
      )}
    </g>
  );
}

function Chair({ x = 0 }: { x?: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <rect x="30" y="46" width="6" height="34" rx="3" fill={C.wood} />
      <rect x="28" y="76" width="44" height="7" rx="3" fill={C.wood} />
      <rect x="32" y="82" width="5" height="12" rx="2.5" fill={C.brown} />
      <rect x="63" y="82" width="5" height="12" rx="2.5" fill={C.brown} />
    </g>
  );
}

/** A speech bubble with a short word in it — used by the polite phrases. */
function Bubble({ tint, edge, word, size = 15 }: {
  tint: string; edge: string; word: string; size?: number;
}) {
  return (
    <Bg tint={tint}>
      <path d="M14 22 h72 a8 8 0 0 1 8 8 v30 a8 8 0 0 1 -8 8 h-40 l-14 14 v-14 h-18
               a8 8 0 0 1 -8 -8 v-30 a8 8 0 0 1 8 -8 Z"
            fill={C.white} stroke={edge} strokeWidth="3" strokeLinejoin="round" />
      <text x="50" y="52" textAnchor="middle" fontSize={size} fontWeight="800"
            fill={edge}>{word}</text>
    </Bg>
  );
}

/** A public sign: a coloured panel with a white keyline, as on a real one. */
function Sign({ panel, children }: { panel: string; children: React.ReactNode }) {
  return (
    <Bg tint="#f3f5f8">
      <rect x="14" y="12" width="72" height="76" rx="12" fill={panel} />
      <rect x="18" y="16" width="64" height="68" rx="9" fill="none"
            stroke={C.white} strokeWidth="2" opacity="0.85" />
      {children}
    </Bg>
  );
}

export const UNIT3_DRAWINGS: Record<string, Draw> = {
  /* --- Lesson 1: classroom commands ------------------------------------- */
  'raise-hand': (animate) => (
    <Bg tint="#eaf3ff">
      <Person shirt={C.blue} armR="M62 52 q12 -8 10 -30" armClass={animate ? 'c2-wave-hand' : undefined} />
      <circle cx="72" cy="20" r="5" fill={C.skin} />
    </Bg>
  ),

  'sit-down': () => (
    <Bg tint="#fff4e3">
      <Chair />
      <Person shirt={C.green} sit dy={4} />
      <path d="M86 26 v22 m-7 -7 l7 7 l7 -7" stroke={C.orange} strokeWidth="4"
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Bg>
  ),

  'stand-up': () => (
    <Bg tint="#eefbf3">
      <Chair x={-16} />
      <Person shirt={C.purple} dx={4} />
      <path d="M88 48 v-22 m-7 7 l7 -7 l7 7" stroke={C.green} strokeWidth="4"
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Bg>
  ),

  'clean-board': () => (
    <Bg tint="#eef7ee">
      <rect x="10" y="14" width="80" height="52" rx="6" fill={C.wood} />
      <rect x="14" y="18" width="72" height="44" rx="4" fill="#3f7d5a" />
      <path d="M22 30 q6 -8 12 0 t12 0 M22 44 h20" stroke={C.white} strokeWidth="3"
            strokeLinecap="round" fill="none" opacity="0.8" />
      <rect x="56" y="30" width="26" height="26" rx="3" fill="#3f7d5a" />
      <g transform="rotate(-12 66 66)">
        <rect x="54" y="44" width="26" height="14" rx="4" fill={C.yellow}
              stroke={C.orange} strokeWidth="2.5" />
        <rect x="54" y="52" width="26" height="6" rx="3" fill={C.orange} />
      </g>
      <rect x="10" y="66" width="80" height="6" rx="3" fill={C.brown} />
    </Bg>
  ),

  'be-quiet': () => (
    <Bg tint="#f1eeff">
      <Person shirt={C.purple} mouth="flat" armR="M62 54 q2 -6 -8 -12" />
      <rect x="48" y="38" width="4" height="10" rx="2" fill={C.skin} stroke={C.ink} strokeWidth="1.5" />
      <rect x="62" y="8" width="32" height="18" rx="9" fill={C.white} stroke={C.purple} strokeWidth="2.5" />
      <text x="78" y="21" textAnchor="middle" fontSize="11" fontWeight="800" fill={C.purple}>Shh!</text>
    </Bg>
  ),

  'close-book': () => (
    <Bg tint="#eaf3ff">
      <rect x="26" y="20" width="48" height="62" rx="6" fill={C.deep} />
      <rect x="26" y="20" width="9" height="62" rx="4" fill="#245287" />
      <rect x="66" y="24" width="10" height="54" rx="3" fill={C.white} stroke={C.grey} strokeWidth="1.5" />
      <circle cx="52" cy="46" r="9" fill={C.yellow} />
      <path d="M12 44 h8 m-4 -4 l4 4 l-4 4 M88 44 h-8 m4 -4 l-4 4 l4 4" stroke={C.blue}
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Bg>
  ),

  'open-book': () => (
    <Bg tint="#eefbf3">
      <path d="M50 30 q-16 -8 -36 -2 v50 q20 -6 36 2 q16 -8 36 -2 v-50 q-20 -6 -36 2 Z"
            fill={C.green} />
      <path d="M50 34 q-14 -7 -32 -2 v42 q18 -5 32 2 Z" fill={C.white} />
      <path d="M50 34 q14 -7 32 -2 v42 q-18 -5 -32 2 Z" fill="#fff6e9" />
      <path d="M24 44 h18 M24 54 h18 M24 64 h12 M58 44 h18 M58 54 h18 M58 64 h12"
            stroke={C.grey} strokeWidth="3" strokeLinecap="round" />
    </Bg>
  ),

  'come-here': () => (
    <Bg tint="#fff1e6">
      <Person shirt={C.orange} dx={-10} armR="M62 54 q16 -2 22 -14" />
      <path d="M84 40 q-2 -8 -8 -10" stroke={C.ink} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M92 86 h-26 m7 -7 l-7 7 l7 7" stroke={C.orange} strokeWidth="4"
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Bg>
  ),

  'write-name': () => (
    <Bg tint="#fffbe6">
      <rect x="16" y="20" width="60" height="62" rx="6" fill={C.white} stroke={C.grey} strokeWidth="2.5" />
      <path d="M24 48 q5 -12 10 0 t10 0 t10 0" stroke={C.deep} strokeWidth="3.5"
            strokeLinecap="round" fill="none" />
      <path d="M24 64 h40" stroke={C.light} strokeWidth="3" strokeLinecap="round" />
      <g transform="rotate(38 70 44)">
        <rect x="66" y="16" width="9" height="40" rx="3" fill={C.yellow} stroke={C.orange} strokeWidth="2" />
        <rect x="66" y="12" width="9" height="8" rx="3" fill={C.pink} />
        <path d="M66 56 h9 l-4.5 10 Z" fill={C.sand} stroke={C.orange} strokeWidth="2" strokeLinejoin="round" />
      </g>
    </Bg>
  ),

  'clap-hands': (animate) => (
    <Bg tint="#fff8e0">
      <ellipse cx="41" cy="62" rx="11" ry="22" fill={C.skin} stroke={C.ink} strokeWidth="2.5"
               transform="rotate(-18 41 62)" />
      <ellipse cx="59" cy="62" rx="11" ry="22" fill={C.skin} stroke={C.ink} strokeWidth="2.5"
               transform="rotate(18 59 62)" />
      <g className={animate ? 'c2-pulse' : undefined} style={{ transformOrigin: '50px 30px' }}>
        <path d="M50 8 v12 M30 16 l8 8 M70 16 l-8 8 M22 34 h10 M78 34 h-10"
              stroke={C.orange} strokeWidth="4" strokeLinecap="round" />
      </g>
    </Bg>
  ),

  classroom: () => (
    <Bg tint="#eaf3ff">
      <rect x="10" y="12" width="80" height="38" rx="5" fill={C.wood} />
      <rect x="14" y="16" width="72" height="30" rx="3" fill="#3f7d5a" />
      <path d="M22 26 q5 -7 10 0 t10 0 M22 36 h18" stroke={C.white} strokeWidth="2.5"
            strokeLinecap="round" fill="none" opacity="0.8" />
      <g transform="translate(46 34) scale(0.62)"><Person shirt={C.orange} armR="M62 52 q12 -8 10 -26" /></g>
      <rect x="12" y="76" width="36" height="6" rx="3" fill={C.brown} />
      <rect x="18" y="82" width="4" height="10" rx="2" fill={C.brown} />
      <rect x="38" y="82" width="4" height="10" rx="2" fill={C.brown} />
    </Bg>
  ),

  /* --- Lesson 2: instructions ------------------------------------------- */
  'draw-line': () => (
    <Bg tint="#ffffff">
      <path d="M16 50 H84" stroke={C.ink} strokeWidth="6" strokeLinecap="round" />
    </Bg>
  ),

  'draw-arrow': () => (
    <Bg tint="#ffffff">
      <path d="M16 34 H84" stroke={C.ink} strokeWidth="5" strokeLinecap="round" />
      <path d="M16 66 H78 m-10 -9 l11 9 l-11 9" stroke={C.red} strokeWidth="5"
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Bg>
  ),

  'draw-circle': () => (
    <Bg tint="#ffffff">
      <circle cx="50" cy="50" r="27" fill="none" stroke={C.blue} strokeWidth="6" />
    </Bg>
  ),

  'draw-flower': () => (
    <Bg tint="#ffffff">
      <path d="M50 52 v34" stroke={C.green} strokeWidth="5" strokeLinecap="round" />
      <path d="M50 74 q-16 -2 -18 -14 q14 0 18 14 Z" fill={C.green} />
      {[0, 72, 144, 216, 288].map((deg) => (
        <ellipse key={deg} cx="50" cy="26" rx="8" ry="13" fill={C.red}
                 transform={`rotate(${deg} 50 42)`} />
      ))}
      <circle cx="50" cy="42" r="8" fill={C.yellow} />
    </Bg>
  ),

  'come-on-time': () => (
    <Bg tint="#eaf7ff">
      <circle cx="30" cy="22" r="8" fill={C.red} /><circle cx="70" cy="22" r="8" fill={C.red} />
      <circle cx="50" cy="54" r="32" fill={C.white} stroke={C.deep} strokeWidth="4" />
      <path d="M50 54 V34 M50 54 L64 62" stroke={C.ink} strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="50" cy="54" r="3.5" fill={C.red} />
    </Bg>
  ),

  prepare: () => (
    <Bg tint="#f1eeff">
      <rect x="22" y="22" width="38" height="56" rx="5" fill={C.deep} />
      <rect x="22" y="22" width="8" height="56" rx="4" fill="#245287" />
      <g transform="rotate(24 70 54)">
        <rect x="64" y="26" width="9" height="42" rx="3" fill={C.yellow} stroke={C.orange} strokeWidth="2" />
        <path d="M64 68 h9 l-4.5 10 Z" fill={C.sand} stroke={C.orange} strokeWidth="2" strokeLinejoin="round" />
      </g>
    </Bg>
  ),

  listen: () => (
    <Bg tint="#fff4e3">
      <path d="M50 20 a20 20 0 0 1 20 20 q0 12 -10 20 q-6 6 -4 14 a10 10 0 0 1 -20 0"
            fill={C.skin} stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
      <path d="M44 42 a8 8 0 0 1 14 0 q0 6 -5 10" stroke={C.brown} strokeWidth="3"
            strokeLinecap="round" fill="none" />
      <path d="M80 34 q8 8 0 18 M88 28 q12 14 0 30" stroke={C.orange} strokeWidth="3.5"
            strokeLinecap="round" fill="none" />
    </Bg>
  ),

  kind: () => (
    <Bg tint="#ffeef4">
      <path d="M36 74 C14 58 10 44 18 36 C25 30 34 32 36 40 C38 32 47 30 54 36 C62 44 58 58 36 74 Z"
            fill={C.pink} stroke={C.red} strokeWidth="3" strokeLinejoin="round" />
      <path d="M68 78 C48 64 44 52 51 46 C57 41 65 43 68 49 C71 43 79 41 85 46 C92 52 88 64 68 78 Z"
            fill={C.red} />
    </Bg>
  ),

  'say-please': () => <Bubble tint="#fff0f6" edge={C.pink} word="Please" />,
  'say-thanks': () => <Bubble tint="#fffbe0" edge={C.orange} word="Thank you" size={12} />,

  'clean-up': () => (
    <Bg tint="#eefbf3">
      <rect x="46" y="10" width="7" height="46" rx="3.5" fill={C.wood} transform="rotate(20 50 40)" />
      <path d="M32 58 h32 l8 26 h-48 Z" fill={C.yellow} stroke={C.orange} strokeWidth="3" strokeLinejoin="round" />
      <path d="M40 66 l-4 16 M50 66 v16 M60 66 l4 16" stroke={C.orange} strokeWidth="3" strokeLinecap="round" />
      <circle cx="80" cy="76" r="3" fill={C.grey} /><circle cx="88" cy="84" r="2.5" fill={C.grey} />
    </Bg>
  ),

  'try-hard': () => (
    <Bg tint="#eaf7ff">
      <path d="M6 88 L38 34 L54 58 L66 42 L94 88 Z" fill={C.teal} />
      <path d="M38 34 l-7 12 l7 -4 l6 6 Z" fill={C.white} />
      <path d="M66 42 V16" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
      <path d="M66 16 h16 l-5 6 l5 6 h-16 Z" fill={C.red} />
    </Bg>
  ),

  share: () => (
    <Bg tint="#fff1e6">
      <path d="M50 34 c-14 -10 -30 2 -24 22 c4 14 16 18 24 14 c8 4 20 0 24 -14 c6 -20 -10 -32 -24 -22 Z"
            fill={C.red} />
      <path d="M50 30 q2 -10 10 -12" stroke={C.leaf} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M8 76 q14 -6 24 -14 M92 76 q-14 -6 -24 -14" stroke={C.skin} strokeWidth="9"
            strokeLinecap="round" fill="none" />
    </Bg>
  ),

  'be-safe': () => (
    <Bg tint="#eef2ff">
      <path d="M50 12 L82 24 V50 q0 24 -32 38 q-32 -14 -32 -38 V24 Z" fill={C.deep} />
      <path d="M34 50 l12 12 l22 -24" stroke={C.white} strokeWidth="7" strokeLinecap="round"
            strokeLinejoin="round" fill="none" />
    </Bg>
  ),

  poster: () => (
    <Bg tint="#fff8e0">
      <rect x="14" y="10" width="72" height="80" rx="6" fill={C.white} stroke={C.grey} strokeWidth="2.5" />
      <rect x="24" y="18" width="52" height="10" rx="3" fill={C.orange} />
      <rect x="24" y="34" width="22" height="18" rx="4" fill={C.blue} />
      <rect x="54" y="34" width="22" height="18" rx="4" fill={C.pink} />
      <rect x="24" y="58" width="22" height="18" rx="4" fill={C.green} />
      <rect x="54" y="58" width="22" height="18" rx="4" fill={C.purple} />
    </Bg>
  ),

  /* --- Lesson 3: making requests ---------------------------------------- */
  library: () => (
    <Bg tint="#f1eeff">
      <rect x="10" y="14" width="80" height="74" rx="6" fill={C.wood} />
      <rect x="15" y="19" width="70" height="30" rx="3" fill="#f1e2c8" />
      <rect x="15" y="54" width="70" height="30" rx="3" fill="#f1e2c8" />
      {[[20, C.red], [30, C.blue], [39, C.green], [50, C.orange], [62, C.purple], [72, C.teal]].map(([x, c], i) => (
        <rect key={`t${i}`} x={x as number} y={i % 2 ? 24 : 22} width="8" height={i % 2 ? 25 : 27} rx="2" fill={c as string} />
      ))}
      {[[20, C.teal], [31, C.pink], [42, C.deep], [54, C.yellow], [65, C.red]].map(([x, c], i) => (
        <rect key={`b${i}`} x={x as number} y={i % 2 ? 60 : 58} width="8" height={i % 2 ? 24 : 26} rx="2" fill={c as string} />
      ))}
    </Bg>
  ),

  eraser: () => (
    <Bg tint="#fff0f6">
      <g transform="rotate(-24 50 50)">
        <rect x="22" y="36" width="56" height="28" rx="6" fill={C.pink} stroke={C.red} strokeWidth="2.5" />
        <rect x="46" y="36" width="32" height="28" rx="6" fill={C.deep} />
        <rect x="46" y="36" width="8" height="28" fill={C.deep} />
      </g>
    </Bg>
  ),

  borrow: () => (
    <Bg tint="#eefbf3">
      <path d="M6 70 q14 -2 24 -12" stroke={C.skin} strokeWidth="10" strokeLinecap="round" fill="none" />
      <path d="M94 70 q-14 -2 -24 -12" stroke={C.skin} strokeWidth="10" strokeLinecap="round" fill="none" />
      <g transform="rotate(-24 50 46)">
        <rect x="34" y="34" width="32" height="18" rx="5" fill={C.pink} stroke={C.red} strokeWidth="2" />
        <rect x="50" y="34" width="16" height="18" rx="5" fill={C.deep} />
      </g>
      <path d="M22 84 H70 m-9 -8 l9 8 l-9 8" stroke={C.green} strokeWidth="4.5"
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Bg>
  ),

  'excuse-me': () => (
    <Bg tint="#eaf3ff">
      <Person shirt={C.teal} dx={-8} armR="M62 52 q12 -8 10 -28" />
      <rect x="66" y="6" width="28" height="18" rx="9" fill={C.white} stroke={C.deep} strokeWidth="2.5" />
      <text x="80" y="20" textAnchor="middle" fontSize="13" fontWeight="800" fill={C.deep}>Hi!</text>
    </Bg>
  ),

  'sign-phone-off': () => (
    <Sign panel="#7a1f2b">
      <rect x="38" y="24" width="24" height="40" rx="5" fill={C.white} />
      <rect x="42" y="30" width="16" height="24" rx="2" fill={C.grey} />
      <circle cx="50" cy="44" r="24" fill="none" stroke={C.red} strokeWidth="5" />
      <path d="M33 61 L67 27" stroke={C.red} strokeWidth="5" strokeLinecap="round" />
    </Sign>
  ),

  'sign-no-litter': () => (
    <Sign panel="#2e8b57">
      <path d="M36 44 h28 l-3 28 h-22 Z" fill={C.white} />
      <rect x="33" y="38" width="34" height="6" rx="3" fill={C.white} />
      <path d="M42 50 v18 M50 50 v18 M58 50 v18" stroke="#2e8b57" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="62" y="24" width="10" height="10" rx="2" fill={C.white} transform="rotate(24 67 29)" />
      <path d="M58 34 q-2 -2 -4 0" stroke={C.white} strokeWidth="2" fill="none" strokeLinecap="round" />
    </Sign>
  ),

  'sign-wash-hands': () => (
    <Sign panel="#1f5fa8">
      <path d="M36 32 h16 q8 0 8 8 v4" stroke={C.white} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M60 50 q-3 5 0 9 q3 -4 0 -9 Z M54 58 q-3 5 0 9 q3 -4 0 -9 Z M66 58 q-3 5 0 9 q3 -4 0 -9 Z"
            fill="#9fd1ff" />
      <ellipse cx="40" cy="74" rx="8" ry="14" fill={C.skin} transform="rotate(-62 40 74)" />
      <ellipse cx="60" cy="74" rx="8" ry="14" fill={C.skin} transform="rotate(62 60 74)" />
    </Sign>
  ),

  'sign-show-ticket': () => (
    <Sign panel="#1f5fa8">
      <circle cx="50" cy="44" r="26" fill={C.white} opacity="0.95" />
      <rect x="34" y="34" width="32" height="22" rx="3" fill="#1f5fa8" />
      <rect x="38" y="39" width="8" height="8" rx="2" fill={C.white} />
      <path d="M50 40 h12 M50 46 h12 M38 52 h24" stroke={C.white} strokeWidth="2" strokeLinecap="round" />
    </Sign>
  ),
};
