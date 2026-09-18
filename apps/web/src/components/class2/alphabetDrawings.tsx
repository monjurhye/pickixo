/**
 * The twenty-six alphabet words of Unit 2, drawn.
 *
 * Original artwork — the NCTB illustrations stay in the textbook (§39 of the
 * brief, and copyright). Kept in its own file because Illustration.tsx was
 * already carrying Unit 1 and one file with fifty drawings in it stops being
 * readable.
 *
 * Same house style as Illustration.tsx so the whole set looks like one hand:
 * flat fills, no gradients, rounded joins, a thick stroke that survives being
 * shrunk to a thumbnail, and one small warm palette. The test for each of
 * these is simple — a seven-year-old should name the thing in under a second,
 * so detail is removed rather than added.
 */

export const PALETTE = {
  ink: '#2b3440',
  skin: '#f4c9a3',
  red: '#ef5b5b',
  orange: '#f79b4b',
  yellow: '#fbd14b',
  green: '#5cb85c',
  leaf: '#3f9e4d',
  teal: '#2eb8a6',
  blue: '#4a9ff5',
  deep: '#2f6fb5',
  purple: '#9b7ede',
  pink: '#f58fb4',
  brown: '#a9713f',
  wood: '#d3a06a',
  grey: '#9aa7b4',
  light: '#e3eaf1',
  white: '#ffffff',
  black: '#33373d',
  sand: '#efd9a8',
} as const;

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

