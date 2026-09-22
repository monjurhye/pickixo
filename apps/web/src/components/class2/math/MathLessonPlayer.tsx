'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MathIllustration } from './mathDrawings';
import { bn } from '@/lib/class2/bnNumerals';
import {
  banglaSpeechAvailable, sayBangla, stopSpeaking, warmUpVoices,
} from '@/lib/class2/speech';
import {
  completeTopic, load, recordAnswer, save, scoreToStars,
} from '@/lib/class2/mathProgress';
import type { Topic } from '@/data/class2/math/schema';

/**
 * The maths topic player.
 *
 * Structurally the same idea as the English course's LessonPlayer — one
 * component drives every step shape, because the book itself is built from a
 * small set of repeating screens (a question, a worked example, a table to
 * read, practice, a quiz). It is a separate component rather than a shared
 * one because every string here is Bangla: there is no second-language
 * speaker button to render, no `banglaSource` to check, so the English
 * player's per-item English/Bangla pair would be dead weight here.
 *
 * The same three rules still apply, because they are true of any
 * seven-year-old, not just an English lesson:
 *   * Nothing is ever "ভুল" — a wrong tap says "আবার চেষ্টা করো" 💪, replays the
 *     sound, and gives a hint. Two misses reveal the answer.
 *   * Sound is one tap away, and free.
 *   * Reading is never required to proceed — every screen has a 🔊 and a
 *     picture doing the work a caption would otherwise have to.
 */

interface LooseStep {
  id: string;
  type: string;
  title: string;
  say?: string;
  illustration?: string;
  lines?: { text: string; speaker?: 'tuli' | 'rafi'; illustration?: string }[];
  rows?: { id: string; illustration?: string; text: string; tests?: string }[];
  kind?: string;
  rounds?: RoundLike[];
  questions?: QuestionLike[];
}

interface RoundLike {
  id: string; ask: string; illustration?: string; speak?: string;
  options: { label?: string; illustration?: string }[]; answer: number;
  hint?: string; tests?: string;
}
interface QuestionLike extends RoundLike { explain?: string; }

interface Props {
  topic: Topic;
  chapterTitle: string;
  onExit: () => void;
  onFinished: (summary: { starsEarned: number; rating: number; score: number; total: number }) => void;
}

export function MathLessonPlayer({ topic, chapterTitle, onExit, onFinished }: Props) {
  const [index, setIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizTotal, setQuizTotal] = useState(0);
  const [missed, setMissed] = useState<string[]>([]);

  const steps = (topic.steps ?? []) as unknown as LooseStep[];
  const step = steps[index];

  useEffect(() => { warmUpVoices(); return () => stopSpeaking(); }, []);
  useEffect(() => { stopSpeaking(); }, [index]);

  const next = useCallback(() => {
    setIndex((i) => Math.min(steps.length - 1, i + 1));
  }, [steps.length]);

  const recordNumber = useCallback((numberId: string | undefined, correct: boolean) => {
    if (!numberId) return;
    const progress = recordAnswer(load(), numberId, correct);
    save(progress);
    if (!correct) setMissed((m) => (m.includes(numberId) ? m : [...m, numberId]));
  }, []);

  const finish = useCallback(() => {
    const quiz = quizTotal > 0 ? { score: quizScore, total: quizTotal } : null;
    const { progress, starsAwarded } = completeTopic(
      load(),
      { id: topic.id, chapterId: topic.chapterId, minutes: topic.minutes ?? 5 },
      quiz,
    );
    save(progress);
    onFinished({
      starsEarned: starsAwarded,
      rating: scoreToStars(quizScore, quizTotal),
      score: quizScore,
      total: quizTotal,
    });
  }, [topic, quizScore, quizTotal, onFinished]);

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
        {step.type === 'worked' && <StepWorked step={step} onNext={next} />}
        {step.type === 'table' && <StepTable step={step} onNext={next} />}
        {step.type === 'game' && (
          <StepGame step={step} onNext={next} onAnswer={recordNumber} />
        )}
        {step.type === 'quiz' && (
          <StepQuiz step={step} onAnswer={recordNumber}
                    onDone={(score, total) => { setQuizScore(score); setQuizTotal(total); next(); }} />
        )}
        {step.type === 'done' && (
          <StepDone step={step} score={quizScore} total={quizTotal} missed={missed.length} onFinish={finish} />
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
  const styles = tone === 'primary' ? 'bg-accent text-white shadow-sm' : 'bg-surface text-ink border-2 border-border-strong';
  return (
    <button type="button" onClick={onClick}
            className={`${styles} mt-8 w-full rounded-card px-6 py-5 text-subheading
                        font-semibold transition-transform active:scale-[0.98]`}>
      {children}
    </button>
  );
}

function Title({ step }: { step: LooseStep }) {
  return <h2 className="text-heading text-ink text-center">{step.title}</h2>;
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                      */
/* -------------------------------------------------------------------------- */

function StepIntro({ step, onNext }: { step: LooseStep; onNext: () => void }) {
  useEffect(() => { void sayBangla(step.say ?? ''); }, [step.say]);
  return (
    <section className="flex flex-col items-center pt-4 text-center">
      <div className="h-40 w-40">
        <MathIllustration name={step.illustration ?? 'tuli'} size={160} />
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

function WorkedBubble({ line }: { line: NonNullable<LooseStep['lines']>[number] }) {
  const isRafi = line.speaker === 'rafi';
  return (
    <div className={`flex items-end gap-2 ${isRafi ? 'flex-row-reverse' : ''}`}>
      {line.speaker ? (
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full">
          <MathIllustration name={line.speaker} size={48} />
        </div>
      ) : line.illustration ? (
        <div className="h-16 w-16 shrink-0">
          <MathIllustration name={line.illustration} size={64} />
        </div>
      ) : null}
      <div className={`max-w-[78%] rounded-card px-4 py-3 ${isRafi ? 'bg-surface-sunken' : 'bg-accent-soft'}`}>
        <p className="text-body text-ink">{line.text}</p>
      </div>
      <Speaker text={line.text} size="sm" />
    </div>
  );
}

function StepWorked({ step, onNext }: { step: LooseStep; onNext: () => void }) {
  const lines = step.lines ?? [];
  return (
    <section className="pt-2">
      <Title step={step} />
      <div className="mt-6 space-y-3">
        {lines.map((line, i) => <WorkedBubble key={i} line={line} />)}
      </div>
      <BigButton onClick={onNext}>বুঝেছি →</BigButton>
    </section>
  );
}

function StepTable({ step, onNext }: { step: LooseStep; onNext: () => void }) {
  const rows = step.rows ?? [];
  const [seen, setSeen] = useState<string[]>([]);
  const allSeen = seen.length >= rows.length;

  return (
    <section className="pt-2">
      <Title step={step} />
      <div className="mt-6 space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-4 rounded-card border-2 border-border bg-surface p-3">
            {row.illustration ? (
              <div className="h-16 w-20 shrink-0">
                <MathIllustration name={row.illustration} size={80} />
              </div>
            ) : null}
            <p className="flex-1 text-heading text-ink">{row.text}</p>
            <span onClick={() => setSeen((s) => (s.includes(row.id) ? s : [...s, row.id]))}>
              <Speaker text={row.text} size="sm" />
            </span>
          </div>
        ))}
      </div>
      <BigButton onClick={onNext} tone={allSeen ? 'primary' : 'quiet'}>
        {allSeen ? 'পরবর্তী →' : '🔊 চেপে শোনো'}
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
    if (used >= 2) {
      setRevealed(true);
      onResolved(false);
    }
  };

  return (
    <div>
      {illustration ? (
        <div className="mx-auto h-32 w-40">
          <MathIllustration name={illustration} size={160} label={ask} />
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
                <div className="h-14 w-16 shrink-0"><MathIllustration name={option.illustration} size={56} label={option.label} /></div>
              ) : null}
              <span className="flex-1">{option.label}</span>
              {showRight ? <span aria-hidden="true">✓</span> : null}
              {showWrong ? <span aria-hidden="true">↻</span> : null}
            </button>
          );
        })}
      </div>

      {attempts > 0 && !revealed ? (
        <p role="status" className="mt-4 rounded-control bg-warning/10 px-4 py-3 text-center text-body text-ink">
          আবার চেষ্টা করো! 💪 {hint ?? ''}
        </p>
      ) : null}
      {revealed && explain ? (
        <p className="mt-4 rounded-control bg-accent-soft px-4 py-3 text-center text-body text-accent-ink">{explain}</p>
      ) : null}
    </div>
  );
}

