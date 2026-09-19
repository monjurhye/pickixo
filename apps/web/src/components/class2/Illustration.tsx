/**
 * Original illustrations for Class 2 English.
 *
 * Drawn here rather than taken from the textbook: §39 of the brief and
 * ordinary copyright point the same way, so the NCTB artwork stays in the
 * book and these are Pickixo's own.
 *
 * Inline SVG rather than image files, because at this size it is smaller than
 * the HTTP request would be, it scales to any screen without blurring, and it
 * can be animated with CSS — which the brief asks for on words like "run" and
 * "grow".
 *
 * House style, kept deliberately consistent so twenty of these sitting
 * together look like one set: flat fills, no gradients, rounded joins, a thick
 * 2.5 stroke that survives being shrunk to a thumbnail, and a small warm
 * palette. A seven-year-old should recognise the thing in under a second.
 */
import type { CSSProperties } from 'react';
import { ALPHABET_DRAWINGS, CountingDots } from './alphabetDrawings';
import { UNIT3_DRAWINGS } from './unit3Drawings';
import { UNIT4_DRAWINGS } from './unit4Drawings';

const C = {
  ink: '#2b3440',
  skin: '#f4c9a3',
  hair: '#2f2a28',
  red: '#ef5b5b',
  orange: '#f79b4b',
  yellow: '#fbd14b',
  green: '#5cb85c',
  teal: '#2eb8a6',
  blue: '#4a9ff5',
  deep: '#2f6fb5',
  purple: '#9b7ede',
  pink: '#f58fb4',
  paper: '#fff6e9',
  white: '#ffffff',
  grey: '#c9d2dc',
} as const;

export type IllustrationName =
  | 'hello' | 'sunrise' | 'nametag' | 'thanks' | 'house'
  | 'asking' | 'happy-face' | 'thumbs-up' | 'birthday'
  | 'number-7' | 'number-8'
  | 'waving-goodbye' | 'hand-wave' | 'see-you' | 'care' | 'later'
  | 'two-children-waving' | 'two-friends-talking' | 'children-waving-goodbye'
  | 'star' | 'unknown';

interface Props {
  name: string;
  /** Pixel size of the square. */
  size?: number;
  /** Adds a gentle idle animation where the drawing supports one. */
  animate?: boolean;
  className?: string;
  /** Decorative by default: the word beside it already carries the meaning. */
  label?: string;
}

/** A child's face and body, reused so the cast looks like one family. */
function Kid({
  x = 0, hair = C.hair, shirt = C.red, wave = false, flip = false,
}: { x?: number; hair?: string; shirt?: string; wave?: boolean; flip?: boolean }) {
  return (
    <g transform={`translate(${x} 0) ${flip ? 'scale(-1 1) translate(-100 0)' : ''}`}>
      {/* body */}
      <path d="M34 62 q16 -8 32 0 l4 26 q-20 8 -40 0 Z" fill={shirt} />
      {/* legs */}
      <rect x="40" y="86" width="8" height="14" rx="4" fill={C.deep} />
      <rect x="52" y="86" width="8" height="14" rx="4" fill={C.deep} />
      {/* arms */}
      <path d="M36 66 q-10 8 -10 18" stroke={C.skin} strokeWidth="7"
            strokeLinecap="round" fill="none" />
      <path
        d={wave ? 'M64 66 q12 -6 14 -20' : 'M64 66 q10 8 10 18'}
        stroke={C.skin} strokeWidth="7" strokeLinecap="round" fill="none"
        className={wave ? 'c2-wave' : undefined}
      />
      {/* head */}
      <circle cx="50" cy="40" r="20" fill={C.skin} />
      <path d="M30 36 q4 -20 20 -20 q16 0 20 20 q-8 -8 -20 -8 q-12 0 -20 8 Z"
            fill={hair} />
      <circle cx="43" cy="40" r="2.6" fill={C.ink} />
      <circle cx="57" cy="40" r="2.6" fill={C.ink} />
      <path d="M44 48 q6 6 12 0" stroke={C.ink} strokeWidth="2.4"
            strokeLinecap="round" fill="none" />
    </g>
  );
}

