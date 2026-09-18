/**
 * What the child has learned, and what they still need to practise.
 *
 * Stored in localStorage first. The child may not be signed in — and for a
 * seven-year-old, being asked to create an account before learning anything is
 * where the learning stops. Losing a week of stars to a cleared cache is not
 * acceptable either, so this is written to sync to an account later: every
 * record is a plain serialisable object with a timestamp, so merging a local
 * and a server copy is a defined operation rather than a rewrite.
 *
 * The mastery model is the part that matters. An item that is answered wrongly
 * moves *backwards*, so "mastered" has to be re-earned. Without that, a child
 * who guesses correctly once is never shown the word again, and the revision
 * queue quietly becomes decorative.
 */

export type Mastery = 'not_started' | 'learning' | 'practicing' | 'mastered';

export interface VocabProgress {
  id: string;
  mastery: Mastery;
  correct: number;
  wrong: number;
  /** ISO. Used to resurface an item the next day, not just the next screen. */
  lastSeen: string;
  /** Set when the item is due for revision. */
  needsPractice: boolean;
}

export interface LessonProgress {
  id: string;
  unitId: string;
  completed: boolean;
  /** Best quiz score, out of the number of questions. */
  bestScore: number;
  questionCount: number;
  stars: number;
  completedAt: string | null;
  attempts: number;
}

export interface Progress {
  version: 1;
  stars: number;
  badges: string[];
  /** yyyy-mm-dd of the last day any lesson step was completed. */
  lastActiveDay: string | null;
  streak: number;
  lessons: Record<string, LessonProgress>;
  vocabulary: Record<string, VocabProgress>;
  /** Total minutes, for the parent view. Rounded, never precise tracking. */
  minutes: number;
  updatedAt: string;
}

const KEY = 'pickixo.class2.english.v1';

const EMPTY: Progress = {
  version: 1,
  stars: 0,
  badges: [],
  lastActiveDay: null,
  streak: 0,
  lessons: {},
  vocabulary: {},
  minutes: 0,
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
    // Defensive: a partially written record must not crash the dashboard.
    return {
      ...EMPTY,
      ...parsed,
      lessons: parsed.lessons ?? {},
      vocabulary: parsed.vocabulary ?? {},
      badges: parsed.badges ?? [],
    };
  } catch {
    // Private mode, cleared storage, corrupted JSON. Start fresh rather than
    // showing a broken screen to a child.
    return { ...EMPTY };
  }
}

export function save(progress: Progress): void {
  if (typeof window === 'undefined') return;
  try {
    progress.updatedAt = new Date().toISOString();
    window.localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Over quota or blocked. The session still works; only persistence is lost.
  }
}

export function reset(): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(KEY); } catch { /* nothing to remove */ }
}

/* -------------------------------------------------------------------------- */
/* Mastery                                                                    */
/* -------------------------------------------------------------------------- */

const ORDER: Mastery[] = ['not_started', 'learning', 'practicing', 'mastered'];

function step(current: Mastery, direction: 1 | -1): Mastery {
  const index = ORDER.indexOf(current);
  const next = Math.min(ORDER.length - 1, Math.max(0, index + direction));
  return ORDER[next]!;
}

/**
 * Record an answer about one vocabulary item.
 *
 * Forward one level on a correct answer, back one on a wrong one. Two correct
 * answers in a row are needed to reach `mastered` from `learning`, which is
 * what stops a lucky guess from removing a word from practice.
 */
export function recordAnswer(
  progress: Progress, vocabId: string, correct: boolean,
): Progress {
  const existing = progress.vocabulary[vocabId] ?? {
    id: vocabId,
    mastery: 'not_started' as Mastery,
    correct: 0,
    wrong: 0,
    lastSeen: new Date(0).toISOString(),
    needsPractice: false,
  };

  const updated: VocabProgress = {
    ...existing,
    correct: existing.correct + (correct ? 1 : 0),
    wrong: existing.wrong + (correct ? 0 : 1),
    mastery: step(existing.mastery, correct ? 1 : -1),
    lastSeen: new Date().toISOString(),
    // A wrong answer puts the word straight into the revision queue; a correct
    // one only clears it once the word is genuinely mastered.
    needsPractice: correct
      ? existing.needsPractice && step(existing.mastery, 1) !== 'mastered'
      : true,
  };

  return {
    ...progress,
    vocabulary: { ...progress.vocabulary, [vocabId]: updated },
  };
}

