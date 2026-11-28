'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Card, SectionHeading, buttonClass, inputClass, secondaryButtonClass, selectClass,
} from '@/components/payscale/Ui';
import { DocumentChecker } from './DocumentChecker';

/**
 * ভূমি সেবা সহায়ক: three things that work without any government API.
 *
 * 1. Links to the official land-service sites (we never embed or scrape them).
 * 2. A land-unit converter, computed entirely in the browser.
 * 3. An ownership-verification checklist whose ticks live in localStorage, so
 *    nothing a visitor does here leaves their device.
 *
 * Service URLs were checked against the service cards on land.gov.bd on
 * 2026-11-28. eporcha.gov.bd did not answer that day; land.gov.bd now sends
 * records and maps to dlrms.land.gov.bd, so that is what is listed.
 */

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const toBn = (s: string) => s.replace(/[0-9]/g, (d) => BN_DIGITS.charAt(Number(d)));
const fromBn = (s: string) => s.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const digits = Math.abs(n) >= 1000 ? 2 : Math.abs(n) >= 1 ? 4 : 6;
  return toBn(n.toLocaleString('en-IN', { maximumFractionDigits: digits }));
}

// --- 1. official services -------------------------------------------------

const SERVICES = [
  {
    name: 'খতিয়ান ও মৌজা ম্যাপ',
    what: 'সিএস, এসএ, আরএস, বিএস খতিয়ান খোঁজা, সার্টিফাইড কপি ও ম্যাপের আবেদন।',
    url: 'https://dlrms.land.gov.bd',
  },
  {
    name: 'ই-নামজারি (মিউটেশন)',
    what: 'নামজারির আবেদন, আবেদনের অবস্থা দেখা ও ডিসিআর।',
    url: 'https://mutation.land.gov.bd',
  },
  {
    name: 'ভূমি উন্নয়ন কর (খাজনা)',
    what: 'অনলাইনে খাজনা পরিশোধ, বকেয়া দেখা ও দাখিলা ডাউনলোড।',
    url: 'https://portal.ldtax.gov.bd',
  },
  {
    name: 'নাগরিক সেবা কর্নার',
    what: 'ভূমি মালিকের নিজের অ্যাকাউন্ট: সব আবেদন এক জায়গায়।',
    url: 'https://lsg-land-owner.land.gov.bd',
  },
  {
    name: 'ভূমি অধিগ্রহণ',
    what: 'সরকারি প্রয়োজনে অধিগ্রহণ করা জমি ও ক্ষতিপূরণের তথ্য।',
    url: 'https://larms.land.gov.bd',
  },
  {
    name: 'ভূমি জরিপ ও রেকর্ড অধিদপ্তর',
    what: 'জরিপ, রেকর্ড ও ম্যাপ সংক্রান্ত অফিসিয়াল তথ্য।',
    url: 'https://dlrs.gov.bd',
  },
  {
    name: 'ভূমি মন্ত্রণালয় পোর্টাল',
    what: 'সব ভূমি সেবার মূল দরজা, নোটিশ ও নির্দেশিকা।',
    url: 'https://land.gov.bd',
  },
] as const;

function Services() {
  return (
    <section aria-labelledby="services-heading" className="mt-12">
      <SectionHeading id="services-heading" sub="প্রতিটি লিংক সরাসরি সরকারি .gov.bd সাইটে নতুন ট্যাবে খুলবে।">
        অনলাইন ভূমি সেবা
      </SectionHeading>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((s) => (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-card border border-border bg-surface p-4 transition-colors hover:bg-surface-sunken"
          >
            <span className="text-subheading text-ink">{s.name} ↗</span>
            <p className="mt-1 text-small text-ink-muted">{s.what}</p>
            <p className="mt-2 text-micro text-ink-subtle">{s.url.replace('https://', '')}</p>
          </a>
        ))}
        <a
          href="tel:16122"
          className="rounded-card border border-accent/30 bg-accent-soft p-4 transition-colors hover:bg-surface-sunken"
        >
          <span className="text-subheading text-accent-ink">ভূমি সেবা হটলাইন: ১৬১২২</span>
          <p className="mt-1 text-small text-ink-muted">যেকোনো প্রশ্ন বা অভিযোগের জন্য কল করুন।</p>
        </a>
      </div>
    </section>
  );
}

// --- 2. unit converter ----------------------------------------------------