function Frame({ children, tint = C.paper }: { children: React.ReactNode; tint?: string }) {
  return (
    <>
      <rect x="0" y="0" width="100" height="100" rx="18" fill={tint} />
      {children}
    </>
  );
}

/* -------------------------------------------------------------------------- */

const DRAWINGS: Record<string, (animate: boolean) => React.ReactNode> = {
  hello: () => (
    <Frame tint="#e8f4ff">
      <Kid x={0} shirt={C.red} wave />
      <g>
        <rect x="60" y="10" width="34" height="20" rx="10" fill={C.white}
              stroke={C.blue} strokeWidth="2.5" />
        <text x="77" y="24" textAnchor="middle" fontSize="10" fontWeight="700"
              fill={C.deep}>Hi!</text>
      </g>
    </Frame>
  ),

  sunrise: (animate) => (
    <Frame tint="#fff3d6">
      <circle cx="50" cy="58" r="20" fill={C.yellow}
              className={animate ? 'c2-pulse' : undefined} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line key={deg} x1="50" y1="58" x2="50" y2="28"
              stroke={C.orange} strokeWidth="4" strokeLinecap="round"
              transform={`rotate(${deg} 50 58)`} />
      ))}
      <rect x="6" y="74" width="88" height="20" rx="8" fill={C.green} />
    </Frame>
  ),

  nametag: () => (
    <Frame tint="#eefbf3">
      <rect x="16" y="26" width="68" height="48" rx="10" fill={C.white}
            stroke={C.green} strokeWidth="3" />
      <rect x="16" y="26" width="68" height="14" rx="7" fill={C.green} />
      <line x1="26" y1="52" x2="74" y2="52" stroke={C.grey} strokeWidth="4"
            strokeLinecap="round" />
      <line x1="26" y1="62" x2="60" y2="62" stroke={C.grey} strokeWidth="4"
            strokeLinecap="round" />
    </Frame>
  ),

  thanks: () => (
    <Frame tint="#ffeef4">
      <path d="M50 82 C22 62 16 46 26 36 C34 28 46 30 50 40 C54 30 66 28 74 36
               C84 46 78 62 50 82 Z" fill={C.pink} stroke={C.red} strokeWidth="3"
            strokeLinejoin="round" />
    </Frame>
  ),

  house: () => (
    <Frame tint="#eaf7ff">
      <path d="M50 20 L86 50 H14 Z" fill={C.red} />
      <rect x="24" y="50" width="52" height="34" rx="5" fill={C.paper}
            stroke={C.ink} strokeWidth="2.5" />
      <rect x="44" y="62" width="14" height="22" rx="3" fill={C.deep} />
      <rect x="30" y="58" width="10" height="10" rx="2" fill={C.blue} />
    </Frame>
  ),

  asking: () => (
    <Frame tint="#f1eeff">
      <Kid x={-6} shirt={C.purple} />
      <circle cx="74" cy="30" r="17" fill={C.white} stroke={C.purple} strokeWidth="3" />
      <text x="74" y="37" textAnchor="middle" fontSize="20" fontWeight="800"
            fill={C.purple}>?</text>
    </Frame>
  ),

  'happy-face': (animate) => (
    <Frame tint="#fff8e0">
      <circle cx="50" cy="50" r="32" fill={C.yellow}
              className={animate ? 'c2-bounce' : undefined} />
      <circle cx="40" cy="44" r="4" fill={C.ink} />
      <circle cx="60" cy="44" r="4" fill={C.ink} />
      <path d="M36 58 q14 14 28 0" stroke={C.ink} strokeWidth="4"
            strokeLinecap="round" fill="none" />
    </Frame>
  ),

  'thumbs-up': () => (
    <Frame tint="#eefbf3">
      <path d="M40 54 v28 h-12 a4 4 0 0 1 -4 -4 v-20 a4 4 0 0 1 4 -4 Z"
            fill={C.skin} stroke={C.ink} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M44 54 l8 -22 a6 6 0 0 1 11 4 l-3 12 h14 a6 6 0 0 1 6 7 l-4 20
               a8 8 0 0 1 -8 7 H44 Z"
            fill={C.skin} stroke={C.ink} strokeWidth="2.5" strokeLinejoin="round" />
    </Frame>
  ),

  birthday: () => (
    <Frame tint="#fff0f6">
      <rect x="24" y="52" width="52" height="28" rx="6" fill={C.pink}
            stroke={C.red} strokeWidth="2.5" />
      <rect x="24" y="46" width="52" height="10" rx="5" fill={C.white} />
      <rect x="47" y="28" width="6" height="18" rx="3" fill={C.blue} />
      <circle cx="50" cy="24" r="5" fill={C.orange} className="c2-pulse" />
    </Frame>
  ),


  'waving-goodbye': () => (
    <Frame tint="#fff1e6">
      <Kid x={0} shirt={C.orange} wave />
      <path d="M72 46 q10 -6 18 0" stroke={C.orange} strokeWidth="3"
            strokeLinecap="round" fill="none" />
      <path d="M74 56 q10 -6 18 0" stroke={C.orange} strokeWidth="3"
            strokeLinecap="round" fill="none" />
    </Frame>
  ),

  'hand-wave': (animate) => (
    <Frame tint="#eaf7ff">
      <g className={animate ? 'c2-wave-hand' : undefined} style={{ transformOrigin: '50px 80px' }}>
        <rect x="38" y="52" width="24" height="34" rx="10" fill={C.skin}
              stroke={C.ink} strokeWidth="2.5" />
        {[28, 38, 48, 58].map((x, i) => (
          <rect key={x} x={x} y={30 + (i === 0 || i === 3 ? 8 : 0)} width="9"
                height={26 - (i === 0 || i === 3 ? 6 : 0)} rx="4.5"
                fill={C.skin} stroke={C.ink} strokeWidth="2.5" />
        ))}
      </g>
    </Frame>
  ),

  'see-you': () => (
    <Frame tint="#eefbf3">
      <ellipse cx="50" cy="50" rx="34" ry="20" fill={C.white}
               stroke={C.teal} strokeWidth="3" />
      <circle cx="50" cy="50" r="11" fill={C.teal} />
      <circle cx="50" cy="50" r="5" fill={C.ink} />
      <circle cx="46" cy="46" r="2" fill={C.white} />
    </Frame>
  ),

  care: () => (
    <Frame tint="#ffeef4">
      <path d="M50 78 C26 60 20 46 29 38 C36 31 46 33 50 41 C54 33 64 31 71 38
               C80 46 74 60 50 78 Z" fill={C.red} />
      <path d="M30 30 q20 -14 40 0" stroke={C.pink} strokeWidth="4"
            strokeLinecap="round" fill="none" />
    </Frame>
  ),

  later: () => (
    <Frame tint="#f1eeff">
      <circle cx="50" cy="50" r="30" fill={C.white} stroke={C.purple} strokeWidth="3.5" />
      <line x1="50" y1="50" x2="50" y2="32" stroke={C.ink} strokeWidth="4"
            strokeLinecap="round" />
      <line x1="50" y1="50" x2="64" y2="56" stroke={C.ink} strokeWidth="4"
            strokeLinecap="round" />
      <circle cx="50" cy="50" r="3.5" fill={C.red} />
    </Frame>
  ),

  'two-children-waving': () => (
    <Frame tint="#e8f4ff">
      <g transform="translate(-12 6) scale(0.82)"><Kid shirt={C.red} wave /></g>
      <g transform="translate(46 6) scale(0.82)"><Kid shirt={C.teal} hair="#3b2b45" wave flip /></g>
    </Frame>
  ),

  'two-friends-talking': () => (
    <Frame tint="#eefbf3">
      <g transform="translate(-12 10) scale(0.78)"><Kid shirt={C.purple} /></g>
      <g transform="translate(46 10) scale(0.78)"><Kid shirt={C.orange} hair="#4a2f22" flip /></g>
      <rect x="34" y="8" width="32" height="16" rx="8" fill={C.white}
            stroke={C.green} strokeWidth="2.5" />
      <circle cx="44" cy="16" r="2" fill={C.green} />
      <circle cx="50" cy="16" r="2" fill={C.green} />
      <circle cx="56" cy="16" r="2" fill={C.green} />
    </Frame>
  ),

  'children-waving-goodbye': () => (
    <Frame tint="#fff1e6">
      <g transform="translate(-12 8) scale(0.8)"><Kid shirt={C.orange} wave /></g>
      <g transform="translate(46 8) scale(0.8)"><Kid shirt={C.blue} hair="#2f2a28" wave flip /></g>
      <path d="M40 14 q10 -8 20 0" stroke={C.orange} strokeWidth="3"
            strokeLinecap="round" fill="none" />
    </Frame>
  ),

  star: (animate) => (
    <Frame tint="#fff8e0">
      <path d="M50 18 L60 40 L84 43 L67 60 L71 84 L50 72 L29 84 L33 60 L16 43 L40 40 Z"
            fill={C.yellow} stroke={C.orange} strokeWidth="3" strokeLinejoin="round"
            className={animate ? 'c2-pulse' : undefined} />
    </Frame>
  ),

  unknown: () => (
    <Frame tint="#eef2f7">
      <circle cx="50" cy="50" r="28" fill={C.white} stroke={C.grey} strokeWidth="3" />
      <text x="50" y="60" textAnchor="middle" fontSize="28" fontWeight="800"
            fill={C.grey}>?</text>
    </Frame>
  ),
};

