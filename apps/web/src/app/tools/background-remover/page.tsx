import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { AppCard } from '@/components/apps/AppCard';
import { AddToMyApps } from '@/components/apps/AddToMyApps';
import { BackgroundRemover } from '@/components/tools/BackgroundRemover';
import { apiFetchOrNull, type AppDetail, type AppSummary } from '@/lib/api';
import { getCurrentUser, forwardCookies } from '@/lib/session';
import {
  buildMetadata, jsonLd, breadcrumbSchema, softwareApplicationSchema, absoluteUrl,
} from '@/lib/seo';

/**
 * The AI Background Remover.
 *
 * A static route so Next serves this rather than the generic
 * [vertical]/[slug] landing page, for the same reason as the transcript tool:
 * a landing page in front of a one-box tool makes people click twice and
 * splits the SEO value over two URLs.
 */

const TITLE = 'AI Background Remover – Remove Image Backgrounds Free';
const DESCRIPTION =
  'Remove the background from a photo in your browser. The image never leaves '
  + 'your device, there is no sign-up, and you get a transparent PNG at full '
  + 'resolution.';

export const metadata: Metadata = buildMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/tools/background-remover',
});

export const dynamic = 'force-dynamic';

const FAQ = [
  {
    q: 'How do I remove the background from an image?',
    a: 'Drop a photo into the box above, or press Choose image. The background '
       + 'is removed automatically and you can download the result as a PNG '
       + 'with a transparent background. There is nothing to sign up for.',
  },
  {
    q: 'Are my photos uploaded anywhere?',
    a: 'No. The whole thing runs inside your browser on your own device. Your '
       + 'image is never sent to Pickixo or to anyone else, and nothing is '
       + 'stored on our servers. You can check this yourself: turn off your '
       + 'internet connection after the first use and the tool still works.',
  },
  {
    q: 'Why is there a download the first time?',
    a: 'Because the work happens on your device, the AI model has to get there '
       + 'first. It is about 84 MB and is downloaded once, then kept by your '
       + 'browser, so later visits start straight away. That download is the '
       + 'price of your images never leaving your device.',
  },
  {
    q: 'What does it work best on?',
    a: 'People. The model is trained for photographs of people, and portraits '
       + 'come out cleanly, down to individual strands of hair. Single, clearly '
       + 'separated objects such as a product on a plain background usually work '
       + 'well too. Busy scenes with no obvious subject are the weakest case.',
  },
  {
    q: 'Does it work on animals, products or cars?',
    a: 'Often, but less reliably than on people, because that is not what the '
       + 'model was trained for. A single animal or object against a reasonably '
       + 'clear background is usually fine. Several animals in one photo, or a '
       + 'cluttered background, can produce a partial cutout. The tool tells you '
       + 'when a result came out uncertain rather than leaving you guessing.',
  },
  {
    q: 'Is the download a transparent PNG?',
    a: 'Yes, at the original resolution of the image you gave it — not a '
       + 'shrunken preview. You can also preview the cutout on white or black, '
       + 'and download it that way instead if you prefer.',
  },
  {
    q: 'Is there a limit on how many images I can do?',
    a: 'No. Because your device does the work rather than our servers, there is '
       + 'nothing for us to ration. There is no daily limit and no account '
       + 'needed.',
  },
  {
    q: 'Which browsers work?',
    a: 'Chrome, Edge, Firefox and Safari 17 or newer, on desktop and mobile. '
       + 'Where your device supports WebGPU the tool uses it and is noticeably '
       + 'faster; otherwise it falls back to running on the processor, which '
       + 'works everywhere but takes longer.',
  },
];

const STEPS = [
  'Drop an image into the box above, or press Choose image.',
  'Wait for the background to be removed — the first run also downloads the model.',
  'Compare the before and after with the slider.',
  'Download the transparent PNG.',
];

