'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';

/**
 * Sign in and sign up, in one component because they differ by one field.
 *
 * Error wording is driven by the stable code the API returns, never by a
 * message from the server, so the copy stays in our hands and is translatable.
 */

const GENERIC_FAILURE = 'Something went wrong on our side. Please try again.';

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email or password is incorrect.',
  email_taken: 'An account with this email already exists. Try signing in instead.',
  invalid_email: 'That does not look like a valid email address.',
  weak_password: 'Please choose a longer password.',
  too_many_attempts: 'Too many attempts. Please wait a few minutes and try again.',
  account_suspended: 'This account is not active. Please contact support.',
  google_not_configured: 'Google sign-in is not available on this server.',
  google_sign_in_failed: 'Google sign-in did not complete. Please try again.',
  google_email_unverified:
    'Your Google account has no verified email address, so it cannot be used here.',
  internal_error: GENERIC_FAILURE,
};

export function AuthForm({
  mode,
  googleEnabled,
}: {
  mode: 'sign-in' | 'sign-up';
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [minLength, setMinLength] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  // The Google callback redirects here with ?error=google when it refuses.
  useEffect(() => {
    if (params.get('error') === 'google') {
      setError(MESSAGES.google_sign_in_failed ?? GENERIC_FAILURE);
    }
  }, [params]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/auth/${mode}`, {
        method: 'POST',
        body:
          mode === 'sign-up'
            ? { email, password, display_name: displayName || null }
            : { email, password },
      });
      // A full navigation rather than router.push: the session cookies were
      // just set, and every server component needs to re-render knowing that.
      window.location.assign(next);
    } catch (err) {
      if (err instanceof ApiError) {
        if (typeof err.meta?.minLength === 'number') setMinLength(err.meta.minLength);
        setError(MESSAGES[err.code] ?? GENERIC_FAILURE);
      } else {
        setError('Could not reach Pickixo. Check your connection and try again.');
      }
      setSubmitting(false);
    }
  }

  const isSignUp = mode === 'sign-up';

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-title text-ink">
        {isSignUp ? 'Create your Pickixo account' : 'Sign in to Pickixo'}
      </h1>
      <p className="mt-2 text-small text-ink-muted">
        {isSignUp
          ? 'One account for AI, tools, games, jobs and education.'
          : 'Welcome back.'}
      </p>

      {googleEnabled ? (
        <>
          {/* A link, not a fetch: OAuth needs a real top-level navigation so the
              state cookie is set and Google can redirect back. */}
          <a
            href="/api/auth/google/start"
            className="mt-6 flex h-10 w-full items-center justify-center gap-2
                       rounded-control border border-border-strong bg-surface
                       text-body font-medium text-ink hover:bg-surface-sunken"
          >
            <svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden="true">
              <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.3-.2-1.9H9v3.5h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" />
              <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.3c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z" />
              <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
            </svg>
            Continue with Google
          </a>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-micro uppercase tracking-wide text-ink-subtle">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : null}

      <form onSubmit={submit} className={googleEnabled ? '' : 'mt-6'} noValidate>
        {error ? (
          <p
            role="alert"
            className="mb-4 rounded-control border border-danger/30 bg-danger/5 px-3
                       py-2 text-small text-danger"
          >
            {error}
          </p>
        ) : null}

        {isSignUp ? (
          <div className="mb-4">
            <label htmlFor="name" className="mb-1.5 block text-small font-medium text-ink">
              Your name <span className="font-normal text-ink-subtle">(optional)</span>
            </label>
            <input
              id="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              maxLength={80}
              className="h-10 w-full rounded-control border border-border bg-surface px-3
                         text-body text-ink focus:border-accent focus:outline-none
                         focus:ring-2 focus:ring-accent/25"
            />
          </div>
        ) : null}

        <div className="mb-4">
          <label htmlFor="email" className="mb-1.5 block text-small font-medium text-ink">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="h-10 w-full rounded-control border border-border bg-surface px-3
                       text-body text-ink focus:border-accent focus:outline-none
                       focus:ring-2 focus:ring-accent/25"
          />
        </div>

        <div className="mb-5">
          <label htmlFor="password" className="mb-1.5 block text-small font-medium text-ink">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            minLength={isSignUp ? minLength : undefined}
            aria-describedby={isSignUp ? 'password-hint' : undefined}
            className="h-10 w-full rounded-control border border-border bg-surface px-3
                       text-body text-ink focus:border-accent focus:outline-none
                       focus:ring-2 focus:ring-accent/25"
          />
          {isSignUp ? (
            <p id="password-hint" className="mt-1.5 text-micro text-ink-subtle">
              At least {minLength} characters. Length matters more than symbols, so
              a short phrase you will remember beats P@ssw0rd.
            </p>
          ) : null}
        </div>

        <Button type="submit" fullWidth loading={submitting} loadingLabel="Working">
          {isSignUp ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-small text-ink-muted">
        {isSignUp ? (
          <>
            Already have an account?{' '}
            <Link href="/sign-in" className="text-accent-ink underline">Sign in</Link>
          </>
        ) : (
          <>
            New to Pickixo?{' '}
            <Link href="/sign-up" className="text-accent-ink underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
