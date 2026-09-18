import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * robots.txt
 *
 * The important distinction this file gets right: **robots.txt controls
 * crawling, `noindex` controls indexing, and they are not interchangeable.**
 *
 * A URL disallowed here is never fetched — so a crawler never sees the
 * `noindex` on it. Google can still index a disallowed URL it finds linked from
 * elsewhere, showing it with no description and no way for us to say "not this
 * one". Blocking a page you want kept out of the index is therefore the one
 * thing that guarantees you cannot keep it out.
 *
 * So the private HTML pages — /dashboard, /my-apps, /settings, /activity,
 * /sign-in, /sign-up, /search — are deliberately NOT disallowed here. Every one
 * of them serves `noindex`, which is the directive that actually works, and
 * they are behind a session anyway. An earlier version of this file disallowed
 * them, which would have quietly defeated their own noindex.
 *
 * What IS disallowed is only what should never be fetched at all:
 *   /api/  — machine endpoints, no HTML, no reason to spend crawl budget
 *
 * Nothing here blocks CSS, JavaScript, fonts or images. Blocking /_next/ is a
 * common and damaging mistake: Google renders pages before judging them, and a
 * page whose stylesheet it cannot fetch is a page it sees broken.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
