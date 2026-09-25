'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BanglaIllustration } from './banglaDrawings';
import { BanglaLessonPlayer } from './BanglaLessonPlayer';
import { bn } from '@/lib/class2/bnNumerals';
import { sayBangla, warmUpVoices } from '@/lib/class2/speech';
import {
  awardBadge, chapterComplete, chapterStars, load, masteryCounts, revisionQueue,
  save, type Progress,
} from '@/lib/class2/banglaProgress';
import type { Chapter, Lesson } from '@/data/class2/bangla/schema';

/**
 * The child's Bangla app — the same four screens as the Maths app (home,
 * chapter, lesson, finished) and for the same reasons: navigation state lives
 * in the client so Back never drops a mid-lesson child out of their progress,
 * and four screens is as many as a seven-year-old can hold.
 *
 * Everything here is in Bangla, because the book is.
 *
 * One thing this home screen shows that the other two do not is the **পাঠ
 * number from the book**. The 29 পাঠ are grouped into eight chapters by
 * theme, so a child following the printed book needs to see that "পাঠ ১৯
 * প্রজাপতি" is in here somewhere — chapter 5 — rather than concluding it is
 * missing.
 */

type View =
  | { screen: 'home' }
  | { screen: 'chapter'; chapterId: string }
  | { screen: 'lesson'; chapterId: string; lessonId: string }
  | { screen: 'finished'; chapterId: string; lessonId: string;
      starsEarned: number; rating: number; score: number; total: number };

