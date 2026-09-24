import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { BanglaApp } from '@/components/class2/bangla/BanglaApp';
import { getCurrentUser } from '@/lib/session';
import {
  buildMetadata, jsonLd, breadcrumbSchema, softwareApplicationSchema,
} from '@/lib/seo';
import { bn } from '@/lib/class2/bnNumerals';
import type { Chapter } from '@/data/class2/bangla/schema';
import chapter01 from '@/data/class2/bangla/chapter01.json';
import chapter02 from '@/data/class2/bangla/chapter02.json';
import chapter03 from '@/data/class2/bangla/chapter03.json';
import chapter04 from '@/data/class2/bangla/chapter04.json';
import chapter05 from '@/data/class2/bangla/chapter05.json';
import chapter06 from '@/data/class2/bangla/chapter06.json';
import chapter07 from '@/data/class2/bangla/chapter07.json';
import chapter08 from '@/data/class2/bangla/chapter08.json';

/**
 * Class 2 Bangla — "আমার বাংলা বই, দ্বিতীয় শ্রেণি" (NCTB).
 *
 * Same reasoning as the English and Maths pages: content ships as JSON at
 * build time, so a পাঠ loads with the page rather than behind a spinner.
 */

const TITLE = 'দ্বিতীয় শ্রেণির বাংলা – পড়ি, শিখি, খেলি';
const DESCRIPTION =
  'দ্বিতীয় শ্রেণির জন্য বিনামূল্যে ইন্টারেক্টিভ বাংলা পাঠ, জাতীয় শিক্ষাক্রম ও '
  + 'পাঠ্যপুস্তক বোর্ডের "আমার বাংলা বই" অনুসরণ করে। বর্ণমালা, কারচিহ্ন, '
  + 'যুক্তবর্ণ, ফলা ও রেফ, গল্প, ছড়া ও কবিতা — বইয়ের ২৯টি পাঠই আছে।';

export const metadata: Metadata = buildMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/education/class-2/bangla',
});

/**
 * Same cast reason as the English and Maths pages: an imported JSON file never
 * structurally satisfies the schema's union types, and the content is checked
 * for real by `validateChapter` in content.test.mjs.
 */
const CHAPTERS = [
  chapter01, chapter02, chapter03, chapter04,
  chapter05, chapter06, chapter07, chapter08,
] as unknown as Chapter[];

const FAQ = [
  {
    q: 'এই অ্যাপটি কোন বই অনুসরণ করে?',
    a: 'আমার বাংলা বই, দ্বিতীয় শ্রেণি — জাতীয় শিক্ষাক্রম ও পাঠ্যপুস্তক বোর্ড, '
       + 'বাংলাদেশ প্রকাশিত। বইয়ের ২৯টি পাঠই আছে, আর প্রতিটি পাঠে বইয়ের পৃষ্ঠা '
       + 'নম্বর ধরে রাখা হয়েছে যাতে মিলিয়ে দেখা যায়।',
  },
  {
    q: 'পাঠগুলো বইয়ের ক্রমে আছে কি?',
    a: 'পাঠের নম্বর বইয়েরটাই — পাঠ ১ থেকে পাঠ ২৯। তবে একই রকম পাঠগুলো আটটি '
       + 'অধ্যায়ে সাজানো হয়েছে, যেমন সব ছড়া-কবিতা একসাথে, সব গল্প একসাথে। '
       + 'প্রতিটি পাঠের পাশে বইয়ের পাঠ নম্বর লেখা আছে।',
  },
  {
    q: 'আমার সন্তানের পড়তে জানতে হবে কি?',
    a: 'না। প্রতিটি লেখা, প্রশ্ন ও বর্ণে 🔊 বাটন আছে। বর্ণমালার প্রতিটি বর্ণে '
       + 'চাপ দিলেই উচ্চারণ শোনা যায়, আর প্রতিটি প্রশ্নের সাথে ছবি থাকে।',
  },
  {
    q: 'ভুল উত্তর দিলে কী হয়?',
    a: 'কখনো "ভুল" বলা হয় না। প্রশ্নটি আবার শোনানো হয়, একটি ইঙ্গিত দেখানো হয়, '
       + 'আর শিশু আরেকবার চেষ্টা করে। দ্বিতীয়বার ভুল হলে সঠিক উত্তর দেখানো হয়, '
       + 'যাতে কেউ আটকে না থাকে।',
  },
  {
    q: 'যুক্তবর্ণগুলো ঠিক আছে তো?',
    a: 'হ্যাঁ, এবং সেটা যাচাই করা হয়। বইয়ের প্রতিটি বর্ণযোগ — যেমন ন + ধ = ন্ধ — '
       + 'পরীক্ষা করে দেখা হয় যে অংশ দুটি জোড়া দিলে সত্যিই ঐ যুক্তবর্ণটিই হয়। '
       + 'না মিললে পাঠটি প্রকাশই হয় না।',
  },
  {
    q: 'অগ্রগতি কি সংরক্ষিত থাকে?',
    a: 'হ্যাঁ, ব্যবহৃত ডিভাইসের ব্রাউজারে সংরক্ষিত থাকে, তাই অ্যাকাউন্ট ছাড়াই '
       + 'তারা ও শেখা শব্দগুলো পরের বার দেখা যায়।',
  },
];

