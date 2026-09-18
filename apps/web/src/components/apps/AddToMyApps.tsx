'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';

/**
 * The "+ Add to My Apps" control (§16).
 *
 * Optimistic: the label flips immediately and reverts if the request fails.
 * Adding something to a list is the kind of action where waiting on a round
 * trip before acknowledging the click feels broken.
 *
 * Signed out, it is not hidden — it links to sign-up, because discovering a
 * useful product is exactly when creating an account makes sense (§140).
 */
export function AddToMyApps({
  slug,
  appId,
  initiallyAdded,
  signedIn,
  size = 'sm',
}: {
  slug: string;
  appId?: string;
  initiallyAdded: boolean;
  signedIn: boolean;
  size?: 'sm' | 'md';
}) {
  const router = useRouter();
  const [added, setAdded] = useState(initiallyAdded);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Button
        variant="secondary"
        size={size}
        onClick={() => router.push(`/sign-up?next=${encodeURIComponent(`/${slug}`)}`)}
      >
        + Add to My Apps
      </Button>
    );
  }

  async function toggle() {
    const next = !added;
    setAdded(next);
    setError(null);
    try {
      if (next) {
        await apiFetch('/me/apps', { method: 'POST', body: { slug } });
      } else if (appId) {
        await apiFetch(`/me/apps/${appId}`, { method: 'DELETE' });
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setAdded(!next); // put the label back; the change did not happen
      setError(
        err instanceof ApiError && err.isAuthProblem
          ? 'Please sign in again.'
          : 'That did not save. Try again.',
      );
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={added ? 'ghost' : 'secondary'}
        size={size}
        loading={pending}
        onClick={toggle}
        aria-pressed={added}
      >
        {added ? '✓ In My Apps' : '+ Add to My Apps'}
      </Button>
      {error ? (
        <span role="alert" className="text-micro text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
