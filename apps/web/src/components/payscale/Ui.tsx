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
    <div className={`rounded-card border border-border bg-surface p-4 shadow-card sm:p-6 ${className}`}>
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
      <label htmlFor={htmlFor} className="block text-small font-semibold text-ink">
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
  'inline-flex min-h-[2.75rem] items-center justify-center rounded-control bg-accent px-6 py-2.5 text-body '
  + 'font-medium text-ink-inverted transition hover:bg-accent-hover focus:outline-none '
  + 'focus:ring-2 focus:ring-accent/30 disabled:opacity-50';

export const secondaryButtonClass =
  'inline-flex min-h-[2.75rem] items-center justify-center rounded-control border border-border bg-surface '
  + 'px-4 py-2 text-small font-medium text-ink transition hover:border-border-strong hover:bg-surface-sunken';

/**
 * A declaration for the one reading in the calculator that the Gazette does not
 * settle: ১(৩)(গ), "বার্ষিক বেতনবৃদ্ধিসহ মূল বেতন শতভাগ" from 1 July 2027.
 * It says what was assumed and sends the reader to the source to check.
 */
export function PhaseThreeDeclaration({ amount }: { amount?: number | null }) {
  return (
    <aside className="mt-4 rounded-control border border-warning/35 bg-warning/5 px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-small font-semibold text-ink">ঘোষণা: ১ জুলাই ২০২৭ এর বেতন — ব্যাখ্যা-সাপেক্ষ</h4>
        <CertaintyTag value="ASSUMPTION" />
      </div>
      <p className="mt-1.5 text-small text-ink-muted">
        অনুচ্ছেদ ১(৩)(গ) বলিয়াছে, ১ জুলাই ২০২৭ হইতে “বার্ষিক বেতনবৃদ্ধি (increment)সহ মূল বেতন শতভাগ”
        প্রদান করা হইবে। গেজেটে ইহার কোনও টাকার অঙ্ক বা উদাহরণ নাই। এই ক্যালকুলেটর ইহার অর্থ ধরিয়াছে:
        নিয়মিত বার্ষিক বেতনবৃদ্ধি চলমান থাকিবে, এবং ঐ তারিখ হইতে মূল বেতন ২০২৬ স্কেলে নির্ধারিত
        {amount ? ` ${taka(amount)}` : ' অঙ্কে'} পূর্ণ (১০০%) হারে প্রদেয়। ইহা একটি ব্যাখ্যা, গেজেটের সুস্পষ্ট বিধান নয়।
      </p>
      <p className="mt-1.5 text-small text-ink">
        ভিন্ন হইলে মূল গেজেট দেখুন: এস. আর. ও. নং ৩৪৭-আইন/২০২৬, অনুচ্ছেদ ১(৩)(গ), গেজেট পৃষ্ঠা ২৫১৯৪
        (PDF পৃষ্ঠা ২)। চূড়ান্ত বেতন সংশ্লিষ্ট হিসাবরক্ষণ অফিসের বেতন নির্ধারণী বিবরণী অনুযায়ীই হইবে।
      </p>
    </aside>
  );
}

/** Two-way switch between calculators. A segmented control rather than two
 *  loose buttons, so it reads as "one control, pick a side". */
export function ModeSwitch<T extends string>({
  value, onChange, options, label,
}: {
  value: T;
  onChange: (next: T) => void;
  options: readonly { value: T; title: string; sub: string }[];
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label}
         className="ps-no-print grid grid-cols-2 gap-1 rounded-card border border-border bg-surface-sunken p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`rounded-control px-3 py-2.5 text-center transition ${
              active
                ? 'bg-surface shadow-card ring-1 ring-border-strong'
                : 'hover:bg-surface/60'
            }`}
          >
            <span className={`block text-small font-semibold ${active ? 'text-accent-ink' : 'text-ink-muted'}`}>
              {o.title}
            </span>
            <span className="mt-0.5 block text-micro text-ink-subtle">{o.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The one number a result is about, large, with the comparison underneath.
 *  Everything else on the card is supporting detail, and looks like it. */
export function ResultHero({
  eyebrow, badge, value, caption, compare, footer, children,
}: {
  eyebrow: string;
  badge?: string;
  value: ReactNode;
  caption?: string;
  compare?: ReactNode;
  footer?: readonly { label: string; value: ReactNode; hint?: ReactNode }[];
  children?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-accent/25 bg-surface shadow-card">
      <div className="bg-accent-soft px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-small font-semibold text-accent-ink">{eyebrow}</p>
          {badge ? (
            <span className="rounded-full border border-accent/25 bg-surface px-2.5 py-0.5 text-micro font-medium text-accent-ink">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="mt-2 font-bengali text-display tabular-nums text-accent-ink">{value}</p>
        {caption ? <p className="mt-1 text-small text-ink-muted">{caption}</p> : null}
        {compare ? (
          <div className="mt-4 flex flex-col items-start gap-1.5 text-small sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2">
            {compare}
          </div>
        ) : null}
      </div>
      {footer && footer.length > 0 ? (
        <dl className={`grid divide-y divide-border border-t border-border sm:divide-x sm:divide-y-0 ${
          footer.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
        }`}>
          {footer.map((f) => (
            <div key={f.label} className="px-4 py-3.5 sm:px-6">
              <dt className="text-micro text-ink-subtle">{f.label}</dt>
              <dd className="mt-0.5 font-bengali text-subheading tabular-nums text-ink">{f.value}</dd>
              {f.hint ? <p className="mt-0.5 text-micro text-ink-subtle">{f.hint}</p> : null}
            </div>
          ))}
        </dl>
      ) : null}
      {children ? <div className="border-t border-border px-4 py-4 sm:px-6">{children}</div> : null}
    </div>
  );
}
