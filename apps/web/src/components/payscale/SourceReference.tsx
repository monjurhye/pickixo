import { EXTRACTION_METHOD, GAZETTE_SECTIONS } from '@/lib/payscale/payScale';
import { GAZETTE_META } from '@/lib/payscale/sourceReference';
import { Card } from './Ui';
import rules from '@/data/payscale/payRules2026.json';

/**
 * Where the numbers came from, and how far they can be trusted.
 *
 * This page is not decoration. The Gazette PDF's embedded font carries no
 * usable character map, so anyone who copies text out of it gets mojibake —
 * which means the figures here were recovered by a process that has to be
 * described if the result is going to be checkable. It also lists, explicitly,
 * the things the order does not settle.
 */
export function GazetteSource() {
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-subheading text-ink">উৎস</h3>
        <dl className="mt-3 space-y-1.5 text-small">
          <Row label="গেজেট" value={`${GAZETTE_META.publication}`} />
          <Row label="তারিখ" value={GAZETTE_META.gazetteDateBn} />
          <Row label="আদেশ" value={GAZETTE_META.title} />
          <Row label="প্রজ্ঞাপন" value={GAZETTE_META.sro} />
          <Row label="জারিকারী" value={GAZETTE_META.issuedBy} />
          <Row label="ক্ষমতার উৎস" value={GAZETTE_META.enablingAct} />
          <Row label="কার্যকর" value="১ জুলাই ২০২৬" />
          <Row label="পৃষ্ঠা" value={`${GAZETTE_META.printedPageRange} (PDF ${GAZETTE_META.pdfPages} পৃষ্ঠা)`} />
          <Row label="স্বাক্ষর" value={GAZETTE_META.signedBy} />
        </dl>
      </Card>

      <Card>
        <h3 className="text-subheading text-ink">সংখ্যাগুলি কীভাবে বাহির করা হইয়াছে</h3>
        <p className="mt-2 text-small text-ink-muted">{EXTRACTION_METHOD.summary}</p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-small text-ink-muted">
          {EXTRACTION_METHOD.steps.map((s) => <li key={s}>{s}</li>)}
        </ol>

        <h4 className="mt-4 text-small font-semibold text-ink">যাচাই</h4>
        <ul className="mt-2 space-y-1.5">
          {EXTRACTION_METHOD.verification.map((v) => (
            <li key={v} className="flex gap-2 text-small text-ink-muted">
              <span aria-hidden="true" className="mt-0.5 shrink-0 text-success">✓</span>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="border-warning/30 bg-warning/5">
        <h3 className="text-subheading text-ink">যাহা গেজেটে নির্ধারিত নাই</h3>
        <p className="mt-1.5 text-small text-ink-muted">
          এই বিষয়গুলিতে ক্যালকুলেটর কোনও সংখ্যা তৈরি করে না; বরং অনিশ্চয়তা জানাইয়া দেয়।
        </p>
        <ul className="mt-3 space-y-2.5">
          {rules.notEstablishedInGazette.map((item) => (
            <li key={item.topic}>
              <p className="text-small font-medium text-ink">{item.topic}</p>
              <p className="text-small text-ink-muted">{item.note}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h3 className="text-subheading text-ink">অনুচ্ছেদ-সূচি</h3>
        <div className="mt-3 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[28rem] border-collapse text-small">
            <thead>
              <tr className="border-b border-border text-left text-micro text-ink-subtle">
                <th scope="col" className="py-2 pr-3 font-medium">অনুচ্ছেদ</th>
                <th scope="col" className="py-2 pr-3 font-medium">বিষয়</th>
                <th scope="col" className="py-2 font-medium">গেজেট পৃষ্ঠা</th>
              </tr>
            </thead>
            <tbody>
              {GAZETTE_SECTIONS.map((s) => (
                <tr key={`${s.article}-${s.titleBn}`} className="border-b border-border last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-medium text-ink tabular-nums">{s.article}</th>
                  <td className="py-2 pr-3 text-ink-muted">{s.titleBn}</td>
                  <td className="py-2 font-bengali tabular-nums text-ink-subtle">{s.printedPage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-6">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="text-ink sm:text-right">{value ?? '—'}</dd>
    </div>
  );
}
