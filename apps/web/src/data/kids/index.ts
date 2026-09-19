/**
 * The curriculum, loaded.
 *
 * Units are imported statically so Next can tree-shake and inline them — a
 * lesson is ~8 KB of JSON and fetching it over a slow connection when it could
 * have been in the bundle is exactly the kind of avoidable round trip §26 is
 * about.
 *
 * Nothing here validates. `validateLesson` runs in `content.test.mjs`, at build
 * time, so a broken lesson fails the build rather than the child's screen.
 */

import type { Lesson, Subject, SubjectId, Unit } from '@/lib/kids/content';

import shoroborno from './bangla/shoroborno.json';
import banjonborno from './bangla/banjonborno.json';
import shobdoGothon from './bangla/shobdo-gothon.json';
import shongkha from './numbers/shongkha.json';

const BANGLA_UNITS = [shoroborno, banjonborno, shobdoGothon] as unknown as Unit[];
const NUMBER_UNITS = [shongkha] as unknown as Unit[];

export const SUBJECTS: Subject[] = [
  {
    id: 'bangla',
    title: 'বাংলা',
    icon: 'bangla',
    colour: 'sun',
    units: BANGLA_UNITS,
  },
  {
    id: 'numbers',
    title: 'সংখ্যা',
    icon: 'number',
    colour: 'berry',
    units: NUMBER_UNITS,
  },
];

export const ALL_UNITS: Unit[] = SUBJECTS.flatMap((s) => s.units);

export const ALL_LESSONS: Lesson[] = ALL_UNITS.flatMap((u) => u.lessons);

const BY_ID = new Map(ALL_LESSONS.map((lesson) => [lesson.id, lesson]));

export function getLesson(id: string): Lesson | null {
  return BY_ID.get(id) ?? null;
}

export function getSubject(id: SubjectId): Subject | null {
  return SUBJECTS.find((s) => s.id === id) ?? null;
}

export function getUnit(id: string): Unit | null {
  return ALL_UNITS.find((u) => u.id === id) ?? null;
}

/**
 * The lesson to offer next.
 *
 * The first lesson the child has not completed, in curriculum order — the
 * book's own order, which is the progression NCTB designed. When everything is
 * done it returns the least-practised lesson rather than null, because
 * "finished" is not a state a learning app should have.
 */
export function nextLesson(completed: Record<string, number>): Lesson {
  const unfinished = ALL_LESSONS.find((lesson) => !completed[lesson.id]);
  if (unfinished) return unfinished;

  return [...ALL_LESSONS].sort(
    (a, b) => (completed[a.id] ?? 0) - (completed[b.id] ?? 0),
  )[0]!;
}

/** Which lesson an item belongs to, for revision that crosses lessons. */
export function lessonOfItem(itemId: string): Lesson | null {
  return ALL_LESSONS.find((l) => l.items.some((i) => i.id === itemId)) ?? null;
}
