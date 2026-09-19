/**
 * Unit 5 illustrations: days of the week, Rima's seed, and the two little birds.
 *
 * Original artwork — the NCTB pictures stay in the book. Same house style as
 * the rest of the set. The days are generated from one function so the strip
 * is guaranteed to highlight the right day: a picture that says "Thursday"
 * over Wednesday's box would teach the wrong thing to a child who cannot yet
 * check it.
 */
import { PALETTE } from './alphabetDrawings';
import { Bg, Person } from './unit3Drawings';

const C = PALETTE;

type Draw = (animate: boolean) => React.ReactNode;

/* -------------------------------------------------------------------------- */
/* Days                                                                       */
/* -------------------------------------------------------------------------- */

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
// The colours the textbook uses for its day labels, so the set is recognisable.
const DAY_COLOURS = ['#a01f8c', '#1f6fc0', '#6b2f9a', '#2f3592', '#1e7a3e', '#1f7fc8', '#e11d2a'];

function WeekStrip({ active, y = 38, h = 26 }: { active: number | 'all'; y?: number; h?: number }) {
  return (
    <>
      {LETTERS.map((letter, i) => {
        const on = active === 'all' || active === i;
        return (
          <g key={i}>
            <rect x={5 + i * 13.2} y={y} width="11.6" height={h} rx="3"
                  fill={on ? DAY_COLOURS[i] : C.white} stroke={on ? DAY_COLOURS[i] : C.grey}
                  strokeWidth="1.5" />
            <text x={10.8 + i * 13.2} y={y + h / 2 + 3.5} textAnchor="middle" fontSize="9"
                  fontWeight="800" fill={on ? C.white : C.grey}>{letter}</text>
          </g>
        );
      })}
    </>
  );
}

const dayDrawings: Record<string, Draw> = {};
DAYS.forEach((name, i) => {
  dayDrawings[`day-${name}`] = () => (
    <Bg tint="#f4f1ff">
      <path d={`M${10.8 + i * 13.2} 30 v-10 m-5 5 l5 -5 l5 5`} stroke={DAY_COLOURS[i]}
            strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <WeekStrip active={i} />
      <rect x="5" y="72" width="88" height="6" rx="3" fill={DAY_COLOURS[i]} opacity="0.25" />
    </Bg>
  );
});

/** April 2026, as printed on page 44: the 1st is a Wednesday, and the month has 30 days. */
function CalendarApril() {
  const cells = [];
  for (let d = 1; d <= 30; d += 1) {
    const slot = d + 2;                       // 1 April 2026 falls in the fourth column (Wednesday)
    cells.push(
      <text key={d} x={11.5 + (slot % 7) * 12.4} y={46 + Math.floor(slot / 7) * 10.5}
            textAnchor="middle" fontSize="6" fontWeight="700" fill={C.ink}>{d}</text>,
    );
  }
  return (
    <Bg tint="#f4f1ff">
      <rect x="6" y="8" width="88" height="84" rx="6" fill={C.white} stroke={C.grey} strokeWidth="2" />
      <rect x="6" y="8" width="88" height="14" rx="6" fill="#8e5bb5" />
      <text x="50" y="18.5" textAnchor="middle" fontSize="7" fontWeight="800" fill={C.white}>APRIL 2026</text>
      {LETTERS.map((l, i) => (
        <text key={i} x={11.5 + i * 12.4} y="31" textAnchor="middle" fontSize="6" fontWeight="800"
              fill={C.deep}>{l}</text>
      ))}
      {cells}
    </Bg>
  );
}

/* -------------------------------------------------------------------------- */
/* Plants                                                                     */
/* -------------------------------------------------------------------------- */

