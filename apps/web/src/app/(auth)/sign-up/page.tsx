import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/AuthForm';
import { apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Create an account',
  description: 'Create a free Pickixo account.',
  path: '/sign-up',
  index: false,
});
export const dynamic = 'force-dynamic';

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect('/dashboard');

  const providers = await apiFetchOrNull<{ email: boolean; google: boolean }>(
    '/auth/providers',
  );

  return (
    <Suspense>
      <AuthForm mode="sign-up" googleEnabled={Boolean(providers?.google)} />
    </Suspense>
  );
}
