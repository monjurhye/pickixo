/**
 * Illustrations for Class 2 Maths: base-ten blocks, Tuli and Rafi, and a
 * plain number card.
 *
 * Original artwork, and generated rather than hand-drawn per number, for the
 * same reason Unit 2's counting dots are generated in the English course: the
 * whole point of a "count the blocks" screen is that the count is right, and
 * thirty hand-placed layouts is thirty chances to draw fifty-four blocks next
 * to the word "forty-five". `parseBlocks` turns a name like `blocks-3-4-5`
 * into exactly 3 hundred-flats, 4 ten-rods and 5 ones-cubes, laid out the way
 * the book itself lays them out — flats, then rods, then cubes — so the
 * picture and the number can never quietly disagree once the JSON is right
 * (and `validateChapter` catches it even if a value is typed in by hand).
 */
import type { CSSProperties } from 'react';
import { bn } from '@/lib/class2/bnNumerals';

const C = {
  ink: '#2b3440',
  flat: '#8fd0e8',
  flatLine: '#4fa8c9',
  rod: '#f6a6c6',
  rodLine: '#d9628f',
  cube: '#ffd54f',
  cubeLine: '#e0a800',
  paper: '#fff9ec',
  skin: '#f4c9a3',
  hairDark: '#2f2a28',
  shirtTuli: '#2eb8a6',
  shirtRafi: '#4a9ff5',
} as const;

const CELL = 6;      // one "unit" square, in local units
const GAP = 3;        // gap between blocks of the same kind
const GROUP_GAP = 10; // gap between hundreds/tens/ones groups

function HundredFlat({ x, y }: { x: number; y: number }) {
  const lines = [];
  for (let i = 1; i < 10; i += 1) {
    lines.push(
      <line key={`h${i}`} x1={x} y1={y + i * CELL} x2={x + 10 * CELL} y2={y + i * CELL}
            stroke={C.flatLine} strokeWidth="0.4" />,
      <line key={`v${i}`} x1={x + i * CELL} y1={y} x2={x + i * CELL} y2={y + 10 * CELL}
            stroke={C.flatLine} strokeWidth="0.4" />,
    );
  }
  return (
    <g>
      <rect x={x} y={y} width={10 * CELL} height={10 * CELL} fill={C.flat} stroke={C.flatLine} strokeWidth="0.8" />
      {lines}
    </g>
  );
}

function TenRod({ x, y }: { x: number; y: number }) {
  const lines = [];
  for (let i = 1; i < 10; i += 1) {
    lines.push(<line key={i} x1={x} y1={y + i * CELL} x2={x + CELL} y2={y + i * CELL}
                     stroke={C.rodLine} strokeWidth="0.4" />);
  }
  return (
    <g>
      <rect x={x} y={y} width={CELL} height={10 * CELL} fill={C.rod} stroke={C.rodLine} strokeWidth="0.8" />
      {lines}
    </g>
  );
}

function OneCube({ x, y }: { x: number; y: number }) {
  return <rect x={x} y={y} width={CELL} height={CELL} fill={C.cube} stroke={C.cubeLine} strokeWidth="0.8" rx="0.6" />;
}

/** Lay `count` copies of a w x h block into rows of `perRow`, left to right. */
function grid(count: number, perRow: number, w: number, h: number, gap: number) {
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    positions.push({ x: col * (w + gap), y: row * (h + gap) });
  }
  const rows = Math.ceil(count / perRow) || (count === 0 ? 0 : 1);
  return { positions, width: Math.min(count, perRow) * (w + gap) - (count ? gap : 0), height: rows * (h + gap) - (rows ? gap : 0) };
}

export interface BlocksProps {
  hundreds: number;
  tens: number;
  ones: number;
  /** Decorative by default: the number beside it already carries the meaning. */
  label?: string;
}

