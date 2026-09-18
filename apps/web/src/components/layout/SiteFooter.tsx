import Link from 'next/link';
import { LogoMark } from '@/components/Logo';
import { VERTICALS } from '@/lib/verticals';

/**
 * The footer carries every vertical, including the ones the header leaves out,
 * so the whole platform is reachable from any page and internal linking reaches
 * every section (§62).
 */
export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-surface-sunken">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-[1.5fr_2fr]">
          <div>
            <div className="flex items-center gap-2">
              <LogoMark className="h-6 w-6" />
              <span className="text-subheading font-semibold text-ink">Pickixo</span>
            </div>
            <p className="mt-3 max-w-xs text-small text-ink-muted">
              AI, Apps, Tools, Games, Jobs &amp; Education — all in one place, with
              one account.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            {VERTICALS.map((v) => (
              <Link
                key={v.slug}
                href={`/${v.slug}`}
                className="text-small text-ink-muted hover:text-ink"
              >
                {v.name}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6
                        text-micro text-ink-subtle sm:flex-row sm:items-center
                        sm:justify-between">
          <p>© {new Date().getFullYear()} Pickixo</p>
          <p>
            Free to use. AI runs on shared free-tier capacity, so daily limits
            apply.
          </p>
        </div>
      </div>
    </footer>
  );
}
