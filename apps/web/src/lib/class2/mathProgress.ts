/**
 * Progress for Class 2 Maths.
 *
 * A near-duplicate of `progress.ts` (the English course's progress store), not
 * an import from it, and on purpose: the two subjects are separate courses
 * with separate lesson ids, so sharing one storage key would let a child's
 * maths stars and English stars quietly cancel or overwrite each other. The
 * mastery/streak/star logic below is subject-agnostic already — it is the
 * *key* that has to be different, and duplicating ~250 lines to guarantee
 * that is cheaper than a shared module with a `subject` parameter threaded
 * through every call.
 */

export type Mastery = 'not_started' | 'learning' | 'practicing' | 'mastered';

export interface NumberProgress {
  id: string;
  mastery: Mastery;
  correct: number;
  wrong: number;
  lastSeen: string;
  needsPractice: boolean;
}

export interface TopicProgress {
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
  topics: Record<string, TopicProgress>;
  numbers: Record<string, NumberProgress>;
  minutes: number;
  updatedAt: string;
}

const KEY = 'pickixo.class2.math.v1';

const EMPTY: Progress = {
  version: 1,
  stars: 0,
  badges: [],
  lastActiveDay: null,
  streak: 0,
  topics: {},
  numbers: {},
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
      topics: parsed.topics ?? {},
      numbers: parsed.numbers ?? {},
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
  progress: Progress, numberId: string, correct: boolean,
): Progress {
  const existing = progress.numbers[numberId] ?? {
    id: numberId,
    mastery: 'not_started' as Mastery,
    correct: 0,
    wrong: 0,
    lastSeen: new Date(0).toISOString(),
    needsPractice: false,
  };

  const updated: NumberProgress = {
    ...existing,
    correct: existing.correct + (correct ? 1 : 0),
    wrong: existing.wrong + (correct ? 0 : 1),
    mastery: step(existing.mastery, correct ? 1 : -1),
    lastSeen: new Date().toISOString(),
    needsPractice: correct
      ? existing.needsPractice && step(existing.mastery, 1) !== 'mastered'
      : true,
  };

  return {
    ...progress,
    numbers: { ...progress.numbers, [numberId]: updated },
  };
}

export function revisionQueue(progress: Progress, limit = 10): NumberProgress[] {
  return Object.values(progress.numbers)
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
  for (const item of Object.values(progress.numbers)) counts[item.mastery] += 1;
  return counts;
}

export const STARS_PER_TOPIC = 10;
export const STARS_PER_QUIZ = 5;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function completeTopic(
  progress: Progress,
  topic: { id: string; chapterId: string; minutes: number },
  quiz: { score: number; total: number } | null,
): { progress: Progress; starsAwarded: number; firstTime: boolean } {
  const existing = progress.topics[topic.id];
  const firstTime = !existing?.completed;

  let starsAwarded = 0;
  if (firstTime) {
    starsAwarded += STARS_PER_TOPIC;
    if (quiz && quiz.score === quiz.total && quiz.total > 0) {
      starsAwarded += STARS_PER_QUIZ;
    }
  }

  const record: TopicProgress = {
    id: topic.id,
    chapterId: topic.chapterId,
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
    topics: { ...progress.topics, [topic.id]: record },
    minutes: progress.minutes + topic.minutes,
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
  progress: Progress, chapterId: string, topicIds: string[],
): boolean {
  return topicIds.every((id) => progress.topics[id]?.completed);
}

export function chapterStars(progress: Progress, topicIds: string[]): number {
  return topicIds.reduce((total, id) => total + (progress.topics[id]?.stars ?? 0), 0);
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
