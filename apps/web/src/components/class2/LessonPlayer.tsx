'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Illustration } from './Illustration';
import {
  banglaSpeechAvailable, encouragement, listen, listeningSupported, say,
  sayBangla, speechSupported, stopSpeaking, warmUpVoices,
} from '@/lib/class2/speech';
import {
  completeLesson, load, recordAnswer, save, scoreToStars,
} from '@/lib/class2/progress';

/**
 * The lesson player.
 *
 * One component drives all eight lesson shapes, because the textbook itself is
 * built from a small set of repeating activities — so a lesson is a sequence
 * of steps, not a bespoke screen.
 *
 * Three rules run through every screen here, and they are for a seven-year-old
 * rather than for a user:
 *
 *   * **Nothing is ever "Wrong."** A wrong tap says "Try again" 💪, replays the
 *     sound, and gives a hint. After a second miss the answer is shown, because
 *     a child stuck on question three must never be trapped there.
 *   * **Sound is always one tap away.** Every word, line and question has 🔊,
 *     and tapping it is free — there is no penalty for listening again.
 *   * **Reading is never required to proceed.** Instructions are short, paired
 *     with Bangla, and every button carries an icon as well as a word.
 */

import type { Lesson, VocabItem } from '@/data/class2/english/schema';

interface GameRoundLike {
  id: string; ask: string; askBn?: string; image?: string; speak?: string;
  options: { label?: string; image?: string }[]; answer: number;
  hint?: string; tests?: string;
}

interface QuestionLike extends GameRoundLike {
  explain?: string;
}

/**
 * A step as it arrives from JSON, before the player narrows it by `type`.
 *
 * The schema models steps as a discriminated union, which is right for
 * authoring. At runtime the player switches on `type` and hands the step to
 * exactly one component, so re-narrowing the union inside each of those
 * components would be ceremony that buys nothing. This is the honest
 * description of what a component receives: the shared fields, plus whatever
 * any step kind may carry, all optional.
 */
interface LooseStep {
  id: string;
  type: string;
  title: string;
  titleBn?: string;
  bookActivity?: string;
  source?: string;
  say?: string;
  sayBn?: string;
  illustration?: string;
  items?: string[];
  lines?: { speaker: string; text: string }[];
  verses?: string[][];
  listenLabel?: string;
  prompt?: string;
  promptBn?: string;
  modelAnswer?: string;
  kind?: string;
  rounds?: GameRoundLike[];
  questions?: QuestionLike[];
  commands?: { text: string; textBn?: string; illustration: string | null }[];
  scenes?: { id: string; text: string; illustration: string | null }[];
}

interface Props {
  lesson: Lesson;
  unitTitle: string;
  onExit: () => void;
  onFinished: (summary: {
    /** Stars added to the running total — 0 when repeating a lesson. */
    starsEarned: number;
    /** The 1-5 rating for this attempt. Always at least 1. */
    rating: number;
    score: number;
    total: number;
  }) => void;
}

