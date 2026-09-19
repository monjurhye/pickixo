import type { Metadata } from 'next';
import { KidsApp } from '@/components/kids/KidsApp';
import { buildMetadata } from '@/lib/seo';
import './kids.css';

/**
 * Pickixo Kids.
 *
 * The page is the app and nothing else — no site header, no footer, no nav.
 * A four-year-old holding a phone should have exactly one thing on screen, and
 * every extra link is a way out of the learning and into the rest of a site
 * that is not built for them (§27).
 *
 * The parent-facing description lives in the product registry and on the
 * Education listing, which is where a parent actually decides whether to open
 * this. Repeating it under the app would only give the child something to
 * scroll past.
 */

const TITLE = 'পিকজিকো কিডস — খেলতে খেলতে শিখি';
const DESCRIPTION =
  'বাংলাদেশের এনসিটিবি প্রাক-প্রাথমিক শিক্ষাক্রম অনুসরণ করে ৪+ ও ৫+ বয়সি '
  + 'শিশুদের জন্য বাংলা বর্ণ, শব্দ ও সংখ্যা শেখার বিনামূল্যের প্ল্যাটফর্ম। '
  + 'ছবি, শব্দ ও খেলার মাধ্যমে শিশু নিজে নিজেই শিখতে পারে।';

export const metadata: Metadata = buildMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/kids',
});

export default function KidsPage() {
  return (
    <main className="kids-root min-h-[100dvh] font-bengali">
      <KidsApp />
    </main>
  );
}
