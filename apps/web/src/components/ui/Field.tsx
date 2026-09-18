'use client';

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const CONTROL =
  'w-full rounded-control border border-border-strong bg-surface px-3 text-body text-ink ' +
  'placeholder:text-ink-subtle transition-colors ' +
  'hover:border-ink-subtle focus:border-accent ' +
  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-subtle ' +
  'aria-[invalid=true]:border-danger';

function Wrapper({
  id, label, hint, error, required, children,
}: {
  id: string; label?: ReactNode; hint?: ReactNode; error?: string;
  required?: boolean; children: ReactNode;
}) {
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={id} className="mb-1.5 block text-small font-medium text-ink">
          {label}
          {required ? <span className="ml-0.5 text-danger" aria-hidden="true">*</span> : null}
        </label>
      ) : null}
      {children}
      {/* Error takes precedence over hint so the two never stack and shift layout. */}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-small text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-small text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode; hint?: ReactNode; error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, required, ...rest }, ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <Wrapper id={fieldId} label={label} hint={hint} error={error} required={required}>
      <input
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cn(CONTROL, 'h-10', className)}
        {...rest}
      />
    </Wrapper>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode; hint?: ReactNode; error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, required, rows = 5, ...rest }, ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <Wrapper id={fieldId} label={label} hint={hint} error={error} required={required}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cn(CONTROL, 'resize-y py-2.5 leading-relaxed', className)}
        {...rest}
      />
    </Wrapper>
  );
});

export interface SelectOption { value: string; label: string; }

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode; hint?: ReactNode; error?: string; options: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, options, className, id, required, ...rest }, ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <Wrapper id={fieldId} label={label} hint={hint} error={error} required={required}>
      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={cn(CONTROL, 'h-10 appearance-none pr-9', className)}
          {...rest}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
          viewBox="0 0 20 20" fill="none" aria-hidden="true"
        >
          <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </Wrapper>
  );
});
