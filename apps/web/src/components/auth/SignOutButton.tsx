'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/Button';

/**
 * Sign out, optionally everywhere.
 *
 * A full navigation rather than a router push: the session cookies are gone,
 * and every cached server-rendered page needs to be re-fetched without them.
 * Failures still navigate — from the user's point of view "sign out" must never
 * appear to leave them signed in.
 */
export function SignOutButton({ everywhere = false }: { everywhere?: boolean }) {
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await apiFetch(
        everywhere ? '/auth/sign-out-everywhere' : '/auth/sign-out',
        { method: 'POST' },
      );
    } catch {
      // Deliberately ignored — we navigate away regardless.
    }
    window.location.assign('/');
  }

  return (
    <Button
      variant={everywhere ? 'danger' : 'secondary'}
      loading={pending}
      onClick={signOut}
    >
      {everywhere ? 'Sign out everywhere' : 'Sign out'}
    </Button>
  );
}
