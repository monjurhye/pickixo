/**
 * Rendering a picture-word.
 *
 * The drawings themselves live in `drawings.tsx` — this file is the component
 * that puts one on screen, and the two are split for the same reason
 * `alphabetDrawings.tsx` is split from `Illustration.tsx`: the table grows
 * every time a word is drawn, and the renderer should not have to be re-read
 * each time.
 *
 * The pictures are Pickixo's own, never lifted from আমার বই (§24 of the brief
 * and ordinary copyright point the same way). Inline SVG rather than image
 * files, because at this size a drawing is smaller than the HTTP request that
 * would fetch it, it scales without blurring, and it animates with CSS alone —
 * which matters on the low-end Android phones §26 targets.
 */
import type { ReactNode } from 'react';
import { hasArtWord } from '@/lib/kids/art-keys';
import { C, DRAWINGS } from './drawings';

const S = {
  stroke: C.ink,
  strokeWidth: 3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/**
 * Whether a word can be shown as a picture.
 *
 * Re-exported from `art-keys` so components have one obvious place to ask.
 * The player checks it before scheduling a picture-dependent activity, so a
 * word with no drawing is never the subject of "which picture is this?" — an
 * unanswerable question is worse than a missing game.
 */
export { hasArtWord as hasArt };

/* -------------------------------------------------------------------------- */
/* The component                                                              */
/* -------------------------------------------------------------------------- */

export interface ArtProps {
  /** The Bangla word, which is also the drawing key. */
  name: string;
  /** Rendered size in px. Touch targets elsewhere enforce the minimum. */
  size?: number;
  className?: string;
  /**
   * Whether the picture gently moves.
   *
   * Respects prefers-reduced-motion through the CSS class, never through a
   * media query read in JS — so it is correct on first paint (§21).
   */
  animate?: boolean;
}

export function Art({ name, size = 120, className = '', animate = false }: ArtProps) {
  // Every picture-word in the curriculum is drawn, and `content.test.mjs`
  // keeps it that way. The lookup still goes through the wider type, and the
  // fallback still exists, because `name` is a plain string at this boundary
  // and a lesson added tomorrow should degrade to a readable card rather than
  // an empty box.
  const drawing = (DRAWINGS as Record<string, ReactNode>)[name];

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      // The word itself is the label. A child does not read it, but a screen
      // reader and a parent do, and it is the honest description.
      aria-label={name}
      className={`${animate ? 'kids-bob' : ''} ${className}`}
    >
      {drawing ?? <Fallback name={name} />}
    </svg>
  );
}

/**
 * Shown when a word has no drawing yet.
 *
 * A card with the word on it — legible, obviously not a picture, and honest
 * about being a placeholder rather than a bad drawing a child might misread.
 * Picture-dependent games never reach this, because `hasArt` filtered them out.
 */
function Fallback({ name }: { name: string }) {
  return (
    <>
      <rect x="8" y="20" width="84" height="60" rx="10" fill={C.cream} {...S} />
      <text
        x="50"
        y="56"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={name.length > 4 ? 15 : 22}
        fill={C.ink}
        fontWeight={600}
      >
        {name}
      </text>
    </>
  );
}

/**
 * Counting dots for the number lessons.
 *
 * Laid out in rows of five, the way আমার বই lays out its bead number-line
 * (book 109 onward) — five-and-some is countable at a glance in a way that a
 * scattered nine is not.
 */
export function CountingDots({ count, size = 160 }: { count: number; size?: number }) {
  const dots = Array.from({ length: count }, (_, i) => i);
  const perRow = 5;
  const rows = Math.max(1, Math.ceil(count / perRow));

  return (
    <svg
      viewBox={`0 0 ${perRow * 22} ${rows * 22}`}
      width={size}
      height={(size / (perRow * 22)) * (rows * 22)}
      role="img"
      aria-label={`${count}`}
    >
      {dots.map((i) => (
        <circle
          key={i}
          cx={(i % perRow) * 22 + 11}
          cy={Math.floor(i / perRow) * 22 + 11}
          r={8}
          fill={C.teal}
          stroke={C.ink}
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}
