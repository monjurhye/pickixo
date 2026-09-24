'use client';

import { useCallback, useEffect, useState } from 'react';
import { BanglaIllustration, BuildCard } from './banglaDrawings';
import { bn } from '@/lib/class2/bnNumerals';
import {
  banglaSpeechAvailable, sayBangla, stopSpeaking, warmUpVoices,
} from '@/lib/class2/speech';
import {
  completeLesson, load, recordAnswer, save, scoreToStars,
} from '@/lib/class2/banglaProgress';
import type { Lesson } from '@/data/class2/bangla/schema';

/**
 * The Bangla পাঠ player.
 *
 * Same idea as the Maths player — one component drives every step shape,
 * because the book is built from a small set of repeating screens — and a
 * separate component for the same reason that one is separate from English's:
 * every string here is Bangla, so there is no second-language speaker button
 * to render and no `banglaSource` to check per item.
 *
 * What this player has that the other two do not is **reading screens**. This
 * is a reading book, so a গল্প, a ছড়া and a কথোপকথন each get a presentation
 * that matches how the book expects them to be used: a story is panels you
 * step through, a rhyme is stanzas with the whole poem readable at once
 * (because a child recites it end to end), and a dialogue is speech bubbles
 * that alternate sides so you can see who is talking without reading a name.
 *
 * The three rules from the other two courses hold, because they are true of
 * any seven-year-old:
 *   * Nothing is ever "ভুল" — a wrong tap says "আবার চেষ্টা করো" 💪, replays
 *     the sound and gives a hint. Two misses reveal the answer.
 *   * Sound is one tap away, and free.
 *   * Reading is never required to *proceed* — every screen has a 🔊 and a
 *     picture doing work a caption would otherwise have to do alone.
 */

/**
 * The steps as this component consumes them.
 *
 * Deliberately loose, exactly as `MathLessonPlayer` does it: an imported JSON
 * file never structurally satisfies the schema's discriminated union, and the
 * content is checked for real by `validateChapter` in content.test.mjs rather
 * than by a cast that would only move the lie somewhere else.
 */
interface LooseStep {
  id: string;
  type: string;
  title: string;
  bookActivity?: string;
  say?: string;
  illustration?: string;
  paragraphs?: string[];
  lines?: { speaker: string; text: string; blanks?: boolean }[];
  verses?: string[][];
  poet?: string;
  scenes?: { id: string; text: string; illustration: string | null }[];
  letters?: string[];
  perRow?: number;
  items?: string[];
  kind?: string;
  rounds?: RoundLike[];
  questions?: QuestionLike[];
}

interface RoundLike {
  id: string; ask: string; illustration?: string; speak?: string;
  options: { label?: string; illustration?: string }[]; answer: number;
  hint?: string; tests?: string;
}
interface QuestionLike extends RoundLike { explain?: string }

interface Props {
  lesson: Lesson;
  chapterTitle: string;
  onExit: () => void;
  onFinished: (summary: { starsEarned: number; rating: number; score: number; total: number }) => void;
}

