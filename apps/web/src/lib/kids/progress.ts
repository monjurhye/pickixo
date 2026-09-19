/**
 * What the child has done, stored on the device.
 *
 * localStorage first, and the platform is fully usable signed out. A
 * four-year-old cannot create an account, and asking their parent to before
 * anything happens is where most of them stop. Signing in later adds sync; it
 * is not a gate.
 *
 * Every record is a plain serialisable object with a timestamp, so merging a
 * device copy with a server copy is a defined operation rather than one
 * silently overwriting the other.
 *
 * Nothing here is written in a way that can throw into the UI. Private mode,
 * blocked storage, a full quota and corrupted JSON all end with the child
 * still able to play — they just lose persistence, which is a far smaller
 * failure than a blank screen.
 */

import { applyAttempt, emptyItem, type Attempt, type ItemProgress } from './mastery';
import { applyDecision, decide } from './adaptive';
import { schedule } from './revision';

const KEY = 'pickixo.kids.v1';

export interface DayRecord {
  /** yyyy-mm-dd */
  day: string;
  minutes: number;
  /** Lesson ids touched. */
  lessons: string[];
  answers: number;
  correct: number;
}

export interface Progress {
  version: 1;
  items: Record<string, ItemProgress>;
  /** Lesson id → times completed. */
  lessons: Record<string, number>;
  stars: number;
  badges: string[];
  /** Last 30 days, newest last. Enough for the parent view, and bounded. */
  days: DayRecord[];
  streak: number;
  lastActiveDay: string | null;
  updatedAt: string;
}

export const EMPTY: Progress = {
  version: 1,
  items: {},
  lessons: {},
  stars: 0,
  badges: [],
  days: [],
  streak: 0,
  lastActiveDay: null,
  updatedAt: new Date(0).toISOString(),
};

/* -------------------------------------------------------------------------- */
/* Storage                                                                    */
/* -------------------------------------------------------------------------- */

export function load(): Progress {
  if (typeof window === 'undefined') return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Progress;
    if (parsed?.version !== 1) return { ...EMPTY };
    // Defensive: a half-written record must not break the dashboard.
    return {
      ...EMPTY,
      ...parsed,
      items: parsed.items ?? {},
      lessons: parsed.lessons ?? {},
      badges: parsed.badges ?? [],
      days: parsed.days ?? [],
    };
  } catch {
    return { ...EMPTY };
  }
}

export function save(progress: Progress): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ ...progress, updatedAt: new Date().toISOString() }),
    );
  } catch {
    // Over quota or blocked. The session continues; only persistence is lost.
  }
}

export function reset(): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(KEY); } catch { /* nothing to remove */ }
}

/* -------------------------------------------------------------------------- */
/* Recording                                                                  */
/* -------------------------------------------------------------------------- */

export interface Recorded {
  progress: Progress;
  item: ItemProgress;
  /** What the level engine decided, for the celebration and for tests. */
  moved: 'promote' | 'demote' | 'hold';
}

/**
 * Record one answer.
 *
 * The order matters and is the whole adaptive loop in five lines: fold the
 * attempt into the item, let the level engine read the updated record, apply
 * its decision, then schedule the item's next appearance.
 */
export function record(
  progress: Progress,
  itemId: string,
  attempt: Attempt,
): Recorded {
  const before = progress.items[itemId] ?? emptyItem(itemId);
  const withAttempt = applyAttempt(before, attempt);
  const decision = decide(withAttempt, attempt);
  const moved = applyDecision(withAttempt, decision);
  const item: ItemProgress = { ...moved, dueAt: schedule(moved, attempt.at) };

  return {
    progress: {
      ...progress,
      items: { ...progress.items, [itemId]: item },
      ...touchDay(progress, attempt.at, attempt.correct),
    },
    item,
    moved: decision.move,
  };
}

/* -------------------------------------------------------------------------- */
/* Days, streak and stars                                                     */
/* -------------------------------------------------------------------------- */

const DAYS_KEPT = 30;

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

function previousDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Update today's record and the streak.
 *
 * The streak is deliberately gentle: a missed day resets it to 1, not to 0,
 * and nothing anywhere warns a child that they are about to "lose" it. A
 * streak should be a small pleasure, not a reason a four-year-old feels
 * anxious about a screen (§17 — no manipulative mechanics).
 */
function touchDay(
  progress: Progress,
  at: string,
  correct: boolean,
): Pick<Progress, 'days' | 'streak' | 'lastActiveDay'> {
  const today = dayOf(at);
  const days = [...progress.days];
  const last = days[days.length - 1];

  if (last?.day === today) {
    days[days.length - 1] = {
      ...last,
      answers: last.answers + 1,
      correct: last.correct + (correct ? 1 : 0),
    };
  } else {
    days.push({
      day: today, minutes: 0, lessons: [],
      answers: 1, correct: correct ? 1 : 0,
    });
  }

  let streak = progress.streak;
  if (progress.lastActiveDay !== today) {
    streak = progress.lastActiveDay === previousDay(today) ? streak + 1 : 1;
  }

  return { days: days.slice(-DAYS_KEPT), streak, lastActiveDay: today };
}