/**
 * A number card, and a card of that many things to count.
 *
 * Generated from the number rather than drawn thirty times: the whole point of
 * the lesson is that the count is correct, and thirty hand-placed layouts is
 * thirty chances to draw four dots above the word "five".
 */
const NUMBER_TINTS = ['#eaf7ff', '#fdeef7', '#eefbf3', '#fff5df', '#f1eeff'];
const NUMBER_COLOURS = [C.deep, C.purple, C.green, C.orange, C.teal];

function NumberCard({ value }: { value: number }) {
  const tint = NUMBER_TINTS[value % NUMBER_TINTS.length]!;
  const colour = NUMBER_COLOURS[value % NUMBER_COLOURS.length]!;
  return (
    <Frame tint={tint}>
      <rect x="20" y="16" width="60" height="68" rx="12" fill={C.white}
            stroke={colour} strokeWidth="3" />
      <text x="50" y="68" textAnchor="middle" fontSize={value > 9 ? 38 : 46}
            fontWeight="800" fill={colour}>{value}</text>
    </Frame>
  );
}

/** The same number, shown as things to count. */
function CountCard({ value }: { value: number }) {
  const colour = NUMBER_COLOURS[value % NUMBER_COLOURS.length]!;
  return (
    <Frame tint="#ffffff">
      <CountingDots count={value} colour={colour} />
    </Frame>
  );
}

