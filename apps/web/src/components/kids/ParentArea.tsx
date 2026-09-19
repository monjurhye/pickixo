'use client';

/**
 * The parent's view.
 *
 * Written for a parent, not a teacher and not an analyst. Three decisions
 * shape it:
 *
 * **No percentages, no grades, no comparison.** A parent shown "62%" learns
 * nothing they can act on and quite a lot they can worry about. What is useful
 * is *which letters need another look and why* — and "ক-এর সাথে খ গুলিয়ে
 * ফেলছে" is something a parent can actually do something about at the dinner
 * table.
 *
 * **The parent is told they do not need to supervise** (§15). That is the
 * product promise and it belongs on this screen in plain Bangla, because a
 * parent who thinks they have to sit down for twenty minutes will simply not
 * open the app on a weekday.
 *
 * **The gate is a small sum, not a password** (§27). It has to stop a
 * four-year-old and it must never stop a parent. A password would do the
 * second thing badly — it would be forgotten, and then the parent is locked
 * out of their own child's progress with no way back.
 */

import { useMemo, useState } from 'react';
import type { Progress } from '@/lib/kids/progress';
import * as store from '@/lib/kids/progress';
import { MASTERY_LABEL_BN, confusions, masteryCounts } from '@/lib/kids/mastery';
import { levelSummaryBn } from '@/lib/kids/adaptive';
import { due } from '@/lib/kids/revision';
import { getLesson } from '@/data/kids';
import { sourceLine } from '@/lib/kids/content';
import { glyphOf, toBn } from './KidsApp';

export function ParentArea({
  progress, onExit,
}: { progress: Progress; onExit: () => void }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Gate onPass={() => setOpen(true)} onExit={onExit} />;
  return <Dashboard progress={progress} onExit={onExit} />;
}

/* -------------------------------------------------------------------------- */
/* The gate                                                                   */
/* -------------------------------------------------------------------------- */

function Gate({ onPass, onExit }: { onPass: () => void; onExit: () => void }) {
  // Two-digit numbers, so the sum is trivial for an adult and out of reach for
  // a pre-primary child who has met ০–২০. Fixed per mount, not per keystroke.
  const [a] = useState(() => 11 + Math.floor(Math.random() * 9));
  const [b] = useState(() => 12 + Math.floor(Math.random() * 9));
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (Number(value) === a + b) onPass();
    else { setWrong(true); setValue(''); }
  };

  return (
    <div className="mx-auto grid min-h-[100dvh] max-w-sm place-items-center px-6">
      <form onSubmit={submit} className="w-full text-center">
        <h1 className="mb-2 font-bengali text-2xl font-bold text-[#2b3440]">
          অভিভাবকদের জন্য
        </h1>
        <p className="mb-6 font-bengali text-base text-[#5a6675]">
          নিচের যোগফলটি লিখুন
        </p>

        <p className="mb-4 text-4xl font-bold text-[#2b3440]">{a} + {b} = ?</p>

        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => { setValue(e.target.value); setWrong(false); }}
          aria-label={`${a} + ${b}`}
          autoFocus
          className="mb-4 w-full rounded-2xl border-2 border-[#c9d2dc] bg-white p-4 text-center text-3xl font-bold text-[#2b3440] outline-none focus:border-[#2eb8a6]"
        />

        {wrong && (
          <p className="mb-3 font-bengali text-sm text-[#ef5b5b]" role="alert">
            আবার চেষ্টা করুন
          </p>
        )}

        <button
          type="submit"
          className="min-h-[56px] w-full rounded-2xl bg-[#2eb8a6] font-bengali text-xl font-bold text-white"
        >
          দেখুন
        </button>
        <button
          type="button"
          onClick={onExit}
          className="mt-4 font-bengali text-sm text-[#8795a5] underline underline-offset-4"
        >
          ফিরে যাই
        </button>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The dashboard                                                              */
/* -------------------------------------------------------------------------- */

