'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SearchBox } from '@/components/layout/SearchBox';
import { Button } from '@/components/ui/Button';
import { PRIMARY_NAV } from '@/lib/verticals';
import type { User } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * The one header, on every page (§6): the user should always know where they
 * are, how to search, and how to get back.
 *
 * Kept to five sections plus search and account. Putting all seven verticals up
 * here would leave no room for the search field, which is the thing people
 * actually arrive wanting.
 */
export function SiteHeader({ user }: { user: User | null }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-canvas/85 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3
                   focus:z-50 focus:rounded-control focus:bg-surface focus:px-3
                   focus:py-2 focus:text-small focus:shadow-raised"
      >
        Skip to content
      </a>

      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Logo />

        <nav aria-label="Sections" className="hidden md:flex md:items-center md:gap-1">
          {PRIMARY_NAV.map((v) => {
            const active = pathname.startsWith(`/${v.slug}`);
            return (
              <Link
                key={v.slug}
                href={`/${v.slug}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-control px-3 py-1.5 text-small font-medium transition-colors',
                  active
                    ? 'bg-surface-sunken text-ink'
                    : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
                )}
              >
                {v.name}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:block sm:w-56 lg:w-72">
            <SearchBox />
          </div>
          <ThemeToggle />

          {user ? (
            <>
              <Link
                href="/my-apps"
                className="hidden rounded-control px-3 py-1.5 text-small font-medium
                           text-ink-muted transition-colors hover:bg-surface-sunken
                           hover:text-ink md:inline-block"
              >
                My Apps
              </Link>
              <Link
                href="/dashboard"
                className="hidden md:inline-flex"
                aria-label="Your dashboard"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full
                             bg-accent-soft text-small font-semibold text-accent-ink"
                >
                  {(user.display_name || user.email).charAt(0).toUpperCase()}
                </span>
              </Link>
            </>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/sign-in">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm">Create account</Button>
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-control
                       text-ink-muted hover:bg-surface-sunken md:hidden"
          >
            <span className="sr-only">{mobileOpen ? 'Close menu' : 'Open menu'}</span>
            <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
              {mobileOpen ? (
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  fill="none"
                />
              ) : (
                <path
                  d="M3 6h14M3 10h14M3 14h14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  fill="none"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div id="mobile-menu" className="border-t border-border bg-surface md:hidden">
          <div className="space-y-3 px-4 py-4">
            <SearchBox onNavigate={() => setMobileOpen(false)} />
            <nav aria-label="Sections" className="grid grid-cols-2 gap-1">
              {PRIMARY_NAV.map((v) => (
                <Link
                  key={v.slug}
                  href={`/${v.slug}`}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-control px-3 py-2 text-body text-ink-muted
                             hover:bg-surface-sunken hover:text-ink"
                >
                  {v.name}
                </Link>
              ))}
            </nav>
            <div className="flex gap-2 border-t border-border pt-3">
              {user ? (
                <>
                  <Link href="/dashboard" className="flex-1" onClick={() => setMobileOpen(false)}>
                    <Button variant="secondary" fullWidth size="sm">Dashboard</Button>
                  </Link>
                  <Link href="/my-apps" className="flex-1" onClick={() => setMobileOpen(false)}>
                    <Button fullWidth size="sm">My Apps</Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/sign-in" className="flex-1" onClick={() => setMobileOpen(false)}>
                    <Button variant="secondary" fullWidth size="sm">Sign in</Button>
                  </Link>
                  <Link href="/sign-up" className="flex-1" onClick={() => setMobileOpen(false)}>
                    <Button fullWidth size="sm">Create account</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
