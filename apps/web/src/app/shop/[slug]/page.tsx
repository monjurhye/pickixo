import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TextPage } from '@/components/layout/TextPage';
import { BuyForm } from '@/components/BuyForm';
import { MetaPixel } from '@/components/MetaPixel';
import { buildMetadata } from '@/lib/seo';
import { BUSINESS, PRODUCTS, formatBdt, type Product } from '@/lib/business';

/** One page per product, at /shop/<slug>: the address ads and links point to. */
export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export const dynamicParams = false;

const find = (slug: string) => PRODUCTS.find((p) => p.slug === slug);

/** Bangla copy for products sold to Bangla readers. Facts only from the book itself. */
const BANGLA: Record<string, { title: string; intro: string; points: string[]; good: string[]; samples: { src: string; alt: string }[] }> = {
  'ios-app-without-mac-bangla': {
    title: 'Mac ছাড়াই iOS অ্যাপ প্রকাশ',
    intro:
      'শুধু একটা Windows কম্পিউটার থেকে, Mac বা iPhone ছাড়াই, iPhone/iPad অ্যাপ App Store-এ প্রকাশের সম্পূর্ণ বাংলা গাইড। একটা আসল অ্যাপ (ArchiveX File Manager) প্রকাশ করতে গিয়ে যা যা করতে হয়েছে, কোথায় আটকে গেছে আর কীভাবে বের হওয়া গেছে — সব ধাপে ধাপে।',
    points: [
      'Codemagic দিয়ে ক্লাউডের Mac-এ iOS অ্যাপ build করা',
      'Apple Developer অ্যাকাউন্ট, certificate, profile আর API key সাজানো',
      'App Store Connect: অ্যাপ, দাম, privacy, In-App Purchase',
      'AdMob বিজ্ঞাপন, consent message আর app-ads.txt',
      'iPhone ছাড়াই ক্লাউডের আসল iPhone-এ পরীক্ষা আর Apple-এর চাওয়া ভিডিও',
      'App Review-এ জমা, রিজেকশন সামলানো, প্রকাশ আর update',
      'Claude দিয়ে নিজে নিজে অ্যাপ বানানো ও প্রকাশের ধাপে ধাপে প্রম্পট',
    ],
    good: [
      'পুরো বই বাংলায়, PDF, ৪৩ পাতা।',
      'Mac বা iPhone লাগবে না। তবে Apple Developer Program-এর সদস্যপদ লাগবে, যার জন্য Apple বছরে US$99 নেয়। এই টাকা Apple-কে দিতে হয়, আমাদের না।',
      'Swift বা SwiftUI প্রোগ্রামিং এই বই শেখায় না। আপনার অ্যাপের কোড আছে বা লিখতে পারেন, এটা ধরে নেওয়া হয়েছে।',
      'কোনো অ্যাপ Apple approve করবেই, এমন নিশ্চয়তা কোনো বই দিতে পারে না, এই বইও দেয় না।',
      'তথ্য অক্টোবর ২০২৬ অনুযায়ী। Apple, Google ও অন্যান্য সার্ভিস তাদের নিয়ম আর দাম বদলাতে পারে।',
      'Apple, App Store, iPhone ও Xcode Apple Inc.-এর ট্রেডমার্ক। এই বই Apple-এর তৈরি বা অনুমোদিত নয়।',
    ],
    samples: [
      { src: '/shop/ios-app-without-mac-bangla/sample-1.png', alt: 'নমুনা পাতা: অধ্যায় ১ — শুরুর কথা' },
      { src: '/shop/ios-app-without-mac-bangla/sample-2.png', alt: 'নমুনা পাতা: অধ্যায় ৫ — Codemagic সেটআপ' },
      { src: '/shop/ios-app-without-mac-bangla/sample-3.png', alt: 'নমুনা পাতা: অধ্যায় ১৬ — Claude দিয়ে অ্যাপ বানানো' },
    ],
  },
};

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = find(params.slug);
  if (!p) return {};
  const bn = BANGLA[p.slug];
  return buildMetadata({
    title: `${bn ? `${bn.title} (বাংলা ই-বুক)` : p.name} — ${formatBdt(p.priceBdt)}`,
    description: bn ? bn.intro.slice(0, 155) : p.description,
    path: `/shop/${p.slug}`,
  });
}