/** Words the child should see again, weakest first. */
export function revisionQueue(progress: Progress, limit = 10): VocabProgress[] {
  return Object.values(progress.vocabulary)
    .filter((v) => v.needsPractice || v.mastery === 'learning')
    .sort((a, b) => {
      // Most-missed first, then least recently seen.
      const missDiff = b.wrong - a.wrong;
      if (missDiff !== 0) return missDiff;
      return a.lastSeen.localeCompare(b.lastSeen);
    })
    .slice(0, limit);
}

export function masteryCounts(progress: Progress): Record<Mastery, number> {
  const counts: Record<Mastery, number> = {
    not_started: 0, learning: 0, practicing: 0, mastered: 0,
  };
  for (const item of Object.values(progress.vocabulary)) counts[item.mastery] += 1;
  return counts;
}

/* -------------------------------------------------------------------------- */
/* Lessons, stars and streak                                                  */
/* -------------------------------------------------------------------------- */

export const STARS_PER_LESSON = 10;
export const STARS_PER_QUIZ = 5;
export const STARS_PER_REVISION = 2;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Mark a lesson finished.
 *
 * Stars for finishing are awarded once. Re-doing a lesson is encouraged — it
 * is how a child practises — so repeats still update the best score and the
 * streak, but do not mint new stars. Paying again for the same work is how a
 * star count stops meaning anything.
 */
export function completeLesson(
  progress: Progress,
  lesson: { id: string; unitId: string; minutes: number },
  quiz: { score: number; total: number } | null,
): { progress: Progress; starsAwarded: number; firstTime: boolean } {
  const existing = progress.lessons[lesson.id];
  const firstTime = !existing?.completed;

  let starsAwarded = 0;
  if (firstTime) {
    starsAwarded += STARS_PER_LESSON;
    if (quiz && quiz.score === quiz.total && quiz.total > 0) {
      starsAwarded += STARS_PER_QUIZ;
    }
  }

  const record: LessonProgress = {
    id: lesson.id,
    unitId: lesson.unitId,
    completed: true,
    bestScore: Math.max(existing?.bestScore ?? 0, quiz?.score ?? 0),
    questionCount: quiz?.total ?? existing?.questionCount ?? 0,
    stars: (existing?.stars ?? 0) + starsAwarded,
    completedAt: existing?.completedAt ?? new Date().toISOString(),
    attempts: (existing?.attempts ?? 0) + 1,
  };

  const next: Progress = {
    ...progress,
    stars: progress.stars + starsAwarded,
    lessons: { ...progress.lessons, [lesson.id]: record },
    minutes: progress.minutes + lesson.minutes,
    ...touchStreak(progress),
  };

  return { progress: next, starsAwarded, firstTime };
}

/**
 * Advance the learning streak.
 *
 * Deliberately gentle: a missed day resets it to 1 rather than to 0, and there
 * is nothing anywhere that warns a child they are about to "lose" it. A streak
 * should be a small pleasure, not a reason a seven-year-old feels anxious about
 * a screen.
 */
function touchStreak(progress: Progress): Pick<Progress, 'streak' | 'lastActiveDay'> {
  const day = today();
  if (progress.lastActiveDay === day) {
    return { streak: progress.streak, lastActiveDay: day };
  }
  if (progress.lastActiveDay === yesterday()) {
    return { streak: progress.streak + 1, lastActiveDay: day };
  }
  return { streak: 1, lastActiveDay: day };
}

export function awardBadge(progress: Progress, badge: string): Progress {
  if (progress.badges.includes(badge)) return progress;
  return { ...progress, badges: [...progress.badges, badge] };
}

export function unitComplete(
  progress: Progress, unitId: string, lessonIds: string[],
): boolean {
  return lessonIds.every((id) => progress.lessons[id]?.completed);
}

/** Stars for a whole unit, for the unit card. */
export function unitStars(progress: Progress, lessonIds: string[]): number {
  return lessonIds.reduce((total, id) => total + (progress.lessons[id]?.stars ?? 0), 0);
}

/** Out of five, for the lesson-complete screen. */
export function scoreToStars(score: number, total: number): number {
  if (total <= 0) return 3;
  const ratio = score / total;
  if (ratio >= 1) return 5;
  if (ratio >= 0.8) return 4;
  if (ratio >= 0.6) return 3;
  if (ratio >= 0.4) return 2;
  return 1;
}