/** Hundreds, tens and ones blocks, side by side, sized to their own content. */
export function Blocks({ hundreds, tens, ones, label }: BlocksProps) {
  const h = grid(hundreds, 3, 10 * CELL, 10 * CELL, GAP);
  const t = grid(tens, 5, CELL, 10 * CELL, GAP);
  const o = grid(ones, 5, CELL, CELL, GAP);

  const groups = [
    hundreds > 0 ? { ...h, draw: (x: number, y: number) => <HundredFlat x={x} y={y} /> } : null,
    tens > 0 ? { ...t, draw: (x: number, y: number) => <TenRod x={x} y={y} /> } : null,
    ones > 0 ? { ...o, draw: (x: number, y: number) => <OneCube x={x} y={y} /> } : null,
  ].filter((g): g is NonNullable<typeof g> => g !== null);

  if (!groups.length) {
    // Zero is a number too — an empty frame rather than nothing on screen.
    return (
      <svg viewBox="0 0 40 40" role={label ? 'img' : undefined} aria-label={label}
           aria-hidden={label ? undefined : true} style={{ width: '100%', height: '100%' }}>
        <rect x="2" y="2" width="36" height="36" rx="6" fill={C.paper} stroke="#e3d9c2" strokeWidth="1" />
        <text x="20" y="25" textAnchor="middle" fontSize="14" fontWeight="800" fill="#c9b98a">0</text>
      </svg>
    );
  }

  const totalWidth = groups.reduce((sum, g, i) => sum + g.width + (i > 0 ? GROUP_GAP : 0), 0);
  const maxHeight = Math.max(...groups.map((g) => g.height));
  const pad = 4;
  const viewW = totalWidth + pad * 2;
  const viewH = maxHeight + pad * 2;

  let cursorX = pad;
  const drawn: React.ReactNode[] = [];
  groups.forEach((g, gi) => {
    const offsetY = pad + (maxHeight - g.height) / 2;
    g.positions.forEach((p, i) => {
      drawn.push(<g key={`${gi}-${i}`}>{g.draw(cursorX + p.x, offsetY + p.y)}</g>);
    });
    cursorX += g.width + GROUP_GAP;
  });

  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} role={label ? 'img' : undefined} aria-label={label}
         aria-hidden={label ? undefined : true} style={{ width: '100%', height: '100%' }}>
      <rect x="0" y="0" width={viewW} height={viewH} rx="6" fill={C.paper} />
      {drawn}
    </svg>
  );
}

/** `blocks-<hundreds>-<tens>-<ones>`, parsed for the generic Illustration slot. */
export function parseBlocks(name: string): BlocksProps | null {
  const match = /^blocks-(\d{1,2})-(\d{1,2})-(\d{1,2})$/.exec(name);
  if (!match) return null;
  return { hundreds: Number(match[1]), tens: Number(match[2]), ones: Number(match[3]) };
}

/** The same reading, from a plain value — `blocksFor(345)` → 3, 4, 5. */
export function blocksFor(value: number): BlocksProps {
  const v = Math.max(0, Math.round(value));
  return { hundreds: Math.floor(v / 100), tens: Math.floor((v % 100) / 10), ones: v % 10 };
}

/* -------------------------------------------------------------------------- */
/* Tuli and Rafi                                                              */
/* -------------------------------------------------------------------------- */

function Face({ shirt, pigtails }: { shirt: string; pigtails: boolean }) {
  return (
    <g>
      <path d="M34 62 q16 -8 32 0 l4 26 q-20 8 -40 0 Z" fill={shirt} />
      <circle cx="50" cy="40" r="20" fill={C.skin} />
      {pigtails ? (
        <>
          <path d="M30 36 q4 -20 20 -20 q16 0 20 20 q-8 -8 -20 -8 q-12 0 -20 8 Z" fill={C.hairDark} />
          <circle cx="28" cy="42" r="5" fill={C.hairDark} />
          <circle cx="72" cy="42" r="5" fill={C.hairDark} />
        </>
      ) : (
        <path d="M29 34 q3 -18 21 -18 q18 0 21 18 q-4 -6 -21 -6 q-17 0 -21 6 Z" fill={C.hairDark} />
      )}
      <circle cx="43" cy="40" r="2.6" fill={C.ink} />
      <circle cx="57" cy="40" r="2.6" fill={C.ink} />
      <path d="M44 48 q6 6 12 0" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </g>
  );
}