export function LessonPlayer({ lesson, unitTitle, onExit, onFinished }: Props) {
  const [index, setIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizTotal, setQuizTotal] = useState(0);
  const [missed, setMissed] = useState<string[]>([]);

  const steps = (lesson.steps ?? []) as unknown as LooseStep[];
  const step = steps[index];
  const vocabById = useMemo(() => {
    const map = new Map<string, VocabItem>();
    for (const item of lesson.vocabulary ?? []) map.set(item.id, item);
    return map;
  }, [lesson]);

  // iOS will not speak until the child has interacted; warming the voice list
  // early means the first 🔊 tap works rather than being silently ignored.
  useEffect(() => { warmUpVoices(); return () => stopSpeaking(); }, []);
  useEffect(() => { stopSpeaking(); }, [index]);

  const next = useCallback(() => {
    setIndex((i) => Math.min(steps.length - 1, i + 1));
  }, [steps.length]);

  const recordVocab = useCallback((vocabId: string | undefined, correct: boolean) => {
    if (!vocabId) return;
    const progress = recordAnswer(load(), vocabId, correct);
    save(progress);
    if (!correct) setMissed((m) => (m.includes(vocabId) ? m : [...m, vocabId]));
  }, []);

  const finish = useCallback(() => {
    const quiz = quizTotal > 0 ? { score: quizScore, total: quizTotal } : null;
    const { progress, starsAwarded } = completeLesson(
      load(),
      { id: lesson.id, unitId: lesson.unitId, minutes: lesson.minutes ?? 5 },
      quiz,
    );
    save(progress);
    onFinished({
      starsEarned: starsAwarded,
      rating: scoreToStars(quizScore, quizTotal),
      score: quizScore,
      total: quizTotal,
    });
  }, [lesson, quizScore, quizTotal, onFinished]);

  if (!step) return null;

  const progressPercent = ((index + 1) / steps.length) * 100;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col px-4 pb-10">
      {/* --- top bar: always escapable ----------------------------------- */}
      <div className="flex items-center gap-3 py-4">
        <button
          type="button"
          onClick={onExit}
          aria-label="Back to lessons"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full
                     bg-surface-sunken text-xl text-ink-muted hover:bg-border"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-micro text-ink-subtle">{unitTitle}</p>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <span className="shrink-0 text-small font-semibold text-ink-muted tabular-nums">
          {index + 1}/{steps.length}
        </span>
      </div>

      {/*
        Keyed by step id so every step starts fresh.

        Without the key, React reuses one component instance for two steps of
        the same type in a row — and a lesson with two games in it opened the
        second one already showing "Nice playing!", because the round counter
        from the first game was still in place. The child never got to play it.
        The same leak was waiting for any two consecutive vocab, speak or
        dialogue steps.
      */}
      <div key={step.id} className="flex-1">
        {step.type === 'intro' && <StepIntro step={step} onNext={next} />}
        {step.type === 'vocab' && (
          <StepVocab step={step} vocabById={vocabById} onNext={next} />
        )}
        {step.type === 'dialogue' && <StepDialogue step={step} onNext={next} />}
        {step.type === 'rhyme' && <StepRhyme step={step} onNext={next} />}
        {step.type === 'story' && <StepStory step={step} onNext={next} />}
        {step.type === 'command' && <StepCommand step={step} onNext={next} />}
        {step.type === 'speak' && <StepSpeak step={step} onNext={next} />}
        {step.type === 'game' && (
          <StepGame step={step} vocabById={vocabById} onNext={next}
                    onAnswer={recordVocab} />
        )}
        {step.type === 'quiz' && (
          <StepQuiz
            step={step}
            onAnswer={recordVocab}
            onDone={(score, total) => { setQuizScore(score); setQuizTotal(total); next(); }}
          />
        )}
        {step.type === 'done' && (
          <StepDone step={step} score={quizScore} total={quizTotal}
                    missed={missed.length} onFinish={finish} />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared pieces                                                              */
/* -------------------------------------------------------------------------- */

/** The listen button. Big, obvious, and never penalised. */
function Speaker({ text, slow = false, size = 'md' }: {
  text: string; slow?: boolean; size?: 'sm' | 'md';
}) {
  const [busy, setBusy] = useState(false);
  if (!speechSupported()) return null;

  const dimension = size === 'sm' ? 'h-10 w-10 text-lg' : 'h-14 w-14 text-2xl';
  return (
    <button
      type="button"
      aria-label={slow ? `Listen slowly: ${text}` : `Listen: ${text}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await say(text, slow ? 'slow' : 'normal');
        setBusy(false);
      }}
      className={`${dimension} flex shrink-0 items-center justify-center rounded-full
                  bg-accent-soft text-accent-ink transition-transform
                  active:scale-95 disabled:opacity-60`}
    >
      {slow ? '🐢' : '🔊'}
    </button>
  );
}

/**
 * Say the Bangla meaning.
 *
 * Deliberately a separate button from the English one. The child needs to
 * hear two different things — how the English word sounds, and what it means —
 * and one button that says both would blur exactly the distinction the lesson
 * is teaching.
 *
 * Hidden entirely on a device with no Bangla voice, because a button that
 * produces silence teaches a child that the app is broken.
 */
function BanglaSpeaker({ text, size = 'md' }: { text: string; size?: 'sm' | 'md' }) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Voices can arrive after first paint, so this is re-checked once rather
    // than decided on mount.
    setAvailable(banglaSpeechAvailable());
    const timer = setTimeout(() => setAvailable(banglaSpeechAvailable()), 700);
    return () => clearTimeout(timer);
  }, []);

  if (!available || !text) return null;

  const dimension = size === 'sm' ? 'h-10 w-10 text-sm' : 'h-14 w-14 text-base';
  return (
    <button
      type="button"
      aria-label={`বাংলায় শুনুন: ${text}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await sayBangla(text);
        setBusy(false);
      }}
      className={`${dimension} flex shrink-0 items-center justify-center rounded-full
                  bg-success/15 font-semibold text-success transition-transform
                  active:scale-95 disabled:opacity-60`}
    >
      বাং
    </button>
  );
}

function BigButton({ children, onClick, tone = 'primary' }: {
  children: React.ReactNode; onClick: () => void; tone?: 'primary' | 'quiet';
}) {
  const styles = tone === 'primary'
    ? 'bg-accent text-white shadow-sm'
    : 'bg-surface text-ink border-2 border-border-strong';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${styles} mt-8 w-full rounded-card px-6 py-5 text-subheading
                  font-semibold transition-transform active:scale-[0.98]`}
    >
      {children}
    </button>
  );
}

function Title({ step }: { step: LooseStep }) {
  return (
    <div className="text-center">
      <h2 className="text-heading text-ink">{step.title}</h2>
      {step.titleBn ? (
        <p className="mt-1 text-body text-ink-muted">{step.titleBn}</p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                      */
/* -------------------------------------------------------------------------- */

function StepIntro({ step, onNext }: { step: LooseStep; onNext: () => void }) {
  useEffect(() => { void say(step.say ?? ''); }, [step.say]);
  return (
    <section className="flex flex-col items-center pt-4 text-center">
      <Illustration name={step.illustration ?? 'hello'} size={168} animate />
      <h2 className="mt-6 text-title text-ink">{step.title}</h2>
      {step.titleBn ? <p className="mt-1 text-subheading text-ink-muted">{step.titleBn}</p> : null}
      <div className="mt-4 flex items-center gap-3">
        <p className="text-body text-ink-muted">{step.say}</p>
        <Speaker text={step.say ?? ''} size="sm" />
      </div>
      {step.sayBn ? (
        <div className="mt-2 flex items-center gap-2">
          <p className="text-body text-ink-subtle">{step.sayBn}</p>
          <BanglaSpeaker text={step.sayBn} size="sm" />
        </div>
      ) : null}
      <BigButton onClick={onNext}>Let&apos;s go! 🚀</BigButton>
    </section>
  );
}

function StepVocab({ step, vocabById, onNext }: {
  step: LooseStep; vocabById: Map<string, VocabItem>; onNext: () => void;
}) {
  const items = (step.items ?? [])
    .map((id) => vocabById.get(id))
    .filter((v): v is VocabItem => Boolean(v));
  const [seen, setSeen] = useState<string[]>([]);
  const allSeen = seen.length >= items.length;

  return (
    <section className="pt-2">
      <Title step={step} />
      <div className="mt-6 space-y-3">
        {items.map((item: any) => (
          <WordCard
            key={item.id}
            item={item}
            onHeard={() => setSeen((s) => (s.includes(item.id) ? s : [...s, item.id]))}
          />
        ))}
      </div>
      <BigButton onClick={onNext} tone={allSeen ? 'primary' : 'quiet'}>
        {allSeen ? 'Next →' : 'Tap 🔊 to hear the words'}
      </BigButton>
    </section>
  );
}

function WordCard({ item, onHeard }: { item: VocabItem; onHeard: () => void }) {
  return (
    <div className="flex items-center gap-4 rounded-card border-2 border-border
                    bg-surface p-4">
      <Illustration name={item.image ?? 'unknown'} size={72} label={item.word} />
      <div className="min-w-0 flex-1">
        <p className="text-heading text-ink">{item.word}</p>
        {/* Bangla is what makes the word mean anything to this child — and it
            has its own listen button, because a Class 2 child cannot always
            read Bangla fluently either. */}
        {item.bangla ? (
          <div className="flex items-center gap-2">
            <p className="text-subheading font-normal text-accent-ink">{item.bangla}</p>
            <BanglaSpeaker text={item.bangla} size="sm" />
          </div>
        ) : null}
        {item.banglaPronunciation ? (
          <p className="text-small text-ink-subtle">{item.banglaPronunciation}</p>
        ) : null}
        {item.example ? (
          <p className="mt-1 text-small italic text-ink-muted">“{item.example}”</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col gap-2">
        <span onClick={onHeard}><Speaker text={item.word} /></span>
        <span onClick={onHeard}><Speaker text={item.word} slow size="sm" /></span>
      </div>
    </div>
  );
}

function StepDialogue({ step, onNext }: { step: LooseStep; onNext: () => void }) {
  const [playing, setPlaying] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => () => { cancelled.current = true; }, []);

  const playAll = async () => {
    setPlaying(true);
    for (const line of step.lines ?? []) {
      if (cancelled.current) break;
      await say(line.text);
    }
    setPlaying(false);
  };

  return (
    <section className="pt-2">
      <Title step={step} />
      <div className="mt-6 space-y-3">
        {(step.lines ?? []).map((line, i) => {
          const isLeft = i % 2 === 0;
          return (
            <div key={i} className={`flex items-end gap-2 ${isLeft ? '' : 'flex-row-reverse'}`}>
              <div className={`max-w-[80%] rounded-card px-4 py-3
                               ${isLeft ? 'bg-accent-soft' : 'bg-surface-sunken'}`}>
                <p className="text-micro font-semibold text-ink-subtle">{line.speaker}</p>
                <p className="text-body text-ink">{line.text}</p>
              </div>
              <Speaker text={line.text} size="sm" />
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={playAll}
        disabled={playing}
        className="mt-6 w-full rounded-card border-2 border-accent bg-accent-soft
                   px-6 py-4 text-subheading font-semibold text-accent-ink
                   disabled:opacity-70"
      >
        {playing ? 'Listening… 👂' : '▶︎ Play the whole talk'}
      </button>
      <BigButton onClick={onNext}>Next →</BigButton>
    </section>
  );
}

function StepRhyme({ step, onNext }: { step: LooseStep; onNext: () => void }) {
  const lines: string[] = (step.verses ?? []).flat();
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(-1);

  const recite = async () => {
    setPlaying(true);
    for (let i = 0; i < lines.length; i++) {
      setCurrent(i);
      await say(lines[i]!);
    }
    setCurrent(-1);
    setPlaying(false);
  };

  return (
    <section className="pt-2">
      <Title step={step} />
      <div className="mt-6 rounded-card border-2 border-border bg-surface p-5">
        {(step.verses ?? []).map((verse, vi) => (
          <div key={vi} className="mb-4 last:mb-0">
            {verse.map((line, li) => {
              const flat = (step.verses ?? []).slice(0, vi).flat().length + li;
              return (
                <p
                  key={li}
                  className={`text-subheading leading-relaxed transition-colors
                              ${current === flat ? 'text-accent-ink font-semibold'
                                                 : 'text-ink'}`}
                >
                  {line}
                </p>
              );
            })}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={recite}
        disabled={playing}
        className="mt-6 w-full rounded-card border-2 border-accent bg-accent-soft
                   px-6 py-4 text-subheading font-semibold text-accent-ink
                   disabled:opacity-70"
      >
        {playing
          ? (step.listenLabel ? 'Reading… 📖' : 'Reciting… 🎵')
          : `▶︎ ${step.listenLabel ?? 'Listen to the rhyme'}`}
      </button>
      <BigButton onClick={onNext}>Next →</BigButton>
    </section>
  );
}

/**
 * A story told one panel at a time, as the book does it.
 *
 * The textbook's stories are already cut into pictures with a sentence or two
 * each, so this follows the book's own panels rather than re-cutting them. The
 * sentence is spoken as the panel appears; the child can go back, hear it
 * again, or have the whole story read through. Nothing here can be got wrong,
 * so nothing is scored — the games after it check that the story was followed.
 */
function StepStory({ step, onNext }: { step: LooseStep; onNext: () => void }) {
  const scenes = step.scenes ?? [];
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const cancelled = useRef(false);
  const current = scenes[index];
  const last = index + 1 >= scenes.length;

  useEffect(() => () => { cancelled.current = true; }, []);
  useEffect(() => {
    if (current && !playing) void say(current.text);
    // Only when the panel changes; the read-through drives its own speech.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const readAll = async () => {
    setPlaying(true);
    for (let i = 0; i < scenes.length; i++) {
      if (cancelled.current) break;
      setIndex(i);
      await say(scenes[i]!.text);
    }
    setPlaying(false);
  };

  if (!current) {
    return (
      <section className="pt-2">
        <Title step={step} />
        <BigButton onClick={onNext}>Next →</BigButton>
      </section>
    );
  }

  return (
    <section className="flex flex-col items-center pt-2 text-center">
      <Title step={step} />
      <p className="mt-1 text-small text-ink-subtle">{index + 1} of {scenes.length}</p>

      <div className="mt-4">
        <Illustration name={current.illustration ?? 'unknown'} size={200} animate
                      label={current.text} />
      </div>
      <div className="mt-4 flex items-center justify-center gap-3">
        <p className="text-heading text-ink">{current.text}</p>
        <Speaker text={current.text} />
      </div>

      <div className="mt-5 flex w-full gap-3">
        <button
          type="button"
          disabled={index === 0 || playing}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="w-1/3 rounded-card border-2 border-border-strong bg-surface px-4 py-4
                     text-subheading text-ink disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          type="button"
          disabled={playing}
          onClick={readAll}
          className="flex-1 rounded-card border-2 border-accent bg-accent-soft px-4 py-4
                     text-subheading font-semibold text-accent-ink disabled:opacity-70"
        >
          {playing ? 'Listening… 👂' : '▶︎ Read it all'}
        </button>
      </div>

      <BigButton onClick={() => (last ? onNext() : setIndex((i) => i + 1))}>
        {last ? 'Next →' : 'Next picture →'}
      </BigButton>
    </section>
  );
}

/**
 * "Listen and do" — the classroom-commands lesson is about acting, not
 * answering, so this is the one step with no right or wrong.
 *
 * One command at a time, spoken as it appears, with the picture large. The
 * child does it (stands up, claps, draws on paper) and taps to say so. There
 * is nothing to mark, so there is nothing to get wrong: the only thing that
 * could go badly is a child having no way to hear the command again, which is
 * why 🔊 and 🐢 stay on screen.
 */
function StepCommand({ step, onNext }: { step: LooseStep; onNext: () => void }) {
  const commands = step.commands ?? [];
  const [index, setIndex] = useState(0);
  const current = commands[index];
  const last = index + 1 >= commands.length;

  useEffect(() => { if (current) void say(current.text); }, [current]);

  if (!current) {
    return (
      <section className="pt-2">
        <Title step={step} />
        <BigButton onClick={onNext}>Next →</BigButton>
      </section>
    );
  }

  return (
    <section className="flex flex-col items-center pt-2 text-center">
      <Title step={step} />
      <p className="mt-1 text-small text-ink-subtle">{index + 1} of {commands.length}</p>

      <div className="mt-4">
        <Illustration name={current.illustration ?? 'unknown'} size={180} animate
                      label={current.text} />
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <p className="text-title text-ink">{current.text}</p>
        <Speaker text={current.text} />
        <Speaker text={current.text} slow size="sm" />
      </div>
      {current.textBn ? (
        <div className="mt-1 flex items-center justify-center gap-2">
          <p className="text-subheading text-ink-muted">{current.textBn}</p>
          <BanglaSpeaker text={current.textBn} size="sm" />
        </div>
      ) : null}

      <p className="mt-4 rounded-control bg-accent-soft px-4 py-2 text-body text-accent-ink">
        Do it now! 🙌
      </p>

      <BigButton onClick={() => (last ? onNext() : setIndex((i) => i + 1))}>
        {last ? 'All done →' : 'I did it! ✓'}
      </BigButton>
    </section>
  );
}

function StepSpeak({ step, onNext }: { step: LooseStep; onNext: () => void }) {
  const [state, setState] = useState<'idle' | 'listening' | 'done'>('idle');
  const [feedback, setFeedback] = useState<string | null>(null);
  const canListen = listeningSupported();

  const tryIt = async () => {
    setState('listening');
    setFeedback(null);
    const heard = await listen(step.modelAnswer ?? '');
    setFeedback(encouragement(heard));
    setState('done');
  };

  return (
    <section className="flex flex-col items-center pt-4 text-center">
      <Title step={step} />
      <div className="mt-6 flex items-center gap-3">
        <p className="text-title text-ink">{step.prompt}</p>
        <Speaker text={step.prompt ?? ''} />
      </div>
      {step.promptBn ? (
        <div className="mt-2 flex items-center justify-center gap-2">
          <p className="text-subheading text-ink-muted">{step.promptBn}</p>
          <BanglaSpeaker text={step.promptBn} size="sm" />
        </div>
      ) : null}

      <div className="mt-6 rounded-card border-2 border-dashed border-border-strong
                      bg-surface-sunken px-6 py-5">
        <p className="text-micro text-ink-subtle">Say something like</p>
        <p className="mt-1 text-subheading text-ink">{step.modelAnswer}</p>
      </div>

      {canListen ? (
        <button
          type="button"
          onClick={tryIt}
          disabled={state === 'listening'}
          className="mt-6 flex h-24 w-24 items-center justify-center rounded-full
                     bg-accent text-4xl text-white shadow-sm transition-transform
                     active:scale-95 disabled:opacity-70"
          aria-label="Speak now"
        >
          {state === 'listening' ? '👂' : '🎤'}
        </button>
      ) : (
        // No microphone support is not a failure the child should meet. They
        // simply say it out loud and carry on.
        <p className="mt-6 text-body text-ink-muted">Say it out loud! 🗣️</p>
      )}

      {feedback ? (
        <p role="status" className="mt-4 text-subheading text-accent-ink">{feedback}</p>
      ) : null}

      <BigButton onClick={onNext}>
        {state === 'done' || !canListen ? 'Next →' : 'Skip for now →'}
      </BigButton>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Games and quiz — shared answer behaviour                                   */
/* -------------------------------------------------------------------------- */

interface ChoiceProps {
  ask: string;
  askBn?: string;
  /** The picture the question is about, shown above it. */
  image?: string;
  speak?: string;
  options: { label?: string; image?: string }[];
  answer: number;
  hint?: string;
  explain?: string;
  onResolved: (correct: boolean) => void;
}

/**
 * One question, however it is dressed.
 *
 * The behaviour on a wrong answer is the important part: the option is marked
 * gently, the audio replays, a hint appears, and the child tries again. After
 * a second miss the right answer is revealed and the child moves on — being
 * stuck is worse for a seven-year-old than being told.
 */
function Choice({
  ask, askBn, image, speak, options, answer, hint, explain, onResolved,
}: ChoiceProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (speak) void say(speak);
  }, [speak]);

  const choose = async (i: number) => {
    if (revealed) return;
    setPicked(i);

    if (i === answer) {
      setRevealed(true);
      onResolved(attempts === 0);
      return;
    }

    const used = attempts + 1;
    setAttempts(used);
    if (speak) void say(speak, 'slow');

    if (used >= 2) {
      // Show the answer rather than leaving them stuck.
      setRevealed(true);
      onResolved(false);
    }
  };

  return (
    <div>
      {/* The subject of the question, before the question itself: a child
          looks at the picture first and reads second. */}
      {image ? (
        <div className="flex justify-center">
          <Illustration name={image} size={148} label={ask} />
        </div>
      ) : null}
      <div className="mt-4 flex items-center justify-center gap-3">
        <p className="text-heading text-ink">{ask}</p>
        {speak ? <Speaker text={speak} /> : null}
      </div>
      {askBn ? (
        <div className="mt-1 flex items-center justify-center gap-2">
          <p className="text-center text-body text-ink-muted">{askBn}</p>
          <BanglaSpeaker text={askBn} size="sm" />
        </div>
      ) : null}

      <div className="mt-6 grid gap-3">
        {options.map((option, i) => {
          const isAnswer = i === answer;
          const isPicked = picked === i;
          const showRight = revealed && isAnswer;
          const showWrong = isPicked && !isAnswer && !revealed;

          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              disabled={revealed}
              className={`flex items-center gap-4 rounded-card border-2 px-5 py-4
                          text-left text-subheading transition-all active:scale-[0.99]
                          ${showRight ? 'border-success bg-success/10 text-ink'
                            : showWrong ? 'border-warning bg-warning/10 text-ink'
                            : 'border-border-strong bg-surface text-ink'}`}
            >
              {option.image ? (
                <Illustration name={option.image} size={56} label={option.label} />
              ) : null}
              <span className="flex-1">{option.label}</span>
              {showRight ? <span aria-hidden="true">✓</span> : null}
              {showWrong ? <span aria-hidden="true">↻</span> : null}
            </button>
          );
        })}
      </div>

      {/* Never "Wrong." */}
      {attempts > 0 && !revealed ? (
        <p role="status" className="mt-4 rounded-control bg-warning/10 px-4 py-3
                                    text-center text-body text-ink">
          Try again! 💪 {hint ?? ''}
        </p>
      ) : null}

      {revealed && explain ? (
        <p className="mt-4 rounded-control bg-accent-soft px-4 py-3 text-center
                      text-body text-accent-ink">{explain}</p>
      ) : null}
    </div>
  );
}

function StepGame({ step, vocabById, onNext, onAnswer }: {
  step: LooseStep; vocabById: Map<string, VocabItem>; onNext: () => void;
  onAnswer: (vocabId: string | undefined, correct: boolean) => void;
}) {
  const rounds = step.rounds ?? [];
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(false);
  const current = rounds[round];

  const advance = (correct: boolean) => {
    onAnswer(current?.tests, correct);
    setTimeout(() => {
      if (round + 1 >= rounds.length) setDone(true);
      else setRound((r) => r + 1);
    }, 900);
  };

  if (!rounds.length) {
    return (
      <section className="pt-2">
        <Title step={step} />
        <BigButton onClick={onNext}>Next →</BigButton>
      </section>
    );
  }

  return (
    <section className="pt-2">
      <div className="text-center">
        <p className="text-micro font-semibold uppercase tracking-wide text-accent-ink">
          🎮 Game
        </p>
        <Title step={step} />
        <p className="mt-1 text-small text-ink-subtle">
          {Math.min(round + 1, rounds.length)} of {rounds.length}
        </p>
      </div>

      <div className="mt-6">
        {done || !current ? (
          <div className="text-center">
            <Illustration name="star" size={140} animate />
            <p className="mt-4 text-heading text-ink">Nice playing! 🎉</p>
          </div>
        ) : (
          <Choice
            key={current.id}
            ask={current.ask}
            askBn={current.askBn}
            image={current.image}
            speak={current.speak}
            options={current.options}
            answer={current.answer}
            hint={current.hint}
            onResolved={advance}
          />
        )}
      </div>

      {done || !current ? <BigButton onClick={onNext}>Next →</BigButton> : null}
    </section>
  );
}

function StepQuiz({ step, onAnswer, onDone }: {
  step: LooseStep;
  onAnswer: (vocabId: string | undefined, correct: boolean) => void;
  onDone: (score: number, total: number) => void;
}) {
  const questions = step.questions ?? [];
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const current = questions[index];

  const resolve = (correct: boolean) => {
    onAnswer(current?.tests, correct);
    const nextScore = score + (correct ? 1 : 0);
    setScore(nextScore);
    setTimeout(() => {
      if (index + 1 >= questions.length) onDone(nextScore, questions.length);
      else setIndex((i) => i + 1);
    }, 1100);
  };

  if (!current) return null;

  return (
    <section className="pt-2">
      <div className="text-center">
        <p className="text-micro font-semibold uppercase tracking-wide text-accent-ink">
          🎯 Quick quiz
        </p>
        <p className="mt-1 text-small text-ink-subtle">
          Question {index + 1} of {questions.length}
        </p>
      </div>
      <div className="mt-6">
        <Choice
          key={current.id}
          ask={current.ask}
          askBn={current.askBn}
          image={current.image}
          speak={current.speak}
          options={current.options}
          answer={current.answer}
          explain={current.explain}
          onResolved={resolve}
        />
      </div>
    </section>
  );
}

function StepDone({ step, score, total, missed, onFinish }: {
  step: LooseStep; score: number; total: number; missed: number; onFinish: () => void;
}) {
  const stars = scoreToStars(score, total);
  useEffect(() => { void say(step.say ?? ''); }, [step.say]);

  return (
    <section className="flex flex-col items-center pt-6 text-center">
      <Illustration name="star" size={160} animate />
      <h2 className="mt-5 text-title text-ink">🎉 {step.title}</h2>
      {step.titleBn ? (
        <p className="mt-1 text-subheading text-ink-muted">{step.titleBn}</p>
      ) : null}
      <p className="mt-3 text-body text-ink-muted">{step.say}</p>
      {step.sayBn ? (
        <div className="mt-1 flex items-center justify-center gap-2">
          <p className="text-body text-ink-subtle">{step.sayBn}</p>
          <BanglaSpeaker text={step.sayBn} size="sm" />
        </div>
      ) : null}

      <div className="mt-6 text-4xl" aria-label={`${stars} out of 5 stars`}>
        {'⭐'.repeat(stars)}{'☆'.repeat(5 - stars)}
      </div>

      {total > 0 ? (
        <p className="mt-3 text-subheading text-ink">Quiz: {score} / {total}</p>
      ) : null}
      {missed > 0 ? (
        <p className="mt-2 text-body text-ink-muted">
          {missed} word{missed === 1 ? '' : 's'} to practise again 🧠
        </p>
      ) : null}

      <BigButton onClick={onFinish}>Finish ✓</BigButton>
    </section>
  );
}