export const ALPHABET_DRAWINGS: Record<string, Draw> = {
  /* --- a to e ----------------------------------------------------------- */
  ant: () => (
    <Bg tint="#fdecec">
      <ellipse cx="34" cy="52" rx="11" ry="10" fill={C.red} />
      <ellipse cx="52" cy="54" rx="9" ry="8" fill={C.red} />
      <ellipse cx="70" cy="56" rx="14" ry="12" fill={C.red} />
      <circle cx="30" cy="48" r="2" fill={C.white} />
      <path d="M28 44 q-4 -10 -10 -13 M36 42 q0 -12 6 -16" stroke={C.ink}
            strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {[[44, 62], [56, 64], [68, 66]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} l-6 14`} stroke={C.ink} strokeWidth="2.5"
              strokeLinecap="round" />
      ))}
    </Bg>
  ),
  boat: () => (
    <Bg tint="#e6f3fb">
      <path d="M14 62 h72 l-12 18 H26 Z" fill={C.wood} stroke={C.brown} strokeWidth="2.5"
            strokeLinejoin="round" />
      <path d="M30 62 q20 -18 40 0 Z" fill={C.sand} stroke={C.brown} strokeWidth="2.5" />
      <path d="M8 84 q12 -6 24 0 t24 0 t24 0" stroke={C.blue} strokeWidth="3.5"
            strokeLinecap="round" fill="none" />
    </Bg>
  ),
  crow: () => (
    <Bg tint="#eef1f5">
      <ellipse cx="52" cy="54" rx="22" ry="15" fill={C.black} />
      <circle cx="32" cy="44" r="11" fill={C.black} />
      <path d="M22 44 l-12 4 12 4 Z" fill={C.orange} />
      <circle cx="30" cy="42" r="2.2" fill={C.white} />
      <path d="M58 48 q14 -6 20 4 q-12 6 -20 -4 Z" fill="#1f2226" />
      <path d="M44 68 l-3 12 M58 68 l3 12" stroke={C.orange} strokeWidth="3"
            strokeLinecap="round" />
    </Bg>
  ),
  deer: () => (
    // Redrawn: the first attempt read as an orange insect at thumbnail size.
    // A deer is recognised by the neck, the antlers and the white tail, so
    // those are exaggerated and the body is simplified.
    <Bg tint="#fdf1e3">
      <ellipse cx="44" cy="60" rx="20" ry="12" fill={C.orange} />
      <path d="M60 58 q6 -10 10 -18" stroke={C.orange} strokeWidth="9"
            strokeLinecap="round" fill="none" />
      <ellipse cx="72" cy="34" rx="9" ry="7" fill={C.orange} />
      <path d="M66 28 q-3 -10 -9 -13 M66 28 q-8 -3 -12 -1
               M78 28 q3 -10 9 -13 M78 28 q8 -3 12 -1"
            stroke="#7a4a22" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      <circle cx="76" cy="34" r="1.8" fill={C.ink} />
      <circle cx="81" cy="36" r="1.4" fill={C.ink} />
      {[32, 40, 50, 58].map((x) => (
        <path key={x} d={`M${x} 70 v14`} stroke="#c47a34" strokeWidth="4"
              strokeLinecap="round" />
      ))}
      <circle cx="25" cy="54" r="5" fill="#fff6ea" />
      <circle cx="40" cy="55" r="2.6" fill="#fff3e2" />
      <circle cx="50" cy="61" r="2.6" fill="#fff3e2" />
    </Bg>
  ),
  ear: () => (
    <Bg tint="#fdeef2">
      <path d="M38 22 q28 -6 30 24 q2 24 -12 34 q-10 8 -14 -4 q-2 -8 -8 -10"
            fill={C.skin} stroke={C.ink} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M48 38 q12 2 10 16 q-2 10 -8 12" stroke={C.ink} strokeWidth="2.5"
            fill="none" strokeLinecap="round" />
    </Bg>
  ),

  /* --- f to j ----------------------------------------------------------- */
  frog: () => (
    <Bg tint="#eaf8ea">
      <ellipse cx="50" cy="62" rx="26" ry="18" fill={C.green} />
      <circle cx="38" cy="40" r="10" fill={C.green} />
      <circle cx="62" cy="40" r="10" fill={C.green} />
      <circle cx="38" cy="38" r="4" fill={C.white} />
      <circle cx="62" cy="38" r="4" fill={C.white} />
      <circle cx="38" cy="38" r="2" fill={C.ink} />
      <circle cx="62" cy="38" r="2" fill={C.ink} />
      <path d="M38 66 q12 8 24 0" stroke={C.ink} strokeWidth="2.5"
            strokeLinecap="round" fill="none" />
      <path d="M24 76 q-8 4 -6 8 M76 76 q8 4 6 8" stroke={C.leaf} strokeWidth="4"
            strokeLinecap="round" fill="none" />
    </Bg>
  ),
  garlic: () => (
    <Bg tint="#f4f6f0">
      <path d="M50 26 q16 10 16 30 q0 18 -16 22 q-16 -4 -16 -22 q0 -20 16 -30 Z"
            fill="#f7f3ea" stroke={C.grey} strokeWidth="2.5" />
      <path d="M50 30 v46 M40 40 q-2 22 4 34 M60 40 q2 22 -4 34" stroke={C.grey}
            strokeWidth="2" fill="none" />
      <path d="M50 26 q-4 -10 -8 -12 M50 26 q4 -10 8 -12" stroke={C.leaf}
            strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </Bg>
  ),
  honey: () => (
    <Bg tint="#fff5df">
      <rect x="32" y="38" width="36" height="42" rx="7" fill={C.orange} />
      <rect x="30" y="30" width="40" height="10" rx="4" fill={C.brown} />
      <rect x="38" y="50" width="24" height="16" rx="3" fill="#fff6e6" />
      <path d="M44 58 l4 -4 4 4 4 -4" stroke={C.orange} strokeWidth="2.5"
            fill="none" strokeLinecap="round" />
    </Bg>
  ),
  island: () => (
    <Bg tint="#e3f4fb">
      <ellipse cx="50" cy="72" rx="32" ry="12" fill={C.sand} />
      <path d="M52 66 v-22" stroke={C.brown} strokeWidth="4" strokeLinecap="round" />
      <path d="M52 44 q-16 -4 -20 6 M52 44 q16 -4 20 6 M52 44 q-6 -14 -18 -14
               M52 44 q6 -14 18 -14" stroke={C.leaf} strokeWidth="4"
            strokeLinecap="round" fill="none" />
      <path d="M8 86 q12 -6 24 0 t24 0 t24 0" stroke={C.blue} strokeWidth="3.5"
            strokeLinecap="round" fill="none" />
    </Bg>
  ),
  jute: () => (
    <Bg tint="#f7f2e4">
      <path d="M50 24 v54" stroke="#b99a58" strokeWidth="5" strokeLinecap="round" />
      {[34, 46, 58].map((y, i) => (
        <g key={y}>
          <path d={`M50 ${y} q-18 -4 -22 8`} stroke={C.leaf} strokeWidth="4"
                strokeLinecap="round" fill="none" />
          <path d={`M50 ${y + 6} q18 -4 22 8`} stroke={C.leaf} strokeWidth="4"
                strokeLinecap="round" fill="none" />
        </g>
      ))}
      <ellipse cx="50" cy="82" rx="18" ry="5" fill="#d8c79a" />
    </Bg>
  ),

  /* --- k to o ----------------------------------------------------------- */
  kitten: () => (
    <Bg tint="#f6f0fb">
      <ellipse cx="50" cy="64" rx="20" ry="16" fill={C.grey} />
      <circle cx="50" cy="42" r="16" fill={C.grey} />
      <path d="M36 32 l-2 -12 12 6 Z M64 32 l2 -12 -12 6 Z" fill={C.grey} />
      <circle cx="44" cy="42" r="2.4" fill={C.ink} />
      <circle cx="56" cy="42" r="2.4" fill={C.ink} />
      <path d="M46 50 q4 4 8 0" stroke={C.ink} strokeWidth="2.2"
            strokeLinecap="round" fill="none" />
      <path d="M30 44 h-10 M30 48 h-10 M70 44 h10 M70 48 h10" stroke={C.ink}
            strokeWidth="1.8" strokeLinecap="round" />
      <path d="M70 70 q16 2 12 -12" stroke={C.grey} strokeWidth="5"
            strokeLinecap="round" fill="none" />
    </Bg>
  ),
  ladder: () => (
    <Bg tint="#fdf4e5">
      <rect x="28" y="18" width="7" height="64" rx="3" fill={C.wood} />
      <rect x="65" y="18" width="7" height="64" rx="3" fill={C.wood} />
      {[30, 44, 58, 72].map((y) => (
        <rect key={y} x="30" y={y} width="40" height="6" rx="3" fill={C.brown} />
      ))}
    </Bg>
  ),
  monkey: () => (
    <Bg tint="#f7efe4">
      <ellipse cx="50" cy="66" rx="18" ry="15" fill={C.brown} />
      <circle cx="50" cy="42" r="17" fill={C.brown} />
      <circle cx="50" cy="46" r="11" fill={C.sand} />
      <circle cx="31" cy="38" r="7" fill={C.brown} />
      <circle cx="69" cy="38" r="7" fill={C.brown} />
      <circle cx="45" cy="42" r="2.3" fill={C.ink} />
      <circle cx="55" cy="42" r="2.3" fill={C.ink} />
      <path d="M45 52 q5 4 10 0" stroke={C.ink} strokeWidth="2.2"
            strokeLinecap="round" fill="none" />
      <path d="M68 68 q16 6 8 16" stroke={C.brown} strokeWidth="4.5"
            strokeLinecap="round" fill="none" />
    </Bg>
  ),
  nest: () => (
    <Bg tint="#f6f1e6">
      <path d="M20 58 q30 -16 60 0 q-6 22 -30 22 q-24 0 -30 -22 Z" fill="#c69b62" />
      <path d="M22 60 q28 -10 56 0" stroke="#a97f4a" strokeWidth="2.5" fill="none" />
      <path d="M26 68 q24 -8 48 0" stroke="#a97f4a" strokeWidth="2.5" fill="none" />
      <ellipse cx="42" cy="58" rx="7" ry="8" fill="#dff3ef" />
      <ellipse cx="58" cy="58" rx="7" ry="8" fill="#dff3ef" />
    </Bg>
  ),
  orange: (animate) => (
    <Bg tint="#fff1e0">
      <circle cx="50" cy="56" r="26" fill={C.orange}
              className={animate ? 'c2-pulse' : undefined} />
      <path d="M50 30 v-6" stroke={C.brown} strokeWidth="4" strokeLinecap="round" />
      <path d="M50 26 q12 -8 18 0 q-10 6 -18 0 Z" fill={C.leaf} />
      <path d="M38 48 q12 -6 24 0" stroke="#e0813a" strokeWidth="2.5" fill="none" />
    </Bg>
  ),

  /* --- p to t ----------------------------------------------------------- */
  pen: () => (
    <Bg tint="#eef3fb">
      <path d="M24 78 l8 -4 34 -40 8 7 -34 40 Z" fill={C.blue} stroke={C.deep}
            strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M66 34 l8 -9 8 7 -8 9 Z" fill={C.deep} />
      <path d="M24 78 l8 -4 -2 6 Z" fill={C.ink} />
    </Bg>
  ),
  quilt: () => (
    <Bg tint="#f3eefb">
      <rect x="18" y="30" width="64" height="46" rx="8" fill={C.purple} />
      {[34, 50, 66].map((x) => (
        <line key={x} x1={x} y1="30" x2={x} y2="76" stroke="#efe7fb"
              strokeWidth="2.5" />
      ))}
      {[45, 60].map((y) => (
        <line key={y} x1="18" y1={y} x2="82" y2={y} stroke="#efe7fb"
              strokeWidth="2.5" />
      ))}
      <rect x="18" y="30" width="64" height="46" rx="8" fill="none"
            stroke="#7a5cc4" strokeWidth="2.5" />
    </Bg>
  ),
  robot: () => (
    <Bg tint="#eef2f6">
      <rect x="30" y="36" width="40" height="32" rx="7" fill={C.grey} />
      <rect x="36" y="44" width="28" height="14" rx="4" fill={C.light} />
      <circle cx="44" cy="51" r="3" fill={C.deep} />
      <circle cx="56" cy="51" r="3" fill={C.deep} />
      <rect x="44" y="24" width="12" height="10" rx="4" fill={C.grey} />
      <path d="M50 24 v-6" stroke={C.ink} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="50" cy="16" r="3.5" fill={C.red} />
      <rect x="20" y="42" width="8" height="18" rx="4" fill={C.grey} />
      <rect x="72" y="42" width="8" height="18" rx="4" fill={C.grey} />
      <rect x="38" y="70" width="9" height="14" rx="4" fill={C.deep} />
      <rect x="53" y="70" width="9" height="14" rx="4" fill={C.deep} />
    </Bg>
  ),
  star: (animate) => (
    <Bg tint="#fff8e0">
      <path d="M50 18 L60 40 L84 43 L67 60 L71 84 L50 72 L29 84 L33 60 L16 43 L40 40 Z"
            fill={C.yellow} stroke={C.orange} strokeWidth="3" strokeLinejoin="round"
            className={animate ? 'c2-pulse' : undefined} />
    </Bg>
  ),
  telescope: () => (
    <Bg tint="#e9eef8">
      <path d="M26 46 l40 -18 8 14 -40 18 Z" fill={C.light} stroke={C.deep}
            strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M66 28 l10 -4 6 10 -8 8 Z" fill={C.deep} />
      <path d="M44 56 v14 M52 60 l12 12 M40 84 h30" stroke={C.ink} strokeWidth="3"
            strokeLinecap="round" />
      <circle cx="78" cy="22" r="2.5" fill={C.yellow} />
      <circle cx="22" cy="24" r="2" fill={C.yellow} />
    </Bg>
  ),

  /* --- u to z ----------------------------------------------------------- */
  uniform: () => (
    <Bg tint="#eaf1fb">
      <path d="M36 30 h28 l10 8 -8 8 -4 -3 v33 H38 V43 l-4 3 -8 -8 Z"
            fill={C.white} stroke={C.deep} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M44 30 l6 10 6 -10" stroke={C.deep} strokeWidth="2.5" fill="none" />
      <rect x="38" y="60" width="24" height="16" fill={C.deep} />
    </Bg>
  ),
  vase: () => (
    <Bg tint="#f1eefb">
      <path d="M38 44 q-4 22 4 32 h16 q8 -10 4 -32 Z" fill={C.blue}
            stroke={C.deep} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="36" y="38" width="28" height="7" rx="3" fill={C.deep} />
      <circle cx="40" cy="26" r="7" fill={C.red} />
      <circle cx="54" cy="20" r="7" fill={C.yellow} />
      <circle cx="62" cy="30" r="6" fill={C.pink} />
      <path d="M44 38 q-2 -10 -4 -12 M52 38 q2 -12 2 -18 M58 38 q4 -8 4 -8"
            stroke={C.leaf} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </Bg>
  ),
  whale: () => (
    <Bg tint="#e3f2fb">
      <path d="M22 58 q10 -18 32 -18 q24 0 30 18 q-8 16 -30 16 q-22 0 -32 -16 Z"
            fill={C.deep} />
      <path d="M82 50 q10 -10 14 -4 q-2 10 -12 12 Z" fill={C.deep} />
      <circle cx="40" cy="52" r="2.6" fill={C.white} />
      <path d="M30 62 q20 8 40 0" stroke="#7fb6e8" strokeWidth="3" fill="none" />
      <path d="M50 40 q-2 -12 -8 -16 M50 40 q2 -12 8 -16" stroke={C.blue}
            strokeWidth="3" strokeLinecap="round" fill="none" />
    </Bg>
  ),
  'x-ray': () => (
    <Bg tint="#e8eaee">
      <rect x="24" y="20" width="52" height="62" rx="6" fill="#2b3440" />
      <path d="M50 30 v40" stroke="#dfe7ef" strokeWidth="4" strokeLinecap="round" />
      {[38, 46, 54, 62].map((y) => (
        <g key={y}>
          <path d={`M50 ${y} q-14 -2 -16 6`} stroke="#dfe7ef" strokeWidth="3"
                fill="none" strokeLinecap="round" />
          <path d={`M50 ${y} q14 -2 16 6`} stroke="#dfe7ef" strokeWidth="3"
                fill="none" strokeLinecap="round" />
        </g>
      ))}
    </Bg>
  ),
  yoke: () => (
    <Bg tint="#f7f2e6">
      <path d="M18 44 q32 -12 64 0" stroke={C.wood} strokeWidth="8"
            strokeLinecap="round" fill="none" />
      <path d="M30 48 v16 M70 48 v16" stroke={C.brown} strokeWidth="3.5"
            strokeLinecap="round" />
      <path d="M26 64 q4 8 8 0 M66 64 q4 8 8 0" stroke={C.brown} strokeWidth="3"
            fill="none" strokeLinecap="round" />
    </Bg>
  ),
  zebra: () => (
    <Bg tint="#f0f2f5">
      <ellipse cx="50" cy="56" rx="24" ry="15" fill={C.white} stroke={C.ink}
               strokeWidth="2.5" />
      <circle cx="74" cy="42" r="10" fill={C.white} stroke={C.ink} strokeWidth="2.5" />
      {[38, 46, 54, 62].map((x) => (
        <path key={x} d={`M${x} 43 q3 13 0 26`} stroke={C.ink} strokeWidth="4"
              fill="none" />
      ))}
      <circle cx="78" cy="40" r="2" fill={C.ink} />
      {[36, 46, 58, 66].map((x) => (
        <path key={x} d={`M${x} 70 v12`} stroke={C.ink} strokeWidth="3.5"
              strokeLinecap="round" />
      ))}
    </Bg>
  ),

  /* --- Unit 2 lesson 12 -------------------------------------------------- */
  vegetables: () => (
    <Bg tint="#eefaea">
      <circle cx="34" cy="60" r="12" fill={C.red} />
      <path d="M34 48 q6 -4 8 0" stroke={C.leaf} strokeWidth="3" fill="none"
            strokeLinecap="round" />
      <path d="M58 46 q8 14 4 30 q-6 4 -10 -2 q-4 -14 2 -28 Z" fill={C.orange} />
      <path d="M58 46 q-4 -10 -8 -12 M58 46 q4 -10 10 -12" stroke={C.leaf}
            strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="76" cy="66" rx="11" ry="9" fill={C.green} />
      <circle cx="72" cy="66" r="2.2" fill="#cdeccb" />
      <circle cx="78" cy="65" r="2.2" fill="#cdeccb" />
    </Bg>
  ),
  tomato: () => (
    <Bg tint="#fdeaea">
      <circle cx="50" cy="58" r="24" fill={C.red} />
      <path d="M50 34 q-12 -6 -14 0 q6 4 14 0 Z M50 34 q12 -6 14 0 q-6 4 -14 0 Z"
            fill={C.leaf} />
      <path d="M50 34 v-8" stroke={C.leaf} strokeWidth="3.5" strokeLinecap="round" />
      <ellipse cx="41" cy="50" rx="4" ry="6" fill="#ff8b8b" opacity="0.7" />
    </Bg>
  ),
  carrot: () => (
    <Bg tint="#fff2e3">
      <path d="M50 34 q14 20 6 44 q-8 6 -14 -2 q-8 -24 8 -42 Z" fill={C.orange} />
      <path d="M46 48 h10 M46 58 h10 M48 68 h8" stroke="#e07f35" strokeWidth="2.5"
            strokeLinecap="round" />
      <path d="M50 34 q-8 -14 -14 -16 M50 34 q0 -16 0 -20 M50 34 q8 -14 14 -16"
            stroke={C.leaf} strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </Bg>
  ),
  cabbage: () => (
    <Bg tint="#eefaf0">
      <circle cx="50" cy="56" r="26" fill="#9ed49b" />
      <path d="M50 30 q-22 10 -16 34 M50 30 q22 10 16 34 M50 30 v52"
            stroke="#6fb872" strokeWidth="3" fill="none" />
      <circle cx="50" cy="56" r="26" fill="none" stroke="#5fa663" strokeWidth="2.5" />
    </Bg>
  ),
  /* --- Unit 2 lesson 5, the Little Seed rhyme ---------------------------- */
  seed: () => (
    <Bg tint="#f6f1e4">
      <ellipse cx="50" cy="56" rx="12" ry="16" fill={C.brown} />
      <path d="M50 42 q6 8 0 16 q-6 -8 0 -16 Z" fill="#8a5a2e" />
      <path d="M50 72 q-2 8 0 12" stroke={C.leaf} strokeWidth="3"
            strokeLinecap="round" fill="none" />
      <ellipse cx="50" cy="86" rx="30" ry="6" fill="#c8a978" />
    </Bg>
  ),
  rain: (animate) => (
    <Bg tint="#e6f2fb">
      <ellipse cx="46" cy="40" rx="22" ry="14" fill={C.white} />
      <ellipse cx="62" cy="36" rx="14" ry="11" fill={C.white} />
      <ellipse cx="34" cy="36" rx="12" ry="10" fill="#eef5fb" />
      {[32, 46, 60, 72].map((x, i) => (
        <path
          key={x}
          d={`M${x} 60 q3 6 0 10 q-3 -4 0 -10 Z`}
          fill={C.blue}
          className={animate ? 'c2-pulse' : undefined}
          style={animate ? { animationDelay: `${i * 0.18}s` } : undefined}
        />
      ))}
      <path d="M30 76 q4 8 0 12 M58 78 q4 8 0 12" fill={C.blue} />
    </Bg>
  ),
  flower: (animate) => (
    <Bg tint="#fdeef5">
      <path d="M50 64 v22" stroke={C.leaf} strokeWidth="4" strokeLinecap="round" />
      <path d="M50 74 q-14 -6 -18 4 q12 6 18 -4 Z" fill={C.leaf} />
      <g className={animate ? 'c2-pulse' : undefined} style={{ transformOrigin: '50px 44px' }}>
        {[0, 72, 144, 216, 288].map((deg) => (
          <ellipse key={deg} cx="50" cy="28" rx="8" ry="13" fill={C.pink}
                   transform={`rotate(${deg} 50 44)`} />
        ))}
        <circle cx="50" cy="44" r="9" fill={C.yellow} />
      </g>
    </Bg>
  ),
  peas: () => (
    <Bg tint="#eefaea">
      <path d="M22 54 q28 -18 56 0 q-4 14 -28 14 q-24 0 -28 -14 Z" fill="#8fce8c" />
      <circle cx="36" cy="56" r="7" fill={C.green} />
      <circle cx="50" cy="58" r="7" fill={C.green} />
      <circle cx="64" cy="56" r="7" fill={C.green} />
    </Bg>
  ),
};

/**
 * Counting dots for the number lessons.
 *
 * Generated rather than drawn one by one: thirty hand-made layouts would be
 * thirty chances to draw the wrong number of dots, and the point of the
 * lesson is that the count is right.
 */
export function CountingDots({ count, colour = C.blue }: {
  count: number; colour?: string;
}) {
  const n = Math.max(0, Math.min(30, Math.round(count)));
  const perRow = n <= 5 ? n : n <= 10 ? 5 : n <= 20 ? 5 : 6;
  const rows = Math.ceil(n / perRow) || 1;
  const size = rows > 4 ? 5 : rows > 2 ? 6.5 : 8;
  const gapX = 88 / (perRow + 1);
  const gapY = Math.min(18, 72 / (rows + 1));

  const dots = [];
  for (let i = 0; i < n; i += 1) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const inRow = Math.min(perRow, n - row * perRow);
    const offset = (perRow - inRow) * gapX / 2;
    dots.push(
      <circle
        key={i}
        cx={6 + offset + (col + 1) * gapX}
        cy={16 + (row + 1) * gapY}
        r={size}
        fill={colour}
      />,
    );
  }
  return <>{dots}</>;
}
