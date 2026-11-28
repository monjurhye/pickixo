'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Card, SectionHeading, buttonClass, inputClass, secondaryButtonClass, selectClass,
} from '@/components/payscale/Ui';
import {
  DOC_LABELS, analyze, asciiToBn, type AreaUnit, type Doc, type DocFields, type DocType, type Finding, type Person,
} from '@/lib/land/compare';

/**
 * "কাগজ মিলিয়ে দেখুন": the visitor photographs each land paper, Gemini reads it
 * through /api/land/read, and src/lib/land/compare.ts says what is missing,
 * what agrees and what does not. Everything stays in this page's memory: a
 * reload forgets it, and nothing is saved on Pickixo's side.
 */

type Entry = {
  id: string;
  files: string[];
  status: 'reading' | 'done' | 'error';
  error?: string;
  fields?: DocFields;
};

const UNIT_LABELS: Record<AreaUnit, string> = {
  shotangsho: 'শতাংশ', acre: 'একর', katha: 'কাঠা', bigha: 'বিঘা', sqft: 'বর্গফুট', ojutangsho: 'অযুতাংশ', other: 'অন্য',
};

const MAX_SIDE = 1800;

/** Shrink a photo to at most 1800 px and JPEG, to keep uploads and cost small. */
async function toPage(file: File): Promise<{ mimeType: string; data: string }> {
  if (file.type === 'application/pdf') {
    if (file.size > 12 * 1024 * 1024) throw new Error('PDF ১২ MB-এর কম হতে হবে।');
    return { mimeType: file.type, data: await toBase64(file) };
  }
  if (!file.type.startsWith('image/')) throw new Error('শুধু ছবি বা PDF দিন।');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('ছবিটা খোলা যায়নি।'))), 'image/jpeg', 0.82));
  return { mimeType: 'image/jpeg', data: await toBase64(blob) };
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] || '');
    r.onerror = () => rej(new Error('ফাইলটা পড়া যায়নি।'));
    r.readAsDataURL(blob);
  });
}

const splitList = (s: string) => s.split(/[,،;]+/).map((x) => x.trim()).filter(Boolean);
const joinNames = (ps: Person[]) => ps.map((p) => p.name).join(', ');

