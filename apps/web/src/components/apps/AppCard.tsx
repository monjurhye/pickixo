import Link from 'next/link';
import type { AppSummary } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * How a product is shown everywhere: catalogue, search, dashboard, My Apps.
 *
 * The status badge is the important part. A product that is not built says so
 * on its own card, so the catalogue can show the shape of the platform without
 * anyone clicking into a dead end expecting a working tool.
 */

const STATUS_BADGE: Record<string, { label: string; className: string } | null> = {
  live: null,
  beta: {
    label: 'Beta',
    className: 'bg-accent-soft text-accent-ink',
  },
  planned: {
    label: 'Coming soon',
    className: 'bg-surface-sunken text-ink-subtle',
  },
};

export function StatusBadge({ status }: { status: string }) {
  const badge = STATUS_BADGE[status];
  if (!badge) return null;
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-micro font-medium',
        badge.className,
      )}
    >
      {badge.label}
    </span>
  );
}

export function AppCard({
  app,
  action,
  className,
}: {
  app: AppSummary;
  /** Slot for "Add to My Apps", a pin toggle, or a drag handle. */
  action?: React.ReactNode;
  className?: string;
}) {
  const unavailable = app.status === 'planned';

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-card border border-border bg-surface p-4',
        'transition-shadow duration-150 hover:shadow-raised',
        unavailable && 'opacity-75 hover:shadow-card',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Link
          href={app.route}
          // Stretching the link over the card keeps the whole surface
          // clickable while leaving `action` above it genuinely clickable.
          className="min-w-0 flex-1 outline-none before:absolute before:inset-0
                     before:rounded-card focus-visible:ring-2
                     focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <span className="flex items-center gap-2">
            <span className="truncate text-subheading text-ink">{app.name}</span>
            <StatusBadge status={app.status} />
          </span>
        </Link>
        {action ? <div className="relative z-10 shrink-0">{action}</div> : null}
      </div>

      {app.tagline ? (
        <p className="mt-1.5 line-clamp-2 text-small text-ink-muted">{app.tagline}</p>
      ) : null}
    </div>
  );
}

export function AppGrid({
  apps,
  renderAction,
  className,
}: {
  apps: AppSummary[];
  renderAction?: (app: AppSummary) => React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid gap-3 sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {apps.map((app) => (
        <AppCard key={app.id} app={app} action={renderAction?.(app)} />
      ))}
    </div>
  );
}
