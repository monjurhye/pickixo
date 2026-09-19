/**
 * How well the child knows one thing.
 *
 * Six states, because "learned / not learned" is not how a four-year-old knows
 * a letter. A child recognises ক in a picture book on Monday, cannot find it
 * on Tuesday, and writes it on Friday. A two-state model calls that a
 * regression; this one calls it Tuesday.
 *
 * Two ideas are deliberate and load-bearing.
 *
 * **Mastery and difficulty are separate.** A wrong answer at CONFIDENT drops
 * the *activity level* immediately — the very next question is easier — but
 * does not drop the mastery state. The child gets help at once; the record
 * stays honest. Collapsing the two would mean either a child grinding at work
 * that is too hard, or a progress report that swings wildly on one unlucky tap.
 * See `adaptive.ts` for the level half.
 *
 * **MASTERED needs two different days.** A child who has a good five minutes
 * has not mastered anything. Requiring a second day is the cheapest available
 * proxy for "it survived a night's sleep", which is most of what mastery means
 * at this age.
 */

import type { Level } from './content';

export type Mastery =
  | 'not_started'
  | 'introduced'
  | 'learning'
  | 'practicing'
  | 'confident'
  | 'mastered';

export const MASTERY_ORDER: readonly Mastery[] = [
  'not_started', 'introduced', 'learning', 'practicing', 'confident', 'mastered',
];

/** What a parent reads. The child never sees these. */
export const MASTERY_LABEL_BN: Record<Mastery, string> = {
  not_started: 'এখনো শুরু হয়নি',
  introduced: 'পরিচয় হয়েছে',
  learning: 'শিখছে',
  practicing: 'অনুশীলন করছে',
  confident: 'বেশ পারছে',
  mastered: 'শিখে গেছে',
};

/** One answer about one item. */
export interface Attempt {
  correct: boolean;
  /** Level the question was asked at. */
  level: Level;
  /** How long the child took, in ms. */
  ms: number;
  /** Whether a hint or a repeat of the audio was used. Never counted wrong. */
  helped: boolean;
  /** The activity kind, so PRACTICING can require more than one kind. */
  activity: string;
  /** What the child picked instead, when it was another known item. */
  confusedWith?: string;
  /** ISO timestamp. Injectable so the tests are not clock-dependent. */
  at: string;
}

/** Everything known about one item. */
export interface ItemProgress {
  id: string;
  mastery: Mastery;
  level: Level;
  correct: number;
  wrong: number;
  /** Consecutive correct answers at the current level. Resets on a miss. */
  streak: number;
  /** Rolling record of the last six answers, newest last. */
  recent: boolean[];
  /** Activity kinds answered correctly, for the PRACTICING rule. */
  correctKinds: string[];
  /** yyyy-mm-dd of each day this item reached CONFIDENT. At most two kept. */
  confidentDays: string[];
  /** Median response time in ms, for the confidence signal. */
  medianMs: number;
  /** Raw times, capped, so the median stays cheap to compute. */
  times: number[];
  /** Which other items this one gets mixed up with, and how often. */
  confusedWith: Record<string, number>;
  lastSeen: string;
  /** ISO date this item is next due for revision, or null. */
  dueAt: string | null;
  /**
   * Whether the child has ever answered this correctly at `master` level.
   *
   * Carried on the record rather than recomputed, because the event log is not
   * kept client-side and MASTERED must not be reachable without ever having
   * answered a symbolic, unaided question.
   */
  masteredTouch: boolean;
}

export function emptyItem(id: string): ItemProgress {
  return {
    id,
    mastery: 'not_started',
    level: 'explore',
    correct: 0,
    wrong: 0,
    streak: 0,
    recent: [],
    correctKinds: [],
    confidentDays: [],
    medianMs: 0,
    times: [],
    confusedWith: {},
    lastSeen: new Date(0).toISOString(),
    dueAt: null,
    masteredTouch: false,
  };
}

/* -------------------------------------------------------------------------- */
/* Transitions                                                                */
/* -------------------------------------------------------------------------- */

const RECENT_WINDOW = 6;
const TIMES_KEPT = 9;