export function Tuli() {
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }} aria-hidden="true">
      <rect x="0" y="0" width="100" height="100" rx="18" fill="#eafbf8" />
      <Face shirt={C.shirtTuli} pigtails />
    </svg>
  );
}

export function Rafi() {
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }} aria-hidden="true">
      <rect x="0" y="0" width="100" height="100" rx="18" fill="#eaf3ff" />
      <Face shirt={C.shirtRafi} pigtails={false} />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

const PALETTE = ['#2f6fb5', '#9b7ede', '#2eb8a6', '#f79b4b', '#ef5b5b'];

/** A plain big number, coloured by its digit count so 9, 54 and 345 read differently at a glance. */
export function NumberCard({ value }: { value: number }) {
  const digits = String(value).length;
  const colour = PALETTE[digits % PALETTE.length]!;
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }} aria-hidden="true">
      <rect x="4" y="4" width="92" height="92" rx="14" fill="#ffffff" stroke={colour} strokeWidth="3" />
      <text x="50" y="63" textAnchor="middle" fontSize={value >= 100 ? 30 : 40} fontWeight="800" fill={colour}>
        {bn(value)}
      </text>
    </svg>
  );
}

export type MathDraw = () => React.ReactNode;

function Flowers() {
  const spots = [
    [20, 60], [32, 40], [46, 66], [58, 34], [70, 58], [82, 42], [26, 78], [64, 80],
  ];
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }} aria-hidden="true">
      <rect x="0" y="0" width="100" height="100" rx="18" fill="#fff1ee" />
      {spots.map(([x, y], i) => (
        <g key={i}>
          {[0, 72, 144, 216, 288].map((deg) => (
            <ellipse key={deg} cx={x} cy={(y as number) - 5} rx="3.4" ry="5.5" fill="#ef5b5b"
                     transform={`rotate(${deg} ${x} ${y})`} />
          ))}
          <circle cx={x} cy={y} r="2.6" fill="#fbd14b" />
        </g>
      ))}
    </svg>
  );
}

/**
 * The four shape families of অধ্যায় ৪ — plain and flat on purpose, because the
 * lesson is the shape itself, not a scene it is drawn into.
 */
function ShapeCard({ tint, children }: { tint: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }} aria-hidden="true">
      <rect x="0" y="0" width="100" height="100" rx="16" fill={tint} />
      {children}
    </svg>
  );
}

const SHAPE_DRAWINGS: Record<string, MathDraw> = {
  'shape-circle': () => <ShapeCard tint="#fff1ee"><circle cx="50" cy="50" r="32" fill="#ef5b5b" /></ShapeCard>,
  'shape-triangle': () => <ShapeCard tint="#eefaf1"><path d="M50 16 L86 80 H14 Z" fill="#3f9e4d" /></ShapeCard>,
  'shape-square': () => <ShapeCard tint="#eef3fb"><rect x="20" y="20" width="60" height="60" fill="#4a7fd6" /></ShapeCard>,
  'shape-rectangle': () => <ShapeCard tint="#fff4ea"><rect x="8" y="28" width="84" height="44" fill="#f79b4b" /></ShapeCard>,
  // Real objects, used to match a shape to something the child already knows.
  'obj-coin': () => (
    <ShapeCard tint="#fff8e0">
      <circle cx="50" cy="50" r="30" fill="#d8b84a" stroke="#a8862a" strokeWidth="3" />
      <circle cx="50" cy="50" r="20" fill="none" stroke="#a8862a" strokeWidth="1.5" />
    </ShapeCard>
  ),
  'obj-samosa': () => (
    <ShapeCard tint="#fff4e3"><path d="M50 22 L82 78 H18 Z" fill="#d9a24a" stroke="#a9713f" strokeWidth="2.5" strokeLinejoin="round" /></ShapeCard>
  ),
  'obj-brick': () => (
    <ShapeCard tint="#fdecec"><rect x="14" y="34" width="72" height="32" rx="2" fill="#b5502e" stroke="#7a2f14" strokeWidth="2.5" /></ShapeCard>
  ),
  'obj-ring': () => (
    <ShapeCard tint="#eaf3ff">
      <circle cx="50" cy="56" r="26" fill="none" stroke="#d8b84a" strokeWidth="9" />
      <path d="M50 30 L42 14 H58 Z" fill="#4a9ff5" stroke="#2f6fb5" strokeWidth="1.5" strokeLinejoin="round" />
    </ShapeCard>
  ),
  'obj-matchbox': () => (
    <ShapeCard tint="#eefaea"><rect x="10" y="32" width="80" height="36" rx="2" fill="#e8d3a0" stroke="#a9713f" strokeWidth="2.5" /></ShapeCard>
  ),
  'obj-sweet-round': () => <ShapeCard tint="#fff1e0"><circle cx="50" cy="50" r="28" fill="#c9702f" /></ShapeCard>,
  'obj-bread': () => (
    <ShapeCard tint="#fff4e3"><rect x="10" y="26" width="80" height="48" rx="6" fill="#e8b96a" stroke="#a9713f" strokeWidth="2.5" /></ShapeCard>
  ),
};

