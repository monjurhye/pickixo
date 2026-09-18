import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { AppCard } from '@/components/apps/AppCard';
import { AddToMyApps } from '@/components/apps/AddToMyApps';
import { YouTubeTranscript } from '@/components/tools/YouTubeTranscript';
import { apiFetchOrNull, type AppDetail, type AppSummary } from '@/lib/api';
import { getCurrentUser, forwardCookies } from '@/lib/session';
import {
  buildMetadata, jsonLd, breadcrumbSchema, softwareApplicationSchema,
  absoluteUrl,
} from '@/lib/seo';

/**
 * The YouTube Transcript tool.
 *
 * A static route, so Next serves this instead of the dynamic
 * [vertical]/[slug] landing page for the same URL. That is deliberate: a
 * micro-tool with a landing page in front of it makes people click twice to
 * reach a box they could already see, and splits the SEO value across two URLs.
 * The tool is at the top, the explanatory content below it.
 */

const TITLE =
  'YouTube Transcript Generator – Free YouTube Transcript Tool';
const DESCRIPTION =
  'Get YouTube video transcripts instantly with Pickixo. Paste a YouTube URL, ' +
  'extract the transcript, copy it, or download it as TXT or SRT.';

export const metadata: Metadata = buildMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/tools/youtube-transcript',
});

export const dynamic = 'force-dynamic';

const FAQ = [
  {
    q: 'How do I get a transcript from a YouTube video?',
    a: 'Copy the video link from YouTube, paste it into the box above and press ' +
       'Get Transcript. The spoken words appear as text with a timestamp on ' +
       'every line, usually within a few seconds.',
  },
  {
    q: 'Can I download a YouTube transcript?',
    a: 'Yes. Download TXT gives you a plain text file with timestamps, which is ' +
       'what you want for reading, quoting or pasting into a document. Download ' +
       'SRT gives you a subtitle file you can load into a video editor or player.',
  },
  {
    q: 'Does this work with YouTube Shorts?',
    a: 'Yes, provided the Short has captions. Shorts links, normal watch links ' +
       'and youtu.be share links are all accepted, and so is a bare video ID.',
  },
  {
    q: 'What happens if a video has no transcript?',
    a: 'You get a clear message saying no transcript was found. Not every video ' +
       'has captions: the creator has to add them, or YouTube has to generate ' +
       'them automatically, and neither is guaranteed. Private, deleted and ' +
       'age-restricted videos cannot be read either.',
  },
  {
    q: 'Can I download the transcript as SRT?',
    a: 'Yes. The SRT file is generated from the real timestamps, numbered from ' +
       'one, with each subtitle ending before the next begins so players do not ' +
       'show two lines at once.',
  },
  {
    q: 'Does it work for languages other than English?',
    a: 'Yes. Whatever caption track the video carries is what you get, including ' +
       'Bengali, Hindi and auto-generated tracks. The language is shown above ' +
       'the transcript.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. The tool works signed out, within a small daily limit. Creating a ' +
       'free Pickixo account raises that limit and lets you keep the tool in My ' +
       'Apps.',
  },
];

const STEPS = [
  'Open the YouTube video and copy its link.',
  'Paste the link into the box above.',
  'Press Get Transcript.',
  'Read it, copy it, or download it as TXT or SRT.',
];