function day(iso: string): string {
  return iso.slice(0, 10);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/**
 * Where an item's mastery should sit, given everything known about it.
 *
 * Computed from the record rather than nudged up and down, so the state is a
 * function of the history and cannot drift out of step with it.
 *
 * The thresholds:
 *   INTRODUCED   seen at all
 *   LEARNING     one correct answer
 *   PRACTICING   3 correct across at least two different activity kinds —
 *                recognising ক on a card is not the same as finding it in a
 *                word, and one of those alone is not practice
 *   CONFIDENT    5 correct, at most one miss in the last six, and the child is
 *                working at practice level or above
 *   MASTERED     confident on two different days, plus one correct at master
 */
export function masteryFor(item: ItemProgress): Mastery {
  const seen = item.correct + item.wrong;
  if (seen === 0) return 'not_started';
  if (item.correct === 0) return 'introduced';

  const recentMisses = item.recent.filter((r) => !r).length;
  const levelIndex = ['explore', 'learn', 'practice', 'master'].indexOf(item.level);

  const confident = item.correct >= 5 && recentMisses <= 1 && levelIndex >= 2;

  if (confident && item.confidentDays.length >= 2 && item.masteredTouch) {
    return 'mastered';
  }
  if (confident) return 'confident';
  if (item.correct >= 3 && new Set(item.correctKinds).size >= 2) return 'practicing';
  return 'learning';
}

/**
 * Fold one attempt into an item's record.
 *
 * Pure: takes a record and an attempt, returns a new record. Nothing here
 * reads the clock or storage, which is what makes the behaviour testable.
 */
export function applyAttempt(item: ItemProgress, attempt: Attempt): ItemProgress {
  const recent = [...item.recent, attempt.correct].slice(-RECENT_WINDOW);
  const times = [...item.times, attempt.ms].slice(-TIMES_KEPT);

  const correctKinds = attempt.correct && !item.correctKinds.includes(attempt.activity)
    ? [...item.correctKinds, attempt.activity]
    : item.correctKinds;

  const confusedWith = { ...item.confusedWith };
  if (!attempt.correct && attempt.confusedWith) {
    confusedWith[attempt.confusedWith] = (confusedWith[attempt.confusedWith] ?? 0) + 1;
  }

  const next: ItemProgress = {
    ...item,
    correct: item.correct + (attempt.correct ? 1 : 0),
    wrong: item.wrong + (attempt.correct ? 0 : 1),
    // A helped answer keeps the streak alive but does not extend it: the child
    // got there, but not unaided, and promotion should wait for unaided.
    streak: attempt.correct ? (attempt.helped ? item.streak : item.streak + 1) : 0,
    recent,
    correctKinds,
    times,
    medianMs: median(times),
    confusedWith,
    lastSeen: attempt.at,
    masteredTouch: item.masteredTouch
      || (attempt.correct && attempt.level === 'master'),
  };

  // Record the day, before recomputing, so two sessions on one day count once.
  const provisional = masteryFor(next);
  if (provisional === 'confident' || provisional === 'mastered') {
    const today = day(attempt.at);
    if (!next.confidentDays.includes(today)) {
      next.confidentDays = [...next.confidentDays, today].slice(-2);
    }
  }

  next.mastery = masteryFor(next);
  return next;
}

/* -------------------------------------------------------------------------- */
/* Reading the record                                                         */
/* -------------------------------------------------------------------------- */

export function masteryCounts(
  items: Record<string, ItemProgress>,
): Record<Mastery, number> {
  const counts = {
    not_started: 0, introduced: 0, learning: 0,
    practicing: 0, confident: 0, mastered: 0,
  } as Record<Mastery, number>;
  for (const item of Object.values(items)) counts[item.mastery] += 1;
  return counts;
}

/** Items the child has genuinely got, for "আমি যা শিখেছি". */
export function learned(items: Record<string, ItemProgress>): ItemProgress[] {
  return Object.values(items)
    .filter((i) => i.mastery === 'confident' || i.mastery === 'mastered')
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Pairs the child mixes up, worst first.
 *
 * Two or more confusions between the same pair is the trigger for a dedicated
 * discrimination set — see `revision.ts`. One is a slip.
 */
export function confusions(
  items: Record<string, ItemProgress>,
  threshold = 2,
): { item: string; with: string; count: number }[] {
  const out: { item: string; with: string; count: number }[] = [];
  for (const item of Object.values(items)) {
    for (const [other, count] of Object.entries(item.confusedWith)) {
      if (count >= threshold) out.push({ item: item.id, with: other, count });
    }
  }
  return out.sort((a, b) => b.count - a.count);
}