export function BanglaApp({ chapters }: { chapters: Chapter[] }) {
  const [view, setView] = useState<View>({ screen: 'home' });
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => { setProgress(load()); warmUpVoices(); }, []);
  const refresh = useCallback(() => setProgress(load()), []);

  const chapter = useMemo(
    () => chapters.find((c) => c.id === ('chapterId' in view ? view.chapterId : '')),
    [chapters, view],
  );
  const lesson = useMemo(
    () => chapter?.lessons.find((l) => l.id === ('lessonId' in view ? view.lessonId : '')),
    [chapter, view],
  );

  if (!progress) {
    return <p className="py-20 text-center text-body text-ink-muted">লোড হচ্ছে…</p>;
  }

  if (view.screen === 'lesson' && chapter && lesson) {
    return (
      <BanglaLessonPlayer
        lesson={lesson}
        chapterTitle={chapter.title}
        onExit={() => { refresh(); setView({ screen: 'chapter', chapterId: chapter.id }); }}
        onFinished={(summary) => {
          const after = load();
          const ids = chapter.lessons.map((l) => l.id);
          if (chapterComplete(after, chapter.id, ids)) {
            save(awardBadge(after, `chapter-${chapter.number}`));
          }
          refresh();
          setView({ screen: 'finished', chapterId: chapter.id, lessonId: lesson.id, ...summary });
        }}
      />
    );
  }

  if (view.screen === 'finished' && chapter && lesson) {
    return (
      <Finished
        chapter={chapter}
        lesson={lesson}
        starsEarned={view.starsEarned}
        rating={view.rating}
        onNextLesson={(nextId) => setView({ screen: 'lesson', chapterId: chapter.id, lessonId: nextId })}
        onAgain={() => setView({ screen: 'lesson', chapterId: chapter.id, lessonId: lesson.id })}
        onHome={() => setView({ screen: 'home' })}
      />
    );
  }

  if (view.screen === 'chapter' && chapter) {
    return (
      <ChapterScreen
        chapter={chapter}
        progress={progress}
        onBack={() => setView({ screen: 'home' })}
        onPick={(lessonId) => setView({ screen: 'lesson', chapterId: chapter.id, lessonId })}
      />
    );
  }

  return (
    <Home
      chapters={chapters}
      progress={progress}
      onPickChapter={(chapterId) => setView({ screen: 'chapter', chapterId })}
      onContinue={(chapterId, lessonId) => setView({ screen: 'lesson', chapterId, lessonId })}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Home                                                                       */
/* -------------------------------------------------------------------------- */

function Home({ chapters, progress, onPickChapter, onContinue }: {
  chapters: Chapter[]; progress: Progress;
  onPickChapter: (chapterId: string) => void;
  onContinue: (chapterId: string, lessonId: string) => void;
}) {
  const nextUp = useMemo(() => {
    for (const chapter of chapters) {
      for (const lesson of chapter.lessons) {
        if (!progress.lessons[lesson.id]?.completed) return { chapter, lesson };
      }
    }
    return null;
  }, [chapters, progress]);

  const counts = masteryCounts(progress);
  const practice = revisionQueue(progress, 99).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="flex items-center gap-4">
        <div className="h-20 w-20"><BanglaIllustration name="book" size={80} /></div>
        <div>
          <h1 className="text-title text-ink">👋 হ্যালো!</h1>
          <p className="mt-1 text-body text-ink-muted">চলো বাংলা পড়ি।</p>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat icon="⭐" value={bn(progress.stars)} label="তারা" />
        <Stat icon="🔥" value={bn(progress.streak)} label="ধারাবাহিক দিন" />
        <Stat icon="🏅" value={bn(progress.badges.length)} label="ব্যাজ" />
      </div>

      {nextUp ? (
        <button
          type="button"
          onClick={() => onContinue(nextUp.chapter.id, nextUp.lesson.id)}
          className="mt-6 w-full rounded-card bg-accent p-6 text-left text-white
                     shadow-sm transition-transform active:scale-[0.99]"
        >
          <p className="text-micro font-semibold uppercase tracking-wide opacity-90">
            পাঠ {bn(nextUp.lesson.number)} · প্রায় {bn(nextUp.lesson.minutes)} মিনিট
          </p>
          <p className="mt-2 text-title">{nextUp.lesson.title}</p>
          <p className="mt-1 text-body opacity-90">{nextUp.lesson.objective}</p>
          <p className="mt-4 text-subheading font-semibold">▶︎ শুরু করো</p>
        </button>
      ) : (
        <div className="mt-6 rounded-card bg-success/10 p-6 text-center">
          <p className="text-title text-ink">🎉 সব শেষ!</p>
          <p className="mt-1 text-body text-ink-muted">
            তুমি বইয়ের সব পাঠ শেষ করেছ। আবার এসে অনুশীলন করো।
          </p>
        </div>
      )}

      {practice > 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-card border-2
                        border-warning/30 bg-warning/5 p-4">
          <span className="text-2xl" aria-hidden="true">🧠</span>
          <p className="text-body text-ink">
            <strong>{bn(practice)}</strong>টি শব্দ আবার অনুশীলন করার সময় হয়েছে
          </p>
        </div>
      ) : null}

      <h2 className="mt-8 text-heading text-ink">📚 অধ্যায়সমূহ</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {chapters.map((chapter) => {
          const ids = chapter.lessons.map((l) => l.id);
          const done = ids.filter((id) => progress.lessons[id]?.completed).length;
          const complete = done === ids.length;
          return (
            <button
              key={chapter.id}
              type="button"
              onClick={() => onPickChapter(chapter.id)}
              className="flex min-w-0 items-center gap-4 rounded-card border-2
                         border-border bg-surface p-4 text-left transition-transform
                         active:scale-[0.99]"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center
                               rounded-full bg-accent-soft text-xl font-bold
                               text-accent-ink">
                {bn(chapter.number)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-subheading text-ink">{chapter.title}</span>
                <span className="block text-small text-ink-muted">
                  {complete ? '✓ শেষ' : `${bn(done)} / ${bn(ids.length)} পাঠ`}
                  {' · '}⭐ {bn(chapterStars(progress, ids))}
                </span>
              </span>
              {complete ? <span aria-hidden="true">🏅</span> : null}
            </button>
          );
        })}
      </div>

      <h2 className="mt-8 text-heading text-ink">🎯 আমার শব্দ</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="🌱" value={bn(counts.learning)} label="শিখছি" small />
        <Stat icon="💪" value={bn(counts.practicing)} label="অনুশীলন" small />
        <Stat icon="⭐" value={bn(counts.mastered)} label="আয়ত্ত" small />
        <Stat icon="🧠" value={bn(practice)} label="অনুশীলন বাকি" small />
      </div>
    </div>
  );
}

