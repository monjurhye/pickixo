import type { Metadata } from 'next';
import { TextPage } from '@/components/layout/TextPage';
import { buildMetadata } from '@/lib/seo';
import { PLAY_APPS, PLAY_DEVELOPER_URL, playUrl } from '@/lib/play-apps';

export const metadata: Metadata = buildMetadata({
  title: 'Our Android apps',
  description: 'Pickixo apps and games on Google Play — Ludo Tiger, Khamar Bondhu, Survival Tiger, Polyscan and more — with each app’s privacy policy.',
  path: '/our-apps',
});

export default function OurAppsPage() {
  return (
    <TextPage
      eyebrow="On Google Play"
      title="Our Android apps"
      intro={
        <p>
          Every app we publish on Google Play, with its privacy policy. You can
          also see them all on{' '}
          <a href={PLAY_DEVELOPER_URL} className="text-accent-ink underline underline-offset-2">our developer page</a>.
        </p>
      }
    >
      <ul className="!list-none !pl-0">
        {PLAY_APPS.map((app) => (
          <li key={app.id} className="border-b border-border py-4">
            <p className="text-subheading text-ink">
              {app.name}
              {app.nameBn ? <span lang="bn" className="ml-2 text-small font-normal text-ink-muted">{app.nameBn}</span> : null}
            </p>
            <p className="mt-1">{app.blurb}</p>
            <p className="mt-1 text-small">
              <a href={playUrl(app.id)}>Get it on Google Play</a>
              {app.privacy ? <> · <a href={app.privacy}>Privacy policy</a></> : null}
            </p>
          </li>
        ))}
      </ul>
    </TextPage>
  );
}
