'use client';

/**
 * One lesson, one screen at a time.
 *
 * The loop is deliberately small: pick the weakest item, pick an activity for
 * the level that item is on, build a round, show it, record the answer, let
 * the engine move the level, repeat. Everything interesting lives in
 * `lib/kids` and is tested there; this file is the part a child touches.
 *
 * Things that look like details and are not:
 *
 * **Nothing here can produce a failure state.** A wrong tap wobbles, says
 * `আবার চেষ্টা করি ❤️`, and leaves the same question up with the wrong option
 * dimmed. There is no score, no timer, no lives, no way to lose.
 *
 * **Every instruction is spoken.** A four-year-old cannot read `ক কোনটি?`, so
 * the question is spoken on arrival and the speaker button replays it. The app
 * never waits for audio, because on a device with no Bangla voice it would
 * wait forever.
 *
 * **The level is never mentioned.** The child sees চলো দেখি / চলো শিখি and
 * never learns that the app moved them down after two misses. That is the
 * whole point of §4.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LEVEL_LABEL_BN, activitiesFor, isSupplementary, sourceLine,
  type ActivityKind, type Lesson, type Level,
} from '@/lib/kids/content';
import { feedback, lessonLevel, nextActivity, nextItems } from '@/lib/kids/adaptive';
import { buildRound, firstPlayable, toBangla, type Round } from '@/lib/kids/rounds';
import * as store from '@/lib/kids/progress';
import type { Progress } from '@/lib/kids/progress';
import { playItem, say, unlock } from '@/lib/kids/speech';
import { Art, CountingDots } from './art';
import { TraceCanvas } from './TraceCanvas';
import {
  MatchGame, MemoryGame, SortGame, SpotDifferenceGame, type GameProps,
} from './games';

/** Rounds in one sitting. Short by design (§16). */
const ROUNDS = 8;

type Phase = 'playing' | 'done';

export interface LessonPlayerProps {
  lesson: Lesson;
  onExit: () => void;
}

