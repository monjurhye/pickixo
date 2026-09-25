/**
 * Progress for Class 2 Bangla.
 *
 * A sibling of `mathProgress.ts`, not an import from it, for the reason that
 * file already gives: the three Class 2 courses have separate lesson ids, so
 * one shared storage key would let a child's Bangla stars and Maths stars
 * quietly overwrite each other. The mastery/streak/star logic is
 * subject-agnostic; it is the *key* that has to differ, and a sibling module
 * guarantees that structurally rather than by everyone remembering to pass a
 * `subject` argument.
 *
 * What is Bangla's own: the practised item is a **word or a letter build**,
 * not a number — so a child who misses ন্ধ gets ন্ধ back in their revision
 * queue, which is the whole point of recording anything.
 */

export type Mastery = 'not_started' | 'learning' | 'practicing' | 'mastered';

/** A word from শব্দ শিখি, or a letter build like ন + ধ = ন্ধ. */
export interface ItemProgress {
  id: string;
  mastery: Mastery;
  correct: number;
  wrong: number;
  lastSeen: string;
  needsPractice: boolean;
}

export interface LessonProgress {
  id: string;
  chapterId: string;
  completed: boolean;
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
  lastActiveDay: string | null;
  streak: number;
  lessons: Record<string, LessonProgress>;
  items: Record<string, ItemProgress>;
  minutes: number;
  updatedAt: string;
}

const KEY = 'pickixo.class2.bangla.v1';

const EMPTY: Progress = {
  version: 1,
  stars: 0,
  badges: [],
  lastActiveDay: null,
  streak: 0,
  lessons: {},
  items: {},
  minutes: 0,
  updatedAt: new Date(0).toISOString(),
};

export function load(): Progress {
  if (typeof window === 'undefined') return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Progress;
    if (parsed?.version !== 1) return { ...EMPTY };
    return {
      ...EMPTY,
      ...parsed,
      lessons: parsed.lessons ?? {},
      items: parsed.items ?? {},
      badges: parsed.badges ?? [],
    };
  } catch {
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

const ORDER: Mastery[] = ['not_started', 'learning', 'practicing', 'mastered'];

function step(current: Mastery, direction: 1 | -1): Mastery {
  const index = ORDER.indexOf(current);
  const next = Math.min(ORDER.length - 1, Math.max(0, index + direction));
  return ORDER[next]!;
}

export function recordAnswer(
  progress: Progress, itemId: string, correct: boolean,
): Progress {
  const existing = progress.items[itemId] ?? {
    id: itemId,
    mastery: 'not_started' as Mastery,
    correct: 0,
    wrong: 0,
    lastSeen: new Date(0).toISOString(),
    needsPractice: false,
  };

  const updated: ItemProgress = {
    ...existing,
    correct: existing.correct + (correct ? 1 : 0),
    wrong: existing.wrong + (correct ? 0 : 1),
    mastery: step(existing.mastery, correct ? 1 : -1),
    lastSeen: new Date().toISOString(),
    needsPractice: correct
      ? existing.needsPractice && step(existing.mastery, 1) !== 'mastered'
      : true,
  };

  return { ...progress, items: { ...progress.items, [itemId]: updated } };
}

export function revisionQueue(progress: Progress, limit = 10): ItemProgress[] {
  return Object.values(progress.items)
    .filter((v) => v.needsPractice || v.mastery === 'learning')
    .sort((a, b) => {
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
  for (const item of Object.values(progress.items)) counts[item.mastery] += 1;
  return counts;
}

export const STARS_PER_LESSON = 10;
export const STARS_PER_QUIZ = 5;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function completeLesson(
  progress: Progress,
  lesson: { id: string; chapterId: string; minutes: number },
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
    chapterId: lesson.chapterId,
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

export function chapterComplete(
  progress: Progress, chapterId: string, lessonIds: string[],
): boolean {
  return lessonIds.every((id) => progress.lessons[id]?.completed);
}

export function chapterStars(progress: Progress, lessonIds: string[]): number {
  return lessonIds.reduce((total, id) => total + (progress.lessons[id]?.stars ?? 0), 0);
}

export function scoreToStars(score: number, total: number): number {
  if (total <= 0) return 3;
  const ratio = score / total;
  if (ratio >= 1) return 5;
  if (ratio >= 0.8) return 4;
  if (ratio >= 0.6) return 3;
  if (ratio >= 0.4) return 2;
  return 1;
}