/** `pattern-<code>-<pos>`, where `code` is a string of c/s/t (circle/square/triangle) repeated, `pos` is highlighted. */
function PatternStrip({ code, highlight }: { code: string; highlight: number }) {
  const shapes: Record<string, { fill: string; draw: (x: number) => React.ReactNode }> = {
    c: { fill: '#ef5b5b', draw: (x) => <circle cx={x + 7} cy="20" r="7" fill="#ef5b5b" /> },
    s: { fill: '#4a7fd6', draw: (x) => <rect x={x} y="13" width="14" height="14" fill="#4a7fd6" /> },
    t: { fill: '#3f9e4d', draw: (x) => <path d={`M${x + 7} 11 L${x + 14} 27 H${x} Z`} fill="#3f9e4d" /> },
  };
  const gap = 6;
  const w = 14;
  const viewW = code.length * (w + gap) + gap;
  return (
    <svg viewBox={`0 0 ${viewW} 40`} style={{ width: '100%', height: '100%' }} aria-hidden="true">
      <rect x="0" y="0" width={viewW} height="40" rx="6" fill="#f8f5ee" />
      {code.split('').map((ch, i) => {
        const x = gap + i * (w + gap);
        const isTarget = i === highlight;
        return (
          <g key={i}>
            {isTarget ? <rect x={x - 3} y="6" width={w + 6} height={w + 6} rx="4" fill="none" stroke="#ef2b2b" strokeWidth="1.6" /> : null}
            {shapes[ch]?.draw(x)}
          </g>
        );
      })}
    </svg>
  );
}

/** A ruler from 0 to `max` cm, with a bar under it ending at `len` cm — অধ্যায় ৫'s দৈর্ঘ্য পরিমাপ. */
function Ruler({ len, max = 20 }: { len: number; max?: number }) {
  const w = 200;
  const pad = 8;
  const step = (w - pad * 2) / max;
  const ticks = [];
  for (let i = 0; i <= max; i += 1) {
    const x = pad + i * step;
    const tall = i % 5 === 0;
    ticks.push(<line key={i} x1={x} y1="6" x2={x} y2={tall ? 16 : 12} stroke="#4a5058" strokeWidth="1" />);
    if (tall) ticks.push(<text key={`t${i}`} x={x} y="26" textAnchor="middle" fontSize="7" fill="#4a5058">{i}</text>);
  }
  return (
    <svg viewBox={`0 0 ${w} 50`} style={{ width: '100%', height: '100%' }} aria-hidden="true">
      <rect x="0" y="0" width={w} height="50" rx="6" fill="#f3f5f8" />
      <rect x={pad} y="2" width={w - pad * 2} height="20" fill="#ffffff" stroke="#9aa7b4" strokeWidth="1" />
      {ticks}
      <rect x={pad} y="34" width={Math.max(2, len * step)} height="10" rx="3" fill="#f79b4b" stroke="#c9702f" strokeWidth="1.2" />
    </svg>
  );
}

