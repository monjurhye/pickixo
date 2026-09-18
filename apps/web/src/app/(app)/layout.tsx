import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { getCurrentUser } from '@/lib/session';

/**
 * The signed-in area.
 *
 * `noindex` here covers every page underneath in one place (§58), so a new
 * private route cannot be added without inheriting it. robots.txt lists these
 * paths too, but robots.txt is a crawl request — this is the part that actually
 * keeps them out of results.
 *
 * The auth check is here rather than in each page for the same reason: a route
 * added later is private by default instead of by remembering.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={user} />
      {/* Bottom padding leaves room for the mobile tab bar, which is fixed. */}
      <main id="main" className="flex-1 pb-20 md:pb-0">{children}</main>
      <MobileTabBar />
    </div>
  );
}
