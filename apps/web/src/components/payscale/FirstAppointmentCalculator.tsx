'use client';

import { useMemo, useState } from 'react';
import { calculateFirstAppointment } from '@/lib/payscale/firstAppointment';
import type {
  AppointmentQualification, AppointmentTrack, JoiningWindow,
} from '@/lib/payscale/firstAppointment';
import { GRADES_LIST, getScale2026 } from '@/lib/payscale/payScale';
import { formatDateBn, gradeLabel, taka, toBnDigits } from '@/lib/payscale/format';
import {
  Card, CertaintyTag, Field, Money, PhaseThreeDeclaration, ResultHero, Source, Warnings, buttonClass, secondaryButtonClass, selectClass,
} from './Ui';
import type { Grade } from '@/lib/payscale/types';

/**
 * অনুচ্ছেদ ১০ — pay on first appointment.
 *
 * Kept as its own form instead of extra fields on the fixation form: a new
 * appointee has no 2015 basic to enter, and putting both sets of questions in
 * one place would make a person fill in things that do not apply to them.
 * Like the fixation form, nothing is pre-selected.
 */

const QUALIFICATIONS: { value: AppointmentQualification; label: string }[] = [
  { value: 'none', label: 'প্রযোজ্য নয় / জানি না' },
  { value: 'degree-one', label: '১০(১)(ক) — এম.বি.বি.এস., আর্কিটেকচার বা ইঞ্জিনিয়ারিং ডিগ্রি (১টি)' },
  { value: 'masters-two', label: '১০(১)(খ) — ইঞ্জিনিয়ারিং/স্থাপত্যে মাস্টার্স, ফিজিক্যাল প্ল্যানিং ডিগ্রি, বা আইনে অনার্স ও মাস্টার্স (২টি)' },
  { value: 'medical-licence', label: '১০(১)(গ) — চিকিৎসা অনুষদের লাইসেন্সধারী (১টি)' },
];

const TRACKS: { value: AppointmentTrack; label: string }[] = [
  { value: 'standard', label: 'সাধারণ নিয়োগ' },
  { value: 'bcs-cadre-9', label: '১০(২) — বিসিএস ক্যাডার, ৯ম গ্রেডে সরাসরি নিয়োগ' },
  { value: 'bpsc-non-cadre-9', label: '১০(৩) — বিপিএসসির সুপারিশে ৯ম গ্রেডের নন-ক্যাডার পদ' },
];

const WINDOWS: { value: JoiningWindow; label: string }[] = [
  { value: 'phase-1', label: '১ জুলাই ২০২৬ – ৩১ ডিসেম্বর ২০২৬' },
  { value: 'phase-2', label: '১ জানুয়ারি ২০২৭ – ৩০ জুন ২০২৭' },
  { value: 'after-transition', label: '১ জুলাই ২০২৭ বা তাহার পরে' },
];

