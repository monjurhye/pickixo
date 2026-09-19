import type { Metadata } from 'next';
import Link from 'next/link';
import { PayScaleShell } from '@/components/payscale/PayScaleShell';
import { PayScaleTable, FixedPayPosts } from '@/components/payscale/PayScaleTable';
import { GazetteSource } from '@/components/payscale/SourceReference';
import { Card, SectionHeading } from '@/components/payscale/Ui';
import { breadcrumbSchema, buildMetadata, jsonLd } from '@/lib/seo';
import allowances from '@/data/payscale/allowanceRules.json';
import pension from '@/data/payscale/pensionRules.json';
import { taka, toBnDigits } from '@/lib/payscale/format';

const PATH = '/pay-scale-2026';
const TITLE = 'জাতীয় বেতনস্কেল ২০২৬ — গ্রেড ১ থেকে ২০ এর সম্পূর্ণ স্কেল ও ধাপ';
const DESCRIPTION =
  'চাকরি (বেতন ও ভাতাদি) আদেশ, ২০২৬ এর অনুচ্ছেদ ৩(১) অনুযায়ী গ্রেড ১–২০ এর সম্পূর্ণ '
  + 'বেতনস্কেল — প্রতিটি ধাপসহ, ২০১৫ স্কেলের পাশাপাশি। সহিত বাড়ি ভাড়া, চিকিৎসা ও '
  + 'অন্যান্য ভাতার হার এবং নিট পেনশন সারণি।';

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbSchema([
            { name: 'হোম', path: '/' },
            { name: 'জাতীয় বেতনস্কেল ২০২৬', path: PATH },
          ])),
        }}
      />

      <PayScaleShell
        wide
        title="জাতীয় বেতনস্কেল, ২০২৬"
        crumb="বেতনস্কেল ২০২৬"
        activeHref={PATH}
        lead={
          <>
            অনুচ্ছেদ ৩(১) এর সারণি হুবহু — গ্রেড ১ হইতে ২০ পর্যন্ত প্রতিটি ধাপ, ২০১৫
            স্কেলের পাশাপাশি। ১ জুলাই ২০২৬ তারিখ হইতে কার্যকর।
          </>
        }
      >
        <section aria-labelledby="scale-heading">
          <SectionHeading id="scale-heading"
            sub="ডান কলামের স্কেলই আপনার গ্রেডের “অনুরূপ স্কেল” (corresponding scale)।">
            গ্রেড অনুযায়ী বেতনস্কেল
          </SectionHeading>
          <PayScaleTable />
        </section>

        <section aria-labelledby="fixed-heading" className="mt-12">
          <SectionHeading id="fixed-heading" sub="অনুচ্ছেদ ৩(২) — গ্রেড সারণির বাহিরে নির্ধারিত বেতন">
            নির্ধারিত বেতনের পদ
          </SectionHeading>
          <FixedPayPosts />
        </section>

        <section aria-labelledby="hr-heading" className="mt-12">
          <SectionHeading id="hr-heading"
            sub="অনুচ্ছেদ ১৫ — ১ জানুয়ারি ২০২৮ হইতে কার্যকর। ৩১ ডিসেম্বর ২০২৭ পর্যন্ত ৩০ জুন ২০২৬ তারিখে প্রাপ্য অঙ্কেই প্রদেয়।">
            বাড়ি ভাড়া ভাতার হার
          </SectionHeading>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[40rem] border-collapse text-small">
              <thead>
                <tr className="border-b border-border-strong text-left text-micro text-ink-subtle">
                  <th scope="col" className="py-2.5 pr-3 font-medium">গ্রেড</th>
                  {allowances.houseRent.zones.map((z) => (
                    <th key={z.id} scope="col" className="py-2.5 pr-3 font-medium">{z.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allowances.houseRent.bands.map((band) => (
                  <tr key={band.label} className="border-b border-border align-top last:border-0">
                    <th scope="row" className="py-3 pr-3 text-left font-medium text-ink">{band.label}</th>
                    <td className="py-3 pr-3 font-bengali tabular-nums text-ink">
                      মূল বেতনের {toBnDigits(band.rates.dhaka)}%
                    </td>
                    <td className="py-3 pr-3 font-bengali tabular-nums text-ink">
                      মূল বেতনের {toBnDigits(band.rates['major-city'])}%
                    </td>
                    <td className="py-3 font-bengali tabular-nums text-ink">
                      মূল বেতনের {toBnDigits(band.rates.other)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="alw-heading" className="mt-12">
          <SectionHeading id="alw-heading"
            sub="অনুচ্ছেদ ১৩–২৮। যে ভাতার হার এই গেজেটে নাই, তাহা নিচে আলাদা করিয়া বলা হইয়াছে।">
            অন্যান্য ভাতা
          </SectionHeading>

          <div className="grid gap-3 sm:grid-cols-2">
            {allowances.fixedAmountAllowances.map((a) => (
              <Card key={a.id}>
                <h3 className="text-subheading text-ink">{a.name}</h3>
                <p className="mt-0.5 text-micro text-ink-subtle">{a.sourceSection}</p>
                <div className="mt-2 space-y-1 text-small">
                  {'amount' in a && typeof a.amount === 'number' ? (
                    <p className="font-bengali tabular-nums text-ink">মাসিক {taka(a.amount)}</p>
                  ) : null}
                  {'amountPerChild' in a && typeof a.amountPerChild === 'number' ? (
                    <p className="font-bengali tabular-nums text-ink">
                      সন্তান প্রতি {taka(a.amountPerChild)}, সর্বোচ্চ {taka(a.maxAmount ?? 0)}
                    </p>
                  ) : null}
                  {'tiers' in a && Array.isArray(a.tiers)
                    ? a.tiers.map((t) => (
                        <p key={t.applies} className="text-ink-muted">
                          {t.applies} — <span className="font-bengali tabular-nums text-ink">{taka(t.amount)}</span>
                        </p>
                      ))
                    : null}
                  {'pensionerTiers' in a && Array.isArray(a.pensionerTiers) ? (
                    <div className="mt-2 border-t border-border pt-2">
                      <p className="text-micro text-ink-subtle">পেনশনভোগীদের ক্ষেত্রে</p>
                      {a.pensionerTiers.map((t) => (
                        <p key={t.applies} className="text-ink-muted">
                          {t.applies} — <span className="font-bengali tabular-nums text-ink">{taka(t.amount)}</span>
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
                {a.conditions && a.conditions.length > 0 ? (
                  <ul className="mt-2 space-y-1 border-t border-border pt-2">
                    {a.conditions.map((c) => (
                      <li key={c} className="text-micro text-ink-subtle">{c}</li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            ))}

            {allowances.percentAllowances.map((a) => (
              <Card key={a.id}>
                <h3 className="text-subheading text-ink">{a.name}</h3>
                <p className="mt-0.5 text-micro text-ink-subtle">{a.sourceSection}</p>
                <p className="mt-2 font-bengali text-small tabular-nums text-ink">
                  মূল বেতনের {toBnDigits(a.percent)}%
                  {a.frequency === 'YEARLY' ? ' — বৎসরে একবার' : ' — মাসিক'}
                </p>
                {'variants' in a && Array.isArray(a.variants) ? (
                  <ul className="mt-1.5 space-y-1">
                    {a.variants.map((v) => (
                      <li key={v.id} className="text-small text-ink-muted">
                        {v.label} — সর্বোচ্চ <span className="font-bengali tabular-nums">{taka(v.cap)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {'appliesToGrades' in a && Array.isArray(a.appliesToGrades) && a.appliesToGrades.length < 20 ? (
                  <p className="mt-1.5 text-micro text-ink-subtle">
                    প্রযোজ্য গ্রেড: {a.appliesToGrades.map((g) => toBnDigits(g)).join(', ')}
                  </p>
                ) : null}
              </Card>
            ))}
          </div>

          <Card className="mt-3 border-warning/30 bg-warning/5">
            <h3 className="text-subheading text-ink">যে ভাতার হার এই গেজেটে নাই</h3>
            <ul className="mt-2 space-y-2.5">
              {allowances.rateNotStatedInGazette.map((a) => (
                <li key={a.id}>
                  <p className="text-small font-medium text-ink">{a.name} <span className="font-normal text-ink-subtle">({a.sourceSection})</span></p>
                  <p className="text-small text-ink-muted">{a.statement}</p>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section aria-labelledby="pension-heading" className="mt-12">
          <SectionHeading id="pension-heading" sub="অনুচ্ছেদ ৮(১)(খ) — ৩০ জুন ২০২৬ তারিখে প্রাপ্ত নিট পেনশনকে ভিত্তি ধরিয়া">
            নিট পেনশন নির্ধারণ সারণি
          </SectionHeading>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[34rem] border-collapse text-small">
              <thead>
                <tr className="border-b border-border-strong text-left text-micro text-ink-subtle">
                  <th scope="col" className="py-2.5 pr-3 font-medium">৩০ জুন ২০২৬ তারিখে প্রাপ্ত নিট পেনশন</th>
                  <th scope="col" className="py-2.5 pr-3 font-medium">বৃদ্ধির হার</th>
                  <th scope="col" className="py-2.5 pr-3 font-medium">নূ্যনতম নিট পেনশন</th>
                  <th scope="col" className="py-2.5 font-medium">সর্বোচ্চ নিট পেনশন</th>
                </tr>
              </thead>
              <tbody>
                {pension.netPensionTable.slabs.map((slab) => (
                  <tr key={slab.label} className="border-b border-border last:border-0">
                    <th scope="row" className="py-2.5 pr-3 text-left font-normal text-ink">{slab.label}</th>
                    <td className="py-2.5 pr-3 font-bengali tabular-nums text-ink">{toBnDigits(slab.increasePercent)}%</td>
                    <td className="py-2.5 pr-3 font-bengali tabular-nums text-ink-muted">{taka(slab.minNetPension)}</td>
                    <td className="py-2.5 font-bengali tabular-nums text-ink-muted">{taka(slab.maxNetPension)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-small text-ink-muted">{pension.netPensionTable.proviso}</p>
        </section>

        <section aria-labelledby="source-heading" className="mt-12">
          <SectionHeading id="source-heading">উৎস ও যাচাই</SectionHeading>
          <GazetteSource />
        </section>

        <p className="mt-8 text-small text-ink-muted">
          আপনার নিজের বেতন নির্ধারণ করিতে{' '}
          <Link href="/salary-calculator" className="text-accent-ink underline underline-offset-2">
            বেতন ক্যালকুলেটর
          </Link>{' '}
          ব্যবহার করুন।
        </p>
      </PayScaleShell>
    </>
  );
}