export function LessonPlayer({ lesson, onExit }: LessonPlayerProps) {
  const [progress, setProgress] = useState<Progress>(store.EMPTY);
  const [round, setRound] = useState<Round | null>(null);
  const [level, setLevel] = useState<Level>('explore');
  const [phase, setPhase] = useState<Phase>('playing');
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState('');
  const [wrongIndex, setWrongIndex] = useState<number | null>(null);
  const [built, setBuilt] = useState<string[]>([]);
  const [stars, setStars] = useState(0);

  const askedAt = useRef(Date.now());
  const helped = useRef(false);
  const lastActivity = useRef<ActivityKind | null>(null);
  /**
   * The latest progress, readable synchronously.
   *
   * The multi-step games (memory, matching, sorting) record several answers
   * between renders, and each has to fold into the result of the last. Reading
   * `progress` from the closure would make every one of them start from the
   * same stale record and quietly lose all but the final answer.
   */
  const progressRef = useRef<Progress>(store.EMPTY);

  const commit = useCallback((next: Progress) => {
    progressRef.current = next;
    setProgress(next);
    store.save(next);
  }, []);

  /* ---- start ---- */
  useEffect(() => {
    const loaded = store.load();
    progressRef.current = loaded;
    setProgress(loaded);
    const startLevel = lessonLevel(lesson, loaded.items);
    setLevel(startLevel);
    setRound(pickRound(lesson, startLevel, loaded, null));
  }, [lesson]);

  /* ---- speak the question whenever a new one arrives ---- */
  useEffect(() => {
    if (!round) return;
    askedAt.current = Date.now();
    helped.current = false;
    setWrongIndex(null);
    setBuilt([]);
    setMessage('');
    // A short beat so the screen paints before the voice starts; without it
    // the child hears the question about a picture they cannot see yet.
    const timer = window.setTimeout(() => {
      say(round.speak ?? round.ask, { rate: round.speak ? 0.75 : 0.9 });
    }, 320);
    return () => window.clearTimeout(timer);
  }, [round]);

  const replay = useCallback(() => {
    if (!round) return;
    unlock();
    helped.current = true;
    say(round.speak ?? round.ask, { rate: 0.7 });
  }, [round]);

  const finish = useCallback((current: Progress) => {
    const { progress: saved } = store.completeLesson(
      current, lesson.id, lesson.minutes, new Date().toISOString(),
    );
    progressRef.current = saved;
    store.save(saved);
    setProgress(saved);
    setPhase('done');
    say('দারুণ! তুমি পেরেছো।', { rate: 0.9 });
  }, [lesson]);

  /** Move on to the next round, or end the lesson. */
  const advance = useCallback((current: Progress) => {
    const next = count + 1;
    if (next >= ROUNDS) { finish(current); return; }
    const nextLevel = lessonLevel(lesson, current.items);
    setLevel(nextLevel);
    setCount(next);
    setRound(pickRound(lesson, nextLevel, current, lastActivity.current));
  }, [count, lesson, finish]);

  /** Fold one answer into the record. Used by both paths. */
  const score = useCallback((
    itemId: string, correct: boolean, confusedWith?: string,
  ): Progress => {
    const recorded = store.record(progressRef.current, itemId, {
      correct,
      level,
      ms: Date.now() - askedAt.current,
      helped: helped.current,
      activity: round?.activity ?? 'listen-look',
      confusedWith,
      at: new Date().toISOString(),
    });
    commit(recorded.progress);
    return recorded.progress;
  }, [level, round, commit]);

  /* ---- answering, single-tap games ---- */
  const answer = useCallback((index: number) => {
    if (!round || phase !== 'playing') return;
    unlock();

    const correct = index === round.answer;

    if (!correct) {
      setWrongIndex(index);
      setMessage(feedback(false, helped.current));
      // Record the miss, including *what* they picked — that is what drives
      // the ক-vs-খ revision set later.
      score(round.itemId, false, round.options[index]?.itemId);
      // The same question stays up. The child tries again; nothing is lost.
      helped.current = true;
      return;
    }

    const saved = score(round.itemId, true);
    setMessage(feedback(true, helped.current));
    setStars((s) => s + (helped.current ? 0 : 1));
    window.setTimeout(() => advance(saved), 850);
  }, [round, phase, score, advance]);

  /* ---- answering, the multi-step games ---- */

  /**
   * One pairing or placement inside memory, matching, sorting or
   * spot-the-difference.
   *
   * Each step is a real answer about a real item, so it goes into the record
   * exactly like a tap does — which is what lets a memory game move a letter's
   * mastery, and what makes "three activity kinds" in the mastery rule mean
   * something. It does not advance the round; the game says when it is done.
   */
  const step = useCallback((itemId: string, correct: boolean) => {
    if (phase !== 'playing') return;
    score(itemId, correct);
    setMessage(feedback(correct, helped.current));
    if (!correct) helped.current = true;
  }, [phase, score]);

  const stepDone = useCallback(() => {
    if (phase !== 'playing') return;
    setMessage('দারুণ! ⭐');
    setStars((s) => s + (helped.current ? 0 : 1));
    window.setTimeout(() => advance(progressRef.current), 650);
  }, [phase, advance]);

  function pickRound(
    current: Lesson, at: Level, p: Progress, justDid: ActivityKind | null,
  ): Round | null {
    const [itemId] = nextItems(current, p.items, 1);
    if (!itemId) return null;

    // Try the preferred activity first, then anything else at this level.
    const preferred = nextActivity(current, at, justDid);
    const all = activitiesFor(current, at);
    const ordered = preferred ? [preferred, ...all.filter((a) => a !== preferred)] : all;

    const next = firstPlayable(current, ordered, itemId);
    if (next) { lastActivity.current = next.activity; return next; }

    // Nothing at this level works for this item — try an easier level rather
    // than showing an empty screen.
    for (const fallback of ['practice', 'learn', 'explore'] as Level[]) {
      const alt = firstPlayable(current, activitiesFor(current, fallback), itemId);
      if (alt) { lastActivity.current = alt.activity; return alt; }
    }
    return buildRound(current, 'listen-look', itemId);
  }

  /* ------------------------------------------------------------------ */

  if (phase === 'done') {
    return <Celebration lesson={lesson} stars={stars} onExit={onExit} />;
  }

  if (!round) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <p className="font-bengali text-2xl">এক মুহূর্ত…</p>
      </div>
    );
  }

  return (
    <div className="kids-shell flex min-h-[100dvh] flex-col px-4 pb-8 pt-3">
      <TopBar
        level={level}
        done={count}
        total={ROUNDS}
        onExit={onExit}
        supplementary={isSupplementary(round.activity)}
      />

      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-center font-bengali text-3xl font-bold text-[#2b3440]">
            {round.ask}
          </h1>
          <button
            type="button"
            onClick={replay}
            aria-label="আবার শুনি"
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-3xl shadow"
          >
            🔊
          </button>
        </div>

        <Subject round={round} built={built} />

        <Answers
          round={round}
          built={built}
          setBuilt={setBuilt}
          wrongIndex={wrongIndex}
          onAnswer={answer}
          onTraced={() => answer(round.answer)}
          onStep={step}
          onStepDone={stepDone}
        />

        <p
          aria-live="polite"
          className="h-10 font-bengali text-2xl font-bold text-[#2b3440]"
        >
          {message}
        </p>
      </div>

      <p className="text-center font-bengali text-xs text-[#8795a5]">
        {sourceLine(lesson)}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function TopBar({
  level, done, total, onExit, supplementary,
}: {
  level: Level; done: number; total: number; onExit: () => void; supplementary: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onExit}
        aria-label="বাড়ি"
        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-3xl shadow"
      >
        🏠
      </button>

      {/* Progress as dots, not a number: a four-year-old reads five filled
          circles far faster than "5/8", and there is nothing to feel behind on. */}
      <div className="flex flex-1 items-center gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-3 flex-1 rounded-full ${i < done ? 'bg-[#2eb8a6]' : 'bg-white/70'}`}
          />
        ))}
      </div>

      <span className="font-bengali text-sm font-semibold text-[#5a6675]">
        {LEVEL_LABEL_BN[level]}
        {supplementary && (
          // Honest labelling: this activity is Pickixo's, not the textbook's.
          <span className="ml-1 rounded bg-white/80 px-1.5 py-0.5 text-[10px]">
            সম্পূরক
          </span>
        )}
      </span>
    </div>
  );
}

