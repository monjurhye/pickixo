import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * The Pickixo mark: a cursor/pick shape inside a rounded square.
 *
 * Drawn rather than loaded as a file so it inherits the ink colour and stays
 * crisp at every size and in both themes, with no extra request.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('h-7 w-7', className)}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="8" className="fill-accent" />
      {/* A pointer: "pick" the thing you need. */}
      <path
        d="M11 8.5 L23 15.4 L17.6 17.2 L15.1 22.6 Z"
        className="fill-white"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  href = '/',
  showWordmark = true,
}: {
  className?: string;
  href?: string;
  showWordmark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-2 rounded-control outline-none',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        className,
      )}
      aria-label="Pickixo — home"
    >
      <LogoMark />
      {showWordmark ? (
        <span className="text-subheading font-semibold tracking-tight text-ink">
          Pickixo
        </span>
      ) : null}
    </Link>
  );
}