function StepGame({ step, onNext, onAnswer }: {
  step: LooseStep; onNext: () => void; onAnswer: (id: string | undefined, correct: boolean) => void;
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
      <section className="pt-2"><Title step={step} /><BigButton onClick={onNext}>পরবর্তী →</BigButton></section>
    );
  }

  return (
    <section className="pt-2">
      <div className="text-center">
        <p className="text-micro font-semibold uppercase tracking-wide text-accent-ink">🎮 খেলা</p>
        <Title step={step} />
        <p className="mt-1 text-small text-ink-subtle">{bn(Math.min(round + 1, rounds.length))} / {bn(rounds.length)}</p>
      </div>
      <div className="mt-6">
        {done || !current ? (
          <div className="text-center">
            <div className="mx-auto h-32 w-32"><MathIllustration name="number-5" size={128} /></div>
            <p className="mt-4 text-heading text-ink">দারুণ খেলেছ! 🎉</p>
          </div>
        ) : (
          <Choice key={current.id} ask={current.ask} illustration={current.illustration} speak={current.speak}
                  options={current.options} answer={current.answer} hint={current.hint} onResolved={advance} />
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
        <p className="mt-1 text-small text-ink-subtle">প্রশ্ন {bn(index + 1)} / {bn(questions.length)}</p>
      </div>
      <div className="mt-6">
        <Choice key={current.id} ask={current.ask} illustration={current.illustration} speak={current.speak}
                options={current.options} answer={current.answer} explain={current.explain} onResolved={resolve} />
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
      <div className="h-40 w-40"><MathIllustration name="number-1" size={160} /></div>
      <h2 className="mt-5 text-title text-ink">🎉 {step.title}</h2>
      <p className="mt-3 text-body text-ink-muted">{step.say}</p>

      <div className="mt-6 text-4xl" aria-label={`${stars} out of 5 stars`}>
        {'⭐'.repeat(stars)}{'☆'.repeat(5 - stars)}
      </div>
      {total > 0 ? <p className="mt-3 text-subheading text-ink">কুইজ: {bn(score)} / {bn(total)}</p> : null}
      {missed > 0 ? (
        <p className="mt-2 text-body text-ink-muted">{bn(missed)}টি সংখ্যা আবার অনুশীলন করতে হবে 🧠</p>
      ) : null}
      <BigButton onClick={onFinish}>শেষ ✓</BigButton>
    </section>
  );
}
