'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Illustration } from './Illustration';
import { LessonPlayer } from './LessonPlayer';
import { say, warmUpVoices } from '@/lib/class2/speech';
import {
  awardBadge, load, masteryCounts, revisionQueue, save, unitComplete, unitStars,
  type Progress,
} from '@/lib/class2/progress';

/**
 * The child's English app.
 *
 * Navigation is client-side state rather than routes, for one reason: a
 * seven-year-old taps Back in the browser and expects to still be in their
 * lesson with their stars intact. Keeping home → unit → lesson in one mounted
 * component means the flow never reloads and progress is never mid-write when
 * they move.
 *
 * Four things only, as the brief asks: Home, Learn, Practice, Progress. No
 * menus, no settings a child can break, nothing that needs reading to use.
 */

import type { Lesson, Unit } from '@/data/class2/english/schema';

type View =
  | { screen: 'home' }
  | { screen: 'unit'; unitId: string }
  | { screen: 'lesson'; unitId: string; lessonId: string }
  | { screen: 'finished'; unitId: string; lessonId: string;
      starsEarned: number; rating: number; score: number; total: number };

export function EnglishApp({ units }: { units: Unit[] }) {
  const [view, setView] = useState<View>({ screen: 'home' });
  const [progress, setProgress] = useState<Progress | null>(null);

  // Progress lives in localStorage, so it can only be read after mount.
  useEffect(() => { setProgress(load()); warmUpVoices(); }, []);

  const refresh = useCallback(() => setProgress(load()), []);

  const unit = useMemo(
    () => units.find((u) => u.id === ('unitId' in view ? view.unitId : '')),
    [units, view],
  );
  const lesson = useMemo(
    () => unit?.lessons.find((l) => l.id === ('lessonId' in view ? view.lessonId : '')),
    [unit, view],
  );

  if (!progress) {
    return <p className="py-20 text-center text-body text-ink-muted">Loading…</p>;
  }

  if (view.screen === 'lesson' && unit && lesson) {
    return (
      <LessonPlayer
        lesson={lesson}
        unitTitle={unit.title}
        onExit={() => { refresh(); setView({ screen: 'unit', unitId: unit.id }); }}
        onFinished={(summary) => {
          // Award the unit badge the moment the last lesson lands.
          const after = load();
          const ids = unit.lessons.map((l) => l.id);
          if (unitComplete(after, unit.id, ids)) {
            save(awardBadge(after, `unit-${unit.number}`));
          }
          refresh();
          setView({
            screen: 'finished', unitId: unit.id, lessonId: lesson.id, ...summary,
          });
        }}
      />
    );
  }

  if (view.screen === 'finished' && unit && lesson) {
    return (
      <Finished
        unit={unit}
        lesson={lesson}
        starsEarned={view.starsEarned}
        rating={view.rating}
        onNextLesson={(nextId) => setView({ screen: 'lesson', unitId: unit.id, lessonId: nextId })}
        onAgain={() => setView({ screen: 'lesson', unitId: unit.id, lessonId: lesson.id })}
        onHome={() => setView({ screen: 'home' })}
      />
    );
  }

  if (view.screen === 'unit' && unit) {
    return (
      <UnitScreen
        unit={unit}
        progress={progress}
        onBack={() => setView({ screen: 'home' })}
        onPick={(lessonId) => setView({ screen: 'lesson', unitId: unit.id, lessonId })}
      />
    );
  }

  return (
    <Home
      units={units}
      progress={progress}
      onPickUnit={(unitId) => setView({ screen: 'unit', unitId })}
      onContinue={(unitId, lessonId) => setView({ screen: 'lesson', unitId, lessonId })}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Home                                                                       */
/* -------------------------------------------------------------------------- */

function Home({ units, progress, onPickUnit, onContinue }: {
  units: Unit[]; progress: Progress;
  onPickUnit: (unitId: string) => void;
  onContinue: (unitId: string, lessonId: string) => void;
}) {
  // The next unfinished lesson, in book order.
  const nextUp = useMemo(() => {
    for (const unit of units) {
      for (const lesson of unit.lessons) {
        if (!progress.lessons[lesson.id]?.completed) {
          return { unit, lesson };
        }
      }
    }
    return null;
  }, [units, progress]);

  const counts = masteryCounts(progress);
  const practice = revisionQueue(progress, 99).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="flex items-center gap-4">
        <Illustration name="two-children-waving" size={84} animate />
        <div>
          <h1 className="text-title text-ink">👋 Hello!</h1>
          <p className="mt-1 text-body text-ink-muted">Let&apos;s learn English.</p>
        </div>
      </header>

      {/* --- three numbers, no dashboard clutter ------------------------- */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat icon="⭐" value={progress.stars} label="Stars" />
        <Stat icon="🔥" value={progress.streak} label="Day streak" />
        <Stat icon="🏅" value={progress.badges.length} label="Badges" />
      </div>

      {/* --- today's learning -------------------------------------------- */}
      {nextUp ? (
        <button
          type="button"
          onClick={() => onContinue(nextUp.unit.id, nextUp.lesson.id)}
          className="mt-6 w-full rounded-card bg-accent p-6 text-left text-white
                     shadow-sm transition-transform active:scale-[0.99]"
        >
          <p className="text-micro font-semibold uppercase tracking-wide opacity-90">
            Today&apos;s learning · about {nextUp.lesson.minutes} minutes
          </p>
          <p className="mt-2 text-title">{nextUp.lesson.title}</p>
          <p className="mt-1 text-body opacity-90">{nextUp.lesson.objective}</p>
          <p className="mt-4 text-subheading font-semibold">▶︎ Start</p>
        </button>
      ) : (
        <div className="mt-6 rounded-card bg-success/10 p-6 text-center">
          <p className="text-title text-ink">🎉 All done!</p>
          <p className="mt-1 text-body text-ink-muted">
            You finished every lesson. Come back to practise.
          </p>
        </div>
      )}

      {practice > 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-card border-2
                        border-warning/30 bg-warning/5 p-4">
          <span className="text-2xl" aria-hidden="true">🧠</span>
          <p className="text-body text-ink">
            <strong>{practice}</strong> word{practice === 1 ? '' : 's'} to practise again
          </p>
        </div>
      ) : null}

      {/* --- units -------------------------------------------------------- */}
      <h2 className="mt-8 text-heading text-ink">📚 Units</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {units.map((unit) => {
          const ids = unit.lessons.map((l) => l.id);
          const done = ids.filter((id: string) => progress.lessons[id]?.completed).length;
          const complete = done === ids.length;
          return (
            <button
              key={unit.id}
              type="button"
              onClick={() => onPickUnit(unit.id)}
              // min-w-0 on the grid item itself, not only on the text inside
              // it: a grid item's default min-width is its content, and the
              // truncating title below never shrinks, so on a 375px phone the
              // card grew to 419px and pushed the whole page sideways.
              className="flex min-w-0 items-center gap-4 rounded-card border-2
                         border-border bg-surface p-4 text-left transition-transform
                         active:scale-[0.99]"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center
                               rounded-full bg-accent-soft text-xl font-bold
                               text-accent-ink">
                {unit.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-subheading text-ink">
                  {unit.title}
                </span>
                <span className="block text-small text-ink-muted">
                  {complete ? '✓ Finished' : `${done} of ${ids.length} lessons`}
                  {' · '}⭐ {unitStars(progress, ids)}
                </span>
              </span>
              {complete ? <span aria-hidden="true">🏅</span> : null}
            </button>
          );
        })}
      </div>

      {/* --- my words ----------------------------------------------------- */}
      <h2 className="mt-8 text-heading text-ink">🎯 My words</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="🌱" value={counts.learning} label="Learning" small />
        <Stat icon="💪" value={counts.practicing} label="Practising" small />
        <Stat icon="⭐" value={counts.mastered} label="Mastered" small />
        <Stat icon="🧠" value={practice} label="To practise" small />
      </div>
    </div>
  );
}

function Stat({ icon, value, label, small = false }: {
  icon: string; value: number; label: string; small?: boolean;
}) {
  return (
    <div className="rounded-card border-2 border-border bg-surface p-3 text-center">
      <p className={small ? 'text-xl' : 'text-2xl'} aria-hidden="true">{icon}</p>
      <p className="mt-1 text-heading text-ink tabular-nums">{value}</p>
      <p className="text-micro text-ink-subtle">{label}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Unit                                                                       */
/* -------------------------------------------------------------------------- */

function UnitScreen({ unit, progress, onBack, onPick }: {
  unit: Unit; progress: Progress; onBack: () => void;
  onPick: (lessonId: string) => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <button
        type="button"
        onClick={onBack}
        className="flex h-11 items-center gap-2 rounded-full bg-surface-sunken px-4
                   text-body text-ink-muted"
      >
        ← Home
      </button>

      <header className="mt-4">
        <p className="text-micro font-semibold uppercase tracking-wide text-accent-ink">
          Unit {unit.number}
        </p>
        <h1 className="mt-1 text-title text-ink">{unit.title}</h1>
        {unit.titleBn ? (
          <p className="mt-1 text-subheading text-ink-muted">{unit.titleBn}</p>
        ) : null}
      </header>

      <div className="mt-6 space-y-3">
        {unit.lessons.map((lesson, i) => {
          const record = progress.lessons[lesson.id];
          const done = Boolean(record?.completed);
          // Lessons stay unlocked. A child who wants lesson 3 first is still
          // learning, and a padlock is just a wall to a seven-year-old.
          return (
            <button
              key={lesson.id}
              type="button"
              onClick={() => onPick(lesson.id)}
              className={`flex w-full items-center gap-4 rounded-card border-2 p-4
                          text-left transition-transform active:scale-[0.99]
                          ${done ? 'border-success/40 bg-success/5'
                                 : 'border-border bg-surface'}`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center
                               rounded-full bg-accent-soft text-lg font-bold
                               text-accent-ink">
                {done ? '✓' : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-subheading text-ink">{lesson.title}</span>
                <span className="block text-small text-ink-muted">
                  {lesson.objective}
                </span>
                <span className="mt-0.5 block text-micro text-ink-subtle">
                  {lesson.vocabulary.length} words · about {lesson.minutes} min
                  {record ? ` · ⭐ ${record.stars}` : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Finished                                                                   */
/* -------------------------------------------------------------------------- */

function Finished({
  unit, lesson, starsEarned, rating, onNextLesson, onAgain, onHome,
}: {
  unit: Unit; lesson: Lesson; starsEarned: number; rating: number;
  onNextLesson: (lessonId: string) => void;
  onAgain: () => void; onHome: () => void;
}) {
  const index = unit.lessons.findIndex((l) => l.id === lesson.id);
  const next = unit.lessons[index + 1];

  useEffect(() => { void say('Great job!'); }, []);

  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-center">
      <Illustration name="star" size={180} animate />
      <h1 className="mt-6 text-title text-ink">🎉 Great job!</h1>
      <p className="mt-2 text-subheading text-ink-muted">{lesson.title}</p>
      {/* The rating is out of five; the star count is what was added to the
          running total. Repeating the emoji by the *count* printed ten stars. */}
      <p className="mt-4 text-3xl" aria-label={`${rating} out of 5 stars`}>
        {'⭐'.repeat(rating)}{'☆'.repeat(5 - rating)}
      </p>
      {starsEarned > 0 ? (
        <p className="mt-2 text-subheading font-semibold text-accent-ink">
          +{starsEarned} stars
        </p>
      ) : (
        <p className="mt-2 text-body text-ink-muted">
          Practice round — you already earned the stars for this one. 💪
        </p>
      )}

      <div className="mt-8 space-y-3">
        {next ? (
          <button
            type="button"
            onClick={() => onNextLesson(next.id)}
            className="w-full rounded-card bg-accent px-6 py-5 text-subheading
                       font-semibold text-white active:scale-[0.98]"
          >
            Next lesson → {next.title}
          </button>
        ) : (
          <div className="rounded-card bg-success/10 p-5">
            <p className="text-heading text-ink">🏆 Unit {unit.number} complete!</p>
            <p className="mt-1 text-body text-ink-muted">You earned a badge.</p>
          </div>
        )}
        <button
          type="button"
          onClick={onAgain}
          className="w-full rounded-card border-2 border-border-strong bg-surface
                     px-6 py-4 text-subheading text-ink active:scale-[0.98]"
        >
          Practise again 🔁
        </button>
        <button
          type="button"
          onClick={onHome}
          className="w-full rounded-card px-6 py-3 text-body text-ink-muted"
        >
          🏠 Home
        </button>
      </div>

      {/* The brief is explicit: do not encourage endless screen time. */}
      <p className="mt-10 text-small text-ink-subtle">
        You finished today&apos;s learning. Come back later for your next lesson. 🌟
      </p>
    </div>
  );
}