function Stat({ icon, value, label, small = false }: {
  icon: string; value: string | number; label: string; small?: boolean;
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
/* Chapter                                                                    */
/* -------------------------------------------------------------------------- */

function ChapterScreen({ chapter, progress, onBack, onPick }: {
  chapter: Chapter; progress: Progress; onBack: () => void;
  onPick: (lessonId: string) => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <button type="button" onClick={onBack}
              className="flex h-11 items-center gap-2 rounded-full bg-surface-sunken px-4
                         text-body text-ink-muted">
        ← হোম
      </button>

      <header className="mt-4">
        <p className="text-micro font-semibold uppercase tracking-wide text-accent-ink">
          অধ্যায় {bn(chapter.number)}
        </p>
        <h1 className="mt-1 text-title text-ink">{chapter.title}</h1>
      </header>

      <div className="mt-6 space-y-3">
        {chapter.lessons.map((lesson) => {
          const record = progress.lessons[lesson.id];
          const done = Boolean(record?.completed);
          return (
            <button
              key={lesson.id}
              type="button"
              onClick={() => onPick(lesson.id)}
              className={`flex w-full items-center gap-4 rounded-card border-2 p-4
                          text-left transition-transform active:scale-[0.99]
                          ${done ? 'border-success/40 bg-success/5' : 'border-border bg-surface'}`}
            >
              {/* The book's own পাঠ number, not a position in this chapter —
                  a child with the printed book open needs the two to match. */}
              <span className="flex h-12 w-12 shrink-0 items-center justify-center
                               rounded-full bg-accent-soft text-lg font-bold text-accent-ink">
                {done ? '✓' : bn(lesson.number)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-subheading text-ink">{lesson.title}</span>
                <span className="block text-small text-ink-muted">{lesson.objective}</span>
                <span className="mt-0.5 block text-micro text-ink-subtle">
                  পাঠ {bn(lesson.number)} · প্রায় {bn(lesson.minutes)} মিনিট
                  {record ? ` · ⭐ ${bn(record.stars)}` : ''}
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

function Finished({ chapter, lesson, starsEarned, rating, onNextLesson, onAgain, onHome }: {
  chapter: Chapter; lesson: Lesson; starsEarned: number; rating: number;
  onNextLesson: (lessonId: string) => void; onAgain: () => void; onHome: () => void;
}) {
  const index = chapter.lessons.findIndex((l) => l.id === lesson.id);
  const next = chapter.lessons[index + 1];

  useEffect(() => { void sayBangla('দারুণ হয়েছে!'); }, []);

  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-center">
      <div className="mx-auto h-40 w-40"><BanglaIllustration name="star" size={160} /></div>
      <h1 className="mt-6 text-title text-ink">🎉 দারুণ হয়েছে!</h1>
      <p className="mt-2 text-subheading text-ink-muted">{lesson.title}</p>
      <p className="mt-4 text-3xl" aria-label={`${rating} out of 5 stars`}>
        {'⭐'.repeat(rating)}{'☆'.repeat(5 - rating)}
      </p>
      {starsEarned > 0 ? (
        <p className="mt-2 text-subheading font-semibold text-accent-ink">
          +{bn(starsEarned)} তারা
        </p>
      ) : (
        <p className="mt-2 text-body text-ink-muted">
          অনুশীলন রাউন্ড — এই পাঠের তারা আগেই পেয়েছ। 💪
        </p>
      )}

      <div className="mt-8 space-y-3">
        {next ? (
          <button type="button" onClick={() => onNextLesson(next.id)}
                  className="w-full rounded-card bg-accent px-6 py-5 text-subheading
                             font-semibold text-white active:scale-[0.98]">
            পরের পাঠ → {next.title}
          </button>
        ) : (
          <div className="rounded-card bg-success/10 p-5">
            <p className="text-heading text-ink">🏆 অধ্যায় {bn(chapter.number)} শেষ!</p>
            <p className="mt-1 text-body text-ink-muted">তুমি একটি ব্যাজ পেয়েছ।</p>
          </div>
        )}
        <button type="button" onClick={onAgain}
                className="w-full rounded-card border-2 border-border-strong bg-surface
                           px-6 py-4 text-subheading text-ink active:scale-[0.98]">
          আবার অনুশীলন করো 🔁
        </button>
        <button type="button" onClick={onHome}
                className="w-full rounded-card px-6 py-3 text-body text-ink-muted">
          🏠 হোম
        </button>
      </div>

      <p className="mt-10 text-small text-ink-subtle">
        আজকের পড়া শেষ। পরের পাঠের জন্য পরে আবার এসো। 🌟
      </p>
    </div>
  );
}
