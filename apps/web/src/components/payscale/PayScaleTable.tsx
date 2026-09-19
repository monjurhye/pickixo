import Link from 'next/link';
import { PAY_SCALE_2015, PAY_SCALE_2026 } from '@/lib/payscale/payScale';
import { gradeLabel, taka, toBnDigits } from '@/lib/payscale/format';
import { Source } from './Ui';
import { REF } from '@/lib/payscale/sourceReference';

/**
 * অনুচ্ছেদ ৩(১) reproduced: every grade, both scales, every step.
 *
 * The full step list is shown rather than just the range, because the range is
 * not enough to fix anyone's pay — the whole method in অনুচ্ছেদ ৫ turns on which
 * printed step an amount lands on or above.
 */
export function PayScaleTable({ highlightGrade }: { highlightGrade?: number }) {
  return (
    <div>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[44rem] border-collapse text-small">
          <caption className="sr-only">
            জাতীয় বেতনস্কেল ২০১৫ ও ২০২৬ — গ্রেড অনুযায়ী প্রতিটি ধাপ
          </caption>
          <thead>
            <tr className="border-b border-border-strong text-left text-micro text-ink-subtle">
              <th scope="col" className="py-2.5 pr-3 font-medium">গ্রেড</th>
              <th scope="col" className="py-2.5 pr-3 font-medium">
                জাতীয় বেতনস্কেল, ২০১৫<span className="block font-normal">(বর্তমান বেতনস্কেল)</span>
              </th>
              <th scope="col" className="py-2.5 font-medium">
                জাতীয় বেতনস্কেল, ২০২৬<span className="block font-normal">(১ জুলাই ২০২৬ হইতে কার্যকর অনুরূপ স্কেল)</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {PAY_SCALE_2026.grades.map((fresh) => {
              const old = PAY_SCALE_2015.grades.find((g) => g.grade === fresh.grade);
              const active = highlightGrade === fresh.grade;
              return (
                <tr
                  key={fresh.grade}
                  className={`border-b border-border align-top last:border-0 ${active ? 'bg-accent-soft' : ''}`}
                >
                  <th scope="row" className="py-3 pr-3 text-left font-medium text-ink">
                    <Link href={`/grade-${fresh.grade}-salary`} className="hover:text-accent-ink hover:underline">
                      {toBnDigits(fresh.grade)}
                    </Link>
                  </th>
                  <td className="py-3 pr-3 font-bengali tabular-nums text-ink-muted">
                    {old ? (old.fixed
                      ? `টাকা ${toBnDigits(old.minimum)} (নির্ধারিত)`
                      : `টাকা ${old.steps.map((s) => toBnDigits(s)).join('-')}`) : '—'}
                  </td>
                  <td className="py-3 font-bengali tabular-nums text-ink">
                    {fresh.fixed
                      ? `টাকা ${toBnDigits(fresh.minimum)} (নির্ধারিত)`
                      : `টাকা ${fresh.steps.map((s) => toBnDigits(s)).join('-')}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Source source={REF.correspondingScale} />
    </div>
  );
}

/** অনুচ্ছেদ ৩(২) — the two posts whose pay is fixed outside the grade table. */
export function FixedPayPosts() {
  return (
    <div className="space-y-2">
      {(PAY_SCALE_2026.specialFixedPay ?? []).map((post) => (
        <div key={post.id}
             className="flex flex-col gap-1 rounded-control border border-border bg-surface-sunken p-3.5
                        sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <span className="text-small text-ink">{post.posts}</span>
          <span className="font-bengali text-small tabular-nums font-medium text-ink">
            {taka(post.amount)} (নির্ধারিত)
          </span>
        </div>
      ))}
      <p className="text-small text-ink-muted">
        অনুচ্ছেদ ৫(গ): এই পদসমূহের ক্ষেত্রে অনুচ্ছেদ ৫ এর দফা (ক) ও (খ) — অর্থাৎ ধাপভিত্তিক
        নির্ধারণ পদ্ধতি — প্রযোজ্য হইবে না।
      </p>
    </div>
  );
}

/** One grade's two scales, side by side, for a grade landing page. */
export function GradeScaleDetail({ grade }: { grade: number }) {
  const old = PAY_SCALE_2015.grades.find((g) => g.grade === grade);
  const fresh = PAY_SCALE_2026.grades.find((g) => g.grade === grade);
  if (!old || !fresh) return null;

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[26rem] border-collapse text-small">
        <caption className="sr-only">{gradeLabel(grade)} — ধাপ অনুযায়ী তুলনা</caption>
        <thead>
          <tr className="border-b border-border-strong text-left text-micro text-ink-subtle">
            <th scope="col" className="py-2 pr-3 font-medium">ধাপ</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">২০১৫ স্কেল</th>
            <th scope="col" className="py-2 text-right font-medium">২০২৬ স্কেল</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.max(old.stepCount, fresh.stepCount) }, (_, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              <th scope="row" className="py-2 pr-3 text-left font-normal text-ink-muted tabular-nums">
                {toBnDigits(i + 1)}
              </th>
              <td className="py-2 pr-3 text-right font-bengali tabular-nums text-ink-muted">
                {old.steps[i] !== undefined ? taka(old.steps[i] as number) : '—'}
              </td>
              <td className="py-2 text-right font-bengali tabular-nums text-ink">
                {fresh.steps[i] !== undefined ? taka(fresh.steps[i] as number) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
