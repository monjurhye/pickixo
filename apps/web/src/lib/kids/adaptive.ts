/**
 * The level engine: how hard the next question is.
 *
 * This is the file that makes Pickixo Kids one platform instead of two. There
 * is no 4+ app and no 5+ app, and the child is never asked their age. There is
 * one lesson for ক, and what the child is *asked to do with it* moves along
 * NCTB's own progression — বাস্তব → অর্ধবাস্তব → প্রতীক — based on how they
 * are actually doing, right now, on that one letter.
 *
 * Three properties matter more than the exact numbers.
 *
 * **Level is per item, not per child.** A child can be at `master` on ক and
 * `explore` on ঞ in the same minute, because that is how children are. A
 * single per-child difficulty would hold the whole session back to its
 * weakest letter.
 *
 * **Demotion is immediate and silent.** Two misses and the next question is
 * easier. Nothing is announced, nothing turns red, no message says the child
 * got something wrong. They simply find themselves able to answer again.
 *
 * **Promotion is slow and needs unaided work.** Four in a row, quick enough,
 * with no hint on the last two. A child who taps through with the audio on
 * repeat is being helped, which is fine — it just is not evidence for harder
 * questions.
 */

import { LEVELS, type ActivityKind, type Level, type Lesson, activitiesFor } from './content';
import type { Attempt, ItemProgress } from './mastery';

/* -------------------------------------------------------------------------- */
/* Tuning                                                                     */
/* -------------------------------------------------------------------------- */

/** Correct answers in a row needed to move up. */
const PROMOTE_STREAK = 4;

/** Misses in a row that drop a level. */
const DEMOTE_CONSECUTIVE = 2;

/** Misses within the recent window that drop a level. */
const DEMOTE_IN_WINDOW = 3;
const DEMOTE_WINDOW = 5;

/**
 * How long a question at each level should take a child who knows the answer.
 *
 * Generous on purpose. These are not a scoring mechanism — they are only used
 * to withhold *promotion* from a child who is getting there by elimination.
 * Being slow never demotes anybody and never counts as wrong.
 */
const EXPECTED_MS: Record<Level, number> = {
  explore: 9000,
  learn: 8000,
  practice: 7000,
  master: 6000,
};

export type Move = 'promote' | 'demote' | 'hold';

export interface Decision {
  move: Move;
  level: Level;
  /** Why, for the parent view and for tests. Never shown to a child. */
  because: string;
}

/* -------------------------------------------------------------------------- */
/* The rule                                                                   */
/* -------------------------------------------------------------------------- */

function shift(level: Level, by: 1 | -1): Level {
  const index = LEVELS.indexOf(level);
  const next = Math.min(LEVELS.length - 1, Math.max(0, index + by));
  return LEVELS[next]!;
}

/**
 * Decide where an item should sit after an attempt.
 *
 * `item` must already have the attempt folded in (see `applyAttempt`), because
 * the decision reads the updated streak and recent window.
 */
export function decide(item: ItemProgress, attempt: Attempt): Decision {
  const recent = item.recent;
  const lastTwo = recent.slice(-DEMOTE_CONSECUTIVE);
  const window = recent.slice(-DEMOTE_WINDOW);
  const missesInWindow = window.filter((r) => !r).length;

  // Demotion first: a struggling child gets help before anything else is
  // considered, and two rules can never both fire and leave it ambiguous.
  if (lastTwo.length === DEMOTE_CONSECUTIVE && lastTwo.every((r) => !r)) {
    return {
      move: 'demote',
      level: shift(item.level, -1),
      because: 'two in a row missed',
    };
  }
  if (missesInWindow >= DEMOTE_IN_WINDOW) {
    return {
      move: 'demote',
      level: shift(item.level, -1),
      because: `${missesInWindow} of the last ${window.length} missed`,
    };
  }

  if (item.streak >= PROMOTE_STREAK) {
    const quickEnough = item.medianMs > 0 && item.medianMs <= EXPECTED_MS[item.level];
    const unaided = !attempt.helped;
    if (quickEnough && unaided) {
      return {
        move: 'promote',
        level: shift(item.level, 1),
        because: `${item.streak} in a row, unaided`,
      };
    }
    return {
      move: 'hold',
      level: item.level,
      because: quickEnough ? 'still using hints' : 'still working it out slowly',
    };
  }

  return { move: 'hold', level: item.level, because: 'building up' };
}

