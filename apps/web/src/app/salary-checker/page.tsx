import type { Metadata } from 'next';
import { PayScaleShell } from '@/components/payscale/PayScaleShell';
import { CalculationChecker } from '@/components/payscale/CalculationChecker';
import { Card, SectionHeading } from '@/components/payscale/Ui';
import { breadcrumbSchema, buildMetadata, jsonLd } from '@/lib/seo';

const PATH = '/salary-checker';
const TITLE = 'আমার বেতন ঠিক আছে কি? — বেতন নির্ধারণ যাচাই ২০২৬';
const DESCRIPTION =
  'আপনাকে জানানো ২০২৬ সালের মূল বেতনের সহিত গেজেট-ভিত্তিক হিসাব মিলাইয়া দেখুন। '
  + 'পার্থক্য পাওয়া গেলে সম্ভাব্য কারণ ও করণীয় জানানো হয়।';

export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbSchema([
            { name: 'হোম', path: '/' },
            { name: 'বেতন যাচাই', path: PATH },
          ])),
        }}
      />

      <PayScaleShell
        title="আমার বেতন ঠিক আছে কি?"
        crumb="বেতন যাচাই"
        activeHref={PATH}
        lead="আপনার ২০১৫ স্কেলের মূল বেতন এবং আপনাকে জানানো ২০২৬ সালের মূল বেতন দিন — দুইটি অঙ্ক মিলে কি না দেখুন।"
      >
        <Card className="mb-5">
          <h2 className="text-subheading text-ink">এই যাচাই কী বলে, আর কী বলে না</h2>
          <ul className="mt-2 space-y-2 text-small text-ink-muted">
            <li className="flex gap-2">
              <span aria-hidden="true" className="mt-0.5 shrink-0 text-success">✓</span>
              <span>গেজেটের অনুচ্ছেদ ৫ ও ৯ অনুযায়ী আপনার গ্রেড ও মূল বেতনের ভিত্তিতে প্রত্যাশিত অঙ্ক দেখায়।</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="mt-0.5 shrink-0 text-danger">✗</span>
              <span>
                ইহা বলে না যে সরকার বা অফিস ভুল করিয়াছে। এই ক্যালকুলেটর আপনার উচ্চতর গ্রেড,
                অগ্রিম বেতনবৃদ্ধি বা পদোন্নতির তথ্য জানে না — আর এই সবই পার্থক্যের সাধারণ কারণ।
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="mt-0.5 shrink-0 text-ink-subtle">ⓘ</span>
              <span>
                চূড়ান্ত বেতন নির্ধারণ হিসাবরক্ষণ অফিসের প্রতিপাদনকৃত ‘বেতন নির্ধারণী বিবরণী’
                অনুযায়ী হইবে (অনুচ্ছেদ ৩২)।
              </span>
            </li>
          </ul>
        </Card>

        <CalculationChecker />

        <section aria-labelledby="diff-heading" className="mt-12">
          <SectionHeading id="diff-heading" sub="পার্থক্য পাওয়া গেলে এই বিষয়গুলি যাচাই করুন">
            পার্থক্যের সাধারণ কারণ
          </SectionHeading>
          <ol className="space-y-2.5">
            {[
              'আপনি ২০১৫ স্কেলে উচ্চতর গ্রেড, সিলেকশন গ্রেড বা টাইম স্কেল পাইয়াছেন — সেই ক্ষেত্রে গ্রেড ভিন্ন হইবে (অনুচ্ছেদ ২(ঘ) ও ৪)।',
              'প্রথম নিয়োগে অগ্রিম বেতনবৃদ্ধি পাইয়াছেন — এমবিবিএস, ইঞ্জিনিয়ারিং, আর্কিটেকচার, আইন বা বিসিএস ক্যাডার (অনুচ্ছেদ ১০)।',
              '১ জুলাই ২০২৬ তারিখে পদোন্নতি হইয়াছে — প্রথমে নিম্নপদে, পরে পদোন্নতিপ্রাপ্ত পদে নির্ধারণ (অনুচ্ছেদ ৫(ঘ))।',
              '৩০ জুন ২০২৬ তারিখের মূল বেতনের অঙ্কে ভুল — সার্ভিস বহি ও সর্বশেষ বেতন বিল মিলাইয়া দেখুন।',
              'আপনার দেওয়া অঙ্ক অনুচ্ছেদ ৫ অনুযায়ী নির্ধারিত বেতন, কিন্তু অনুচ্ছেদ ৯(২) এর বেতনবৃদ্ধি এখনও যোগ হয় নাই (বা উল্টাটা)।',
              'নতুন যোগদানকারী হিসাবে কোয়ালিফাইং চাকরি ৬ মাসের কম — তখন বেতনবৃদ্ধি প্রাপ্য নহেন।',
            ].map((text, index) => (
              <li key={text} className="flex gap-3 text-body text-ink-muted">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                             bg-surface-sunken text-micro font-semibold text-ink-muted tabular-nums"
                >
                  {['১', '২', '৩', '৪', '৫', '৬'][index]}
                </span>
                {text}
              </li>
            ))}
          </ol>
        </section>
      </PayScaleShell>
    </>
  );
}
