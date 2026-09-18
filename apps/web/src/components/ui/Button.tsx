import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-hover active:bg-accent-hover ' +
    'disabled:bg-accent/45 shadow-sm',
  secondary:
    'bg-surface text-ink border border-border-strong hover:bg-surface-sunken ' +
    'active:bg-surface-sunken disabled:text-ink-subtle',
  ghost:
    'text-ink-muted hover:bg-surface-sunken hover:text-ink active:bg-surface-sunken',
  danger:
    'bg-danger text-white hover:brightness-95 active:brightness-90 disabled:bg-danger/45',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-small gap-1.5 rounded-control',
  md: 'h-10 px-4 text-body gap-2 rounded-control',
  lg: 'h-12 px-6 text-subheading gap-2 rounded-control',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Text announced to screen readers while `loading` is true. */
  loadingLabel?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary', size = 'md', loading = false, loadingLabel,
    iconLeft, iconRight, fullWidth, className, children, disabled, type = 'button', ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      // A loading button stays focusable but rejects input, so focus is not
      // thrown to the top of the page mid-interaction.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium',
        'transition-[background-color,color,box-shadow] duration-150',
        'disabled:cursor-not-allowed',
        VARIANTS[variant], SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : iconLeft}
      <span className={cn(loading && 'opacity-90')}>{children}</span>
      {!loading && iconRight}
      {loading && loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
    </button>
  );
});