/** Square feet per unit. Standard values; কাঠা and বিঘা vary in some regions. */
const UNITS = [
  { id: 'sqft', name: 'বর্গফুট', sqft: 1 },
  { id: 'sqm', name: 'বর্গমিটার', sqft: 10.7639104 },
  { id: 'ojutangsho', name: 'অযুতাংশ', sqft: 4.356 },
  { id: 'chhotak', name: 'ছটাক', sqft: 45 },
  { id: 'katha', name: 'কাঠা', sqft: 720 },
  { id: 'shotangsho', name: 'শতাংশ (ডেসিমেল)', sqft: 435.6 },
  { id: 'bigha', name: 'বিঘা', sqft: 14400 },
  { id: 'acre', name: 'একর', sqft: 43560 },
  { id: 'hectare', name: 'হেক্টর', sqft: 107639.104 },
] as const;

function Converter() {
  const [raw, setRaw] = useState('১');
  const [from, setFrom] = useState<string>('shotangsho');

  const value = Number(fromBn(raw).replace(/,/g, ''));
  const unit = UNITS.find((u) => u.id === from)!;
  const sqft = value * unit.sqft;
  const valid = raw.trim() !== '' && Number.isFinite(value) && value >= 0;

  return (
    <section aria-labelledby="convert-heading" className="mt-12">
      <SectionHeading id="convert-heading" sub="সংখ্যা বাংলা বা ইংরেজি যেকোনোভাবে লিখতে পারেন।">
        জমির একক রূপান্তর
      </SectionHeading>
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="land-amount" className="mb-1.5 block text-small font-medium text-ink">পরিমাণ</label>
            <input
              id="land-amount"
              inputMode="decimal"
              className={inputClass}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              aria-invalid={!valid}
            />
          </div>
          <div>
            <label htmlFor="land-unit" className="mb-1.5 block text-small font-medium text-ink">একক</label>
            <select id="land-unit" className={selectClass} value={from} onChange={(e) => setFrom(e.target.value)}>
              {UNITS.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>

        {valid ? (
          <dl className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {UNITS.filter((u) => u.id !== from).map((u) => (
              <div key={u.id} className="rounded-control border border-border bg-surface-sunken p-3">
                <dt className="text-micro text-ink-subtle">{u.name}</dt>
                <dd className="mt-1 font-bengali text-subheading tabular-nums text-ink">{fmt(sqft / u.sqft)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p role="alert" className="mt-4 text-small text-danger">একটি সঠিক সংখ্যা লিখুন।</p>
        )}

        <p className="mt-4 text-small text-ink-muted">
          হিসাব প্রচলিত মানে: ১ শতাংশ = ৪৩৫.৬ বর্গফুট, ১ কাঠা = ৭২০ বর্গফুট, ১ বিঘা = ২০ কাঠা = ১৪,৪০০ বর্গফুট,
          ১ একর = ১০০ শতাংশ। কিছু এলাকায় কাঠা ও বিঘার মাপ আলাদা, তাই দলিল বা খতিয়ানে লেখা এককটাই চূড়ান্ত।
        </p>
      </Card>
    </section>
  );
}

// --- 3. ownership checklist ----------------------------------------------

type Step = { id: string; title: string; detail: string; url?: string; urlLabel?: string };

const CHECK_GROUPS: { title: string; steps: Step[] }[] = [
  {
    title: 'অনলাইনে যাচাই',
    steps: [
      {
        id: 'khatian',
        title: 'খতিয়ানে বিক্রেতার নাম আছে কিনা',
        detail: 'দাগ নম্বর ও জমির পরিমাণ মিলিয়ে দেখুন। সম্ভব হলে সিএস, এসএ, আরএস ও বিএস চারটি খতিয়ানেই ধারাবাহিকতা দেখুন।',
        url: 'https://dlrms.land.gov.bd', urlLabel: 'খতিয়ান দেখুন',
      },
      {
        id: 'namjari',
        title: 'বিক্রেতার নামে নামজারি হয়েছে কিনা',
        detail: 'নামজারির খতিয়ান ও ডিসিআর (DCR) বিক্রেতার কাছ থেকে চেয়ে নিন এবং অনলাইনে মিলিয়ে দেখুন।',
        url: 'https://mutation.land.gov.bd', urlLabel: 'নামজারি দেখুন',
      },
      {
        id: 'khajna',
        title: 'খাজনা হালনাগাদ আছে কিনা',
        detail: 'ভূমি উন্নয়ন কর বকেয়া থাকলে কেনার আগেই পরিশোধ করাতে বলুন।',
        url: 'https://portal.ldtax.gov.bd', urlLabel: 'খাজনা দেখুন',
      },
      {
        id: 'map',
        title: 'মৌজা ম্যাপে দাগের অবস্থান',
        detail: 'দাগটা ম্যাপে কোথায়, সীমানা ও রাস্তা কোন দিকে, তা দেখে নিন।',
        url: 'https://dlrms.land.gov.bd', urlLabel: 'ম্যাপ দেখুন',
      },
    ],
  },
  {
    title: 'অফিসে গিয়ে যাচাই',
    steps: [
      {
        id: 'tollashi',
        title: 'সাব-রেজিস্ট্রি অফিসে তল্লাশি',
        detail: 'জমিটি আগে অন্য কারো কাছে বিক্রি, দান বা ব্যাংকে বন্ধক দেওয়া হয়েছে কিনা দেখুন। দলিলের সার্টিফাইড কপি (নকল) তুলুন।',
      },
      {
        id: 'baya',
        title: 'বায়া দলিল মিলানো',
        detail: 'মালিকানা কীভাবে বিক্রেতার কাছে এসেছে, তার পুরো ধারা দেখুন। কমপক্ষে ২৫ থেকে ৩০ বছরের দলিল দেখা ভালো।',
      },
      {
        id: 'acland',
        title: 'এসি ল্যান্ড বা ইউনিয়ন ভূমি অফিসে খোঁজ',
        detail: 'জমিটি খাস, অর্পিত সম্পত্তি, অধিগ্রহণের তালিকায়, ওয়াকফ বা দেবোত্তর কিনা জেনে নিন।',
        url: 'https://larms.land.gov.bd', urlLabel: 'অধিগ্রহণ দেখুন',
      },
      {
        id: 'court',
        title: 'আদালতে মামলা আছে কিনা',
        detail: 'স্থানীয় দেওয়ানি আদালতে জমি নিয়ে কোনো মামলা চলছে কিনা খোঁজ নিন।',
      },
    ],
  },
  {
    title: 'সরেজমিনে ও কাগজপত্রে',
    steps: [
      {
        id: 'amin',
        title: 'আমিন দিয়ে জমি মাপা',
        detail: 'দলিল ও খতিয়ানের পরিমাণের সাথে আসল জমির মাপ মেলে কিনা দেখুন।',
      },
      {
        id: 'dokhol',
        title: 'দখল যাচাই',
        detail: 'জমি বিক্রেতার দখলে আছে কিনা প্রতিবেশীদের কাছে জিজ্ঞেস করুন।',
      },
      {
        id: 'warish',
        title: 'ওয়ারিশ সূত্রে পাওয়া জমি হলে',
        detail: 'ওয়ারিশান সনদ দেখুন, আর সব ওয়ারিশ বিক্রিতে রাজি কিনা নিশ্চিত হন।',
      },
      {
        id: 'lawyer',
        title: 'আইনজীবীকে দিয়ে কাগজ যাচাই',
        detail: 'রেজিস্ট্রির আগে একজন অভিজ্ঞ ভূমি আইনজীবীকে সব কাগজ দেখিয়ে নিন।',
      },
    ],
  },
];

const ALL_STEPS = CHECK_GROUPS.flatMap((g) => g.steps);
const STORAGE_KEY = 'pickixo.bhumi.checklist.v1';

function Checklist() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setDone(JSON.parse(saved));
    } catch { /* private mode or bad JSON: start empty */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(done)); } catch { /* ignore */ }
  }, [done, loaded]);

  const count = useMemo(() => ALL_STEPS.filter((s) => done[s.id]).length, [done]);
  const total = ALL_STEPS.length;

  return (
    <section aria-labelledby="check-heading">
      <SectionHeading
        id="check-heading"
        sub="টিকগুলো শুধু আপনার ফোন বা কম্পিউটারে সেভ থাকে। কোনো তথ্য আমাদের কাছে আসে না।"
      >
        জমির মালিকানা যাচাই
      </SectionHeading>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-bengali text-subheading text-ink" aria-live="polite">
            {toBn(String(count))}/{toBn(String(total))} ধাপ সম্পন্ন
          </p>
          <div className="ps-no-print flex gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => setDone({})}>
              নতুন করে শুরু
            </button>
            <button type="button" className={buttonClass} onClick={() => window.print()}>
              প্রিন্ট / PDF
            </button>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
          <div className="h-full bg-accent transition-all" style={{ width: `${(count / total) * 100}%` }} />
        </div>

        {CHECK_GROUPS.map((g) => (
          <div key={g.title} className="mt-6">
            <h3 className="text-subheading text-ink">{g.title}</h3>
            <ul className="mt-2 space-y-2">
              {g.steps.map((s) => (
                <li key={s.id} className="rounded-control border border-border bg-surface-sunken p-3">
                  <label className="flex cursor-pointer gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0 accent-accent"
                      checked={!!done[s.id]}
                      onChange={(e) => setDone((d) => ({ ...d, [s.id]: e.target.checked }))}
                    />
                    <span>
                      <span className={`text-body font-medium ${done[s.id] ? 'text-ink-subtle line-through' : 'text-ink'}`}>
                        {s.title}
                      </span>
                      <span className="mt-0.5 block text-small text-ink-muted">{s.detail}</span>
                    </span>
                  </label>
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ps-no-print ml-8 mt-1 inline-block text-small text-accent-ink underline"
                    >
                      {s.urlLabel} ↗
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
    </section>
  );
}

// --- 4. e-namjari papers and fee -----------------------------------------

function NamjariInfo() {
  return (
    <section aria-labelledby="namjari-heading" className="mt-12">
      <SectionHeading id="namjari-heading" sub="অনলাইনে আবেদনের আগে এগুলো স্ক্যান করে রাখুন।">
        ই-নামজারির কাগজপত্র ও ফি
      </SectionHeading>
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <h3 className="text-subheading text-ink">যা লাগবে</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-body text-ink-muted">
            <li>আবেদনকারীর জাতীয় পরিচয়পত্র ও ছবি</li>
            <li>জমির দলিল (মূল দলিল বা সার্টিফাইড কপি)</li>
            <li>বায়া দলিল</li>
            <li>সর্বশেষ খতিয়ান</li>
            <li>হালনাগাদ খাজনার দাখিলা</li>
            <li>ওয়ারিশ সূত্রে হলে ওয়ারিশান সনদ</li>
          </ul>
        </Card>
        <Card>
          <h3 className="text-subheading text-ink">সরকারি ফি (প্রচলিত)</h3>
          <table className="mt-2 w-full font-bengali text-body">
            <tbody className="text-ink-muted">
              <tr><td className="py-1">কোর্ট ফি</td><td className="text-right tabular-nums">২০ টাকা</td></tr>
              <tr><td className="py-1">নোটিশ জারি ফি</td><td className="text-right tabular-nums">৫০ টাকা</td></tr>
              <tr><td className="py-1">রেকর্ড সংশোধন ফি</td><td className="text-right tabular-nums">১,০০০ টাকা</td></tr>
              <tr><td className="py-1">খতিয়ান সরবরাহ ফি</td><td className="text-right tabular-nums">১০০ টাকা</td></tr>
              <tr className="border-t border-border text-ink">
                <td className="py-1 font-medium">মোট</td><td className="text-right font-medium tabular-nums">১,১৭০ টাকা</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-small text-ink-muted">
            ফি সরকার বদলাতে পারে। আবেদনের সময় mutation.land.gov.bd-তে দেখানো ফি-ই চূড়ান্ত। এর বাইরে কেউ টাকা চাইলে ১৬১২২-এ জানান।
          </p>
        </Card>
      </div>
    </section>
  );
}

export function LandHelper() {
  return (
    <div className="ps-report">
      <div className="mb-8 rounded-control border border-warning/35 bg-warning/5 px-4 py-3 text-small text-ink">
        এটি Pickixo-র একটি <strong>বেসরকারি সহায়ক পেজ</strong>, সরকারি সাইট নয়। সব আবেদন ও পেমেন্ট শুধু
        অফিসিয়াল <strong>.gov.bd</strong> সাইটে করুন। আমরা কখনো আপনার এনআইডি, পাসওয়ার্ড বা OTP চাই না।
      </div>
      <Checklist />
      <DocumentChecker />
      <Services />
      <Converter />
      <NamjariInfo />
    </div>
  );
}