/** An analogue clock face at `hour`:`minute` (minute rounded to a multiple of 5) — সময় পরিমাপ. */
function Clock({ hour, minute }: { hour: number; minute: number }) {
  const h = ((hour % 12) + minute / 60) * 30; // degrees
  const m = minute * 6;
  const hx = 50 + 16 * Math.sin((h * Math.PI) / 180);
  const hy = 50 - 16 * Math.cos((h * Math.PI) / 180);
  const mx = 50 + 24 * Math.sin((m * Math.PI) / 180);
  const my = 50 - 24 * Math.cos((m * Math.PI) / 180);
  const marks = [];
  for (let i = 0; i < 12; i += 1) {
    const a = i * 30;
    const x1 = 50 + 30 * Math.sin((a * Math.PI) / 180);
    const y1 = 50 - 30 * Math.cos((a * Math.PI) / 180);
    const x2 = 50 + 26 * Math.sin((a * Math.PI) / 180);
    const y2 = 50 - 26 * Math.cos((a * Math.PI) / 180);
    marks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#4a5058" strokeWidth="1.6" />);
  }
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }} aria-hidden="true">
      <circle cx="50" cy="50" r="38" fill="#fff9ec" stroke="#c9a24a" strokeWidth="4" />
      {marks}
      <line x1="50" y1="50" x2={hx} y2={hy} stroke="#2b3440" strokeWidth="3.4" strokeLinecap="round" />
      <line x1="50" y1="50" x2={mx} y2={my} stroke="#2b3440" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="50" cy="50" r="2.6" fill="#ef5b5b" />
    </svg>
  );
}

/** A Bangladeshi taka coin or note for `value` — অধ্যায় ৬. Coins for small values, a note for the rest. */
function Taka({ value }: { value: number }) {
  const isCoin = value <= 5;
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }} aria-hidden="true">
      <rect x="0" y="0" width="100" height="100" rx="16" fill="#fff8e0" />
      {isCoin ? (
        <>
          <circle cx="50" cy="50" r="34" fill="#d8c98a" stroke="#a8862a" strokeWidth="3" />
          <circle cx="50" cy="50" r="26" fill="none" stroke="#a8862a" strokeWidth="1.4" />
          <text x="50" y="58" textAnchor="middle" fontSize="22" fontWeight="800" fill="#6b5620">৳{bn(value)}</text>
        </>
      ) : (
        <>
          <rect x="8" y="30" width="84" height="40" rx="4" fill="#cfe3d0" stroke="#3f7d5a" strokeWidth="2.5" />
          <rect x="12" y="34" width="76" height="32" rx="2" fill="none" stroke="#3f7d5a" strokeWidth="1" strokeDasharray="2 2" />
          <circle cx="26" cy="50" r="11" fill="#a9d0ab" stroke="#3f7d5a" strokeWidth="1.4" />
          <text x="63" y="57" textAnchor="middle" fontSize="20" fontWeight="800" fill="#2f5c40">৳{bn(value)}</text>
        </>
      )}
    </svg>
  );
}

/**
 * Tally marks for `n` — অধ্যায় ৭'s ট্যালি চিহ্ন: four upright strokes, a fifth
 * struck diagonally across them to close the group of five, exactly as the
 * book explains it, generated so the stroke count can never drift from `n`.
 */
