import type { Metadata } from 'next';
import Link from 'next/link';
import { AgentDashboard } from '@/components/facebook/AgentDashboard';

/**
 * The Facebook agent's control panel.
 *
 * Under (app) so it inherits the signed-in layout and its auth guard. It is
 * never indexed: it shows one person's Page operations, and the API it talks
 * to sets `X-Robots-Tag: noindex` on every response for the same reason.
 */
export const metadata: Metadata = {
  title: 'Facebook Agent',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function FacebookAgentPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <nav aria-label="Breadcrumb" className="text-small text-ink-subtle">
        <Link href="/dashboard" className="hover:text-ink">Dashboard</Link>
        <span className="mx-1.5">›</span>
        <span className="text-ink-muted">Facebook Agent</span>
      </nav>

      <header className="mt-4">
        <h1 className="text-title text-ink">Facebook Agent</h1>
        <p className="mt-2 text-body text-ink-muted">
          An autonomous manager for your Page. It observes, decides whether
          anything is worth doing, and acts only when it is — which most of the
          time means doing nothing at all.
        </p>
      </header>

      <div className="mt-8">
        <AgentDashboard />
      </div>

      <p className="mt-10 text-micro text-ink-subtle">
        The agent runs in a background worker on the server. You can close this
        page and it keeps working.
      </p>
    </div>
  );
}
