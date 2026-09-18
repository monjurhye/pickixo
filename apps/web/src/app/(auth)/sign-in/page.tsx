import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/AuthForm';
import { apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Sign in',
  description: 'Sign in to your Pickixo account.',
  path: '/sign-in',
  index: false,
});
export const dynamic = 'force-dynamic';

export default async function SignInPage() {
  if (await getCurrentUser()) redirect('/dashboard');

  // Ask the server what it actually supports rather than assuming. An
  // unconfigured deployment shows no Google button instead of a broken one.
  const providers = await apiFetchOrNull<{ email: boolean; google: boolean }>(
    '/auth/providers',
  );

  return (
    <Suspense>
      <AuthForm mode="sign-in" googleEnabled={Boolean(providers?.google)} />
    </Suspense>
  );
}