export function FirstAppointmentCalculator() {
  const [grade, setGrade] = useState('');
  const [track, setTrack] = useState<AppointmentTrack>('standard');
  const [qualification, setQualification] = useState<AppointmentQualification>('none');
  const [joining, setJoining] = useState<JoiningWindow | ''>('');
  const [submitted, setSubmitted] = useState<{
    grade: number; track: AppointmentTrack; qualification: AppointmentQualification; joining: JoiningWindow;
  } | null>(null);

  const result = useMemo(
    () => (submitted
      ? calculateFirstAppointment({ ...submitted, grade: submitted.grade as Grade })
      : null),
    [submitted],
  );
  const scale = grade ? getScale2026(Number(grade)) : null;
  const ready = grade !== '' && joining !== '';

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setSubmitted({ grade: Number(grade), track, qualification, joining: joining as JoiningWindow });
  }

  function reset() {
    setGrade(''); setTrack('standard'); setQualification('none'); setJoining(''); setSubmitted(null);
  }

  return (
    <div className="space-y-5">
      <Card className="ps-no-print">
        <form onSubmit={submit} className="space-y-5">
          <div>
            <h2 className="text-subheading text-ink">নিয়োগের তথ্য দিন</h2>
            <p className="mt-0.5 text-small text-ink-muted">
              ১ জুলাই ২০২৬ বা তাহার পরে প্রথম নিয়োগে বেতন ২০২৬ স্কেলের প্রথম ধাপ হইতে শুরু হয়।
              ৯ম গ্রেড ও তদূর্ধ্বে যোগ্যতাভেদে অগ্রিম বেতনবৃদ্ধিও যোগ হয় (অনুচ্ছেদ ১০)।
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="পদের গ্রেড" htmlFor="fa-grade" required
                   hint="জাতীয় বেতনস্কেল, ২০২৬ এর গ্রেড">
              <select id="fa-grade" className={selectClass} value={grade}
                      onChange={(e) => setGrade(e.target.value)}>
                <option value="">— নির্বাচন করুন —</option>
                {GRADES_LIST.map((g) => (
                  <option key={g.grade} value={g.grade}>{gradeLabel(g.grade)}</option>
                ))}
              </select>
            </Field>

            <Field label="২০২৬ বেতনস্কেল" htmlFor="fa-scale" hint="গ্রেড বাছিলে নিজে নিজে আসিবে">
              <input id="fa-scale" readOnly tabIndex={-1} className={`${selectClass} cursor-default bg-surface-sunken text-ink-muted`} placeholder="—"
                     value={scale
                       ? `${toBnDigits(scale.minimum)}${scale.fixed ? ' (নির্ধারিত)' : `–${toBnDigits(scale.maximum)}`}`
                       : ''} />
            </Field>
          </div>

          <Field label="যোগদানের সময়" htmlFor="fa-joining" required
                 hint="অনুচ্ছেদ ১০(৪) ও ১(৩) অনুযায়ী প্রদেয় শতাংশ ইহার উপর নির্ভর করে">
            <select id="fa-joining" className={selectClass} value={joining}
                    onChange={(e) => setJoining(e.target.value as JoiningWindow)}>
              <option value="">— নির্বাচন করুন —</option>
              {WINDOWS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </Field>

          <Field label="নিয়োগের ধরন" htmlFor="fa-track"
                 hint="৯ম গ্রেডের বিশেষ বিধান — অন্য গ্রেডে ‘সাধারণ’ রাখুন">
            <select id="fa-track" className={selectClass} value={track}
                    onChange={(e) => setTrack(e.target.value as AppointmentTrack)}>
              {TRACKS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>

          <Field label="অগ্রিম বেতনবৃদ্ধির যোগ্যতা" htmlFor="fa-qualification"
                 hint="শুধু তখনই, যখন এই ডিগ্রি/লাইসেন্স পদের ন্যূনতম শিক্ষাগত যোগ্যতা হিসাবে নির্ধারিত আছে — অনুচ্ছেদ ১০(১)">
            <select id="fa-qualification" className={selectClass} value={qualification}
                    onChange={(e) => setQualification(e.target.value as AppointmentQualification)}>
              {QUALIFICATIONS.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
            </select>
          </Field>

          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
            <button type="submit" className={`${buttonClass} w-full sm:w-auto`} disabled={!ready}>বেতন হিসাব করুন</button>
            {submitted ? (
              <button type="button" onClick={reset} className={secondaryButtonClass}>নূতন হিসাব</button>
            ) : null}
          </div>
        </form>
      </Card>

      {result ? <FirstAppointmentResultView result={result} /> : null}
    </div>
  );
}

function FirstAppointmentResultView({ result }: { result: ReturnType<typeof calculateFirstAppointment> }) {
  if (!result.ok || result.fixedBasic === null || result.payOnJoining === null) {
    return (
      <div className="space-y-4">
        <Card className="border-danger/30 bg-danger/5">
          <h3 className="text-subheading text-ink">বেতন নির্ধারণ করা যাইতেছে না</h3>
          <p className="mt-1.5 text-small text-ink-muted">
            এই তথ্যের ভিত্তিতে নির্দিষ্ট বেতন নির্ধারণ নিশ্চিত করা যাইতেছে না। নিচের বার্তাগুলি দেখুন।
          </p>
        </Card>
        <Warnings items={result.warnings} />
      </div>
    );
  }

  const { input, scale } = result;
  const inTransition = input.joining !== 'after-transition';

  return (
    <div className="ps-report space-y-4">
      <ResultHero
        eyebrow="নতুন নিয়োগে যোগদানের সময় প্রাপ্য মূল বেতন"
        badge={gradeLabel(input.grade)}
        value={taka(result.payOnJoining)}
        caption={inTransition
          ? `২০২৬ স্কেলে নির্ধারিত বেতনের পার্থক্যের ${toBnDigits(result.joiningPercent ?? 0)}% যোগ হইয়াছে — অনুচ্ছেদ ১০(৪)`
          : 'পূর্ণ নির্ধারিত বেতন — অনুচ্ছেদ ১০(৪) প্রযোজ্য নয়'}
        compare={(
          <>
            <span className="text-ink-muted">
              প্রারম্ভিক ধাপ <span className="font-semibold text-ink">{taka(result.startingBasic)}</span>
            </span>
            <span aria-hidden="true" className="hidden text-ink-subtle sm:inline">→</span>
            <span className="rounded-full bg-surface px-2.5 py-1 font-semibold text-accent-ink">
              {result.advanceIncrements === 0
                ? 'অগ্রিম বেতনবৃদ্ধি নাই'
                : `${toBnDigits(result.advanceIncrements)}টি অগ্রিম বেতনবৃদ্ধি`}
            </span>
            <span aria-hidden="true" className="hidden text-ink-subtle sm:inline">→</span>
            <span className="text-ink-muted">
              ২০২৬ স্কেলে <span className="font-semibold text-ink">{taka(result.fixedBasic)}</span>
              {scale && result.fixedStepIndex !== null
                ? ` (ধাপ ${toBnDigits(result.fixedStepIndex + 1)}/${toBnDigits(scale.stepCount)})`
                : ''}
            </span>
          </>
        )}
        footer={[
          {
            label: 'পরবর্তী বেতনবৃদ্ধি',
            value: result.nextIncrementAmount === null ? 'নির্ধারিত নয়' : `+${taka(result.nextIncrementAmount)}`,
            hint: 'প্রতি ১ জুলাই — অনুচ্ছেদ ৯(১)',
          },
          ...(result.advanceLines.length > 0
            ? [{ label: 'অগ্রিম বেতনবৃদ্ধির ভিত্তি', value: result.advanceLines.map((l) => l.label.split(' — ')[0]).join(' + ') }]
            : []),
        ]}
      >
        {result.advanceLines.map((l) => <Source key={l.label} source={l.source} compact />)}
      </ResultHero>

      {inTransition ? (
        <Card>
          <h3 className="text-subheading text-ink">কখন কত টাকা হাতে পাইবেন</h3>
          <p className="mt-1 text-small text-ink-muted">
            অনুচ্ছেদ ১০(৪): ৩০ জুন ২০২৬ তারিখে যোগদান করিলে ২০১৫ স্কেলের প্রারম্ভিক ধাপে
            ({taka(result.oldBase)}) যে বেতন পাইতেন, তাহার সহিত ২০২৬ স্কেলে নির্ধারিত বেতনের পার্থক্যের
            প্রযোজ্য শতাংশ যোগ হয়।
          </p>
          <div className="mt-3 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full border-collapse text-small">
              <thead>
                <tr className="border-b border-border text-left text-micro text-ink-subtle">
                  <th scope="col" className="py-2 pr-3 font-medium">সময়কাল</th>
                  <th scope="col" className="py-2 pr-3 font-medium">হার</th>
                  <th scope="col" className="py-2 text-right font-medium">প্রাপ্য মূল বেতন</th>
                </tr>
              </thead>
              <tbody>
                {result.phases.map((phase) => (
                  <tr
                    key={phase.id}
                    className={`border-b border-border last:border-0 ${phase.id === 'phase-3' ? 'bg-accent-soft/60' : ''}`}
                  >
                    <td className="py-2.5 pr-3 align-top text-ink">
                      {formatDateBn(phase.from)}{phase.to ? ` – ${formatDateBn(phase.to)}` : ' হইতে'}
                  {phase.certainty === 'ASSUMPTION' ? (
                    <span className="ml-2 rounded-full border border-warning/35 bg-warning/10 px-1.5 py-0.5 text-micro text-warning">
                      ব্যাখ্যা
                    </span>
                  ) : null}
                    </td>
                    <td className="py-2.5 pr-3 align-top font-bengali tabular-nums text-ink-muted">
                      {toBnDigits(phase.percent)}%
                    </td>
                    <td className="py-2.5 text-right align-top font-bengali tabular-nums font-medium text-ink">
                      <Money value={phase.payable} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PhaseThreeDeclaration amount={result.fixedBasic} />
        </Card>
      ) : null}

      <Card>
        <h3 className="text-subheading text-ink">এই বেতন কীভাবে নির্ধারণ হলো?</h3>
        <ol className="mt-4 space-y-3">
          {result.steps.map((s) => (
            <li key={s.step} className="rounded-control border border-border bg-surface-sunken p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span aria-hidden="true"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft
                                 text-micro font-semibold text-accent-ink tabular-nums">
                  {toBnDigits(s.step)}
                </span>
                <span className="text-small font-semibold text-ink">{s.title}</span>
                <CertaintyTag value={s.certainty} />
              </div>
              {s.value !== undefined ? (
                <p className="mt-2 font-bengali text-subheading tabular-nums text-ink">{taka(s.value)}</p>
              ) : null}
              <p className="mt-1.5 text-small text-ink-muted">{s.why}</p>
              {s.formula ? (
                <p className="mt-2 overflow-x-auto rounded border border-border bg-surface px-2.5 py-1.5
                              font-bengali text-small tabular-nums text-ink">{s.formula}</p>
              ) : null}
              {s.source ? <Source source={s.source} compact /> : null}
            </li>
          ))}
        </ol>
      </Card>

      <Warnings items={result.warnings} title="সতর্কতা ও তথ্য" />
    </div>
  );
}