export default async function YouTubeTranscriptPage() {
  const cookie = forwardCookies();
  const [user, app, related] = await Promise.all([
    getCurrentUser(),
    apiFetchOrNull<AppDetail>('/apps/youtube-transcript', { cookie }),
    apiFetchOrNull<AppSummary[]>('/apps?vertical=tools&limit=5', { revalidate: 300 }),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbSchema([
              { name: 'Home', path: '/' },
              { name: 'Tools', path: '/tools' },
              { name: 'YouTube Transcript Generator', path: '/tools/youtube-transcript' },
            ]),
            softwareApplicationSchema({
              name: 'YouTube Transcript Generator',
              description: DESCRIPTION,
              url: '/tools/youtube-transcript',
              category: 'UtilitiesApplication',
            }),
            // Every one of these questions and answers is visible on the page
            // below. FAQ markup describing content a visitor cannot see is the
            // kind of thing Google issues manual actions for.
            {
              '@type': 'FAQPage',
              '@id': `${absoluteUrl('/tools/youtube-transcript')}#faq`,
              mainEntity: FAQ.map((item) => ({
                '@type': 'Question',
                name: item.q,
                acceptedAnswer: { '@type': 'Answer', text: item.a },
              })),
            },
          ),
        }}
      />

      <SiteHeader user={user} />

      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <nav aria-label="Breadcrumb" className="text-small text-ink-subtle">
          <Link href="/" className="hover:text-ink">Home</Link>
          <span className="mx-1.5">›</span>
          <Link href="/tools" className="hover:text-ink">Tools</Link>
          <span className="mx-1.5">›</span>
          <span className="text-ink-muted">YouTube Transcript</span>
        </nav>

        <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-title text-ink">YouTube Transcript Generator</h1>
            <p className="mt-2 text-subheading font-normal text-ink-muted">
              Get the transcript from any supported YouTube video in seconds.
            </p>
          </div>
          {app ? (
            <AddToMyApps
              slug={app.slug}
              appId={app.id}
              initiallyAdded={Boolean(app.in_my_apps)}
              signedIn={Boolean(user)}
            />
          ) : null}
        </header>

        {/* --- the tool ---------------------------------------------------- */}
        <section aria-label="Get a transcript" className="mt-8">
          <YouTubeTranscript />
        </section>

        {/* --- how it works ------------------------------------------------ */}
        <section aria-labelledby="how-heading" className="mt-16">
          <h2 id="how-heading" className="text-heading text-ink">
            How to get a YouTube transcript
          </h2>
          <ol className="mt-4 space-y-3">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-3 text-body text-ink-muted">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center
                             rounded-full bg-accent-soft text-micro font-semibold
                             text-accent-ink"
                >
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        {/* --- what you get ------------------------------------------------ */}
        <section aria-labelledby="formats-heading" className="mt-12">
          <h2 id="formats-heading" className="text-heading text-ink">
            What you can take away
          </h2>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-subheading text-ink">Copy</dt>
              <dd className="mt-1 text-body text-ink-muted">
                Plain text for pasting into a document, or the same text with a
                timestamp on every line when you need to cite a moment.
              </dd>
            </div>
            <div>
              <dt className="text-subheading text-ink">TXT</dt>
              <dd className="mt-1 text-body text-ink-muted">
                A text file that opens anywhere, with the video title, channel
                and link at the top so you still know where it came from a month
                later.
              </dd>
            </div>
            <div>
              <dt className="text-subheading text-ink">SRT</dt>
              <dd className="mt-1 text-body text-ink-muted">
                A standard subtitle file for video editors and players, built
                from the real timestamps.
              </dd>
            </div>
          </dl>
        </section>

        {/* --- faq ---------------------------------------------------------- */}
        <section aria-labelledby="faq-heading" className="mt-12">
          <h2 id="faq-heading" className="text-heading text-ink">
            Questions
          </h2>
          <div className="mt-4 divide-y divide-border border-y border-border">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="cursor-pointer list-none text-subheading text-ink
                                    marker:hidden">
                  <span className="flex items-start justify-between gap-4">
                    {item.q}
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-ink-subtle transition-transform
                                 group-open:rotate-45"
                    >
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-2 text-body text-ink-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* --- honest limits ------------------------------------------------ */}
        <section aria-labelledby="limits-heading" className="mt-12">
          <h2 id="limits-heading" className="text-heading text-ink">
            What it cannot do
          </h2>
          <p className="mt-3 text-body text-ink-muted">
            It reads captions; it does not listen to audio. If a video has no
            caption track — because nobody added one and YouTube did not generate
            one — there is nothing to extract, and you will be told so rather
            than shown an empty page. Private, deleted, members-only and
            age-restricted videos cannot be read either.
          </p>
        </section>

        {related && related.length > 1 ? (
          <section aria-labelledby="related-heading" className="mt-14">
            <h2 id="related-heading" className="text-heading text-ink">
              More tools
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {related
                .filter((tool) => tool.slug !== 'youtube-transcript')
                .slice(0, 4)
                .map((tool) => <AppCard key={tool.id} app={tool} />)}
            </div>
          </section>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}
