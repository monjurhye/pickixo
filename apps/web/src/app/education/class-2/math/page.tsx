import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { MathApp } from '@/components/class2/math/MathApp';
import { getCurrentUser } from '@/lib/session';
import {
  buildMetadata, jsonLd, breadcrumbSchema, softwareApplicationSchema,
} from '@/lib/seo';
import { bn } from '@/lib/class2/bnNumerals';
import type { Chapter } from '@/data/class2/math/schema';
import chapter01 from '@/data/class2/math/chapter01.json';
import chapter02 from '@/data/class2/math/chapter02.json';
import chapter03 from '@/data/class2/math/chapter03.json';
import chapter04 from '@/data/class2/math/chapter04.json';
import chapter05 from '@/data/class2/math/chapter05.json';
import chapter06 from '@/data/class2/math/chapter06.json';
import chapter07 from '@/data/class2/math/chapter07.json';

/**
 * Class 2 Maths — "প্রাথমিক গণিত, দ্বিতীয় শ্রেণি" (NCTB).
 *
 * Same reasoning as the English page: content ships as JSON at build time, so
 * a topic loads with the page rather than behind a spinner.
 */

const TITLE = 'দ্বিতীয় শ্রেণির গণিত – শিখি, খেলি, অনুশীলন করি';
const DESCRIPTION =
  'দ্বিতীয় শ্রেণির জন্য বিনামূল্যে ইন্টারেক্টিভ গণিত পাঠ, জাতীয় শিক্ষাক্রম ও '
  + 'পাঠ্যপুস্তক বোর্ডের "প্রাথমিক গণিত" বই অনুসরণ করে। রুক (ব্লক) দেখে গণনা, '
  + 'সংখ্যা তুলনা, যোগ-বিয়োগ ও আরও অনেক কিছু।';

export const metadata: Metadata = buildMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/education/class-2/math',
});

/**
 * Same cast reason as the English page: an imported JSON file never
 * structurally satisfies the schema's union types, and the content is
 * checked for real by `validateChapter` in content.test.mjs.
 */
const CHAPTERS = [chapter01, chapter02, chapter03, chapter04, chapter05, chapter06, chapter07] as unknown as Chapter[];

const FAQ = [
  {
    q: 'এই অ্যাপটি কোন বই অনুসরণ করে?',
    a: 'প্রাথমিক গণিত, দ্বিতীয় শ্রেণি — জাতীয় শিক্ষাক্রম ও পাঠ্যপুস্তক বোর্ড, '
       + 'বাংলাদেশ প্রকাশিত। অধ্যায়, পাঠ ও উদাহরণ বইয়ের অনুসরণেই তৈরি।',
  },
  {
    q: 'আমার সন্তানের পড়তে জানতে হবে কি?',
    a: 'না। প্রতিটি সংখ্যা, প্রশ্ন ও নির্দেশে 🔊 বাটন আছে, আর প্রতিটি সংখ্যাই '
       + 'রুক (ব্লক) দিয়ে ছবির মতো দেখানো হয়েছে।',
  },
  {
    q: 'ভুল উত্তর দিলে কী হয়?',
    a: 'কখনো "ভুল" বলা হয় না। শব্দটি আবার শোনানো হয়, একটি ইঙ্গিত দেখানো হয়, '
       + 'আর শিশু আরেকবার চেষ্টা করে। দ্বিতীয়বার ভুল হলে সঠিক উত্তর দেখানো হয়, '
       + 'যাতে কেউ আটকে না থাকে।',
  },
  {
    q: 'অগ্রগতি কি সংরক্ষিত থাকে?',
    a: 'হ্যাঁ, ব্যবহৃত ডিভাইসের ব্রাউজারে সংরক্ষিত থাকে, তাই অ্যাকাউন্ট ছাড়াই '
       + 'তারা ও শেখা সংখ্যাগুলো পরের বার দেখা যায়।',
  },
];

export default async function Class2MathPage() {
  const user = await getCurrentUser();
  const topicCount = CHAPTERS.reduce((n, c) => n + c.topics.length, 0);
  const numberCount = CHAPTERS.reduce(
    (n, c) => n + c.topics.reduce((m, t) => m + t.numbers.length, 0), 0,
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbSchema([
              { name: 'Home', path: '/' },
              { name: 'Education', path: '/education' },
              { name: 'দ্বিতীয় শ্রেণির গণিত', path: '/education/class-2/math' },
            ]),
            softwareApplicationSchema({
              name: 'Pickixo Class 2 Maths',
              description: DESCRIPTION,
              url: '/education/class-2/math',
              category: 'EducationalApplication',
            }),
          ),
        }}
      />

      <SiteHeader user={user} />

      <main id="main">
        <MathApp chapters={CHAPTERS} />

        <section className="mx-auto mt-16 max-w-3xl border-t border-border px-4 py-10">
          <nav aria-label="Breadcrumb" className="text-small text-ink-subtle">
            <Link href="/" className="hover:text-ink">Home</Link>
            <span className="mx-1.5">›</span>
            <Link href="/education" className="hover:text-ink">Education</Link>
            <span className="mx-1.5">›</span>
            <span className="text-ink-muted">দ্বিতীয় শ্রেণির গণিত</span>
          </nav>

          <h1 className="mt-4 text-title text-ink">দ্বিতীয় শ্রেণির গণিত</h1>
          <p className="mt-3 text-body text-ink-muted">
            <em>প্রাথমিক গণিত, দ্বিতীয় শ্রেণি</em> বই অনুসরণ করে তৈরি ইন্টারেক্টিভ
            পাঠ — জাতীয় শিক্ষাক্রম ও পাঠ্যপুস্তক বোর্ড, বাংলাদেশে ব্যবহৃত বই।
            প্রতিটি সংখ্যা রুক (ব্লক) দিয়ে দেখানো হয়, শোনা যায়, আর খেলার মধ্য
            দিয়ে অনুশীলন করা যায়।
          </p>

          <p className="mt-3 text-body text-ink-muted">
            এখন {bn(topicCount)}টি পাঠ ও {bn(numberCount)}টি সংখ্যা আছে। বইয়ের ক্রম
            অনুসরণ করে আরও অধ্যায় যোগ করা হবে।
          </p>

          <h2 className="mt-10 text-heading text-ink">প্রশ্ন</h2>
          <div className="mt-4 divide-y divide-border border-y border-border">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="cursor-pointer list-none text-subheading text-ink
                                    marker:hidden">
                  <span className="flex items-start justify-between gap-4">
                    {item.q}
                    <span aria-hidden="true"
                          className="shrink-0 text-ink-subtle transition-transform
                                     group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-2 text-body text-ink-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
