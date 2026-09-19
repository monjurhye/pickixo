import type { Metadata } from 'next';
import { PayScaleShell } from '@/components/payscale/PayScaleShell';
import { SalaryComparison } from '@/components/payscale/SalaryComparison';
import { PayScaleTable } from '@/components/payscale/PayScaleTable';
import { Card, SectionHeading } from '@/components/payscale/Ui';
import { PAY_SCALE_2015, PAY_SCALE_2026 } from '@/lib/payscale/payScale';
import { percentBn, taka, toBnDigits } from '@/lib/payscale/format';
import { breadcrumbSchema, buildMetadata, jsonLd } from '@/lib/seo';

const PATH = '/2015-vs-2026-pay-scale';
const TITLE = '২০১৫ বনাম ২০২৬ বেতন স্কেল — গ্রেড অনুযায়ী পার্থক্য';
const DESCRIPTION =
  'জাতীয় বেতনস্কেল ২০১৫ ও ২০২৬ এর তুলনা — গ্রেড ১ থেকে ২০ পর্যন্ত প্রারম্ভিক ও সর্বোচ্চ '
  + 'বেতনের পার্থক্য, শতকরা বৃদ্ধি, এবং আপনার নিজের বেতনের মাসিক ও বার্ষিক পার্থক্য।';

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

export default function Page() {
  const rows = PAY_SCALE_2026.grades.map((fresh) => {
    const old = PAY_SCALE_2015.grades.find((g) => g.grade === fresh.grade);
    const minIncrease = old ? fresh.minimum - old.minimum : null;
    const minPercent = old && old.minimum > 0 ? (minIncrease! / old.minimum) * 100 : null;
    return { fresh, old, minIncrease, minPercent };
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbSchema([
            { name: 'হোম', path: '/' },
            { name: '২০১৫ বনাম ২০২৬', path: PATH },
          ])),
        }}
      />

      <PayScaleShell
        wide
        title="২০১৫ বনাম ২০২৬ বেতন স্কেল"
        crumb="২০১৫ বনাম ২০২৬"
        activeHref={PATH}
        lead="প্রারম্ভিক বেতনের তুলনা গ্রেড অনুযায়ী, এবং আপনার নিজের ধাপের জন্য বিস্তারিত পার্থক্য।"
      >
        <Card className="mb-6">
          <h2 className="text-subheading text-ink">এক নজরে</h2>
          <ul className="mt-2 space-y-1.5 text-small text-ink-muted">
            <li>• গ্রেড ১ হইতে ১১ পর্যন্ত প্রারম্ভিক বেতন ঠিক দ্বিগুণ হইয়াছে।</li>
            <li>• গ্রেড ১২ হইতে ২০ পর্যন্ত প্রারম্ভিক বেতন দ্বিগুণের বেশি বাড়িয়াছে — সর্বনিম্ন গ্রেডে সবচেয়ে বেশি (গ্রেড ২০: প্রায় ২.৪২ গুণ)।</li>
            <li>• তবে আপনার নিজের বৃদ্ধি এই শতাংশের সমান নাও হইতে পারে: অনুচ্ছেদ ৫(খ) ধাপের পার্থক্য ব্যবহার করে, তাই আপনি স্কেলের যত উপরে, বৃদ্ধির হার তত ভিন্ন।</li>
            <li>• ২০১৫ আদেশ অনুচ্ছেদ ৩৩ দ্বারা রহিত; ভাতাদি সংক্রান্ত বিধান সংগতিপূর্ণ হওয়া সাপেক্ষে বলবৎ।</li>
          </ul>
        </Card>

        <section aria-labelledby="grade-heading">
          <SectionHeading id="grade-heading" sub="প্রারম্ভিক (সর্বনিম্ন) ধাপের তুলনা">
            গ্রেড অনুযায়ী পার্থক্য
          </SectionHeading>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[40rem] border-collapse text-small">
              <thead>
                <tr className="border-b border-border-strong text-left text-micro text-ink-subtle">
                  <th scope="col" className="py-2.5 pr-3 font-medium">গ্রেড</th>
                  <th scope="col" className="py-2.5 pr-3 text-right font-medium">২০১৫ প্রারম্ভিক</th>
                  <th scope="col" className="py-2.5 pr-3 text-right font-medium">২০২৬ প্রারম্ভিক</th>
                  <th scope="col" className="py-2.5 pr-3 text-right font-medium">বৃদ্ধি</th>
                  <th scope="col" className="py-2.5 pr-3 text-right font-medium">হার</th>
                  <th scope="col" className="py-2.5 text-right font-medium">২০২৬ সর্বোচ্চ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ fresh, old, minIncrease, minPercent }) => (
                  <tr key={fresh.grade} className="border-b border-border last:border-0">
                    <th scope="row" className="py-2.5 pr-3 text-left font-medium text-ink tabular-nums">
                      {toBnDigits(fresh.grade)}
                    </th>
                    <td className="py-2.5 pr-3 text-right font-bengali tabular-nums text-ink-muted">
                      {old ? taka(old.minimum) : '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-bengali tabular-nums text-ink">
                      {taka(fresh.minimum)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-bengali tabular-nums text-ink">
                      {minIncrease === null ? '—' : taka(minIncrease)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-bengali tabular-nums text-accent-ink">
                      {minPercent === null ? '—' : percentBn(minPercent, 1)}
                    </td>
                    <td className="py-2.5 text-right font-bengali tabular-nums text-ink-muted">
                      {taka(fresh.maximum)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-small text-ink-muted">
            এই শতাংশ কেবল <span className="font-medium text-ink">প্রারম্ভিক ধাপের</span> তুলনা।
            আপনি স্কেলের উপরের ধাপে থাকিলে আপনার নিজের বৃদ্ধির হার ভিন্ন হইবে — নিচের
            ক্যালকুলেটরে নিজের ধাপ দিয়া দেখুন।
          </p>
        </section>

        <section aria-labelledby="own-heading" className="mt-12">
          <SectionHeading id="own-heading"
            sub="Basic salary increase ও Gross salary increase আলাদা করিয়া দেখানো হয় — কারণ ইহারা ভিন্ন সময়ে কার্যকর।">
            আপনার নিজের তুলনা
          </SectionHeading>
          <SalaryComparison />
        </section>

        <section aria-labelledby="full-heading" className="mt-12">
          <SectionHeading id="full-heading" sub="অনুচ্ছেদ ৩(১) এর সারণি — প্রতিটি ধাপসহ">
            সম্পূর্ণ স্কেল পাশাপাশি
          </SectionHeading>
          <PayScaleTable />
        </section>
      </PayScaleShell>
    </>
  );
}
