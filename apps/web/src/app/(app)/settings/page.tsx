import type { Metadata } from 'next';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = (await getCurrentUser())!;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-title text-ink">Settings</h1>

      <Card className="mt-8">
        <CardHeader title="Account" />
        <CardBody className="pt-2">
          <dl className="space-y-3 text-body">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Email</dt>
              <dd className="text-ink">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Name</dt>
              <dd className="text-ink">{user.display_name ?? '—'}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Sessions"
          description="Signing out everywhere ends every session on every device."
        />
        <CardBody className="flex flex-wrap gap-3 pt-2">
          <SignOutButton />
          <SignOutButton everywhere />
        </CardBody>
      </Card>
    </div>
  );
}