function FindingList({ title, items, tone }: { title: string; items: Finding[]; tone: 'ok' | 'bad' | 'warn' | 'plain' }) {
  if (!items.length) return null;
  const style = {
    ok: 'border-success/30 bg-success/5', bad: 'border-danger/30 bg-danger/5',
    warn: 'border-warning/35 bg-warning/5', plain: 'border-border bg-surface-sunken',
  }[tone];
  const icon = { ok: '✅', bad: '❌', warn: '⚠️', plain: '•' }[tone];
  return (
    <div className={`rounded-control border p-4 ${style}`}>
      <h4 className="text-subheading text-ink">{title} ({asciiToBn(String(items.length))})</h4>
      <ul className="mt-2 space-y-2">
        {items.map((f, i) => (
          <li key={i} className="flex gap-2 text-body text-ink">
            <span aria-hidden="true">{icon}</span>
            <span>
              {f.text}
              {f.detail ? <span className="block text-small text-ink-muted">{f.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FieldEditor({ fields, onChange }: { fields: DocFields; onChange: (f: DocFields) => void }) {
  const set = (patch: Partial<DocFields>) => onChange({ ...fields, ...patch });
  const isDeed = fields.doc_type === 'dolil' || fields.doc_type === 'baya_dolil';
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="block text-small text-ink-muted">
        কাগজের ধরন
        <select className={`${selectClass} mt-1`} value={fields.doc_type}
                onChange={(e) => set({ doc_type: e.target.value as DocType, is_land_document: e.target.value !== 'other' })}>
          {(Object.keys(DOC_LABELS) as DocType[]).map((t) => <option key={t} value={t}>{DOC_LABELS[t]}</option>)}
        </select>
      </label>
      <label className="block text-small text-ink-muted">
        {isDeed ? 'গ্রহীতা (ক্রেতা)' : 'মালিক'} — কমা দিয়ে আলাদা
        <input className={`${inputClass} mt-1`} defaultValue={joinNames(fields.owners)}
               onBlur={(e) => set({ owners: splitList(e.target.value).map((name) => ({ name })) })} />
      </label>
      {isDeed ? (
        <label className="block text-small text-ink-muted">
          দাতা (বিক্রেতা)
          <input className={`${inputClass} mt-1`} defaultValue={joinNames(fields.sellers)}
                 onBlur={(e) => set({ sellers: splitList(e.target.value).map((name) => ({ name })) })} />
        </label>
      ) : null}
      <label className="block text-small text-ink-muted">
        দাগ নম্বর
        <input className={`${inputClass} mt-1`} defaultValue={fields.dag_numbers.join(', ')}
               onBlur={(e) => set({ dag_numbers: splitList(e.target.value) })} />
      </label>
      <label className="block text-small text-ink-muted">
        খতিয়ান নম্বর
        <input className={`${inputClass} mt-1`} defaultValue={fields.khatian_numbers.join(', ')}
               onBlur={(e) => set({ khatian_numbers: splitList(e.target.value) })} />
      </label>
      <label className="block text-small text-ink-muted">
        মৌজা
        <input className={`${inputClass} mt-1`} defaultValue={fields.mouza ?? ''}
               onBlur={(e) => set({ mouza: e.target.value.trim() || null })} />
      </label>
      {fields.doc_type !== 'dakhila' ? (
        <div className="flex gap-2">
          <label className="block flex-1 text-small text-ink-muted">
            জমির পরিমাণ
            <input className={`${inputClass} mt-1`} inputMode="decimal" defaultValue={fields.area_value ?? ''}
                   onBlur={(e) => {
                     const v = Number(e.target.value.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))));
                     set({ area_value: e.target.value.trim() && Number.isFinite(v) ? v : null });
                   }} />
          </label>
          <label className="block w-32 text-small text-ink-muted">
            একক
            <select className={`${selectClass} mt-1`} value={fields.area_unit ?? 'shotangsho'}
                    onChange={(e) => set({ area_unit: e.target.value as AreaUnit })}>
              {(Object.keys(UNIT_LABELS) as AreaUnit[]).map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
            </select>
          </label>
        </div>
      ) : (
        <label className="block text-small text-ink-muted">
          খাজনা পরিশোধ (কোন সন পর্যন্ত)
          <input className={`${inputClass} mt-1`} defaultValue={fields.tax_paid_upto ?? ''}
                 onBlur={(e) => set({ tax_paid_upto: e.target.value.trim() || null })} />
        </label>
      )}
    </div>
  );
}

export function DocumentChecker() {
  const [consent, setConsent] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const result = useMemo(() => {
    const docs: Doc[] = entries.filter((e) => e.status === 'done' && e.fields).map((e) => ({ id: e.id, fields: e.fields! }));
    return docs.length ? analyze(docs) : null;
  }, [entries]);
  const reading = entries.some((e) => e.status === 'reading');

  const update = (id: string, patch: Partial<Entry>) =>
    setEntries((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  async function addDocument(files: FileList | null) {
    if (!files || files.length === 0) return;
    const picked = Array.from(files).slice(0, 8);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setEntries((list) => [...list, { id, files: picked.map((f) => f.name), status: 'reading' }]);
    try {
      const pages = await Promise.all(picked.map(toPage));
      const res = await fetch('/api/land/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.fields) throw new Error(body.error || 'কাগজটা পড়া যায়নি। একটু পরে আবার চেষ্টা করুন।');
      update(id, { status: 'done', fields: body.fields });
    } catch (err) {
      update(id, { status: 'error', error: err instanceof Error ? err.message : 'কাগজটা পড়া যায়নি।' });
    } finally {
      if (input.current) input.current.value = '';
    }
  }

  return (
    <section aria-labelledby="docs-heading" className="mt-12">
      <SectionHeading
        id="docs-heading"
        sub="জমির কাগজের ছবি বা PDF দিন। AI পড়ে বলে দেবে কোন কাগজ এখনো লাগবে, কী মিলেছে আর কী মেলেনি।"
      >
        কাগজ মিলিয়ে দেখুন
      </SectionHeading>

      <Card>
        <ol className="list-decimal space-y-1 pl-5 text-small text-ink-muted">
          <li>প্রতিটা কাগজ আলাদা করে যোগ করুন: দলিল, বায়া দলিল, খতিয়ান, নামজারি খতিয়ান, ডিসিআর, খাজনার দাখিলা।</li>
          <li>একটা কাগজের একাধিক পাতা থাকলে সব পাতা একসাথে বেছে নিন (সর্বোচ্চ ৮টা)।</li>
          <li>ছবি সোজা করে, পুরো কাগজ ফ্রেমে রেখে, আলোতে তুলুন।</li>
        </ol>

        <label className="mt-4 flex gap-3 rounded-control border border-warning/35 bg-warning/5 p-3 text-small text-ink">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-accent" checked={consent}
                 onChange={(e) => setConsent(e.target.checked)} />
          <span>
            আমি বুঝেছি যে কাগজের ছবি পড়ার জন্য Google Gemini AI-তে পাঠানো হবে। Pickixo ছবি বা তথ্য জমা রাখে না;
            পেজ বন্ধ করলে সব মুছে যায়। এনআইডি নম্বরের মতো তথ্য চাইলে ছবিতে ঢেকে দিতে পারেন।
          </span>
        </label>

        <div className="ps-no-print mt-4 flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/*,application/pdf" multiple className="hidden"
                 onChange={(e) => addDocument(e.target.files)} />
          <button type="button" className={buttonClass} disabled={!consent || reading}
                  onClick={() => input.current?.click()}>
            {reading ? 'পড়া হচ্ছে…' : entries.length ? '+ আরেকটা কাগজ যোগ করুন' : '+ কাগজ যোগ করুন'}
          </button>
          {entries.length ? (
            <>
              <button type="button" className={secondaryButtonClass} onClick={() => window.print()}>প্রিন্ট / PDF</button>
              <button type="button" className={secondaryButtonClass} onClick={() => { setEntries([]); setEditing(null); }}>
                সব মুছে ফেলুন
              </button>
            </>
          ) : null}
        </div>

        {entries.length ? (
          <ul className="mt-5 space-y-2">
            {entries.map((e, i) => (
              <li key={e.id} className="rounded-control border border-border bg-surface-sunken p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-body font-medium text-ink">
                      {asciiToBn(String(i + 1))}. {e.fields ? DOC_LABELS[e.fields.doc_type] : 'কাগজ'}
                      {e.fields?.survey ? ` (${e.fields.survey})` : ''}
                    </span>
                    <span className="block text-micro text-ink-subtle">
                      {e.files.length > 1 ? `${asciiToBn(String(e.files.length))} পাতা` : e.files[0]}
                    </span>
                  </div>
                  <div className="ps-no-print flex gap-2 text-small">
                    {e.status === 'done' ? (
                      <button type="button" className="text-accent-ink underline"
                              onClick={() => setEditing(editing === e.id ? null : e.id)}>
                        {editing === e.id ? 'বন্ধ করুন' : 'পড়া তথ্য দেখুন / ঠিক করুন'}
                      </button>
                    ) : null}
                    <button type="button" className="text-ink-subtle underline"
                            onClick={() => setEntries((l) => l.filter((x) => x.id !== e.id))}>
                      বাদ দিন
                    </button>
                  </div>
                </div>
                {e.status === 'reading' ? <p className="mt-2 text-small text-ink-muted">AI কাগজটা পড়ছে…</p> : null}
                {e.status === 'error' ? <p role="alert" className="mt-2 text-small text-danger">{e.error}</p> : null}
                {e.status === 'done' && e.fields && editing === e.id ? (
                  <FieldEditor fields={e.fields} onChange={(f) => update(e.id, { fields: f })} />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {result ? (
          <div className="mt-6 space-y-3" aria-live="polite">
            <h3 className="text-heading text-ink">ফলাফল</h3>
            <FindingList title="যে কাগজ এখনো লাগবে" items={result.missing} tone="plain" />
            <FindingList title="যা মেলেনি" items={result.mismatched} tone="bad" />
            <FindingList title="যা মিলেছে" items={result.matched} tone="ok" />
            <FindingList title="সতর্কতা" items={result.warnings} tone="warn" />
            <FindingList title="যা মেলানো যায়নি" items={result.unchecked} tone="plain" />
            <p className="text-small text-ink-muted">
              AI ভুল পড়তে পারে, বিশেষ করে হাতের লেখা ও পুরোনো দলিলে। &quot;পড়া তথ্য দেখুন&quot; থেকে মিলিয়ে নিন।
              কাগজ মিলে গেলেও জমি নিরাপদ, তা নিশ্চিত নয়: সাব-রেজিস্ট্রি অফিসে তল্লাশি আর আইনজীবীর যাচাই দরকার।
            </p>
          </div>
        ) : null}
      </Card>
    </section>
  );
}