export const STARS_PER_LESSON = 5;

/**
 * Mark a lesson finished.
 *
 * Stars for finishing are awarded once. Repeating a lesson is encouraged — it
 * is how a child practises, and the adaptive engine makes the second run
 * genuinely different — so repeats update everything except the star count.
 * Paying again for the same work is how a star total stops meaning anything.
 */
export function completeLesson(
  progress: Progress,
  lessonId: string,
  minutes: number,
  at: string,
): { progress: Progress; starsAwarded: number; firstTime: boolean } {
  const done = progress.lessons[lessonId] ?? 0;
  const firstTime = done === 0;
  const starsAwarded = firstTime ? STARS_PER_LESSON : 0;

  const today = dayOf(at);
  const days = [...progress.days];
  const last = days[days.length - 1];
  if (last?.day === today) {
    days[days.length - 1] = {
      ...last,
      minutes: last.minutes + minutes,
      lessons: last.lessons.includes(lessonId)
        ? last.lessons
        : [...last.lessons, lessonId],
    };
  } else {
    days.push({
      day: today, minutes, lessons: [lessonId], answers: 0, correct: 0,
    });
  }

  return {
    progress: {
      ...progress,
      lessons: { ...progress.lessons, [lessonId]: done + 1 },
      stars: progress.stars + starsAwarded,
      days: days.slice(-DAYS_KEPT),
    },
    starsAwarded,
    firstTime,
  };
}

export function awardBadge(progress: Progress, badge: string): Progress {
  if (progress.badges.includes(badge)) return progress;
  return { ...progress, badges: [...progress.badges, badge] };
}

/* -------------------------------------------------------------------------- */
/* Reading, for the parent view                                               */
/* -------------------------------------------------------------------------- */

export function today(progress: Progress, at: string): DayRecord {
  const day = dayOf(at);
  return progress.days.find((d) => d.day === day)
    ?? { day, minutes: 0, lessons: [], answers: 0, correct: 0 };
}

/** Minutes over the last seven days, oldest first, for the small chart. */
export function week(progress: Progress, at: string): DayRecord[] {
  const out: DayRecord[] = [];
  let day = dayOf(at);
  for (let i = 0; i < 7; i += 1) {
    out.unshift(
      progress.days.find((d) => d.day === day)
        ?? { day, minutes: 0, lessons: [], answers: 0, correct: 0 },
    );
    day = previousDay(day);
  }
  return out;
}

/**
 * Merge a device copy with a server copy.
 *
 * Per item, the record with more total answers wins — it has seen more of the
 * child's actual work. Stars and lessons take the maximum, so nothing a child
 * earned disappears because they used a second device. Defined rather than
 * clever, which is what makes it safe to run automatically.
 */
export function merge(local: Progress, remote: Progress): Progress {
  const items: Record<string, ItemProgress> = { ...remote.items };
  for (const [id, mine] of Object.entries(local.items)) {
    const theirs = items[id];
    if (!theirs) { items[id] = mine; continue; }
    const mineSeen = mine.correct + mine.wrong;
    const theirsSeen = theirs.correct + theirs.wrong;
    items[id] = mineSeen >= theirsSeen ? mine : theirs;
  }

  const lessons: Record<string, number> = { ...remote.lessons };
  for (const [id, count] of Object.entries(local.lessons)) {
    lessons[id] = Math.max(count, lessons[id] ?? 0);
  }

  const byDay = new Map<string, DayRecord>();
  for (const day of [...remote.days, ...local.days]) {
    const existing = byDay.get(day.day);
    byDay.set(day.day, existing
      ? {
        ...day,
        minutes: Math.max(existing.minutes, day.minutes),
        answers: Math.max(existing.answers, day.answers),
        correct: Math.max(existing.correct, day.correct),
        lessons: [...new Set([...existing.lessons, ...day.lessons])],
      }
      : day);
  }

  return {
    version: 1,
    items,
    lessons,
    stars: Math.max(local.stars, remote.stars),
    badges: [...new Set([...local.badges, ...remote.badges])],
    days: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-DAYS_KEPT),
    streak: Math.max(local.streak, remote.streak),
    lastActiveDay: [local.lastActiveDay, remote.lastActiveDay]
      .filter(Boolean).sort().pop() ?? null,
    updatedAt: new Date().toISOString(),
  };
}