/**
 * `number-7` and `count-7` are generated on demand, so a lesson can reference
 * any number from 1 to 30 without a drawing having to exist for it.
 *
 * Returns the rendered node rather than a component factory: returning an
 * anonymous function here is what React's lint flags as a component with no
 * display name, and naming thirty of them would be noise.
 */
function dynamicDrawing(name: string): React.ReactNode | null {
  const match = /^(number|count)-(\d{1,2})$/.exec(name);
  if (!match) return null;
  const value = Number(match[2]);
  if (!Number.isInteger(value) || value < 0 || value > 30) return null;
  return match[1] === 'count'
    ? <CountCard value={value} />
    : <NumberCard value={value} />;
}

/**
 * Render an illustration by name.
 *
 * An unknown name draws a friendly question mark rather than throwing or
 * leaving a hole — a missing picture must never be what stops a child
 * finishing a lesson.
 */
export function Illustration({
  name, size = 96, animate = false, className, label,
}: Props) {
  const draw = DRAWINGS[name] ?? ALPHABET_DRAWINGS[name]
    ?? UNIT3_DRAWINGS[name] ?? UNIT4_DRAWINGS[name];
  const generated = draw ? null : dynamicDrawing(name);
  const style: CSSProperties = { width: size, height: size, flexShrink: 0 };

  return (
    <svg
      viewBox="0 0 100 100"
      style={style}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {draw ? draw(animate) : (generated ?? DRAWINGS.unknown!(animate))}
    </svg>
  );
}

export function hasIllustration(name: string | null | undefined): boolean {
  if (!name) return false;
  return name in DRAWINGS || name in ALPHABET_DRAWINGS || name in UNIT3_DRAWINGS
    || name in UNIT4_DRAWINGS
    || dynamicDrawing(name) !== null;
}