function Tally({ n }: { n: number }) {
  const count = Math.max(0, Math.min(30, Math.round(n)));
  const groups = Math.ceil(count / 5) || 1;
  const groupW = 30;
  const gap = 10;
  const viewW = groups * groupW + (groups - 1) * gap + 16;
  const nodes: React.ReactNode[] = [];
  for (let g = 0; g < groups; g += 1) {
    const inGroup = Math.min(5, count - g * 5);
    const x0 = 8 + g * (groupW + gap);
    for (let i = 0; i < Math.min(4, inGroup); i += 1) {
      const x = x0 + i * 6;
      nodes.push(<line key={`${g}-${i}`} x1={x} y1="10" x2={x} y2="38" stroke="#2b3440" strokeWidth="2.6" strokeLinecap="round" />);
    }
    if (inGroup === 5) {
      nodes.push(<line key={`${g}-cross`} x1={x0 - 3} y1="34" x2={x0 + 21} y2="12" stroke="#ef5b5b" strokeWidth="2.6" strokeLinecap="round" />);
    }
  }
  return (
    <svg viewBox={`0 0 ${viewW} 46`} style={{ width: '100%', height: '100%' }} aria-hidden="true">
      <rect x="0" y="0" width={viewW} height="46" rx="6" fill="#fff9ec" />
      {nodes}
    </svg>
  );
}

export const MATH_DRAWINGS: Record<string, MathDraw> = {
  tuli: () => <Tuli />,
  rafi: () => <Rafi />,
  flowers: () => <Flowers />,
  ...SHAPE_DRAWINGS,
};

/**
 * `n` small circles, grouped two at a time — the book's own "goal দাগ" way of
 * finding odd and even (page 26-29): a number is even when nothing is left
 * over once every circle has a partner, odd when exactly one does not.
 */
function PairDots({ n }: { n: number }) {
  const count = Math.max(0, Math.min(50, Math.round(n)));
  const perRow = 6; // 3 pairs per row
  const pairs = Math.floor(count / 2);
  const hasOdd = count % 2 === 1;
  const podW = 20;
  const podH = 11;
  const gapX = 4;
  const gapY = 4;
  const items: React.ReactNode[] = [];
  for (let p = 0; p < pairs; p += 1) {
    const row = Math.floor(p / (perRow / 2));
    const col = p % (perRow / 2);
    const x = 6 + col * (podW + gapX);
    const y = 6 + row * (podH + gapY);
    items.push(
      <g key={p}>
        <rect x={x} y={y} width={podW} height={podH} rx={podH / 2} fill="#eafbf8" stroke="#2eb8a6" strokeWidth="1" />
        <circle cx={x + podW * 0.3} cy={y + podH / 2} r="4" fill="#2eb8a6" />
        <circle cx={x + podW * 0.7} cy={y + podH / 2} r="4" fill="#2eb8a6" />
      </g>,
    );
  }
  if (hasOdd) {
    const row = Math.floor(pairs / (perRow / 2));
    const col = pairs % (perRow / 2);
    const x = 6 + col * (podW + gapX);
    const y = 6 + row * (podH + gapY);
    items.push(<circle key="odd" cx={x + 5} cy={y + podH / 2} r="4.6" fill="#f79b4b" stroke="#c9702f" strokeWidth="1" />);
  }
  const rows = Math.ceil((pairs + (hasOdd ? 1 : 0)) / (perRow / 2)) || 1;
  const viewW = 6 + (perRow / 2) * (podW + gapX);
  const viewH = 6 + rows * (podH + gapY) + 4;
  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} style={{ width: '100%', height: '100%' }} aria-hidden="true">
      <rect x="0" y="0" width={viewW} height={viewH} rx="6" fill="#fff9ec" />
      {items}
    </svg>
  );
}

/**
 * `total` small blocks in a row, the one at `pos` (counting from `dir`)
 * picked out — for ক্রমবাচক সংখ্যা (ordinal numbers), where the point is
 * literally "count from this end and stop here".
 */
