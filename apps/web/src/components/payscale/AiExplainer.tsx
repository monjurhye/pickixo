'use client';

import { useMemo, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import {
  AI_SYSTEM_PROMPT, allowedFigures, factBlock, findInventedFigures,
} from '@/lib/payscale/aiExplain';
import { Card, buttonClass, inputClass, secondaryButtonClass } from './Ui';
import type { FixationResult } from '@/lib/payscale/types';

/**
 * "এই ফলাফল সম্পর্কে প্রশ্ন করুন" — an AI layer over a finished calculation.
 *
 * The AI never calculates. It is handed the figures the deterministic engine
 * produced and asked to explain them; every answer is then scanned for
 * money-sized numbers that are not among those figures, and any that turn up
 * are shown to the user as a warning above the answer rather than quietly
 * accepted. The calculated numbers stay on screen next to it, so the answer is
 * always checkable against them.
 */

const SUGGESTIONS = [
  'আমার বেতন এত কম বাড়ল কেন?',
  '১০%/১৫% সুবিধা কি আমার হিসাবে যোগ হইয়াছে?',
  '১ জুলাই ২০২৬ হইতে আমি হাতে কত পাইব?',
  'পরবর্তী বেতনবৃদ্ধি কখন এবং কত?',
];

type Answer = {
  text: string;
  invented: string[];
};

export function AiExplainer({ result }: { result: FixationResult }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const facts = useMemo(() => factBlock(result), [result]);
  const allowed = useMemo(() => allowedFigures(result), [result]);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      const response = await apiFetch<{ content: string }>('/ai/text', {
        method: 'POST',
        body: {
          prompt: `${facts}\n\nপ্রশ্ন: ${trimmed}`,
          system: AI_SYSTEM_PROMPT.slice(0, 2000),
          locale: 'bn',
          max_tokens: 600,
          temperature: 0.2,
        },
      });
      const content = (response.content ?? '').trim();
      setAnswer({ text: content, invented: findInventedFigures(content, allowed) });
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 429
          ? 'আজকের AI ব্যবহারের সীমা শেষ হইয়াছে। উপরের ধাপে ধাপে ব্যাখ্যা ও হিসাবের সূত্র দেখুন।'
          : 'AI ব্যাখ্যা এখন পাওয়া যাইতেছে না। উপরের ধাপে ধাপে ব্যাখ্যা ও হিসাবের সূত্র দেখুন — সেখানে সম্পূর্ণ হিসাব রহিয়াছে।',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!result.ok) return null;

  return (
    <Card className="ps-no-print">
      <h3 className="text-subheading text-ink">এই ফলাফল সম্পর্কে প্রশ্ন করুন</h3>
      <p className="mt-1 text-small text-ink-muted">
        সংখ্যাগুলি উপরের ক্যালকুলেটর হইতে — AI কেবল ব্যাখ্যা করে, হিসাব করে না।
        AI কোনও নূতন অঙ্ক লিখিলে তাহা চিহ্নিত করিয়া দেখানো হইবে।
      </p>

      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => { event.preventDefault(); void ask(question); }}
      >
        <input
          className={inputClass}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="যেমন: আমার বেতন এত কম বাড়ল কেন?"
          aria-label="আপনার প্রশ্ন"
          maxLength={400}
        />
        <button type="submit" className={buttonClass} disabled={busy || question.trim() === ''}>
          {busy ? 'উত্তর আসিতেছে…' : 'জিজ্ঞাসা করুন'}
        </button>
      </form>

      <ul className="mt-2.5 flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <li key={suggestion}>
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={busy}
              onClick={() => { setQuestion(suggestion); void ask(suggestion); }}
            >
              {suggestion}
            </button>
          </li>
        ))}
      </ul>

      {error ? (
        <p className="mt-3 rounded-control border border-border bg-surface-sunken px-3 py-2.5 text-small text-ink-muted">
          {error}
        </p>
      ) : null}

      {answer ? (
        <div className="mt-4">
          {answer.invented.length > 0 ? (
            <div className="rounded-control border border-danger/30 bg-danger/5 px-3.5 py-3">
              <p className="text-small text-ink">
                ⚠ এই উত্তরে এমন অঙ্ক রহিয়াছে যাহা ক্যালকুলেটরের হিসাবে নাই:{' '}
                <span className="font-bengali tabular-nums font-medium">{answer.invented.join(', ')}</span>।
              </p>
              <p className="mt-1 text-small text-ink-muted">
                এই অঙ্কগুলি উপেক্ষা করুন। নির্ভরযোগ্য হিসাব কেবল উপরের ফলাফল কার্ড ও
                “এই বেতন কীভাবে নির্ধারণ হলো?” অংশে।
              </p>
            </div>
          ) : null}
          <div className="mt-2 rounded-control border border-border bg-surface-sunken px-3.5 py-3">
            <p className="whitespace-pre-line text-body text-ink">{answer.text}</p>
            <p className="mt-2 text-micro text-ink-subtle">
              AI-উৎপন্ন ব্যাখ্যা। সংখ্যা ও বিধি গেজেট-ভিত্তিক ক্যালকুলেটর হইতে; চূড়ান্ত বেতন
              নির্ধারণ সংশ্লিষ্ট কর্তৃপক্ষের উপর নির্ভরশীল।
            </p>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