function Dashboard({
  progress, onExit,
}: { progress: Progress; onExit: () => void }) {
  const now = new Date().toISOString();
  const today = store.today(progress, now);
  const week = store.week(progress, now);
  const counts = masteryCounts(progress.items);

  const needsWork = useMemo(() => {
    const pairs = new Map(
      confusions(progress.items).map((c) => [c.item, c.with]),
    );
    return due(progress.items, now, 6).map((item) => ({
      item,
      confusedWith: pairs.get(item.id) ?? null,
    }));
  }, [progress.items, now]);

  const lessonsToday = today.lessons
    .map((id) => getLesson(id))
    .filter((lesson): lesson is NonNullable<typeof lesson> => Boolean(lesson));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-5">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-bengali text-2xl font-bold text-[#2b3440]">
          শেখার অগ্রগতি
        </h1>
        <button
          type="button"
          onClick={onExit}
          className="min-h-[48px] rounded-xl bg-white px-4 font-bengali text-base font-semibold text-[#2b3440] shadow"
        >
          শিশুর পাতায় ফিরি
        </button>
      </div>

      {/* The promise, said plainly. */}
      <p className="mb-6 rounded-2xl bg-white/70 p-4 font-bengali text-base leading-relaxed text-[#5a6675]">
        শিশু নিজে নিজেই শিখতে পারে — আপনাকে পাশে বসে থাকতে হবে না।
        প্রতিদিন ১০–১৫ মিনিটই যথেষ্ট।
      </p>

      <Section title="আজকের শেখা">
        {today.answers === 0 ? (
          <p className="font-bengali text-base text-[#5a6675]">আজ এখনো শুরু হয়নি।</p>
        ) : (
          <ul className="space-y-1 font-bengali text-base text-[#2b3440]">
            <li>✓ {toBn(today.lessons.length)}টি পাঠ · {toBn(today.minutes)} মিনিট</li>
            <li>✓ {toBn(today.answers)}টি প্রশ্ন, {toBn(today.correct)}টি ঠিক</li>
            {progress.streak > 1 && <li>🔥 ধারাবাহিক {toBn(progress.streak)} দিন</li>}
          </ul>
        )}
      </Section>

      <Section title="যেগুলো আবার অনুশীলন করা দরকার">
        {needsWork.length === 0 ? (
          <p className="font-bengali text-base text-[#5a6675]">
            এখন আলাদা করে অনুশীলনের কিছু নেই।
          </p>
        ) : (
          <ul className="space-y-3">
            {needsWork.map(({ item, confusedWith }) => (
              <li key={item.id} className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white font-bengali text-2xl font-bold text-[#2b3440] shadow">
                  {glyphOf(item.id)}
                </span>
                <span className="font-bengali text-base text-[#5a6675]">
                  {/* Name the *confusion*, not a score — it is the only thing
                      here a parent can act on. */}
                  {confusedWith
                    ? `${glyphOf(confusedWith)}-এর সাথে গুলিয়ে ফেলছে`
                    : MASTERY_LABEL_BN[item.mastery]}
                  <span className="ml-2 text-sm text-[#8795a5]">
                    · {levelSummaryBn(item.level)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="এ পর্যন্ত">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="শিখে গেছে" value={counts.mastered + counts.confident} />
          <Stat label="শিখছে" value={counts.learning + counts.practicing} />
          <Stat label="তারা" value={progress.stars} />
        </div>
      </Section>

      <Section title="এই সপ্তাহে">
        <div className="flex items-end gap-2" role="img" aria-label="সাপ্তাহিক সময়">
          {week.map((day) => (
            <div key={day.day} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-[#2eb8a6]"
                // Bars also carry their number below, so the chart never
                // depends on being able to compare heights (§21).
                style={{ height: Math.max(4, Math.min(72, day.minutes * 5)) }}
              />
              <span className="text-[10px] text-[#8795a5]">
                {toBn(day.minutes)}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="পাঠ্যসূত্র">
        <p className="font-bengali text-sm leading-relaxed text-[#5a6675]">
          সব পাঠ জাতীয় শিক্ষাক্রম ও পাঠ্যপুস্তক বোর্ড (এনসিটিবি)-এর
          প্রাক-প্রাথমিক বই <strong>আমার বই</strong> এবং
          প্রাক-প্রাথমিক শিক্ষাক্রম ২০২২ অনুসরণ করে তৈরি।
          বইয়ের ছবি ব্যবহার করা হয়নি — সব ছবি পিকজিকোর নিজস্ব।
        </p>
        {lessonsToday[0] && (
          <p className="mt-2 font-bengali text-xs text-[#8795a5]">
            {sourceLine(lessonsToday[0]!)}
          </p>
        )}
      </Section>

      <div className="mt-8 border-t border-[#e3e8ee] pt-5">
        <button
          type="button"
          onClick={() => {
            // Confirmed, because there is no undo and no server copy to
            // restore from while the child is signed out.
            if (window.confirm('সব অগ্রগতি মুছে ফেলবেন? এটি ফেরানো যাবে না।')) {
              store.reset();
              onExit();
            }
          }}
          className="font-bengali text-sm text-[#ef5b5b] underline underline-offset-4"
        >
          সব অগ্রগতি মুছে ফেলি
        </button>
        <p className="mt-2 font-bengali text-xs text-[#8795a5]">
          অগ্রগতি শুধু এই ডিভাইসে রাখা হয়। কোনো তথ্য বাইরে পাঠানো হয় না।
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-bengali text-lg font-bold text-[#2b3440]">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#f7f9fb] p-3 text-center">
      <p className="text-2xl font-bold text-[#2b3440]">{toBn(value)}</p>
      <p className="font-bengali text-xs text-[#5a6675]">{label}</p>
    </div>
  );
}
