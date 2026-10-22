import type { Metadata } from 'next';
import Link from 'next/link';
import { TesterPanel } from '@/components/testing/TesterPanel';

/**
 * Google Play closed-test tracker. Admin-only: the API refuses the data to
 * anyone else, and the panel says so instead of rendering empty tables.
 */
export const metadata: Metadata = {
  title: 'Closed Test Testers',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function TestersPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <nav aria-label="Breadcrumb" className="text-small text-ink-subtle">
        <Link href="/dashboard" className="hover:text-ink">Dashboard</Link>
        <span className="mx-1.5">›</span>
        <span className="text-ink-muted">Closed Test Testers</span>
      </nav>

      <header className="mt-4">
        <h1 className="text-title text-ink">Closed Test Testers</h1>
        <p className="mt-2 text-body text-ink-muted">
          Who actually opens each app during the Google Play closed test. Play
          needs at least 12 testers opted in for 14 days in a row before an app
          can go to production; this page shows how close each app is.
        </p>
      </header>

      <div className="mt-8">
        <TesterPanel />
      </div>

      <section className="mt-12 rounded-card border border-border bg-surface p-5 text-small text-ink-muted">
        <h2 className="text-subheading text-ink">Connecting an app</h2>
        <p className="mt-2">
          Each app sends one heartbeat when it opens. The Kotlin snippet is in{' '}
          <code className="text-ink">docs/CLOSED_TESTING.md</code>. It posts to{' '}
          <code className="text-ink">https://pickixo.com/api/testing/heartbeat</code>{' '}
          with the package name and a random install id; an app with Google
          sign-in can send the tester&apos;s email too. Installs without an email
          appear as &ldquo;Unlinked&rdquo; and can be matched to a tester from the table.
        </p>
      </section>
    </div>
  );
}