export function BanglaLessonPlayer({ lesson, chapterTitle, onExit, onFinished }: Props) {
  const [index, setIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizTotal, setQuizTotal] = useState(0);
  const [missed, setMissed] = useState<string[]>([]);

  const steps = (lesson.steps ?? []) as unknown as LooseStep[];
  const step = steps[index];

  useEffect(() => { warmUpVoices(); return () => stopSpeaking(); }, []);
  useEffect(() => { stopSpeaking(); }, [index]);

  const next = useCallback(() => {
    setIndex((i) => Math.min(steps.length - 1, i + 1));
  }, [steps.length]);

  const recordItem = useCallback((itemId: string | undefined, correct: boolean) => {
    if (!itemId) return;
    save(recordAnswer(load(), itemId, correct));
    if (!correct) setMissed((m) => (m.includes(itemId) ? m : [...m, itemId]));
  }, []);

  const finish = useCallback(() => {
    const quiz = quizTotal > 0 ? { score: quizScore, total: quizTotal } : null;
    const { progress, starsAwarded } = completeLesson(
      load(),
      { id: lesson.id, chapterId: lesson.chapterId, minutes: lesson.minutes ?? 5 },
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
      <div className="flex items-center gap-3 py-4">
        <button type="button" onClick={onExit} aria-label="তালিকায় ফিরে যাও"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full
                           bg-surface-sunken text-xl text-ink-muted hover:bg-border">
          ←
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-micro text-ink-subtle">{chapterTitle}</p>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-accent transition-[width] duration-300"
                 style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <span className="shrink-0 text-small font-semibold text-ink-muted tabular-nums">
          {bn(index + 1)}/{bn(steps.length)}
        </span>
      </div>

      <div key={step.id} className="flex-1">
        {step.type === 'intro' && <StepIntro step={step} onNext={next} />}
        {step.type === 'read' && <StepRead step={step} onNext={next} />}
        {step.type === 'dialogue' && <StepDialogue step={step} onNext={next} />}
        {step.type === 'rhyme' && <StepRhyme step={step} onNext={next} />}
        {step.type === 'story' && <StepStory step={step} onNext={next} />}
        {step.type === 'letters' && <StepLetters step={step} onNext={next} />}
        {step.type === 'build' && <StepBuild step={step} lesson={lesson} onNext={next} />}
        {step.type === 'words' && <StepWords step={step} lesson={lesson} onNext={next} />}
        {step.type === 'game' && <StepGame step={step} onNext={next} onAnswer={recordItem} />}
        {step.type === 'quiz' && (
          <StepQuiz step={step} onAnswer={recordItem}
                    onDone={(score, total) => { setQuizScore(score); setQuizTotal(total); next(); }} />
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

function Speaker({ text, size = 'md' }: { text: string; size?: 'sm' | 'md' }) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAvailable(banglaSpeechAvailable());
    const timer = setTimeout(() => setAvailable(banglaSpeechAvailable()), 700);
    return () => clearTimeout(timer);
  }, []);

  if (!available || !text) return null;
  const dimension = size === 'sm' ? 'h-10 w-10 text-lg' : 'h-14 w-14 text-2xl';
  return (
    <button
      type="button"
      aria-label={`শোনো: ${text}`}
      disabled={busy}
      onClick={async () => { setBusy(true); await sayBangla(text); setBusy(false); }}
      className={`${dimension} flex shrink-0 items-center justify-center rounded-full
                  bg-accent-soft text-accent-ink transition-transform
                  active:scale-95 disabled:opacity-60`}
    >
      🔊
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
    <button type="button" onClick={onClick}
            className={`${styles} mt-8 w-full rounded-card px-6 py-5 text-subheading
                        font-semibold transition-transform active:scale-[0.98]`}>
      {children}
    </button>
  );
}

function Header({ step }: { step: LooseStep }) {
  return (
    <div className="text-center">
      {step.bookActivity ? (
        <p className="text-micro font-semibold uppercase tracking-wide text-accent-ink">
          {step.bookActivity}
        </p>
      ) : null}
      <h2 className="mt-1 text-heading text-ink">{step.title}</h2>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Reading steps                                                              */
/* -------------------------------------------------------------------------- */

function StepIntro({ step, onNext }: { step: LooseStep; onNext: () => void }) {
  useEffect(() => { void sayBangla(step.say ?? ''); }, [step.say]);
  return (
    <section className="flex flex-col items-center pt-4 text-center">
      <div className="h-40 w-40">
        <BanglaIllustration name={step.illustration ?? 'book'} size={160} />
      </div>
      <h2 className="mt-6 text-title text-ink">{step.title}</h2>
      <div className="mt-4 flex items-center gap-3">
        <p className="text-body text-ink-muted">{step.say}</p>
        <Speaker text={step.say ?? ''} size="sm" />
      </div>
      <BigButton onClick={onNext}>শুরু করি 🚀</BigButton>
    </section>
  );
}

/**
 * Prose, one paragraph per card with its own 🔊.
 *
 * Per paragraph rather than per page because a child who loses the thread
 * needs to hear that paragraph again, and a single button for a whole page
 * makes them sit through the part they already understood.
 */
function StepRead({ step, onNext }: { step: LooseStep; onNext: () => void }) {
  const paragraphs = step.paragraphs ?? [];
  return (
    <section className="pt-2">
      <Header step={step} />
      {step.illustration ? (
        <div className="mx-auto mt-5 h-36 w-36">
          <BanglaIllustration name={step.illustration} size={144} />
        </div>
      ) : null}
      <div className="mt-6 space-y-3">
        {paragraphs.map((text, i) => (
          <div key={i} className="flex items-start gap-3 rounded-card border-2
                                  border-border bg-surface p-4">
            <p className="flex-1 text-body leading-relaxed text-ink">{text}</p>
            <Speaker text={text} size="sm" />
          </div>
        ))}
      </div>
      <BigButton onClick={onNext}>পড়া হয়েছে →</BigButton>
    </section>
  );
}

/**
 * A conversation as alternating bubbles.
 *
 * Sides alternate by speaker so a child can follow who is talking without
 * reading the names — the same reason the book draws its dialogues as two
 * people facing each other.
 */
function StepDialogue({ step, onNext }: { step: LooseStep; onNext: () => void }) {
  const lines = step.lines ?? [];
  const speakers = Array.from(new Set(lines.map((l) => l.speaker)));
  return (
    <section className="pt-2">
      <Header step={step} />
      <div className="mt-6 space-y-3">
        {lines.map((line, i) => {
          const right = speakers.indexOf(line.speaker) % 2 === 1;
          return (
            <div key={i} className={`flex items-end gap-2 ${right ? 'flex-row-reverse' : ''}`}>
              <div className={`max-w-[78%] rounded-card px-4 py-3
                               ${right ? 'bg-surface-sunken' : 'bg-accent-soft'}`}>
                <p className="text-micro font-semibold text-ink-subtle">{line.speaker}</p>
                <p className="mt-0.5 text-body text-ink">{line.text}</p>
                {line.blanks ? (
                  <p className="mt-1 text-small text-ink-subtle">✏️ তুমি নিজের কথা বলো</p>
                ) : null}
              </div>
              <Speaker text={line.text} size="sm" />
            </div>
          );
        })}
      </div>
      <BigButton onClick={onNext}>বুঝেছি →</BigButton>
    </section>
  );
}

/**
 * A poem, whole, with a 🔊 per line and one for the stanza.
 *
 * The whole poem is on screen at once rather than paged, because আবৃত্তি —
 * reciting it end to end — is what the book actually asks for, and you cannot
 * recite something you can only see four lines of.
 */
function StepRhyme({ step, onNext }: { step: LooseStep; onNext: () => void }) {
  const verses = step.verses ?? [];
  return (
    <section className="pt-2">
      <Header step={step} />
      {step.poet ? (
        <p className="mt-1 text-center text-small text-ink-muted">— {step.poet}</p>
      ) : null}
      <div className="mt-6 space-y-5">
        {verses.map((verse, vi) => (
          <div key={vi} className="rounded-card border-2 border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1.5">
                {verse.map((line, li) => (
                  <div key={li} className="flex items-center gap-2">
                    <p className="flex-1 text-body leading-relaxed text-ink">{line}</p>
                    <Speaker text={line} size="sm" />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 flex justify-center">
              <Speaker text={verse.join('। ')} />
            </div>
          </div>
        ))}
      </div>
      <BigButton onClick={onNext}>আবৃত্তি করেছি →</BigButton>
    </section>
  );
}

/** A story, one panel at a time — the book's own comic layout. */
function StepStory({ step, onNext }: { step: LooseStep; onNext: () => void }) {
  const scenes = step.scenes ?? [];
  const [at, setAt] = useState(0);
  const scene = scenes[at];
  const last = at >= scenes.length - 1;

  useEffect(() => { if (scene) void sayBangla(scene.text); }, [scene]);

  if (!scene) {
    return <section className="pt-2"><Header step={step} /><BigButton onClick={onNext}>পরবর্তী →</BigButton></section>;
  }

  return (
    <section className="pt-2">
      <Header step={step} />
      <p className="mt-1 text-center text-small text-ink-subtle">
        {bn(at + 1)} / {bn(scenes.length)}
      </p>
      <div className="mt-5 flex flex-col items-center">
        <div className="h-44 w-44">
          <BanglaIllustration name={scene.illustration ?? 'book'} size={176} label={scene.text} />
        </div>
        <div className="mt-5 flex w-full items-start gap-3 rounded-card border-2
                        border-border bg-surface p-4">
          <p className="flex-1 text-body leading-relaxed text-ink">{scene.text}</p>
          <Speaker text={scene.text} size="sm" />
        </div>
      </div>
      <BigButton onClick={() => (last ? onNext() : setAt((i) => i + 1))}>
        {last ? 'গল্প শেষ →' : 'তারপর? →'}
      </BigButton>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Letter steps                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The alphabet as the book's own grid.
 *
 * `perRow` comes from the content so the table is the shape the book prints —
 * four across for স্বরবর্ণ, five for ব্যঞ্জনবর্ণ — which matters to a child
 * following along with the book open beside them.
 */
function StepLetters({ step, onNext }: { step: LooseStep; onNext: () => void }) {
  const letters = step.letters ?? [];
  const perRow = step.perRow ?? 5;
  const [heard, setHeard] = useState<string[]>([]);

  return (
    <section className="pt-2">
      <Header step={step} />
      <p className="mt-2 text-center text-small text-ink-muted">
        প্রতিটি বর্ণে চাপ দিয়ে শোনো
      </p>
      <div className="mt-5 grid gap-2"
           style={{ gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))` }}>
        {letters.map((ch) => (
          <button
            key={ch}
            type="button"
            aria-label={`শোনো: ${ch}`}
            onClick={() => {
              void sayBangla(ch);
              setHeard((h) => (h.includes(ch) ? h : [...h, ch]));
            }}
            className={`flex aspect-square items-center justify-center rounded-card
                        border-2 text-2xl font-semibold transition-transform
                        active:scale-95
                        ${heard.includes(ch)
                          ? 'border-success/50 bg-success/10 text-ink'
                          : 'border-border bg-surface text-ink'}`}
          >
            {ch}
          </button>
        ))}
      </div>
      <p className="mt-4 text-center text-small text-ink-subtle">
        {bn(heard.length)} / {bn(letters.length)} শোনা হয়েছে
      </p>
      <BigButton onClick={onNext} tone={heard.length >= letters.length ? 'primary' : 'quiet'}>
        {heard.length >= letters.length ? 'পরবর্তী →' : 'পরবর্তী (এখনই) →'}
      </BigButton>
    </section>
  );
}

/**
 * Letter arithmetic — ক + া = কা.
 *
 * The card is drawn from the same `parts` the validator composed to prove the
 * result, so what the child sees and what the test checked are the same data.
 */
function StepBuild({ step, lesson, onNext }: {
  step: LooseStep; lesson: Lesson; onNext: () => void;
}) {
  const builds = (step.items ?? [])
    .map((id) => lesson.builds.find((b) => b.id === id))
    .filter((b): b is NonNullable<typeof b> => Boolean(b));

  return (
    <section className="pt-2">
      <Header step={step} />
      <div className="mt-6 space-y-3">
        {builds.map((build) => (
          <div key={build.id} className="rounded-card border-2 border-border bg-surface p-3">
            <div className="flex items-center gap-3">
              {/* Rendered directly rather than through BanglaIllustration: a
                  build card is wide, not square, so the square frame that
                  suits every other picture would squash it. */}
              <div className="h-12 min-w-0 flex-1" role="img"
                   aria-label={`${build.parts.join(' যোগ ')} মিলে হয় ${build.result}`}>
                <BuildCard parts={build.parts} result={build.result} />
              </div>
              <Speaker text={build.result} size="sm" />
            </div>
            {build.example ? (
              <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
                <p className="flex-1 text-body text-ink-muted">
                  যেমন — <span className="font-semibold text-ink">{build.example}</span>
                </p>
                <Speaker text={build.example} size="sm" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <BigButton onClick={onNext}>বুঝেছি →</BigButton>
    </section>
  );
}

/** শব্দ শিখি — a word, what it means, and a 🔊. */
function StepWords({ step, lesson, onNext }: {
  step: LooseStep; lesson: Lesson; onNext: () => void;
}) {
  const words = (step.items ?? [])
    .map((id) => lesson.words.find((w) => w.id === id))
    .filter((w): w is NonNullable<typeof w> => Boolean(w));
  const [seen, setSeen] = useState<string[]>([]);

  return (
    <section className="pt-2">
      <Header step={step} />
      <div className="mt-6 space-y-3">
        {words.map((word) => (
          <div key={word.id} className="flex items-center gap-3 rounded-card border-2
                                        border-border bg-surface p-3">
            {word.illustration ? (
              <div className="h-14 w-14 shrink-0">
                <BanglaIllustration name={word.illustration} size={56} />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-subheading text-ink">{word.word}</p>
              {word.meaning ? (
                <p className="text-small text-ink-muted">
                  {word.meaning}
                  {/* The book glosses its own hard words; anything else is ours,
                      and says so rather than passing itself off as the book. */}
                  {word.meaningSource === 'enrichment' ? (
                    <span className="ml-1 text-micro text-ink-subtle">(পিকিক্সোর যোগ)</span>
                  ) : null}
                </p>
              ) : null}
            </div>
            <span onClick={() => setSeen((s) => (s.includes(word.id) ? s : [...s, word.id]))}>
              <Speaker text={word.meaning ? `${word.word}। ${word.meaning}` : word.word} size="sm" />
            </span>
          </div>
        ))}
      </div>
      <BigButton onClick={onNext} tone={seen.length >= words.length ? 'primary' : 'quiet'}>
        {seen.length >= words.length ? 'পরবর্তী →' : '🔊 চেপে শোনো'}
      </BigButton>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Games and quiz                                                             */
/* -------------------------------------------------------------------------- */

interface ChoiceProps {
  ask: string;
  illustration?: string;
  speak?: string;
  options: { label?: string; illustration?: string }[];
  answer: number;
  hint?: string;
  explain?: string;
  onResolved: (correct: boolean) => void;
}

function Choice({ ask, illustration, speak, options, answer, hint, explain, onResolved }: ChoiceProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => { if (speak) void sayBangla(speak); }, [speak]);

  const choose = (i: number) => {
    if (revealed) return;
    setPicked(i);
    if (i === answer) {
      setRevealed(true);
      onResolved(attempts === 0);
      return;
    }
    const used = attempts + 1;
    setAttempts(used);
    // Replay the prompt on a miss: often the child simply did not hear it.
    if (speak) void sayBangla(speak);
    if (used >= 2) {
      setRevealed(true);
      onResolved(false);
    }
  };

  return (
    <div>
      {illustration ? (
        <div className="mx-auto h-36 w-36">
          <BanglaIllustration name={illustration} size={144} label={ask} />
        </div>
      ) : null}
      <div className="mt-4 flex items-center justify-center gap-3">
        <p className="text-heading text-ink text-center">{ask}</p>
        {speak ? <Speaker text={speak} /> : null}
      </div>

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
              {option.illustration ? (
                <div className="h-14 w-14 shrink-0">
                  <BanglaIllustration name={option.illustration} size={56} label={option.label} />
                </div>
              ) : null}
              <span className="flex-1">{option.label}</span>
              {showRight ? <span aria-hidden="true">✓</span> : null}
              {showWrong ? <span aria-hidden="true">↻</span> : null}
            </button>
          );
        })}
      </div>

      {attempts > 0 && !revealed ? (
        <p role="status" className="mt-4 rounded-control bg-warning/10 px-4 py-3
                                    text-center text-body text-ink">
          আবার চেষ্টা করো! 💪 {hint ?? ''}
        </p>
      ) : null}
      {revealed && explain ? (
        <p className="mt-4 rounded-control bg-accent-soft px-4 py-3 text-center
                      text-body text-accent-ink">{explain}</p>
      ) : null}
    </div>
  );
}

function StepGame({ step, onNext, onAnswer }: {
  step: LooseStep; onNext: () => void;
  onAnswer: (id: string | undefined, correct: boolean) => void;
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
      <section className="pt-2"><Header step={step} /><BigButton onClick={onNext}>পরবর্তী →</BigButton></section>
    );
  }

  return (
    <section className="pt-2">
      <div className="text-center">
        <p className="text-micro font-semibold uppercase tracking-wide text-accent-ink">🎮 খেলা</p>
        <h2 className="mt-1 text-heading text-ink">{step.title}</h2>
        <p className="mt-1 text-small text-ink-subtle">
          {bn(Math.min(round + 1, rounds.length))} / {bn(rounds.length)}
        </p>
      </div>
      <div className="mt-6">
        {done || !current ? (
          <div className="text-center">
            <div className="mx-auto h-32 w-32"><BanglaIllustration name="star" size={128} /></div>
            <p className="mt-4 text-heading text-ink">দারুণ খেলেছ! 🎉</p>
          </div>
        ) : (
          <Choice key={current.id} ask={current.ask} illustration={current.illustration}
                  speak={current.speak} options={current.options} answer={current.answer}
                  hint={current.hint} onResolved={advance} />
        )}
      </div>
      {done || !current ? <BigButton onClick={onNext}>পরবর্তী →</BigButton> : null}
    </section>
  );
}

function StepQuiz({ step, onAnswer, onDone }: {
  step: LooseStep; onAnswer: (id: string | undefined, correct: boolean) => void;
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
        <p className="text-micro font-semibold uppercase tracking-wide text-accent-ink">🎯 ছোট্ট কুইজ</p>
        <p className="mt-1 text-small text-ink-subtle">
          প্রশ্ন {bn(index + 1)} / {bn(questions.length)}
        </p>
      </div>
      <div className="mt-6">
        <Choice key={current.id} ask={current.ask} illustration={current.illustration}
                speak={current.speak} options={current.options} answer={current.answer}
                explain={current.explain} onResolved={resolve} />
      </div>
    </section>
  );
}

function StepDone({ step, score, total, missed, onFinish }: {
  step: LooseStep; score: number; total: number; missed: number; onFinish: () => void;
}) {
  const stars = scoreToStars(score, total);
  useEffect(() => { void sayBangla(step.say ?? ''); }, [step.say]);

  return (
    <section className="flex flex-col items-center pt-6 text-center">
      <div className="h-40 w-40"><BanglaIllustration name="star" size={160} /></div>
      <h2 className="mt-5 text-title text-ink">🎉 {step.title}</h2>
      <p className="mt-3 text-body text-ink-muted">{step.say}</p>

      <div className="mt-6 text-4xl" aria-label={`${stars} out of 5 stars`}>
        {'⭐'.repeat(stars)}{'☆'.repeat(5 - stars)}
      </div>
      {total > 0 ? (
        <p className="mt-3 text-subheading text-ink">কুইজ: {bn(score)} / {bn(total)}</p>
      ) : null}
      {missed > 0 ? (
        <p className="mt-2 text-body text-ink-muted">{bn(missed)}টি শব্দ আবার অনুশীলন করতে হবে 🧠</p>
      ) : null}
      <BigButton onClick={onFinish}>শেষ ✓</BigButton>
    </section>
  );
}