function LinePosition({ total, pos, dir }: { total: number; pos: number; dir: 'L' | 'R' }) {
  const n = Math.max(1, Math.min(12, Math.round(total)));
  const target = dir === 'L' ? pos : n - pos + 1;
  const w = 10;
  const gap = 3;
  const viewW = n * (w + gap) + gap;
  const viewH = 30;
  const items = [];
  for (let i = 1; i <= n; i += 1) {
    const isTarget = i === target;
    const x = gap + (i - 1) * (w + gap);
    items.push(
      <g key={i}>
        <rect x={x} y="8" width={w} height="14" rx="3"
              fill={isTarget ? '#ef5b5b' : '#c9d2dc'} stroke={isTarget ? '#a33' : '#9aa7b4'} strokeWidth="1" />
        {isTarget ? <circle cx={x + w / 2} cy="4" r="2.6" fill="#ef5b5b" /> : null}
      </g>,
    );
  }
  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} style={{ width: '100%', height: '100%' }} aria-hidden="true">
      <rect x="0" y="0" width={viewW} height={viewH} rx="6" fill="#f3f5f8" />
      <text x={gap + 1} y={viewH - 2} fontSize="6" fill="#6b7684">{dir === 'L' ? 'বাম' : 'ডান'}</text>
      {items}
    </svg>
  );
}

export function mathIllustration(name: string): React.ReactNode | null {
  const fixed = MATH_DRAWINGS[name];
  if (fixed) return fixed();
  const blocks = parseBlocks(name);
  if (blocks) return <Blocks {...blocks} />;
  const numberMatch = /^number-(\d{1,4})$/.exec(name);
  if (numberMatch) return <NumberCard value={Number(numberMatch[1])} />;
  const pairsMatch = /^pairs-(\d{1,2})$/.exec(name);
  if (pairsMatch) return <PairDots n={Number(pairsMatch[1])} />;
  const lineMatch = /^line-(\d{1,2})-(\d{1,2})-(L|R)$/.exec(name);
  if (lineMatch) {
    return <LinePosition total={Number(lineMatch[1])} pos={Number(lineMatch[2])} dir={lineMatch[3] as 'L' | 'R'} />;
  }
  const patternMatch = /^pattern-([cst]+)-(\d{1,2})$/.exec(name);
  if (patternMatch) return <PatternStrip code={patternMatch[1]!} highlight={Number(patternMatch[2])} />;
  const rulerMatch = /^ruler-(\d{1,2})$/.exec(name);
  if (rulerMatch) return <Ruler len={Number(rulerMatch[1])} />;
  const clockMatch = /^clock-(\d{1,2})-(\d{1,2})$/.exec(name);
  if (clockMatch) return <Clock hour={Number(clockMatch[1])} minute={Number(clockMatch[2])} />;
  const takaMatch = /^taka-(\d{1,4})$/.exec(name);
  if (takaMatch) return <Taka value={Number(takaMatch[1])} />;
  const tallyMatch = /^tally-(\d{1,2})$/.exec(name);
  if (tallyMatch) return <Tally n={Number(tallyMatch[1])} />;
  return null;
}

export function hasMathIllustration(name: string | null | undefined): boolean {
  if (!name) return false;
  return name in MATH_DRAWINGS || parseBlocks(name) !== null
    || /^number-\d{1,4}$/.test(name) || /^pairs-\d{1,2}$/.test(name)
    || /^line-\d{1,2}-\d{1,2}-(L|R)$/.test(name) || /^pattern-[cst]+-\d{1,2}$/.test(name)
    || /^ruler-\d{1,2}$/.test(name) || /^clock-\d{1,2}-\d{1,2}$/.test(name)
    || /^taka-\d{1,4}$/.test(name) || /^tally-\d{1,2}$/.test(name);
}

/** Shared frame so an unrecognised name still renders something, never a gap. */
export function MathIllustration({ name, size = 96, className, label }: {
  name: string; size?: number; className?: string; label?: string;
}) {
  const node = mathIllustration(name);
  const style: CSSProperties = { width: size, height: size, flexShrink: 0 };
  if (node) {
    return <div style={style} className={className}>{node}</div>;
  }
  return (
    <svg viewBox="0 0 100 100" style={style} className={className}
         role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <rect x="0" y="0" width="100" height="100" rx="18" fill="#eef2f7" />
      <circle cx="50" cy="50" r="28" fill="#ffffff" stroke="#c9d2dc" strokeWidth="3" />
      <text x="50" y="60" textAnchor="middle" fontSize="28" fontWeight="800" fill="#c9d2dc">?</text>
    </svg>
  );
}