function Pot({ soil = false, sprout = false, x = 0, y = 0, s = 1 }: {
  soil?: boolean; sprout?: boolean; x?: number; y?: number; s?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M26 52 h48 l-6 34 a5 5 0 0 1 -5 4 h-26 a5 5 0 0 1 -5 -4 Z" fill="#e58a5b" />
      <rect x="22" y="46" width="56" height="10" rx="4" fill="#f0a072" />
      {soil ? <ellipse cx="50" cy="47" rx="24" ry="4.5" fill="#6b4a2e" /> : (
        <ellipse cx="50" cy="47" rx="24" ry="4.5" fill="#b86a42" />
      )}
      {sprout ? (
        <>
          <path d="M50 46 v-14" stroke={C.leaf} strokeWidth="3" strokeLinecap="round" />
          <path d="M50 34 q-10 -2 -12 -10 q10 0 12 10 Z M50 34 q10 -2 12 -10 q-10 0 -12 10 Z" fill={C.green} />
        </>
      ) : null}
    </g>
  );
}

function Sun({ cx, cy, r = 9 }: { cx: number; cy: number; r?: number }) {
  return (
    <>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
        <line key={d} x1={cx} y1={cy - r - 3} x2={cx} y2={cy - r - 9} stroke={C.orange}
              strokeWidth="3" strokeLinecap="round" transform={`rotate(${d} ${cx} ${cy})`} />
      ))}
      <circle cx={cx} cy={cy} r={r} fill={C.yellow} stroke={C.orange} strokeWidth="2" />
    </>
  );
}

