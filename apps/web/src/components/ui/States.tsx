import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

/** Skeleton placeholder. Sized by the caller so it matches the real content
 *  and the layout does not jump when data arrives. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

export function EmptyState({
  icon, title, body, action, className,
}: {
  icon?: ReactNode; title: string; body?: string; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      {icon ? (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full
                        bg-surface-sunken text-ink-subtle">
          {icon}
        </div>
      ) : null}
      <p className="text-subheading text-ink">{title}</p>
      {body ? <p className="mt-1.5 max-w-sm text-body text-ink-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title, body, retryLabel, onRetry, className,
}: {
  title: string; body?: string; retryLabel?: string; onRetry?: () => void; className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center px-6 py-12 text-center', className)}
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full
                      bg-danger/10 text-danger">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M12 8v5m0 3.5h.01M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20.4h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
                stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="text-subheading text-ink">{title}</p>
      {body ? <p className="mt-1.5 max-w-sm text-body text-ink-muted">{body}</p> : null}
      {onRetry && retryLabel ? (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function Badge({
  tone = 'neutral', children,
}: {
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
  children: ReactNode;
}) {
  const tones = {
    neutral: 'bg-surface-sunken text-ink-muted border-border',
    accent: 'bg-accent-soft text-accent-ink border-accent/20',
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    danger: 'bg-danger/10 text-danger border-danger/20',
  } as const;
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2 py-0.5 text-micro font-medium',
      tones[tone],
    )}>
      {children}
    </span>
  );
}