export default async function BackgroundRemoverPage() {
  const cookie = forwardCookies();
  const [user, app, related] = await Promise.all([
    getCurrentUser(),
    apiFetchOrNull<AppDetail>('/apps/background-remover', { cookie }),
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
              { name: 'AI Background Remover', path: '/tools/background-remover' },
            ]),
            softwareApplicationSchema({
              name: 'AI Background Remover',
              description: DESCRIPTION,
              url: '/tools/background-remover',
              category: 'MultimediaApplication',
            }),
            // Every question below is answered in visible text on this page.
            // FAQ markup describing content a visitor cannot see is the kind of
            // thing Google issues manual actions for.
            {
              '@type': 'FAQPage',
              '@id': `${absoluteUrl('/tools/background-remover')}#faq`,
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
          <span className="text-ink-muted">Background Remover</span>
        </nav>

        <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-title text-ink">AI Background Remover</h1>
            <p className="mt-2 text-subheading font-normal text-ink-muted">
              Remove the background from a photo and download a transparent PNG.
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

        {/* The claim that matters most on this page, stated where it is read
            rather than buried in the FAQ. */}
        <p className="mt-5 flex items-start gap-2 rounded-control border border-success/25
                      bg-success/5 px-4 py-3 text-small text-ink-muted">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-success"
               fill="none" aria-hidden="true">
            <path d="M12 3 4.5 6v6c0 4.2 3.1 7.8 7.5 9 4.4-1.2 7.5-4.8 7.5-9V6L12 3Z"
                  stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.7"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>
            <strong className="font-medium text-ink">Your image stays on your device.</strong>{' '}
            The AI runs inside your browser, so nothing is uploaded to Pickixo and
            nothing is stored. No account, no limits.
          </span>
        </p>

        {/* --- the tool ---------------------------------------------------- */}
        <section aria-label="Remove a background" className="mt-6">
          <BackgroundRemover />
        </section>

        {/* --- how it works ------------------------------------------------ */}
        <section aria-labelledby="how-heading" className="mt-16">
          <h2 id="how-heading" className="text-heading text-ink">
            How to remove an image background
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

        {/* --- why in-browser ---------------------------------------------- */}
        <section aria-labelledby="privacy-heading" className="mt-12">
          <h2 id="privacy-heading" className="text-heading text-ink">
            Why it runs in your browser
          </h2>
          <p className="mt-3 text-body text-ink-muted">
            Most background removers upload your photo to a server, run it there
            and send back a result. That means your image sits on someone
            else&apos;s machine, and it costs them money per image — which is why
            those tools have credits, watermarks and sign-up walls.
          </p>
          <p className="mt-3 text-body text-ink-muted">
            This one sends the model to you instead of sending your photo to us.
            The trade is an 84 MB download the first time, in exchange for your
            images never leaving your device, no usage limit, and no account. The
            model is kept by your browser afterwards, so it only happens once —
            and once it is there, the tool works with the internet switched off.
          </p>
        </section>

        {/* --- honest limits ------------------------------------------------ */}
        <section aria-labelledby="limits-heading" className="mt-12">
          <h2 id="limits-heading" className="text-heading text-ink">
            What it is good at, and what it is not
          </h2>
          <p className="mt-3 text-body text-ink-muted">
            The model is trained for photographs of <strong className="font-medium
            text-ink">people</strong>. Portraits are its strongest case and it
            resolves individual strands of hair rather than cutting a hard
            outline around them. A single clear object — a product, a shoe, a car
            against a plain background — usually comes out well too.
          </p>
          <p className="mt-3 text-body text-ink-muted">
            It is weaker on animals than on people, and weakest on busy scenes
            with no single obvious subject: a photo of undergrowth, or several
            animals at different distances, can produce a partial or unusable
            cutout. That is a limit of the model, not a bug to be worked around,
            so the tool says when a result came out uncertain instead of
            presenting a bad cutout without comment.
          </p>
          <p className="mt-3 text-body text-ink-muted">
            Speed depends on your device. Where WebGPU is available the tool
            uses it and is much faster; otherwise it runs on the processor,
            which works everywhere but can take a good few seconds on an older
            phone. Every image is processed at the same resolution, so the
            result does not change with how fast your device is — only how long
            it takes.
          </p>
        </section>

        {/* --- faq ---------------------------------------------------------- */}
        <section aria-labelledby="faq-heading" className="mt-12">
          <h2 id="faq-heading" className="text-heading text-ink">Questions</h2>
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

        {related && related.length > 1 ? (
          <section aria-labelledby="related-heading" className="mt-14">
            <h2 id="related-heading" className="text-heading text-ink">More tools</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {related
                .filter((tool) => tool.slug !== 'background-remover')
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