/** Apply a decision, returning the item with its new level. */
export function applyDecision(item: ItemProgress, decision: Decision): ItemProgress {
  if (decision.level === item.level) return item;
  return {
    ...item,
    level: decision.level,
    // The streak belongs to the level it was earned at. Carrying it across
    // would promote a child twice on one run of luck, or demote and then
    // instantly re-promote them.
    streak: 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Choosing the next thing to do                                              */
/* -------------------------------------------------------------------------- */

/**
 * The level to open a lesson at.
 *
 * The median across the lesson's items, so one hard letter does not drag the
 * whole lesson down to `explore` and one easy one does not push it up. A
 * lesson the child has never touched opens at `explore` — the cold start is
 * always the gentlest thing available (§31).
 */
export function lessonLevel(
  lesson: Lesson,
  progress: Record<string, ItemProgress>,
): Level {
  const indices = lesson.items
    .map((item) => progress[item.id])
    .filter((p): p is ItemProgress => Boolean(p) && p!.correct + p!.wrong > 0)
    .map((p) => LEVELS.indexOf(p.level));

  if (!indices.length) return 'explore';

  indices.sort((a, b) => a - b);
  const mid = Math.floor(indices.length / 2);
  const median = indices.length % 2
    ? indices[mid]!
    : Math.floor((indices[mid - 1]! + indices[mid]!) / 2);

  return LEVELS[median]!;
}

/**
 * Pick the next activity for a lesson.
 *
 * Avoids repeating the activity the child just did, so a run of correct
 * answers does not become four identical screens. If the only activity at this
 * level is the one just done, doing it again is better than an empty screen.
 */
export function nextActivity(
  lesson: Lesson,
  level: Level,
  justDid: ActivityKind | null,
  pick: () => number = Math.random,
): ActivityKind | null {
  const available = activitiesFor(lesson, level);
  if (!available.length) return null;

  const fresh = available.filter((k) => k !== justDid);
  const pool = fresh.length ? fresh : available;
  return pool[Math.floor(pick() * pool.length)] ?? pool[0]!;
}

/**
 * The items in a lesson that most need the next question, weakest first.
 *
 * Unseen items come first so the lesson introduces everything before drilling
 * anything; after that it is whatever the child is worst at. This is what
 * makes a second run through a lesson different from the first.
 */
export function nextItems(
  lesson: Lesson,
  progress: Record<string, ItemProgress>,
  count = 1,
): string[] {
  const scored = lesson.items.map((item) => {
    const p = progress[item.id];
    if (!p || p.correct + p.wrong === 0) return { id: item.id, score: -1 };
    const seen = p.correct + p.wrong;
    return { id: item.id, score: p.correct / seen };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, count).map((s) => s.id);
}

/**
 * What the child is told after an answer.
 *
 * There is one failure message and it is warm. No "Wrong", no X, no buzzer, no
 * score. The brief is explicit about this (§4) and so is the curriculum, whose
 * assessment guidance is পর্যবেক্ষণ and চেকলিস্ট — observation, not marking.
 */
export function feedback(correct: boolean, helped: boolean): string {
  if (!correct) return 'আবার চেষ্টা করি ❤️';
  if (helped) return 'হয়েছে! 😊';
  return 'দারুণ! ⭐';
}

/**
 * A plain-Bangla summary of where a child is, for the parent view only.
 *
 * Deliberately not a percentage and not a grade.
 */
export function levelSummaryBn(level: Level): string {
  switch (level) {
    case 'explore': return 'ছবি দেখে চিনছে';
    case 'learn': return 'ছবি ও বর্ণ একসাথে চিনছে';
    case 'practice': return 'বর্ণ দেখেই চিনছে';
    case 'master': return 'নিজে নিজে পারছে';
  }
}