function PriceBox({ p, cover }: { p: Product; cover?: string }) {
  const price = formatBdt(p.priceBdt);
  return (
    <div className="not-prose mt-6 grid gap-5 rounded-card border border-border bg-surface p-5 sm:grid-cols-[160px_1fr]">
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="বইয়ের প্রচ্ছদ" width={160} height={226} className="w-32 rounded shadow sm:w-40" />
      ) : null}
      <div className="grid content-start gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="font-display text-display text-ink">{price}</p>
          <p className="text-small text-ink-subtle">
            {[p.kind === 'tool' ? 'Tool' : 'PDF ebook', p.language, p.pages ? `${p.pages} pages` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <p className="text-small text-ink-muted" lang="bn">
          bKash, নগদ, রকেট, কার্ড বা ইন্টারনেট ব্যাংকিং — পেমেন্টের সাথে সাথে ডাউনলোড লিংক, ইমেইলেও পাবেন।
        </p>
        <BuyForm slug={p.slug} price={price} />
      </div>
    </div>
  );
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const p = find(params.slug);
  if (!p) notFound();
  const bn = BANGLA[p.slug];
  const pixel = <MetaPixel viewContent={{ id: p.slug, name: p.name, value: p.priceBdt }} />;

  if (bn) {
    return (
      <TextPage eyebrow="Pickixo Shop · বাংলা ই-বুক" title={bn.title} intro={<p lang="bn">{bn.intro}</p>}>
        {pixel}
        <div lang="bn">
          <PriceBox p={p} cover={bn.samples.length ? `/shop/${p.slug}/cover.png` : undefined} />

          <h2>এই বই পড়ে যা পারবেন</h2>
          <ul>{bn.points.map((x) => <li key={x}>{x}</li>)}</ul>

          <h2>ভেতরের কয়েকটা পাতা</h2>
          <div className="not-prose mt-4 grid gap-4 sm:grid-cols-3">
            {bn.samples.map((s) => (
              <a key={s.src} href={s.src} target="_blank" rel="noopener" className="block overflow-hidden rounded border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.src} alt={s.alt} width={909} height={1287} loading="lazy" className="h-auto w-full" />
              </a>
            ))}
          </div>
          <p className="text-small text-ink-subtle">ছবিতে চাপ দিলে বড় করে দেখা যাবে।</p>

          {p.contents?.length ? (
            <>
              <h2>সূচিপত্র</h2>
              <ol>{p.contents.map((c) => <li key={c}>{c}</li>)}</ol>
            </>
          ) : null}

          <h2>কেনার আগে জেনে নিন</h2>
          <ul>{bn.good.map((x) => <li key={x}>{x}</li>)}</ul>

          <h2>পেমেন্ট</h2>
          <p>
            দাম টাকায় লেখা, এটাই মোট যা দেবেন। পেমেন্ট নেয় EPS (Easy Payment System), বাংলাদেশ ব্যাংক
            অনুমোদিত পেমেন্ট গেটওয়ে। কার্ড, মোবাইল ওয়ালেট (bKash, নগদ, রকেট ইত্যাদি) বা ইন্টারনেট ব্যাংকিং
            দিয়ে দিতে পারবেন। আপনার কার্ড নম্বর বা ওয়ালেট PIN আমরা কখনো দেখি না।
          </p>
          <p>পেমেন্টের পর সাথে সাথে ডাউনলোড লিংক পাবেন, ইমেইলেও যাবে। লিংক ৭ দিন আর ৫ বার ডাউনলোড পর্যন্ত চলে।</p>

          <PriceBox p={p} />

          <p className="mt-6">
            কেনার আগে আমাদের <Link href="/refund-policy">refund &amp; return policy</Link> আর{' '}
            <Link href="/terms">terms of service</Link> পড়ে নিন। প্রশ্ন থাকলে ইমেইল করুন:{' '}
            <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>। আমাদের সব পণ্য <Link href="/shop">shop</Link>-এ।
          </p>
        </div>
      </TextPage>
    );
  }

  return (
    <TextPage eyebrow={p.kind === 'tool' ? 'Pickixo Shop · Tool' : 'Pickixo Shop · Ebook'} title={p.name} intro={<p>{p.description}</p>}>
      {pixel}
      <PriceBox p={p} />

      {p.contents?.length ? (
        <>
          <h2>What is inside</h2>
          <ol>{p.contents.map((c) => <li key={c}>{c}</li>)}</ol>
        </>
      ) : null}

      <h2>Paying</h2>
      <p>
        The price is shown in taka and is the full amount you pay. Payment is handled by EPS (Easy Payment
        System), a payment gateway authorised by Bangladesh Bank. After payment you get a download link straight
        away, and by email. It works for 7 days and up to 5 downloads.
      </p>

      <h2>Before you buy</h2>
      <p>
        Please read our <Link href="/refund-policy">refund &amp; return policy</Link> and{' '}
        <Link href="/terms">terms of service</Link>. Questions? Email{' '}
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>. Everything we sell is on the{' '}
        <Link href="/shop">shop</Link>.
      </p>
    </TextPage>
  );
}
