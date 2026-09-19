'use client';

/**
 * Pickixo Kids — the child's whole world.
 *
 * One client component holding four views, rather than four routes, because a
 * route change on a slow Android phone is a white flash and a four-year-old
 * reads a white flash as "it broke". Everything is already in the bundle;
 * moving between views costs nothing.
 *
 * The rules this screen exists to honour:
 *
 * **Nothing requires reading.** Every card is a picture plus a word, every
 * card speaks its own name when tapped, and the only navigation is one large
 * 🏠. There is no menu, no tab bar and no text link anywhere a child can reach.
 *
 * **The child is never asked their age** (§30). There is no "4+ / 5+" choice,
 * no placement test, and no locked content. The first lesson is simply the
 * gentlest one, and the engine takes it from there.
 *
 * **The parent area is separated, not hidden** (§27). It sits behind a gate a
 * four-year-old will not pass — a small sum, not a password, because a parent
 * should never be locked out of their own child's progress.
 */

import { useCallback, useEffect, useState } from 'react';
import { SUBJECTS, getLesson, nextLesson } from '@/data/kids';
import type { Lesson, Subject, Unit } from '@/lib/kids/content';
import * as store from '@/lib/kids/progress';
import type { Progress } from '@/lib/kids/progress';
import { masteryCounts } from '@/lib/kids/mastery';
import { say, unlock } from '@/lib/kids/speech';
import { Art, hasArt } from './art';
import { LessonPlayer } from './LessonPlayer';
import { ParentArea } from './ParentArea';

type View =
  | { name: 'home' }
  | { name: 'subject'; subject: Subject }
  | { name: 'lesson'; lesson: Lesson }
  | { name: 'learned' }
  | { name: 'parents' };

