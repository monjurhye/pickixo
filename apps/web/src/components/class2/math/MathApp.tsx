'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MathIllustration } from './mathDrawings';
import { bn } from '@/lib/class2/bnNumerals';
import { MathLessonPlayer } from './MathLessonPlayer';
import { sayBangla, warmUpVoices } from '@/lib/class2/speech';
import {
  awardBadge, chapterComplete, chapterStars, load, masteryCounts, revisionQueue,
  save, type Progress,
} from '@/lib/class2/mathProgress';
import type { Chapter, Topic } from '@/data/class2/math/schema';

/**
 * The child's Maths app — the same shape as `EnglishApp`, for the same
 * reason: client-side navigation state so Back in the browser never drops a
 * mid-lesson child out of their progress, and four screens only (home,
 * chapter, topic, finished).
 *
 * Everything here is in Bangla, because the book is. English's app has an
 * English/Bangla pair on every string; this one does not need it.
 */

type View =
  | { screen: 'home' }
  | { screen: 'chapter'; chapterId: string }
  | { screen: 'topic'; chapterId: string; topicId: string }
  | { screen: 'finished'; chapterId: string; topicId: string;
      starsEarned: number; rating: number; score: number; total: number };

export function MathApp({ chapters }: { chapters: Chapter[] }) {
  const [view, setView] = useState<View>({ screen: 'home' });
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => { setProgress(load()); warmUpVoices(); }, []);
  const refresh = useCallback(() => setProgress(load()), []);

  const chapter = useMemo(
    () => chapters.find((c) => c.id === ('chapterId' in view ? view.chapterId : '')),
    [chapters, view],
  );
  const topic = useMemo(
    () => chapter?.topics.find((t) => t.id === ('topicId' in view ? view.topicId : '')),
    [chapter, view],
  );

  if (!progress) {
    return <p className="py-20 text-center text-body text-ink-muted">লোড হচ্ছে…</p>;
  }

  if (view.screen === 'topic' && chapter && topic) {
    return (
      <MathLessonPlayer
        topic={topic}
        chapterTitle={chapter.title}
        onExit={() => { refresh(); setView({ screen: 'chapter', chapterId: chapter.id }); }}
        onFinished={(summary) => {
          const after = load();
          const ids = chapter.topics.map((t) => t.id);
          if (chapterComplete(after, chapter.id, ids)) {
            save(awardBadge(after, `chapter-${chapter.number}`));
          }
          refresh();
          setView({ screen: 'finished', chapterId: chapter.id, topicId: topic.id, ...summary });
        }}
      />
    );
  }

  if (view.screen === 'finished' && chapter && topic) {
    return (
      <Finished
        chapter={chapter}
        topic={topic}
        starsEarned={view.starsEarned}
        rating={view.rating}
        onNextTopic={(nextId) => setView({ screen: 'topic', chapterId: chapter.id, topicId: nextId })}
        onAgain={() => setView({ screen: 'topic', chapterId: chapter.id, topicId: topic.id })}
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
        onPick={(topicId) => setView({ screen: 'topic', chapterId: chapter.id, topicId })}
      />
    );
  }

  return (
    <Home
      chapters={chapters}
      progress={progress}
      onPickChapter={(chapterId) => setView({ screen: 'chapter', chapterId })}
      onContinue={(chapterId, topicId) => setView({ screen: 'topic', chapterId, topicId })}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Home                                                                       */
/* -------------------------------------------------------------------------- */

function Home({ chapters, progress, onPickChapter, onContinue }: {
  chapters: Chapter[]; progress: Progress;
  onPickChapter: (chapterId: string) => void;
  onContinue: (chapterId: string, topicId: string) => void;
}) {
  const nextUp = useMemo(() => {
    for (const chapter of chapters) {
      for (const topic of chapter.topics) {
        if (!progress.topics[topic.id]?.completed) return { chapter, topic };
      }
    }
    return null;
  }, [chapters, progress]);

  const counts = masteryCounts(progress);
  const practice = revisionQueue(progress, 99).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="flex items-center gap-4">
        <div className="h-20 w-20"><MathIllustration name="number-2" size={80} /></div>
        <div>
          <h1 className="text-title text-ink">👋 হ্যালো!</h1>
          <p className="mt-1 text-body text-ink-muted">চলো গণিত শিখি।</p>
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
          onClick={() => onContinue(nextUp.chapter.id, nextUp.topic.id)}
          className="mt-6 w-full rounded-card bg-accent p-6 text-left text-white
                     shadow-sm transition-transform active:scale-[0.99]"
        >
          <p className="text-micro font-semibold uppercase tracking-wide opacity-90">
            আজকের পাঠ · প্রায় {bn(nextUp.topic.minutes)} মিনিট
          </p>
          <p className="mt-2 text-title">{nextUp.topic.title}</p>
          <p className="mt-1 text-body opacity-90">{nextUp.topic.objective}</p>
          <p className="mt-4 text-subheading font-semibold">▶︎ শুরু করো</p>
        </button>
      ) : (
        <div className="mt-6 rounded-card bg-success/10 p-6 text-center">
          <p className="text-title text-ink">🎉 সব শেষ!</p>
          <p className="mt-1 text-body text-ink-muted">তুমি সব পাঠ শেষ করেছ। আবার এসে অনুশীলন করো।</p>
        </div>
      )}

      {practice > 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-card border-2
                        border-warning/30 bg-warning/5 p-4">
          <span className="text-2xl" aria-hidden="true">🧠</span>
          <p className="text-body text-ink">
            <strong>{bn(practice)}</strong>টি সংখ্যা আবার অনুশীলন করার সময় হয়েছে
          </p>
        </div>
      ) : null}

      <h2 className="mt-8 text-heading text-ink">📚 অধ্যায়সমূহ</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {chapters.map((chapter) => {
          const ids = chapter.topics.map((t) => t.id);
          const done = ids.filter((id) => progress.topics[id]?.completed).length;
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

      <h2 className="mt-8 text-heading text-ink">🎯 আমার সংখ্যা</h2>
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
  onPick: (topicId: string) => void;
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
        {chapter.topics.map((topic, i) => {
          const record = progress.topics[topic.id];
          const done = Boolean(record?.completed);
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => onPick(topic.id)}
              className={`flex w-full items-center gap-4 rounded-card border-2 p-4
                          text-left transition-transform active:scale-[0.99]
                          ${done ? 'border-success/40 bg-success/5' : 'border-border bg-surface'}`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center
                               rounded-full bg-accent-soft text-lg font-bold text-accent-ink">
                {done ? '✓' : bn(i + 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-subheading text-ink">{topic.title}</span>
                <span className="block text-small text-ink-muted">{topic.objective}</span>
                <span className="mt-0.5 block text-micro text-ink-subtle">
                  প্রায় {bn(topic.minutes)} মিনিট{record ? ` · ⭐ ${bn(record.stars)}` : ''}
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

function Finished({ chapter, topic, starsEarned, rating, onNextTopic, onAgain, onHome }: {
  chapter: Chapter; topic: Topic; starsEarned: number; rating: number;
  onNextTopic: (topicId: string) => void; onAgain: () => void; onHome: () => void;
}) {
  const index = chapter.topics.findIndex((t) => t.id === topic.id);
  const next = chapter.topics[index + 1];

  useEffect(() => { void sayBangla('দারুণ হয়েছে!'); }, []);

  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-center">
      <div className="mx-auto h-40 w-40"><MathIllustration name="number-3" size={160} /></div>
      <h1 className="mt-6 text-title text-ink">🎉 দারুণ হয়েছে!</h1>
      <p className="mt-2 text-subheading text-ink-muted">{topic.title}</p>
      <p className="mt-4 text-3xl" aria-label={`${rating} out of 5 stars`}>
        {'⭐'.repeat(rating)}{'☆'.repeat(5 - rating)}
      </p>
      {starsEarned > 0 ? (
        <p className="mt-2 text-subheading font-semibold text-accent-ink">+{bn(starsEarned)} তারা</p>
      ) : (
        <p className="mt-2 text-body text-ink-muted">অনুশীলন রাউন্ড — এই পাঠের তারা আগেই পেয়েছ। 💪</p>
      )}

      <div className="mt-8 space-y-3">
        {next ? (
          <button type="button" onClick={() => onNextTopic(next.id)}
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
