import Link from 'next/link';
import type { Metadata } from 'next';
import { Logo } from '@/components/Logo';

/**
 * Auth pages carry noindex (§58).
 *
 * robots.txt already discourages crawling them, but a disallowed URL can still
 * be indexed from an external link — only a noindex header actually keeps it
 * out of results.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-6xl">
          <Logo />
        </div>
      </header>
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </main>
      <footer className="px-4 py-6 text-center text-micro text-ink-subtle">
        <Link href="/" className="hover:text-ink">Back to Pickixo</Link>
      </footer>
    </div>
  );
}