function WaterCan({ x = 0, y = 0, s = 1, tilt = 0 }: { x?: number; y?: number; s?: number; tilt?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt} 50 50) scale(${s})`}>
      <rect x="30" y="38" width="34" height="26" rx="5" fill="#5fc2d8" stroke="#2b93aa" strokeWidth="2" />
      <path d="M64 46 l20 -12 v8 l-18 14 Z" fill="#5fc2d8" stroke="#2b93aa" strokeWidth="2" strokeLinejoin="round" />
      <path d="M32 40 q-14 -6 -14 8 q0 12 14 8" stroke="#2b93aa" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <rect x="28" y="36" width="38" height="5" rx="2.5" fill="#8ad8e8" />
    </g>
  );
}

function Drops({ x, y }: { x: number; y: number }) {
  return (
    <>
      {[0, 8, 16].map((d, i) => (
        <path key={i} d={`M${x + d} ${y + i * 5} q-3 5 0 8 q3 -3 0 -8 Z`} fill="#7fc7ff" />
      ))}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Birds                                                                      */
/* -------------------------------------------------------------------------- */

const BIRD = '#d8746a';

function Nest({ y = 0 }: { y?: number }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <ellipse cx="50" cy="72" rx="34" ry="14" fill="#b98a4e" />
      <path d="M20 70 q30 12 60 0 M26 78 q24 8 48 0" stroke="#8a6431" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M8 64 q4 -10 14 -8 q-2 10 -14 8 Z M92 64 q-4 -10 -14 -8 q2 10 14 8 Z" fill={C.leaf} />
    </g>
  );
}

function Egg({ x, y }: { x: number; y: number }) {
  return <ellipse cx={x} cy={y} rx="8" ry="10" fill="#a9dcf5" stroke="#6fb5dc" strokeWidth="2" />;
}

function Bird({ x, y, s = 1, flip = false, wings = 'down', beak = 'closed' }: {
  x: number; y: number; s?: number; flip?: boolean; wings?: 'down' | 'up'; beak?: 'closed' | 'open';
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx="0" cy="0" rx="13" ry="10" fill={BIRD} />
      <path d={wings === 'up' ? 'M-2 -4 q-4 -18 12 -18 q-2 10 -6 18 Z' : 'M-4 0 q6 12 16 4 q-6 -2 -16 -4 Z'}
            fill="#b85a50" />
      <circle cx="-10" cy="-8" r="8" fill={BIRD} />
      <circle cx="-12" cy="-9" r="1.8" fill={C.ink} />
      <path d={beak === 'open' ? 'M-17 -9 l-9 -3 l1 6 l8 2 Z' : 'M-17 -8 l-8 2 l8 3 Z'} fill={C.orange} />
      <path d="M12 2 l10 4 l-10 2 Z" fill="#b85a50" />
    </g>
  );
}

function Note({ x, y }: { x: number; y: number }) {
  return (
    <>
      <path d={`M${x} ${y} v-10 l7 -2 v10`} stroke={C.purple} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x - 2} cy={y} r="3" fill={C.purple} /><circle cx={x + 5} cy={y - 2} r="3" fill={C.purple} />
    </>
  );
}

const SKY = '#eaf7ff';

/* -------------------------------------------------------------------------- */

export const UNIT5_DRAWINGS: Record<string, Draw> = {
  ...dayDrawings,

  calendar: () => <CalendarApril />,

  week: () => (
    <Bg tint="#f4f1ff">
      <WeekStrip active="all" y={34} h={32} />
    </Bg>
  ),

  today: (animate) => (
    <Bg tint="#f4f1ff">
      <rect x="18" y="12" width="64" height="76" rx="8" fill={C.white} stroke={C.grey} strokeWidth="2.5" />
      <rect x="18" y="12" width="64" height="18" rx="8" fill={C.red} />
      <circle cx="34" cy="12" r="3.5" fill={C.ink} /><circle cx="66" cy="12" r="3.5" fill={C.ink} />
      <path d="M50 42 L57 57 L73 59 L61 70 L64 85 L50 77 L36 85 L39 70 L27 59 L43 57 Z"
            fill={C.yellow} stroke={C.orange} strokeWidth="2.5" strokeLinejoin="round"
            className={animate ? 'c2-pulse' : undefined} style={{ transformOrigin: '50px 64px' }} />
    </Bg>
  ),

  /* --- Lesson 4: what a seed needs --------------------------------------- */
  'flower-pot': () => (
    <Bg tint="#fff1ee">
      <path d="M50 52 V28" stroke={C.leaf} strokeWidth="4" strokeLinecap="round" />
      <path d="M50 44 q-14 -2 -16 -12 q14 0 16 12 Z" fill={C.green} />
      {[[50, 20], [38, 26], [62, 26], [42, 14], [58, 14]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7" fill={C.red} />)}
      <circle cx="50" cy="20" r="4.5" fill={C.yellow} />
      <Pot soil />
    </Bg>
  ),

  'the-sun': (animate) => (
    <Bg tint="#fff3d6">
      <g className={animate ? 'c2-pulse' : undefined} style={{ transformOrigin: '50px 50px' }}>
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((d) => (
          <line key={d} x1="50" y1="14" x2="50" y2="26" stroke={C.orange} strokeWidth="5"
                strokeLinecap="round" transform={`rotate(${d} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="22" fill={C.red} stroke={C.orange} strokeWidth="3" />
      </g>
    </Bg>
  ),

  'water-can': () => (
    <Bg tint="#eaf7ff">
      <WaterCan x={-2} y={6} s={1.1} tilt={-10} />
      <Drops x={20} y={62} />
    </Bg>
  ),

  plant: () => (
    <Bg tint="#eefaea">
      <path d="M10 62 h80" stroke="#8a6431" strokeWidth="4" strokeLinecap="round" />
      <path d="M50 62 V36" stroke={C.leaf} strokeWidth="4" strokeLinecap="round" />
      <path d="M50 44 q-16 -2 -20 -14 q16 0 20 14 Z M50 40 q16 -2 20 -14 q-16 0 -20 14 Z" fill={C.green} />
      <path d="M50 62 q-8 10 -16 12 M50 62 q0 12 -2 18 M50 62 q8 10 16 12" stroke="#a9713f" strokeWidth="2.5"
            strokeLinecap="round" fill="none" />
    </Bg>
  ),

  'pot-empty': () => <Bg tint="#eaf7ff"><Pot /></Bg>,
  'pot-soil': () => <Bg tint="#eaf7ff"><Pot soil /></Bg>,
  'pot-sprout': () => <Bg tint="#eaf7ff"><Pot soil sprout /></Bg>,

  watering: () => (
    <Bg tint="#eaf7ff">
      <Pot soil x={16} y={6} s={0.8} />
      <g transform="translate(-16 0) scale(0.75)"><Person shirt={C.pink} armR="M62 54 q14 4 22 -2" /></g>
      <WaterCan x={44} y={-16} s={0.55} tilt={22} />
      <Drops x={72} y={40} />
    </Bg>
  ),

  soil: () => (
    <Bg tint="#fff3e6">
      <path d="M10 80 q10 -34 40 -34 q30 0 40 34 Z" fill="#6b4a2e" />
      <circle cx="36" cy="70" r="3" fill="#8a6431" /><circle cx="56" cy="62" r="3.5" fill="#8a6431" />
      <circle cx="68" cy="74" r="2.5" fill="#8a6431" />
    </Bg>
  ),

  leaves: () => (
    <Bg tint="#eefaea">
      <path d="M50 84 V50" stroke={C.leaf} strokeWidth="4" strokeLinecap="round" />
      <path d="M50 58 q-30 -4 -34 -30 q30 2 34 30 Z" fill={C.green} />
      <path d="M50 52 q30 -4 34 -30 q-30 2 -34 30 Z" fill={C.leaf} />
    </Bg>
  ),

  /* --- Lesson 5: Rima and the seed --------------------------------------- */
  'rima-seed': () => (
    <Bg tint="#dff0ff">
      <g transform="translate(-6 -6) scale(0.9)"><Person shirt={C.deep} armR="M62 54 q14 4 22 12" /></g>
      <g transform="translate(40 26) scale(0.62)"><Person shirt={C.pink} armL="M38 54 q-10 6 -12 14" /></g>
      <ellipse cx="72" cy="58" rx="4" ry="2.6" fill="#7a2f2f" />
    </Bg>
  ),

  'rima-soil': () => (
    <Bg tint="#dff0ff">
      <g transform="translate(-6 -10) scale(0.9)"><Person shirt={C.purple} armL="M38 54 q-6 16 6 26" armR="M62 54 q6 16 -6 26" /></g>
      <Pot soil x={22} y={12} s={0.75} />
    </Bg>
  ),

  'rima-put-seed': () => (
    <Bg tint="#dff0ff">
      <g transform="translate(-6 -10) scale(0.9)"><Person shirt={C.pink} armL="M38 54 q-6 16 6 26" armR="M62 54 q6 16 -6 26" /></g>
      <Pot soil x={22} y={12} s={0.75} />
      <ellipse cx="50" cy="42" rx="4" ry="2.6" fill="#7a2f2f" />
      <path d="M50 30 v8 m-4 -3 l4 4 l4 -4" stroke={C.orange} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Bg>
  ),

  'rima-water': () => (
    <Bg tint="#dff0ff">
      <Pot soil x={30} y={12} s={0.75} />
      <g transform="translate(-22 -4) scale(0.8)"><Person shirt={C.orange} armR="M62 54 q16 0 24 -4" /></g>
      <WaterCan x={36} y={-18} s={0.5} tilt={24} />
      <Drops x={72} y={36} />
    </Bg>
  ),

  'rima-sun': () => (
    <Bg tint="#dff0ff">
      <Sun cx={22} cy={26} r={9} />
      <rect x="6" y="66" width="88" height="8" rx="3" fill={C.brown} />
      <Pot soil x={38} y={-2} s={0.7} />
      <g transform="translate(-20 4) scale(0.75)"><Person shirt="#f2d24b" armR="M62 54 q14 -6 20 -14" /></g>
    </Bg>
  ),

  'rima-wait': () => (
    <Bg tint="#dff0ff">
      <g transform="translate(-14 -6) scale(0.9)"><Person shirt={C.pink} armR="M62 54 q4 -4 -6 -14" /></g>
      <Pot soil x={46} y={16} s={0.6} />
      <circle cx="80" cy="22" r="10" fill={C.white} stroke={C.purple} strokeWidth="2.5" />
      <path d="M80 22 v-6 M80 22 l5 3" stroke={C.ink} strokeWidth="2.2" strokeLinecap="round" />
    </Bg>
  ),

  'rima-sprout': (animate) => (
    <Bg tint="#dff0ff">
      <g transform="translate(-14 -6) scale(0.9)"><Person shirt={C.orange} armL="M38 54 q4 8 12 6" armR="M62 54 q-4 8 -12 6" /></g>
      <g className={animate ? 'c2-bounce' : undefined}><Pot soil sprout x={46} y={16} s={0.6} /></g>
      <path d="M78 14 l2 5 l5 1 l-4 3 l1 5 l-4 -3 l-4 3 l1 -5 l-4 -3 l5 -1 Z" fill={C.yellow} />
    </Bg>
  ),

  /* --- Lesson 6: two little birds ---------------------------------------- */
  egg: () => (
    <Bg tint={SKY}>
      <ellipse cx="50" cy="52" rx="20" ry="26" fill="#a9dcf5" stroke="#6fb5dc" strokeWidth="3" />
      <path d="M40 40 q6 -8 14 -6" stroke={C.white} strokeWidth="3" strokeLinecap="round" fill="none" />
    </Bg>
  ),

  'bird-nest': () => (
    <Bg tint={SKY}>
      <Nest />
    </Bg>
  ),

  bird: () => (
    <Bg tint={SKY}>
      <Bird x={54} y={54} s={1.9} />
    </Bg>
  ),

  branch: () => (
    <Bg tint={SKY}>
      <path d="M4 66 q30 -14 60 -8 q16 2 32 -10" stroke="#8a6431" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M30 60 q-2 -14 -14 -16 q0 12 14 16 Z M56 56 q2 -14 14 -18 q2 12 -14 18 Z M76 52 q8 -8 18 -6 q-6 10 -18 6 Z"
            fill={C.green} />
    </Bg>
  ),

  'birds-eggs': () => (
    <Bg tint={SKY}>
      <Nest />
      <Egg x={41} y={66} /><Egg x={59} y={66} />
    </Bg>
  ),

  'birds-hatch': () => (
    <Bg tint={SKY}>
      <Nest />
      <Bird x={40} y={60} s={0.9} beak="open" /><Bird x={62} y={62} s={0.9} flip />
      <path d="M28 76 l6 -5 l4 5 Z M66 76 l6 -5 l4 5 Z" fill="#a9dcf5" />
    </Bg>
  ),

  'birds-sing': () => (
    <Bg tint={SKY}>
      <Nest />
      <Bird x={40} y={58} s={0.95} beak="open" /><Bird x={62} y={60} s={0.95} flip beak="open" />
      <Note x={20} y={24} /><Note x={76} y={22} />
    </Bg>
  ),

  'birds-hop': (animate) => (
    <Bg tint={SKY}>
      <Nest y={6} />
      <g className={animate ? 'c2-bounce' : undefined}>
        <Bird x={34} y={40} s={0.95} wings="up" /><Bird x={68} y={36} s={0.95} flip wings="up" />
      </g>
      <path d="M14 56 q-4 6 0 12 M86 52 q4 6 0 12" stroke={C.pink} strokeWidth="3" strokeLinecap="round" fill="none" />
    </Bg>
  ),

  'birds-branch': () => (
    <Bg tint={SKY}>
      <path d="M2 40 q30 -12 60 -6 q20 4 36 -8" stroke="#8a6431" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M22 36 q-2 -12 -12 -14 q0 10 12 14 Z" fill={C.green} />
      <Bird x={36} y={30} s={0.8} /><Bird x={62} y={28} s={0.8} flip />
      <g transform="translate(0 10) scale(1 0.9)"><Nest y={8} /></g>
    </Bg>
  ),

  'birds-play': () => (
    <Bg tint={SKY}>
      <path d="M2 44 q30 -12 60 -6 q20 4 36 -8" stroke="#8a6431" strokeWidth="7" strokeLinecap="round" fill="none" />
      <Bird x={30} y={34} s={0.8} />
      <Bird x={68} y={66} s={0.85} flip wings="up" />
      <path d="M50 62 q6 -8 12 -2" stroke={C.pink} strokeWidth="3" strokeLinecap="round" fill="none" strokeDasharray="1 6" />
      <Nest y={12} />
    </Bg>
  ),

  'birds-flyaway': () => (
    <Bg tint={SKY}>
      <Nest y={10} />
      <Bird x={44} y={30} s={0.9} flip wings="up" /><Bird x={74} y={18} s={0.8} flip wings="up" />
      <path d="M24 52 q10 -8 18 -18" stroke={C.grey} strokeWidth="2.5" strokeLinecap="round" fill="none" strokeDasharray="2 5" />
    </Bg>
  ),
};
