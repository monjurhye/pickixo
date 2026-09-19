import type { ReactNode } from 'react';
import { citationLine } from '@/lib/payscale/sourceReference';
import { taka } from '@/lib/payscale/format';
import type { Certainty, SourceRef, Warning } from '@/lib/payscale/types';

/**
 * Shared presentational pieces for the pay-scale pages.
 *
 * The two that carry weight are `Warnings` and `Source`. Everything this
 * calculator is unsure about has to reach the screen, and every figure has to
 * be traceable — so those are components rather than something each page
 * remembers to render.
 */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-border bg-surface p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeading({ id, children, sub }: { id?: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 id={id} className="text-heading text-ink">{children}</h2>
      {sub ? <p className="mt-1.5 text-small text-ink-muted">{sub}</p> : null}
    </div>
  );
}

/** A headline number. `tone` is only about emphasis, never about good or bad —
 *  a pay figure is not a score. */
export function Stat({
  label, value, hint, tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'accent';
}) {
  return (
    <div className={`rounded-control border p-3.5 ${
      tone === 'accent' ? 'border-accent/30 bg-accent-soft' : 'border-border bg-surface-sunken'
    }`}>
      <div className="text-micro text-ink-subtle">{label}</div>
      <div className={`mt-1 font-bengali text-heading tabular-nums ${
        tone === 'accent' ? 'text-accent-ink' : 'text-ink'
      }`}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-micro text-ink-subtle">{hint}</div> : null}
    </div>
  );
}

export function Money({ value }: { value: number | null | undefined }) {
  return <span className="font-bengali tabular-nums">{taka(value)}</span>;
}

const LEVEL_STYLE: Record<Warning['level'], { box: string; icon: string; label: string }> = {
  blocker: { box: 'border-danger/30 bg-danger/5', icon: 'text-danger', label: 'থামুন' },
  warning: { box: 'border-warning/35 bg-warning/5', icon: 'text-warning', label: 'সতর্কতা' },
  info: { box: 'border-border bg-surface-sunken', icon: 'text-ink-subtle', label: 'তথ্য' },
};

export function Warnings({ items, title }: { items: readonly Warning[]; title?: string }) {
  if (items.length === 0) return null;
  const order: Warning['level'][] = ['blocker', 'warning', 'info'];
  const sorted = [...items].sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
  return (
    <div className="space-y-2">
      {title ? <h3 className="text-subheading text-ink">{title}</h3> : null}
      {sorted.map((w, i) => {
        const style = LEVEL_STYLE[w.level];
        return (
          <div key={`${w.code}-${i}`} className={`rounded-control border px-3.5 py-3 ${style.box}`}>
            <div className="flex gap-2.5">
              <span aria-hidden="true" className={`mt-0.5 shrink-0 text-small ${style.icon}`}>
                {w.level === 'info' ? 'ⓘ' : '⚠'}
              </span>
              <div className="min-w-0">
                <span className="sr-only">{style.label}: </span>
                <p className="text-small text-ink">{w.message}</p>
                {w.action ? <p className="mt-1 text-small text-ink-muted">{w.action}</p> : null}
                {w.source ? <Source source={w.source} compact /> : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Source({ source, compact = false }: { source: SourceRef; compact?: boolean }) {
  if (!source.verified) {
    return (
      <p className={`${compact ? 'mt-1' : 'mt-2'} text-micro text-warning`}>
        সূত্র নিশ্চিতভাবে যাচাই করা যায় নাই — {source.label}
      </p>
    );
  }
  return (
    <p className={`${compact ? 'mt-1' : 'mt-2'} text-micro text-ink-subtle`}>
      সূত্র: {citationLine(source)}
    </p>
  );
}

const CERTAINTY_LABEL: Record<Certainty, { text: string; className: string }> = {
  GAZETTE: { text: 'গেজেটে উল্লিখিত', className: 'border-success/30 bg-success/10 text-success' },
  DERIVED: { text: 'গেজেটের সংখ্যা হইতে গণনাকৃত', className: 'border-accent/30 bg-accent-soft text-accent-ink' },
  ASSUMPTION: { text: 'ঘোষিত অনুমান', className: 'border-warning/35 bg-warning/10 text-warning' },
  UNDETERMINED: { text: 'গেজেটে নির্ধারিত নয়', className: 'border-danger/30 bg-danger/10 text-danger' },
};

export function CertaintyTag({ value }: { value: Certainty }) {
  const style = CERTAINTY_LABEL[value];
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-micro ${style.className}`}>
      {style.text}
    </span>
  );
}

/** The statutory disclaimer. Present on every page that shows a figure. */
export function Disclaimer() {
  return (
    <aside className="ps-disclaimer mt-10 rounded-card border border-border bg-surface-sunken px-4 py-3.5">
      <h2 className="text-small font-semibold text-ink">দ্রষ্টব্য</h2>
      <p className="mt-1.5 text-small text-ink-muted">
        এই ক্যালকুলেটরটি সরকারি ওয়েবসাইট নয়। এটি প্রকাশিত গেজেটের তথ্য ও নিয়মের
        ভিত্তিতে হিসাব প্রদানের জন্য তৈরি। চূড়ান্ত বেতন, Pay Fixation, Allowance এবং
        অন্যান্য আর্থিক সুবিধা সংশ্লিষ্ট কর্তৃপক্ষের অফিসিয়াল আদেশ/নির্ধারণ অনুযায়ী
        কার্যকর হইবে।
      </p>
      <p className="mt-2 text-micro text-ink-subtle">
        অনুচ্ছেদ ৩২(১০) অনুযায়ী সংশ্লিষ্ট হিসাবরক্ষণ অফিস চূড়ান্তভাবে প্রতিপাদনকৃত
        ‘বেতন নির্ধারণী বিবরণী’-এর ভিত্তিতে বেতন পরিশোধ করিবে।
      </p>
    </aside>
  );
}

export function Field({
  label, hint, htmlFor, children, required = false,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-small font-medium text-ink">
        {label}
        {required ? <span className="ml-0.5 text-danger" aria-hidden="true">*</span> : null}
      </label>
      {hint ? <p className="mt-0.5 text-micro text-ink-subtle">{hint}</p> : null}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export const inputClass =
  'w-full rounded-control border border-border bg-surface px-3 py-2.5 font-bengali text-body '
  + 'text-ink tabular-nums outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20';

export const selectClass =
  'w-full rounded-control border border-border bg-surface px-3 py-2.5 text-body text-ink '
  + 'outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20';

export const buttonClass =
  'inline-flex items-center justify-center rounded-control bg-accent px-5 py-2.5 text-body '
  + 'font-medium text-ink-inverted transition hover:bg-accent-hover focus:outline-none '
  + 'focus:ring-2 focus:ring-accent/30 disabled:opacity-50';

export const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-control border border-border bg-surface '
  + 'px-4 py-2 text-small font-medium text-ink transition hover:border-border-strong';
