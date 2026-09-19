/**
 * Unit 4 illustrations: daily habits, likes, and where we live.
 *
 * Original artwork — the NCTB pictures stay in the book. Same house style as
 * the rest of the set (flat fills, round joins, thick strokes). The children
 * reuse Unit 3's `Person` so the cast looks like one class.
 */
import { PALETTE } from './alphabetDrawings';
import { Bg, Person } from './unit3Drawings';

const C = PALETTE;

type Draw = (animate: boolean) => React.ReactNode;

function Bed({ blanket = C.teal }: { blanket?: string }) {
  return (
    <>
      <rect x="8" y="56" width="84" height="26" rx="6" fill={C.wood} />
      <rect x="8" y="46" width="10" height="42" rx="4" fill={C.brown} />
      <rect x="12" y="52" width="24" height="10" rx="5" fill={C.white} />
      <rect x="34" y="60" width="58" height="20" rx="6" fill={blanket} />
    </>
  );
}

export const UNIT4_DRAWINGS: Record<string, Draw> = {
  /* --- Lesson 1: a day ---------------------------------------------------- */
  'go-to-school': () => (
    <Bg tint="#eaf3ff">
      <path d="M52 30 L88 12 L88 30 Z" fill={C.red} />
      <rect x="54" y="30" width="36" height="46" rx="3" fill={C.orange} />
      <rect x="66" y="52" width="12" height="24" rx="2" fill={C.deep} />
      <path d="M72 12 v-6 h9 v6 Z" fill={C.green} />
      <Person shirt={C.blue} dx={-22} armR="M62 54 q10 2 16 8" />
      <rect x="53" y="50" width="9" height="22" rx="3" fill={C.purple} transform="translate(-22 0)" />
    </Bg>
  ),

  'go-to-bed': () => (
    <Bg tint="#1f2a5c">
      <circle cx="78" cy="22" r="10" fill={C.yellow} />
      <circle cx="82" cy="19" r="9" fill="#1f2a5c" />
      <circle cx="30" cy="18" r="1.8" fill={C.white} /><circle cx="52" cy="12" r="1.5" fill={C.white} />
      <Bed />
      <circle cx="24" cy="54" r="11" fill={C.skin} />
      <path d="M13 52 q1 -12 12 -12 q9 0 11 10 q-10 -5 -23 2 Z" fill="#2f2a28" />
      <path d="M19 55 h4 M27 55 h4" stroke={C.ink} strokeWidth="2" strokeLinecap="round" />
      <text x="46" y="42" fontSize="12" fontWeight="800" fill={C.white}>z</text>
      <text x="54" y="32" fontSize="9" fontWeight="800" fill={C.white}>z</text>
    </Bg>
  ),

  'play-football': () => (
    <Bg tint="#eefbf3">
      <rect x="6" y="80" width="88" height="14" rx="6" fill={C.green} />
      <Person shirt={C.orange} armL="M38 54 q-12 2 -14 12" armR="M62 54 q12 2 14 12" dx={-8} />
      <circle cx="76" cy="84" r="9" fill={C.white} stroke={C.ink} strokeWidth="2.5" />
      <path d="M76 79 l4 3 l-1.5 5 h-5 l-1.5 -5 Z" fill={C.ink} />
    </Bg>
  ),

  'brush-teeth': () => (
    <Bg tint="#eaf7ff">
      <Person shirt={C.teal} mouth="flat" armR="M62 54 q10 -2 12 -12" />
      <rect x="47" y="39" width="28" height="5" rx="2.5" fill={C.blue} />
      <rect x="45" y="36" width="9" height="10" rx="2" fill={C.white} stroke={C.blue} strokeWidth="1.5" />
      <circle cx="70" cy="22" r="4" fill="#cfeaff" /><circle cx="80" cy="30" r="3" fill="#cfeaff" />
    </Bg>
  ),

  'read-book': () => (
    <Bg tint="#fff4e3">
      <Person shirt={C.green} armL="M38 56 q-2 10 10 12" armR="M62 56 q2 10 -10 12" />
      <path d="M50 66 q-14 -6 -26 -2 v14 q12 -4 26 2 Z" fill={C.white} stroke={C.deep} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M50 66 q14 -6 26 -2 v14 q-12 -4 -26 2 Z" fill="#fff6e9" stroke={C.deep} strokeWidth="2.5" strokeLinejoin="round" />
    </Bg>
  ),

  'get-up': () => (
    <Bg tint="#fff3d6">
      <rect x="62" y="8" width="30" height="30" rx="5" fill="#bfe3ff" stroke={C.wood} strokeWidth="3" />
      <circle cx="77" cy="23" r="7" fill={C.yellow} />
      <Bed blanket={C.blue} />
      <g transform="translate(-16 -8) scale(0.85)">
        <Person shirt={C.orange} armL="M38 54 q-12 -4 -12 -22" armR="M62 54 q12 -4 12 -22" />
      </g>
    </Bg>
  ),

  'have-breakfast': () => (
    <Bg tint="#fff1e6">
      <rect x="6" y="66" width="88" height="10" rx="4" fill={C.brown} />
      <rect x="14" y="76" width="6" height="16" rx="2" fill={C.brown} />
      <rect x="80" y="76" width="6" height="16" rx="2" fill={C.brown} />
      <g transform="translate(7 -4) scale(0.85)"><Person shirt={C.red} armL="M38 54 q-4 12 8 20" armR="M62 54 q4 12 -8 20" /></g>
      <ellipse cx="34" cy="64" rx="15" ry="5" fill={C.white} stroke={C.grey} strokeWidth="2" />
      <ellipse cx="34" cy="62" rx="6" ry="3" fill={C.yellow} />
      <path d="M68 54 h12 v10 a4 4 0 0 1 -4 4 h-4 a4 4 0 0 1 -4 -4 Z" fill={C.white} stroke={C.grey} strokeWidth="2" />
    </Bg>
  ),

  afternoon: () => (
    <Bg tint="#e6f4ff">
      <circle cx="50" cy="32" r="14" fill={C.yellow} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
        <line key={d} x1="50" y1="32" x2="50" y2="10" stroke={C.orange} strokeWidth="4"
              strokeLinecap="round" transform={`rotate(${d} 50 32)`} />
      ))}
      <circle cx="50" cy="32" r="14" fill={C.yellow} />
      <rect x="6" y="70" width="88" height="22" rx="8" fill={C.green} />
    </Bg>
  ),

  evening: () => (
    <Bg tint="#ffd9b8">
      <path d="M22 66 a28 28 0 0 1 56 0 Z" fill={C.orange} />
      <path d="M0 66 q22 -16 44 -4 q22 -12 56 4 V100 H0 Z" fill="#7a5fb0" />
      <circle cx="80" cy="20" r="2" fill={C.white} /><circle cx="24" cy="24" r="1.6" fill={C.white} />
    </Bg>
  ),

  /* --- Lesson 2: fruits --------------------------------------------------- */
  guava: () => (
    <Bg tint="#eefaea">
      <circle cx="50" cy="54" r="26" fill="#9bd66a" />
      <path d="M50 28 q4 -10 12 -10 q-2 10 -12 10 Z" fill={C.leaf} />
      <circle cx="40" cy="48" r="2" fill="#7cb84f" /><circle cx="58" cy="62" r="2" fill="#7cb84f" />
      <circle cx="56" cy="46" r="2" fill="#7cb84f" />
    </Bg>
  ),
  banana: () => (
    <Bg tint="#fffbe0">
      <path d="M22 34 q4 44 56 42 q-2 -10 -18 -14 q-22 -6 -22 -30 Z" fill={C.yellow} stroke={C.orange} strokeWidth="3" strokeLinejoin="round" />
      <path d="M22 34 l-2 -8" stroke={C.brown} strokeWidth="5" strokeLinecap="round" />
    </Bg>
  ),
  papaya: () => (
    <Bg tint="#fff3e6">
      <path d="M50 14 C74 22 78 52 62 82 C58 88 42 88 38 82 C22 52 26 22 50 14 Z" fill="#f4a74a" />
      <path d="M50 22 C66 30 68 52 58 76 C54 80 46 80 42 76 C32 52 34 30 50 22 Z" fill="#ffd58a" />
      {[[50, 50], [45, 58], [55, 58], [50, 66], [46, 44], [54, 44]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.6" fill={C.ink} />
      ))}
    </Bg>
  ),
  mango: () => (
    <Bg tint="#fff8e0">
      <path d="M30 40 C30 20 68 20 74 42 C78 62 58 82 40 74 C26 68 26 52 30 40 Z" fill="#f7b731" />
      <path d="M40 30 C44 24 54 24 60 28" stroke="#fde08a" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M52 22 q4 -10 14 -8 q-2 10 -14 8 Z" fill={C.leaf} />
    </Bg>
  ),
  'thumbs-down': () => (
    <Bg tint="#ffeeee">
      <g transform="translate(0 100) scale(1 -1)">
        <path d="M40 54 v28 h-12 a4 4 0 0 1 -4 -4 v-20 a4 4 0 0 1 4 -4 Z" fill={C.skin} stroke={C.ink} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M44 54 l8 -22 a6 6 0 0 1 11 4 l-3 12 h14 a6 6 0 0 1 6 7 l-4 20 a8 8 0 0 1 -8 7 H44 Z" fill={C.skin} stroke={C.ink} strokeWidth="2.5" strokeLinejoin="round" />
      </g>
    </Bg>
  ),

  /* --- Lesson 3: things we like ------------------------------------------ */
  football: () => (
    <Bg tint="#eefbf3">
      <circle cx="50" cy="50" r="30" fill={C.white} stroke={C.ink} strokeWidth="3" />
      <path d="M50 34 l14 10 l-5 16 h-18 l-5 -16 Z" fill={C.ink} />
      <path d="M50 20 v14 M64 44 l14 -4 M59 60 l8 12 M41 60 l-8 12 M36 44 l-14 -4" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
    </Bg>
  ),
  cricket: () => (
    <Bg tint="#eaf3ff">
      <g transform="rotate(28 44 50)">
        <rect x="38" y="14" width="14" height="46" rx="5" fill="#e2b877" stroke={C.brown} strokeWidth="2.5" />
        <rect x="42" y="58" width="6" height="28" rx="3" fill={C.brown} />
      </g>
      <circle cx="74" cy="72" r="9" fill={C.red} />
      <path d="M67 70 q7 4 14 0" stroke={C.white} strokeWidth="2" fill="none" />
    </Bg>
  ),
  kabadi: () => (
    <Bg tint="#fff4e3">
      <rect x="48" y="8" width="4" height="84" fill={C.wood} />
      <g transform="translate(-2 10) scale(0.6)"><Person shirt={C.red} armL="M38 54 q-12 -2 -14 -12" armR="M62 54 q14 -2 20 -6" /></g>
      <g transform="translate(50 10) scale(0.6)"><Person shirt={C.deep} armL="M38 54 q-14 -2 -20 -6" armR="M62 54 q12 -2 14 -12" /></g>
    </Bg>
  ),
  singing: () => (
    <Bg tint="#f1eeff">
      <Person shirt={C.pink} dx={-8} armR="M62 54 q6 -10 -6 -14" />
      <ellipse cx="45" cy="42" rx="4" ry="6" fill={C.ink} />
      <path d="M72 30 v-16 l12 -4 v16" stroke={C.purple} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="70" cy="32" r="4.5" fill={C.purple} /><circle cx="82" cy="28" r="4.5" fill={C.purple} />
    </Bg>
  ),
  dancing: (animate) => (
    <Bg tint="#fff0f6">
      <g className={animate ? 'c2-bounce' : undefined}>
        <Person shirt={C.orange} armL="M38 54 q-14 -4 -16 -22" armR="M62 54 q14 4 18 -8" />
      </g>
      <path d="M12 60 q-4 8 0 16 M88 64 q4 8 0 16" stroke={C.pink} strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </Bg>
  ),
  picnic: () => (
    <Bg tint="#eaf7ff">
      <circle cx="80" cy="18" r="9" fill={C.yellow} />
      <rect x="20" y="20" width="8" height="30" rx="3" fill={C.brown} />
      <circle cx="24" cy="18" r="17" fill={C.leaf} />
      <rect x="6" y="72" width="88" height="22" rx="8" fill={C.green} />
      <path d="M22 78 h56 l6 12 h-68 Z" fill={C.red} />
      <path d="M32 78 l-3 12 M46 78 l-1 12 M60 78 l1 12 M72 78 l3 12" stroke={C.white} strokeWidth="2.5" />
      <path d="M40 66 h20 l-3 12 h-14 Z" fill={C.wood} stroke={C.brown} strokeWidth="2" />
      <circle cx="72" cy="72" r="5" fill={C.red} />
    </Bg>
  ),
  'study-tour': () => (
    <Bg tint="#eefbf3">
      <rect x="8" y="30" width="84" height="42" rx="8" fill={C.yellow} stroke={C.orange} strokeWidth="3" />
      {[16, 32, 48, 64].map((x) => <rect key={x} x={x} y="36" width="12" height="14" rx="2" fill="#bfe3ff" />)}
      <rect x="80" y="36" width="8" height="26" rx="2" fill="#bfe3ff" />
      <circle cx="28" cy="74" r="8" fill={C.ink} /><circle cx="72" cy="74" r="8" fill={C.ink} />
      <circle cx="28" cy="74" r="3" fill={C.grey} /><circle cx="72" cy="74" r="3" fill={C.grey} />
    </Bg>
  ),

  /* --- Lesson 4: good habits ---------------------------------------------- */
  'cross-road': () => (
    <Bg tint="#eef2f7">
      <rect x="0" y="34" width="100" height="40" fill="#5b6672" />
      <path d="M0 54 h100" stroke={C.white} strokeWidth="2" strokeDasharray="8 6" />
      {[16, 30, 44, 58, 72].map((x) => <rect key={x} x={x} y="34" width="8" height="40" fill={C.white} opacity="0.9" />)}
      <path d="M50 92 V80 m-7 6 l7 -8 l7 8" stroke={C.green} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M50 8 V20 m-7 -6 l7 8 l7 -8" stroke={C.green} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Bg>
  ),
  'foot-overbridge': () => (
    <Bg tint="#eaf3ff">
      <rect x="0" y="66" width="100" height="26" fill="#5b6672" />
      <path d="M0 66 h100" stroke={C.white} strokeWidth="2" />
      <rect x="18" y="26" width="64" height="8" rx="3" fill={C.orange} />
      <rect x="18" y="14" width="64" height="4" rx="2" fill={C.brown} />
      {[24, 40, 56, 72].map((x) => <rect key={x} x={x} y="16" width="3" height="10" fill={C.brown} />)}
      <path d="M18 34 L6 66 M82 34 L94 66" stroke={C.orange} strokeWidth="6" strokeLinecap="round" />
      <rect x="14" y="34" width="4" height="32" fill={C.orange} /><rect x="82" y="34" width="4" height="32" fill={C.orange} />
      <rect x="26" y="76" width="22" height="9" rx="4" fill={C.red} /><circle cx="32" cy="86" r="3" fill={C.ink} /><circle cx="43" cy="86" r="3" fill={C.ink} />
    </Bg>
  ),
  'cut-nails': () => (
    <Bg tint="#fff0f6">
      {[24, 36, 48, 60].map((x, i) => (
        <rect key={x} x={x} y={i === 1 || i === 2 ? 14 : 22} width="10" height={i === 1 || i === 2 ? 44 : 36} rx="5" fill={C.skin} stroke={C.ink} strokeWidth="2" />
      ))}
      {[24, 36, 48, 60].map((x, i) => (
        <rect key={`n${x}`} x={x + 2} y={i === 1 || i === 2 ? 15 : 23} width="6" height="8" rx="2" fill={C.pink} />
      ))}
      <rect x="20" y="52" width="54" height="34" rx="14" fill={C.skin} stroke={C.ink} strokeWidth="2" />
    </Bg>
  ),
  'nail-cutter': () => (
    <Bg tint="#eef2f7">
      <path d="M22 62 q28 -30 58 -22 l2 8 q-30 -6 -54 22 Z" fill={C.grey} stroke={C.ink} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M26 74 q10 4 16 -6" stroke={C.ink} strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="30" cy="72" r="4" fill={C.light} stroke={C.ink} strokeWidth="2" />
    </Bg>
  ),

  /* --- Lesson 5: where we live -------------------------------------------- */
  village: () => (
    <Bg tint="#e6f6ff">
      <rect x="4" y="68" width="92" height="24" rx="8" fill={C.green} />
      <rect x="10" y="26" width="8" height="42" rx="3" fill={C.brown} /><circle cx="14" cy="24" r="14" fill={C.leaf} />
      <rect x="36" y="50" width="26" height="20" fill="#e9c98f" /><path d="M32 52 L49 32 L66 52 Z" fill={C.brown} />
      <rect x="45" y="58" width="8" height="12" fill={C.deep} />
      <rect x="70" y="56" width="20" height="14" fill="#e9c98f" /><path d="M67 58 L80 44 L93 58 Z" fill={C.brown} />
    </Bg>
  ),
  city: () => (
    <Bg tint="#e6f1ff">
      {[[8, 30, 20, C.deep], [30, 14, 22, C.blue], [54, 24, 20, C.purple], [76, 36, 16, C.teal]].map(([x, y, w, c], i) => (
        <g key={i}>
          <rect x={x as number} y={y as number} width={w as number} height={88 - (y as number)} fill={c as string} />
          {[0, 1, 2, 3, 4].map((r) => [0, 1].map((k) => (
            <rect key={`${r}${k}`} x={(x as number) + 4 + k * 8} y={(y as number) + 6 + r * 12} width="5" height="6" fill="#ffe9a8" />
          )))}
        </g>
      ))}
      <rect x="0" y="86" width="100" height="10" fill="#5b6672" />
    </Bg>
  ),
  'small-town': () => (
    <Bg tint="#eaf7ff">
      <rect x="6" y="40" width="34" height="36" fill={C.orange} /><rect x="6" y="36" width="34" height="6" fill={C.red} />
      <rect x="44" y="50" width="28" height="26" fill={C.pink} /><rect x="44" y="46" width="28" height="6" fill={C.purple} />
      {[12, 24, 50, 62].map((x) => <rect key={x} x={x} y="54" width="7" height="8" fill="#bfe3ff" />)}
      <rect x="0" y="76" width="100" height="16" fill="#5b6672" />
      <path d="M0 84 h100" stroke={C.white} strokeWidth="2" strokeDasharray="8 6" />
      <rect x="62" y="70" width="26" height="12" rx="5" fill={C.deep} /><circle cx="68" cy="83" r="3.5" fill={C.ink} /><circle cx="82" cy="83" r="3.5" fill={C.ink} />
    </Bg>
  ),
};
