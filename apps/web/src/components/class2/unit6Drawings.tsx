/**
 * Unit 6 illustrations: the picture words of the sound lessons.
 *
 * Original artwork — the NCTB pictures stay in the book. Each of these has to
 * be recognised at a glance, because in a sounds lesson the picture is the
 * question: if a child cannot tell that this is a "tap" and not a "pipe", they
 * cannot hear that it starts with /t/.
 *
 * (`ball` is drawn as a football, the same picture as Unit 4's `football`, so
 * that lesson reuses it rather than duplicating it.)
 */
import { PALETTE } from './alphabetDrawings';
import { Bg, Person } from './unit3Drawings';

const C = PALETTE;

type Draw = (animate: boolean) => React.ReactNode;

export const UNIT6_DRAWINGS: Record<string, Draw> = {
  apple: () => (
    <Bg tint="#fff1ee">
      <path d="M50 30 C34 20 16 32 20 54 C24 76 40 86 50 80 C60 86 76 76 80 54 C84 32 66 20 50 30 Z" fill={C.red} />
      <path d="M50 30 q0 -12 6 -18" stroke={C.brown} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M54 22 q10 -10 22 -6 q-6 12 -22 6 Z" fill={C.green} />
      <path d="M30 44 q4 -8 12 -8" stroke="#ff9a9a" strokeWidth="4" strokeLinecap="round" fill="none" />
    </Bg>
  ),

  mat: () => (
    <Bg tint="#fff8e0">
      <path d="M14 40 L70 28 L86 62 L30 74 Z" fill="#e7c98a" stroke="#b98a4e" strokeWidth="2.5" strokeLinejoin="round" />
      <ellipse cx="22" cy="57" rx="9" ry="17" fill="#d9b06a" stroke="#b98a4e" strokeWidth="2.5" transform="rotate(-14 22 57)" />
      <ellipse cx="22" cy="57" rx="4" ry="9" fill="#b98a4e" transform="rotate(-14 22 57)" />
      <path d="M80 50 l8 14 M72 54 l8 14 M64 56 l8 14" stroke="#b98a4e" strokeWidth="2" strokeLinecap="round" />
    </Bg>
  ),

  man: () => (
    <Bg tint="#eaf3ff">
      <Person shirt={C.orange} />
    </Bg>
  ),

  ash: () => (
    <Bg tint="#f1f3f6">
      <path d="M10 82 q6 -26 40 -28 q34 2 40 28 Z" fill="#aab3bd" />
      <path d="M30 76 q4 -10 14 -10 M56 72 q6 -8 14 -6" stroke="#cbd3db" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M46 46 q-6 -10 2 -18 q6 -8 -2 -16" stroke="#c9d2dc" strokeWidth="4" strokeLinecap="round" fill="none" />
    </Bg>
  ),

  milk: () => (
    <Bg tint="#eaf3ff">
      <path d="M14 46 h72 q-2 30 -36 34 q-34 -4 -36 -34 Z" fill={C.white} stroke={C.grey} strokeWidth="3" strokeLinejoin="round" />
      <ellipse cx="50" cy="46" rx="36" ry="9" fill="#f6fbff" stroke={C.grey} strokeWidth="3" />
      <path d="M32 44 q18 6 36 0" stroke={C.light} strokeWidth="3" strokeLinecap="round" fill="none" />
    </Bg>
  ),

  bag: () => (
    <Bg tint="#eefaea">
      <path d="M24 34 q0 -18 26 -18 q26 0 26 18 v42 q0 8 -8 8 h-36 q-8 0 -8 -8 Z" fill="#4c9a4c" stroke="#2f6f2f" strokeWidth="3" />
      <rect x="32" y="50" width="36" height="24" rx="6" fill="#65b565" stroke="#2f6f2f" strokeWidth="2.5" />
      <path d="M34 36 h32" stroke="#2f6f2f" strokeWidth="3" strokeLinecap="round" />
      <path d="M40 16 q10 -8 20 0" stroke="#2f6f2f" strokeWidth="4" strokeLinecap="round" fill="none" />
    </Bg>
  ),

  fan: (animate) => (
    <Bg tint="#fff1e6">
      <rect x="48" y="6" width="4" height="22" rx="2" fill={C.grey} />
      <g className={animate ? 'c2-pulse' : undefined} style={{ transformOrigin: '50px 36px' }}>
        <path d="M50 36 q-8 -20 -32 -10 q12 14 32 10 Z" fill={C.orange} />
        <path d="M50 36 q24 -8 34 12 q-18 6 -34 -12 Z" fill={C.orange} />
        <path d="M50 36 q-6 22 4 38 q10 -18 -4 -38 Z" fill={C.orange} />
      </g>
      <circle cx="50" cy="36" r="8" fill="#e0782f" />
      <circle cx="50" cy="36" r="3.5" fill={C.yellow} />
    </Bg>
  ),

  top: () => (
    <Bg tint="#fdecec">
      <rect x="47" y="8" width="6" height="14" rx="3" fill={C.grey} />
      <path d="M20 28 h60 q-4 16 -18 24 h-24 q-14 -8 -18 -24 Z" fill={C.red} />
      <path d="M28 44 h44 q-4 6 -10 8 h-24 q-6 -2 -10 -8 Z" fill={C.white} />
      <path d="M38 52 h24 q-4 10 -12 26 q-8 -16 -12 -26 Z" fill={C.green} />
      <circle cx="50" cy="82" r="3" fill={C.ink} />
    </Bg>
  ),

  cake: () => (
    <Bg tint="#fff8e0">
      <rect x="16" y="46" width="68" height="34" rx="8" fill="#fbe58a" stroke={C.orange} strokeWidth="2.5" />
      <path d="M16 54 q9 12 18 0 q9 12 18 0 q9 12 18 0 q6 8 14 0 v-8 h-68 Z" fill={C.white} />
      <circle cx="34" cy="42" r="5" fill={C.red} /><circle cx="52" cy="40" r="5" fill={C.red} /><circle cx="68" cy="42" r="5" fill={C.red} />
    </Bg>
  ),

  tap: () => (
    <Bg tint="#eaf7ff">
      <rect x="44" y="12" width="12" height="8" rx="3" fill={C.grey} />
      <rect x="30" y="18" width="40" height="8" rx="4" fill="#7d8b99" />
      <path d="M22 34 h52 q10 0 10 10 v6 h-14 v-4 q0 -4 -4 -4 h-44 Z" fill="#9aa7b4" stroke="#7d8b99" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M78 54 q-3 6 0 10 q3 -4 0 -10 Z" fill="#7fc7ff" />
      <path d="M78 72 q-3 6 0 10 q3 -4 0 -10 Z" fill="#7fc7ff" opacity="0.7" />
    </Bg>
  ),

  book: () => (
    <Bg tint="#fff4e3">
      <path d="M18 34 L70 26 L84 64 L32 74 Z" fill="#8a3f1f" stroke="#5c2810" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M32 74 L84 64 l0 6 L32 80 Z" fill={C.white} stroke={C.grey} strokeWidth="2" strokeLinejoin="round" />
      <path d="M26 42 L62 36" stroke="#b36a45" strokeWidth="3" strokeLinecap="round" />
    </Bg>
  ),

  cap: () => (
    <Bg tint="#fdecec">
      <path d="M20 62 q0 -32 32 -32 q28 0 30 32 Z" fill={C.red} />
      <path d="M18 62 q-2 12 30 14 q30 2 40 -12 q-16 4 -70 -2 Z" fill="#c93c3c" />
      <circle cx="52" cy="30" r="3.5" fill="#c93c3c" />
      <path d="M40 48 q6 -8 14 -6" stroke="#ff9a9a" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </Bg>
  ),

  cat: () => (
    <Bg tint="#f1eeff">
      <path d="M72 84 q22 -6 14 -30" stroke="#8c8f99" strokeWidth="7" strokeLinecap="round" fill="none" />
      <ellipse cx="50" cy="66" rx="24" ry="20" fill="#a3a7b3" />
      <circle cx="50" cy="38" r="16" fill="#a3a7b3" />
      <path d="M36 28 l-2 -14 l12 8 Z M64 28 l2 -14 l-12 8 Z" fill="#a3a7b3" />
      <circle cx="44" cy="38" r="2.6" fill={C.ink} /><circle cx="56" cy="38" r="2.6" fill={C.ink} />
      <path d="M50 42 v3 M46 46 q4 3 8 0" stroke={C.ink} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M34 42 h-10 M34 46 h-10 M66 42 h10 M66 46 h10" stroke={C.ink} strokeWidth="1.5" strokeLinecap="round" />
    </Bg>
  ),

  bat: () => (
    <Bg tint="#fff4e3">
      <g transform="rotate(38 50 50)">
        <rect x="42" y="8" width="16" height="52" rx="6" fill="#e2b877" stroke={C.brown} strokeWidth="2.5" />
        <rect x="46" y="58" width="8" height="30" rx="4" fill={C.brown} />
        <rect x="45" y="70" width="10" height="4" fill="#6b4a2e" />
      </g>
    </Bg>
  ),

  van: () => (
    <Bg tint="#eef2f7">
      <rect x="12" y="46" width="52" height="8" rx="3" fill="#8a4f2a" />
      <path d="M12 46 h52 M18 46 v-8 M58 46 v-8" stroke="#5c2810" strokeWidth="2.5" />
      <path d="M64 50 L84 34 L88 30 M68 38 h14" stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <circle cx="26" cy="68" r="14" fill="none" stroke={C.ink} strokeWidth="3.5" />
      <circle cx="26" cy="68" r="2.5" fill={C.ink} />
      <circle cx="72" cy="66" r="18" fill="none" stroke={C.ink} strokeWidth="3.5" />
      <circle cx="72" cy="66" r="2.5" fill={C.ink} />
      <path d="M72 66 l-12 10 M72 66 l12 -10 M72 66 v-16 M72 66 v16" stroke={C.grey} strokeWidth="1.5" />
    </Bg>
  ),

  red: () => (
    <Bg tint="#ffffff">
      <circle cx="50" cy="50" r="30" fill="#ef2b2b" />
    </Bg>
  ),

  dog: () => (
    <Bg tint="#fff1e6">
      <path d="M22 44 q20 -10 46 -2 l8 -10 q8 -2 8 6 l-4 12 q0 6 -6 6 h-10 v16 h-8 v-14 h-22 v14 h-8 v-16 q-8 -2 -10 -10 Z" fill="#e58a4f" />
      <path d="M22 44 q-8 -6 -10 -16" stroke="#e58a4f" strokeWidth="6" strokeLinecap="round" fill="none" />
      <circle cx="72" cy="40" r="2.2" fill={C.ink} />
      <path d="M80 44 h6" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
      <path d="M66 36 q-6 8 0 14" fill="#c9702f" />
    </Bg>
  ),

  bus: () => (
    <Bg tint="#eefbf3">
      <rect x="8" y="26" width="84" height="46" rx="9" fill="#f7b731" stroke="#d98d10" strokeWidth="3" />
      {[16, 32, 48, 64].map((x) => <rect key={x} x={x} y="32" width="12" height="15" rx="2" fill="#bfe3ff" />)}
      <rect x="80" y="32" width="8" height="26" rx="2" fill="#bfe3ff" />
      <rect x="8" y="56" width="84" height="6" fill="#d98d10" opacity="0.5" />
      <circle cx="28" cy="74" r="8" fill={C.ink} /><circle cx="72" cy="74" r="8" fill={C.ink} />
      <circle cx="28" cy="74" r="3" fill={C.grey} /><circle cx="72" cy="74" r="3" fill={C.grey} />
    </Bg>
  ),
};