/** The thing the question is about: a picture, a big letter, dots to count. */
function Subject({ round, built }: { round: Round; built: string[] }) {
  // These games *are* the subject — they fill the screen themselves, and a
  // picture above them would be a second thing competing for the same look.
  if (round.trace || round.pairs || round.match || round.sort || round.panels) {
    return null;
  }

  return (
    <div className="grid min-h-[150px] place-items-center gap-3">
      {round.image && <Art name={round.image} size={150} animate />}

      {typeof round.count === 'number' && round.activity !== 'fill-dots'
        && !round.display && <CountingDots count={round.count} />}

      {round.display && (
        <span className="font-bengali text-7xl font-bold leading-none text-[#2b3440]">
          {round.display}
        </span>
      )}

      {round.parts && (
        <div className="flex gap-2" aria-label="তৈরি হচ্ছে">
          {round.options.map((_, i) => (
            <span
              key={i}
              className="grid h-20 w-20 place-items-center rounded-2xl border-4 border-dashed border-[#c9d2dc] bg-white/60 font-bengali text-4xl font-bold"
            >
              {built[i] ?? ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** The options, or the special interaction some activities need instead. */
function Answers({
  round, built, setBuilt, wrongIndex, onAnswer, onTraced, onStep, onStepDone,
}: {
  round: Round;
  built: string[];
  setBuilt: (next: string[]) => void;
  wrongIndex: number | null;
  onAnswer: (index: number) => void;
  onTraced: () => void;
  onStep: GameProps['onStep'];
  onStepDone: GameProps['onDone'];
}) {
  // The four games that run for several taps each keep their own state and
  // report back; everything below them is still one tap.
  const game = { round, onStep, onDone: onStepDone };
  if (round.pairs) return <MemoryGame key={round.id} {...game} />;
  if (round.match) return <MatchGame key={round.id} {...game} />;
  if (round.sort) return <SortGame key={round.id} {...game} />;
  if (round.panels) return <SpotDifferenceGame key={round.id} {...game} />;

  if (round.trace) {
    return <TraceCanvas glyph={round.trace} resetKey={round.id} onComplete={onTraced} />;
  }

  if (round.parts) {
    return (
      <BuildWord
        parts={round.parts}
        target={round.options.map((o) => o.label ?? '')}
        built={built}
        setBuilt={setBuilt}
        onComplete={() => onAnswer(round.answer)}
      />
    );
  }

  if (round.activity === 'fill-dots' && typeof round.count === 'number') {
    return <FillDots count={round.count} onComplete={() => onAnswer(round.answer)} />;
  }

  return (
    <div
      className={`grid w-full gap-3 ${
        round.options.length === 1 ? 'grid-cols-1'
          : round.options.length > 2 ? 'grid-cols-3' : 'grid-cols-2'
      }`}
    >
      {round.options.map((option, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onAnswer(index)}
          // 64px minimum touch target, well above the platform 44px, because
          // these are four-year-old fingers.
          className={`grid min-h-[104px] place-items-center rounded-3xl bg-white p-3 shadow transition
            ${wrongIndex === index ? 'kids-wobble opacity-40' : 'active:scale-95'}`}
        >
          {option.image
            ? <Art name={option.image} size={96} />
            : (
              <span className="font-bengali text-5xl font-bold text-[#2b3440]">
                {option.label}
              </span>
            )}
        </button>
      ))}
    </div>
  );
}

/**
 * শব্দ গঠন — tap the letters in order to build the word (book 76).
 *
 * Tapping rather than dragging: drag-and-drop on a phone is hard for small
 * hands and breaks completely with a screen reader, while tapping is the same
 * gesture the rest of the app already uses.
 */
function BuildWord({
  parts, target, built, setBuilt, onComplete,
}: {
  parts: string[];
  target: string[];
  built: string[];
  setBuilt: (next: string[]) => void;
  onComplete: () => void;
}) {
  const used = useMemo(() => {
    const counts = new Map<string, number>();
    for (const letter of built) counts.set(letter, (counts.get(letter) ?? 0) + 1);
    return counts;
  }, [built]);

  const tap = (letter: string) => {
    const next = [...built, letter];
    setBuilt(next);
    if (next.length < target.length) return;
    if (next.join('') === target.join('')) {
      window.setTimeout(onComplete, 300);
    } else {
      // Wrong order. Clear and let them try again — no penalty, no message
      // beyond the letters going back.
      window.setTimeout(() => setBuilt([]), 550);
    }
  };

  const remaining = (letter: string) =>
    parts.filter((p) => p === letter).length - (used.get(letter) ?? 0);

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {parts.map((letter, index) => (
        <button
          key={`${letter}-${index}`}
          type="button"
          disabled={remaining(letter) <= 0}
          onClick={() => tap(letter)}
          className="grid h-20 w-20 place-items-center rounded-2xl bg-white font-bengali text-4xl font-bold text-[#2b3440] shadow transition active:scale-95 disabled:opacity-25"
        >
          {letter}
        </button>
      ))}
    </div>
  );
}

/** বাম পাশের সংখ্যা অনুযায়ী গোল ভরাট করি — book 128. */
function FillDots({ count, onComplete }: { count: number; onComplete: () => void }) {
  const [filled, setFilled] = useState<boolean[]>(() => Array(10).fill(false));
  const total = filled.filter(Boolean).length;

  const toggle = (index: number) => {
    const next = [...filled];
    next[index] = !next[index];
    setFilled(next);
    if (next.filter(Boolean).length === count) window.setTimeout(onComplete, 400);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-2">
        {filled.map((on, index) => (
          <button
            key={index}
            type="button"
            onClick={() => toggle(index)}
            aria-label={`${index + 1}`}
            aria-pressed={on}
            className={`h-16 w-16 rounded-full border-4 transition active:scale-90
              ${on ? 'border-[#2b3440] bg-[#ef5b5b]' : 'border-[#c9d2dc] bg-white'}`}
          />
        ))}
      </div>
      <p className="font-bengali text-xl text-[#5a6675]">{toBangla(total)}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Celebration({
  lesson, stars, onExit,
}: { lesson: Lesson; stars: number; onExit: () => void }) {
  return (
    <div className="mx-auto grid min-h-[100dvh] max-w-md place-items-center px-6 text-center">
      <div className="flex flex-col items-center gap-6">
        <div className="kids-pop text-8xl">🎉</div>
        <h1 className="font-bengali text-4xl font-bold text-[#2b3440]">
          দারুণ! তুমি পেরেছো ⭐
        </h1>
        <div className="flex gap-1 text-4xl" aria-label={`${stars} তারা`}>
          {Array.from({ length: Math.max(1, Math.min(5, stars)) }, (_, i) => (
            <span key={i}>⭐</span>
          ))}
        </div>

        {/* §16 — the session is allowed to end here. Nothing pushes for more. */}
        <p className="font-bengali text-xl text-[#5a6675]">আজ এতটুকুই যথেষ্ট ❤️</p>

        <button
          type="button"
          onClick={onExit}
          className="min-h-[68px] rounded-3xl bg-[#2eb8a6] px-10 font-bengali text-2xl font-bold text-white shadow-lg active:scale-95"
        >
          বাড়ি যাই 🏠
        </button>

        <p className="font-bengali text-xs text-[#8795a5]">{sourceLine(lesson)}</p>
      </div>
    </div>
  );
}
