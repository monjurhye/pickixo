import type { Metadata } from 'next';
import Link from 'next/link';
import { SalaryCalculator } from '@/components/payscale/SalaryCalculator';
import { PayScaleShell, Faq } from '@/components/payscale/PayScaleShell';
import { MythBusters } from '@/components/payscale/BenefitAdjustment';
import { MAIN_FAQ } from '@/lib/payscale/faq';
import { gradeLabel } from '@/lib/payscale/format';
import {
  absoluteUrl, breadcrumbSchema, buildMetadata, jsonLd, softwareApplicationSchema,
} from '@/lib/seo';

/**
 * The main calculator.
 *
 * Client-side only for the arithmetic: nothing anyone types — grade, basic
 * pay, what they draw as a special benefit — is sent to a server, because none
 * of it needs to be. The engine and both pay scales ship to the browser.
 */

const PATH = '/salary-calculator';
const TITLE = 'জাতীয় বেতনস্কেল ২০২৬ — বেতন কত বাড়বে? | সরকারি বেতন ক্যালকুলেটর';
const DESCRIPTION =
  'গেজেট-ভিত্তিক সরকারি বেতন ক্যালকুলেটর। চাকরি (বেতন ও ভাতাদি) আদেশ, ২০২৬ অনুযায়ী '
  + 'গ্রেড ১–২০ এর বেতন নির্ধারণ, ধাপ, বার্ষিক বেতনবৃদ্ধি ও ৪০%/৫০% পর্যায়ক্রমিক প্রদানের '
  + 'হিসাব — প্রতিটি ধাপের ব্যাখ্যা ও গেজেট সূত্রসহ।';

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

type Props = { searchParams?: Record<string, string | string[] | undefined> };

export default function Page({ searchParams }: Props) {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (typeof value === 'string') query[key] = value;
    else if (Array.isArray(value) && value[0] !== undefined) query[key] = value[0];
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbSchema([
              { name: 'হোম', path: '/' },
              { name: 'সরকারি বেতন ক্যালকুলেটর', path: PATH },
            ]),
            softwareApplicationSchema({
              name: 'জাতীয় বেতনস্কেল ২০২৬ ক্যালকুলেটর',
              description: DESCRIPTION,
              url: PATH,
              category: 'FinanceApplication',
            }),
            {
              '@type': 'FAQPage',
              '@id': `${absoluteUrl(PATH)}#faq`,
              mainEntity: MAIN_FAQ.map((item) => ({
                '@type': 'Question',
                name: item.q,
                acceptedAnswer: { '@type': 'Answer', text: item.a },
              })),
            },
          ),
        }}
      />

      <PayScaleShell
        title="জাতীয় বেতনস্কেল ২০২৬"
        crumb="বেতন ক্যালকুলেটর"
        activeHref={PATH}
        lead={
          <>
            আপনার বেতন কত বাড়বে? চাকরি (বেতন ও ভাতাদি) আদেশ, ২০২৬ — এস. আর. ও. নং
            ৩৪৭-আইন/২০২৬, ১৭ সেপ্টেম্বর ২০২৬ — এর অনুচ্ছেদ ৫ ও ৯ অনুযায়ী হিসাব।
            কোনও শতাংশ অনুমান করা হয় না; গেজেটের ধাপ ধরিয়াই নির্ধারণ হয়।
          </>
        }
      >
        <SalaryCalculator initialQuery={query} />

        <section aria-labelledby="how-heading" className="ps-no-print mt-12">
          <h2 id="how-heading" className="text-heading text-ink">কীভাবে হিসাব হয়</h2>
          <ol className="mt-4 space-y-3">
            {[
              'অনুচ্ছেদ ৩(১) এর সারণি হইতে আপনার গ্রেডের ২০১৫ স্কেল ও উহার অনুরূপ ২০২৬ স্কেল বাহির করা হয়।',
              'অনুচ্ছেদ ৫(ক): প্রারম্ভিক ধাপে থাকিলে অনুরূপ স্কেলের প্রারম্ভিক ধাপে নির্ধারণ।',
              'অনুচ্ছেদ ৫(খ): উচ্চতর ধাপে থাকিলে ধাপের পার্থক্য ২০২৬ স্কেলের প্রারম্ভিক ধাপের সহিত যোগ; সমান ধাপ থাকিলে সেই ধাপে, না থাকিলে পরবর্তী উচ্চতর ধাপে।',
              'অনুচ্ছেদ ৯(২): নির্ধারণের পর ১ জুলাই ২০২৬ তারিখে ১টি বার্ষিক বেতনবৃদ্ধি।',
              'অনুচ্ছেদ ১(৩): বৃদ্ধির অঙ্কের ৪০%/৫০%, পরে ৭০%/৭৫%, এবং ১ জুলাই ২০২৭ হইতে শতভাগ।',
              'অনুচ্ছেদ ১০: ১ জুলাই ২০২৬ বা তাহার পরে নূতন নিয়োগে ২০২৬ স্কেলের প্রারম্ভিক ধাপ; ৯ম গ্রেড ও তদূর্ধ্বে ডিগ্রি/লাইসেন্সভেদে ১–২টি অগ্রিম বেতনবৃদ্ধি (বিসিএস ক্যাডার ৯ম গ্রেডে আরও ১টি)।',
            ].map((text, index) => (
              <li key={text} className="flex gap-3 text-body text-ink-muted">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                             bg-accent-soft text-micro font-semibold text-accent-ink tabular-nums"
                >
                  {['১', '২', '৩', '৪', '৫', '৬'][index]}
                </span>
                {text}
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="myth-heading" className="ps-no-print mt-12">
          <h2 id="myth-heading" className="text-heading text-ink">যে ধারণাগুলি গেজেট সমর্থন করে না</h2>
          <p className="mt-2 text-body text-ink-muted">
            ২০১৫ স্কেলের ১০%/১৫% সুবিধা নিয়া সবচেয়ে বেশি ভুল বোঝাবুঝি হয়, আর ইহা
            কয়েক হাজার টাকার পার্থক্য তৈরি করে। তাই গেজেটে আসলে কী আছে তাহা এখানে স্পষ্ট করা হইল।
          </p>
          <div className="mt-4"><MythBusters /></div>
        </section>

        <Faq items={MAIN_FAQ} />

        <section aria-labelledby="more-heading" className="ps-no-print mt-12">
          <h2 id="more-heading" className="text-heading text-ink">গ্রেড অনুযায়ী বেতন</h2>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 20 }, (_, i) => i + 1).map((grade) => (
              <li key={grade}>
                <Link
                  href={`/grade-${grade}-salary`}
                  className="block rounded-control border border-border bg-surface px-3 py-2
                             text-small text-ink-muted transition hover:border-border-strong hover:text-ink"
                >
                  {gradeLabel(grade)} এর বেতন
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </PayScaleShell>
    </>
  );
}
