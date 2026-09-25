import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { EnglishApp } from '@/components/class2/EnglishApp';
import { getCurrentUser } from '@/lib/session';
import {
  buildMetadata, jsonLd, breadcrumbSchema, softwareApplicationSchema,
} from '@/lib/seo';
import type { Unit } from '@/data/class2/english/schema';
import unit01 from '@/data/class2/english/unit01.json';
import unit02 from '@/data/class2/english/unit02.json';
import unit03 from '@/data/class2/english/unit03.json';
import unit04 from '@/data/class2/english/unit04.json';
import unit05 from '@/data/class2/english/unit05.json';
import unit06 from '@/data/class2/english/unit06.json';
import unit07 from '@/data/class2/english/unit07.json';
import unit08 from '@/data/class2/english/unit08.json';
import unit09 from '@/data/class2/english/unit09.json';
import unit10 from '@/data/class2/english/unit10.json';

/**
 * Class 2 English — the child's learning app.
 *
 * Content is imported as JSON at build time, so a lesson is served with the
 * page rather than fetched: a child on a slow connection should not watch a
 * spinner before they can start, and the whole of Unit 1 is a few kilobytes.
 *
 * The page below the app is written for the parent who is deciding whether to
 * let their child use this. The child never needs to read it.
 */

const TITLE = 'Class 2 English – Learn, Play and Practise';
const DESCRIPTION =
  'Free interactive English lessons for Class 2, following the Bangladesh '
  + 'NCTB textbook "English for Today". Listen, play, practise and learn with '
  + 'Bangla meanings for every word.';

export const metadata: Metadata = buildMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/education/class-2/english',
});

/**
 * TypeScript widens JSON string literals to `string`, so an imported file
 * never structurally satisfies the schema's union types even when it is
 * correct. The cast is contained here, at the single boundary, and the
 * content is checked for real by validateUnit in content.test.mjs — which
 * catches the mistakes that actually happen (a bad answer index, a dangling
 * vocabulary id) and which a structural type could not catch anyway.
 */
const UNITS = [
  unit01, unit02, unit03, unit04, unit05, unit06, unit07, unit08, unit09, unit10,
] as unknown as Unit[];

const FAQ = [
  {
    q: 'Which book does this follow?',
    a: 'English for Today, Class Two, published by the National Curriculum and '
       + 'Textbook Board, Bangladesh. The units, lessons, dialogues and rhymes '
       + 'follow the book. Bangla meanings are added by Pickixo, because the '
       + 'textbook does not include them.',
  },
  {
    q: 'Does my child need to read to use it?',
    a: 'No. Every word, sentence and question has a listen button, the '
       + 'instructions are one short line, and every button has a picture as '
       + 'well as a word. A child can work through a lesson on their own.',
  },
  {
    q: 'Does it work on a phone?',
    a: 'Yes. It is designed for a phone first, with large buttons a small hand '
       + 'can hit, and it works on a tablet or computer too.',
  },
  {
    q: 'What happens when my child gets an answer wrong?',
    a: 'It never says "Wrong". The word is read out again, a hint appears, and '
       + 'the child tries once more. After a second try the answer is shown so '
       + 'nobody gets stuck, and the word comes back later for practice.',
  },
  {
    q: 'How long is a lesson?',
    a: 'About five to seven minutes. When a lesson finishes the app says so and '
       + 'suggests coming back later, rather than pulling the child into '
       + 'another one.',
  },
  {
    q: 'Is progress saved?',
    a: 'Yes, in the browser on the device being used, so stars and learned '
       + 'words are kept between visits without needing an account.',
  },
];

export default async function Class2EnglishPage() {
  const user = await getCurrentUser();
  const lessonCount = UNITS.reduce((n, u) => n + u.lessons.length, 0);
  const wordCount = UNITS.reduce(
    (n, u) => n + u.lessons.reduce((m, l) => m + l.vocabulary.length, 0), 0,
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
              { name: 'Class 2 English', path: '/education/class-2/english' },
            ]),
            softwareApplicationSchema({
              name: 'Pickixo Class 2 English',
              description: DESCRIPTION,
              url: '/education/class-2/english',
              category: 'EducationalApplication',
            }),
          ),
        }}
      />

      <SiteHeader user={user} />

      <main id="main">
        {/* --- the app itself, first thing on the page ------------------- */}
        <EnglishApp units={UNITS} />

        {/* --- for the parent -------------------------------------------- */}
        <section className="mx-auto mt-16 max-w-3xl border-t border-border px-4 py-10">
          <nav aria-label="Breadcrumb" className="text-small text-ink-subtle">
            <Link href="/" className="hover:text-ink">Home</Link>
            <span className="mx-1.5">›</span>
            <Link href="/education" className="hover:text-ink">Education</Link>
            <span className="mx-1.5">›</span>
            <span className="text-ink-muted">Class 2 English</span>
          </nav>

          <h1 className="mt-4 text-title text-ink">Class 2 English</h1>
          <p className="mt-3 text-body text-ink-muted">
            Interactive lessons that follow <em>English for Today, Class Two</em> —
            the National Curriculum and Textbook Board textbook used in
            Bangladeshi schools. Your child listens, repeats, plays and answers,
            with the Bangla meaning beside every English word.
          </p>

          <p className="mt-3 text-body text-ink-muted">
            All {UNITS.length} units of the book are here: {lessonCount} lesson
            {lessonCount === 1 ? '' : 's'} and {wordCount} words.
          </p>

          <h2 className="mt-10 text-heading text-ink">How a lesson works</h2>
          <ol className="mt-4 space-y-3">
            {[
              'See the picture and meet the new words.',
              'Listen to each word — normal speed or slow.',
              'Hear the conversation from the textbook.',
              'Say it out loud. The app listens and encourages.',
              'Play a game with the same words.',
              'Answer five quick questions.',
              'Collect stars, and see which words to practise again.',
            ].map((line, i) => (
              <li key={line} className="flex gap-3 text-body text-ink-muted">
                <span aria-hidden="true"
                      className="flex h-6 w-6 shrink-0 items-center justify-center
                                 rounded-full bg-accent-soft text-micro font-semibold
                                 text-accent-ink">
                  {i + 1}
                </span>
                {line}
              </li>
            ))}
          </ol>

          <h2 className="mt-10 text-heading text-ink">Questions</h2>
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

          <h2 className="mt-10 text-heading text-ink">About the content</h2>
          <p className="mt-3 text-body text-ink-muted">
            The curriculum — units, lessons, dialogues, rhymes and vocabulary —
            comes from the NCTB textbook. The illustrations are Pickixo&apos;s own
            drawings, not the book&apos;s artwork, and the Bangla meanings are added
            by Pickixo because the textbook does not gloss its own vocabulary.
            Pronunciation currently uses your device&apos;s built-in voice.
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