export function KidsApp() {
  const [view, setView] = useState<View>({ name: 'home' });
  const [progress, setProgress] = useState<Progress>(store.EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProgress(store.load());
    setReady(true);
  }, []);

  /** Reload after a lesson, so the home screen reflects what just happened. */
  const home = useCallback(() => {
    setProgress(store.load());
    setView({ name: 'home' });
  }, []);

  const speak = (text: string) => { unlock(); say(text, { rate: 0.9 }); };

  if (view.name === 'lesson') {
    return <LessonPlayer lesson={view.lesson} onExit={home} />;
  }
  if (view.name === 'parents') {
    return <ParentArea progress={progress} onExit={home} />;
  }
  if (view.name === 'learned') {
    return <Learned progress={progress} onExit={home} />;
  }
  if (view.name === 'subject') {
    return (
      <SubjectView
        subject={view.subject}
        progress={progress}
        onPick={(lesson) => setView({ name: 'lesson', lesson })}
        onExit={home}
        speak={speak}
      />
    );
  }

  return (
    <Home
      progress={progress}
      ready={ready}
      onSubject={(subject) => setView({ name: 'subject', subject })}
      onContinue={(lesson) => setView({ name: 'lesson', lesson })}
      onLearned={() => setView({ name: 'learned' })}
      onParents={() => setView({ name: 'parents' })}
      speak={speak}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Home                                                                       */
/* -------------------------------------------------------------------------- */

function Home({
  progress, ready, onSubject, onContinue, onLearned, onParents, speak,
}: {
  progress: Progress;
  ready: boolean;
  onSubject: (subject: Subject) => void;
  onContinue: (lesson: Lesson) => void;
  onLearned: () => void;
  onParents: () => void;
  speak: (text: string) => void;
}) {
  const next = nextLesson(progress.lessons);
  const started = Object.keys(progress.lessons).length > 0;

  return (
    <div className="kids-center px-4 py-6">
      <div className="kids-shell">
      <header className="mb-6 text-center">
        <h1 className="font-bengali text-4xl font-bold text-[#2b3440]">
          পিকজিকো কিডস
        </h1>
        <p className="mt-1 font-bengali text-lg text-[#5a6675]">
          চলো শিখি! 🎈
        </p>
      </header>

      {/* Continue, which is the only thing most children will ever tap. It is
          first, biggest and says what happens next in three words. */}
      <button
        type="button"
        onClick={() => { speak(started ? 'চলো শিখি' : 'চলো শুরু করি'); onContinue(next); }}
        className="mb-4 flex w-full items-center gap-4 rounded-3xl bg-[#2eb8a6] p-5 text-left shadow-lg transition active:scale-[0.98]"
      >
        <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-white/25 text-5xl">
          ▶️
        </span>
        <span className="min-w-0">
          <span className="block font-bengali text-3xl font-bold text-white">
            {started ? 'চলো শিখি' : 'শুরু করি'}
          </span>
          <span className="block truncate font-bengali text-lg text-white/90">
            {next.title}
          </span>
        </span>
      </button>

      <div className="grid grid-cols-2 gap-4">
        {SUBJECTS.map((subject) => (
          <BigCard
            key={subject.id}
            title={subject.title}
            emoji={subject.id === 'bangla' ? '🔤' : '🔢'}
            tint={subject.id === 'bangla' ? '#fbd14b' : '#f58fb4'}
            onClick={() => { speak(subject.title); onSubject(subject); }}
          />
        ))}

        <BigCard
          title="আমার শেখা"
          emoji="⭐"
          tint="#9b7ede"
          onClick={() => { speak('আমার শেখা'); onLearned(); }}
        />

        <BigCard
          title="খেলি"
          emoji="🎮"
          tint="#4a9ff5"
          // Games live inside lessons for now; tapping here starts the lesson
          // the child is on, at whatever level they are on, which is exactly
          // what "play" means here. A separate arcade would be a different
          // product and is not in the curriculum.
          onClick={() => { speak('চলো খেলি'); onContinue(next); }}
        />
      </div>

      {ready && progress.stars > 0 && (
        <p className="mt-6 text-center font-bengali text-2xl font-bold text-[#2b3440]">
          ⭐ {toBn(progress.stars)}
          {progress.streak > 1 && (
            <span className="ml-3 text-xl text-[#5a6675]">
              🔥 {toBn(progress.streak)} দিন
            </span>
          )}
        </p>
      )}

      {/* Small, plain, at the bottom, in a place a child has no reason to tap. */}
      <div className="mt-10 text-center">
        <button
          type="button"
          onClick={onParents}
          className="font-bengali text-sm text-[#8795a5] underline underline-offset-4"
        >
          অভিভাবকদের জন্য
        </button>
      </div>
      </div>
    </div>
  );
}

function BigCard({
  title, emoji, tint, onClick,
}: { title: string; emoji: string; tint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ backgroundColor: tint }}
      className="flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-3xl p-4 shadow-lg transition active:scale-95"
    >
      <span className="text-5xl" aria-hidden>{emoji}</span>
      <span className="font-bengali text-2xl font-bold text-[#2b3440]">{title}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Subject → unit → lesson                                                    */
/* -------------------------------------------------------------------------- */

function SubjectView({
  subject, progress, onPick, onExit, speak,
}: {
  subject: Subject;
  progress: Progress;
  onPick: (lesson: Lesson) => void;
  onExit: () => void;
  speak: (text: string) => void;
}) {
  return (
    <div className="kids-shell px-4 pb-10 pt-4">
      <HomeBar title={subject.title} onExit={onExit} />

      {subject.units.map((unit) => (
        <section key={unit.id} className="mb-7">
          <h2 className="mb-3 font-bengali text-2xl font-bold text-[#2b3440]">
            {unit.title}
          </h2>
          {/* Two columns everywhere. The shell is now narrow enough that a
              third column on a wide viewport would make the cards *smaller*
              on desktop than on a phone, which is the wrong way round. */}
          <div className="grid grid-cols-2 gap-3">
            {unit.lessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                unit={unit}
                done={(progress.lessons[lesson.id] ?? 0) > 0}
                onClick={() => { speak(lesson.title); onPick(lesson); }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function LessonCard({
  lesson, unit, done, onClick,
}: { lesson: Lesson; unit: Unit; done: boolean; onClick: () => void }) {
  // The first *drawable* picture-word becomes the cover, so a non-reader can
  // tell ক-বর্গ from চ-বর্গ at a glance. Taking the first word regardless
  // would hand most cards the text fallback even when a later word in the
  // same lesson has a real drawing.
  const words = lesson.items.flatMap((i) => i.words).map((w) => w.text);
  const cover = words.find(hasArt) ?? words[0];

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex min-h-[132px] flex-col items-center justify-center gap-1 rounded-3xl bg-white p-3 shadow transition active:scale-95"
    >
      {done && (
        <span className="absolute right-2 top-2 text-xl" aria-label="হয়েছে">⭐</span>
      )}
      {cover ? <Art name={cover} size={60} /> : <span className="text-4xl">📘</span>}
      <span className="font-bengali text-xl font-bold text-[#2b3440]">
        {lesson.title}
      </span>
      <span className="sr-only">{unit.title}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* আমার শেখা                                                                  */
/* -------------------------------------------------------------------------- */

function Learned({ progress, onExit }: { progress: Progress; onExit: () => void }) {
  const counts = masteryCounts(progress.items);
  const known = Object.values(progress.items).filter(
    (i) => i.mastery === 'confident' || i.mastery === 'mastered',
  );
  const learning = Object.values(progress.items).filter(
    (i) => i.mastery === 'learning' || i.mastery === 'practicing',
  );

  return (
    <div className="kids-shell px-4 pb-10 pt-4">
      <HomeBar title="আমার শেখা" onExit={onExit} />

      <p className="mb-5 text-center font-bengali text-2xl font-bold text-[#2b3440]">
        ⭐ {toBn(progress.stars)}
      </p>

      {known.length === 0 && learning.length === 0 && (
        <p className="mt-10 text-center font-bengali text-xl text-[#5a6675]">
          চলো শুরু করি! 🎈
        </p>
      )}

      {/* Only what the child *has*. Nothing here shows a gap, a percentage or
          a thing they cannot do — that view exists, and it is the parent's. */}
      {known.length > 0 && (
        <Glyphs title="আমি পারি ⭐" ids={known.map((i) => i.id)} tint="#2eb8a6" />
      )}
      {learning.length > 0 && (
        <Glyphs title="শিখছি 😊" ids={learning.map((i) => i.id)} tint="#fbd14b" />
      )}

      <p className="sr-only">
        {counts.mastered} mastered, {counts.confident} confident
      </p>
    </div>
  );
}

function Glyphs({ title, ids, tint }: { title: string; ids: string[]; tint: string }) {
  return (
    <section className="mb-7">
      <h2 className="mb-3 font-bengali text-xl font-bold text-[#2b3440]">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <span
            key={id}
            style={{ backgroundColor: tint }}
            className="grid h-16 w-16 place-items-center rounded-2xl font-bengali text-3xl font-bold text-[#2b3440] shadow"
          >
            {glyphOf(id)}
          </span>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function HomeBar({ title, onExit }: { title: string; onExit: () => void }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <button
        type="button"
        onClick={onExit}
        aria-label="বাড়ি"
        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-3xl shadow"
      >
        🏠
      </button>
      <h1 className="font-bengali text-3xl font-bold text-[#2b3440]">{title}</h1>
    </div>
  );
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
function toBn(n: number): string {
  return String(n).split('').map((d) => BN_DIGITS[Number(d)] ?? d).join('');
}

/**
 * The glyph behind an item id.
 *
 * Ids are shaped `con-ক` / `num-৭` / `wrd-বল`, but reading the character off
 * the id would break the moment an id scheme changed, so it is looked up in
 * the curriculum and the id is only the fallback.
 */
function glyphOf(id: string): string {
  for (const subject of SUBJECTS) {
    for (const unit of subject.units) {
      for (const lesson of unit.lessons) {
        const item = lesson.items.find((i) => i.id === id);
        if (item) return item.glyph;
      }
    }
  }
  return id.split('-').slice(1).join('-') || id;
}

/** Exported for the parent view, which needs the same lookup. */
export { glyphOf, toBn };

/** Re-exported so the route can prefetch a deep link later. */
export { getLesson };