export default async function Class2BanglaPage() {
  const user = await getCurrentUser();
  const lessonCount = CHAPTERS.reduce((n, c) => n + c.lessons.length, 0);
  const wordCount = CHAPTERS.reduce(
    (n, c) => n + c.lessons.reduce((m, l) => m + l.words.length, 0), 0,
  );
  const buildCount = CHAPTERS.reduce(
    (n, c) => n + c.lessons.reduce((m, l) => m + l.builds.length, 0), 0,
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
              { name: 'দ্বিতীয় শ্রেণির বাংলা', path: '/education/class-2/bangla' },
            ]),
            softwareApplicationSchema({
              name: 'Pickixo Class 2 Bangla',
              description: DESCRIPTION,
              url: '/education/class-2/bangla',
              category: 'EducationalApplication',
            }),
          ),
        }}
      />

      <SiteHeader user={user} />

      <main id="main">
        <BanglaApp chapters={CHAPTERS} />

        <section className="mx-auto mt-16 max-w-3xl border-t border-border px-4 py-10">
          <nav aria-label="Breadcrumb" className="text-small text-ink-subtle">
            <Link href="/" className="hover:text-ink">Home</Link>
            <span className="mx-1.5">›</span>
            <Link href="/education" className="hover:text-ink">Education</Link>
            <span className="mx-1.5">›</span>
            <span className="text-ink-muted">দ্বিতীয় শ্রেণির বাংলা</span>
          </nav>

          <h1 className="mt-4 text-title text-ink">দ্বিতীয় শ্রেণির বাংলা</h1>
          <p className="mt-3 text-body text-ink-muted">
            <em>আমার বাংলা বই, দ্বিতীয় শ্রেণি</em> অনুসরণ করে তৈরি ইন্টারেক্টিভ
            পাঠ — জাতীয় শিক্ষাক্রম ও পাঠ্যপুস্তক বোর্ড, বাংলাদেশে ব্যবহৃত বই।
            প্রতিটি লেখা শোনা যায়, প্রতিটি বর্ণে চাপ দিলে উচ্চারণ হয়, আর খেলার
            মধ্য দিয়ে অনুশীলন করা যায়।
          </p>

          <p className="mt-3 text-body text-ink-muted">
            বইয়ের {bn(lessonCount)}টি পাঠই আছে — {bn(wordCount)}টি শব্দ ও
            {' '}{bn(buildCount)}টি বর্ণযোগ (কার, যুক্তবর্ণ, ফলা ও রেফ) নিয়ে।
          </p>

          <p className="mt-3 text-body text-ink-muted">
            বইয়ের ছবি ব্যবহার করা হয়নি — সব ছবি পিকিক্সোর নিজের আঁকা। পাঠের
            লেখা বইয়ের হুবহু, আর যেখানে শব্দের অর্থ বই নিজে দেয়নি সেখানে
            পিকিক্সোর যোগ করা অর্থ আলাদা করে চিহ্নিত।
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

          <p className="mt-10 text-small text-ink-subtle">
            আরও পড়া:{' '}
            <Link href="/education/class-2/math" className="underline hover:text-ink">
              দ্বিতীয় শ্রেণির গণিত
            </Link>
            {' · '}
            <Link href="/education/class-2/english" className="underline hover:text-ink">
              Class 2 English
            </Link>
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
