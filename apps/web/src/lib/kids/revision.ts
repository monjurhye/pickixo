/**
 * Bringing things back before they are forgotten.
 *
 * Two mechanisms, for two different problems.
 *
 * **Spacing** handles ordinary forgetting. An item the child got right comes
 * back after 1, then 3, then 7, then 21 days. This is the standard expanding
 * interval, kept short at the start because a pre-primary child's week is long.
 *
 * **Discrimination sets** handle a specific, different failure: the child has
 * not forgotten ক, they are *mixing it up with* খ. More practice on ক alone
 * does not fix that — the two have to be put side by side. The brief asks for
 * this in §18 and it is the part of revision that generic spacing cannot do.
 *
 * Neither ever produces a "test". A revision round looks exactly like a normal
 * game, at whatever level the child is on, because a four-year-old who can
 * tell revision from play will stop wanting to do it.
 */

import type { Level } from './content';
import { confusions, type ItemProgress, type Mastery } from './mastery';

/** Days until an item comes back, by how many times it has been right. */
const INTERVALS = [1, 3, 7, 21];

/**
 * Items at these mastery states are never scheduled away.
 *
 * Something the child is still learning stays in rotation; only work that has
 * actually landed earns a gap.
 */
const ALWAYS_DUE: ReadonlySet<Mastery> = new Set<Mastery>([
  'introduced', 'learning',
]);

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/**
 * When an item should next be seen.
 *
 * The interval is chosen by the number of correct answers, capped at the last
 * step — so an item does not disappear for months. A miss resets it to
 * tomorrow, not to zero: the child sees it again next session, not four times
 * in the next two minutes.
 */
export function schedule(item: ItemProgress, now: string): string | null {
  if (ALWAYS_DUE.has(item.mastery)) return now;

  const lastWasWrong = item.recent.length > 0 && !item.recent[item.recent.length - 1];
  if (lastWasWrong) return addDays(now, 1);

  const step = Math.min(item.correct, INTERVALS.length) - 1;
  if (step < 0) return now;
  return addDays(now, INTERVALS[step]!);
}

/** Items due for another look, weakest first. */
export function due(
  items: Record<string, ItemProgress>,
  now: string,
  limit = 8,
): ItemProgress[] {
  return Object.values(items)
    .filter((item) => {
      if (item.mastery === 'not_started') return false;
      if (ALWAYS_DUE.has(item.mastery)) return true;
      return !item.dueAt || item.dueAt <= now;
    })
    .sort((a, b) => {
      // Most-missed first, then least recently seen.
      const missDiff = b.wrong - a.wrong;
      if (missDiff !== 0) return missDiff;
      return a.lastSeen.localeCompare(b.lastSeen);
    })
    .slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/* Discrimination sets                                                        */
/* -------------------------------------------------------------------------- */

export interface DiscriminationSet {
  /** The item the child is getting wrong. */
  target: string;
  /** What they keep picking instead. */
  against: string;
  /**
   * Six rounds: see both, hear both, then choose, four times.
   *
   * Short on purpose. The point is to put the pair side by side often enough
   * that the difference is noticed, not to drill one letter into the ground.
   */
  rounds: DiscriminationRound[];
  /** Explained to the parent, never to the child. */
  becauseBn: string;
}

export interface DiscriminationRound {
  kind: 'show-both' | 'hear-both' | 'choose';
  /** Which of the pair is the answer, for `choose` rounds. */
  answer?: string;
}

/**
 * Build a side-by-side set for the pair the child confuses most.
 *
 * Returns null when there is no pair confused twice or more — one mix-up is a
 * slip and building a whole intervention around it would be noise.
 *
 * The `choose` rounds alternate which of the pair is correct. A child who has
 * worked out that the answer is always the left one has learned the game, not
 * the letter.
 */
export function discriminationSet(
  items: Record<string, ItemProgress>,
): DiscriminationSet | null {
  const worst = confusions(items)[0];
  if (!worst) return null;

  const rounds: DiscriminationRound[] = [
    { kind: 'show-both' },
    { kind: 'hear-both' },
    { kind: 'choose', answer: worst.item },
    { kind: 'choose', answer: worst.with },
    { kind: 'choose', answer: worst.item },
    { kind: 'choose', answer: worst.with },
  ];

  return {
    target: worst.item,
    against: worst.with,
    rounds,
    becauseBn: `${worst.item}-এর সাথে ${worst.with} গুলিয়ে ফেলছে`,
  };
}

/**
 * Clear a resolved confusion.
 *
 * Called once the child gets the pair right through a whole discrimination
 * set. Without this the pair stays on the parent's "needs practice" list
 * forever, and the list stops being read.
 */
export function clearConfusion(
  item: ItemProgress,
  against: string,
): ItemProgress {
  if (!item.confusedWith[against]) return item;
  const confusedWith = { ...item.confusedWith };
  delete confusedWith[against];
  return { ...item, confusedWith };
}

/* -------------------------------------------------------------------------- */
/* The daily session                                                          */
/* -------------------------------------------------------------------------- */

export interface DailyPlan {
  /** Lesson to continue or start. */
  lessonId: string | null;
  /** Items to revisit inside it. */
  revise: string[];
  /** A pair to separate, if one has shown up. */
  discrimination: DiscriminationSet | null;
  /** Minutes this plan is meant to take. */
  minutes: number;
}

/**
 * Today's learning (§16).
 *
 * Ten to fifteen minutes, and the plan is allowed to be *shorter* than that
 * but never longer. The brief is clear that a tired child should be told
 * "আজ এতটুকুই যথেষ্ট ❤️" rather than pushed to finish, so the plan is a
 * ceiling, not a quota.
 */
export function planToday(
  items: Record<string, ItemProgress>,
  nextLessonId: string | null,
  now: string,
): DailyPlan {
  const revise = due(items, now, 5).map((i) => i.id);
  const discrimination = discriminationSet(items);

  return {
    lessonId: nextLessonId,
    revise,
    discrimination,
    minutes: Math.min(12, 5 + revise.length + (discrimination ? 2 : 0)),
  };
}
