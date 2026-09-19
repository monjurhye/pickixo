import type { MetadataRoute } from 'next';
import { apiFetchOrNull } from '@/lib/api';
import { SITE_URL, absoluteUrl } from '@/lib/seo';
import { SUBMENUS, VERTICALS } from '@/lib/verticals';

type SitemapData = {
  apps: { route: string; updated_at: string; vertical: string }[];
  lastmod: { verticals: Record<string, string>; site: string | null };
};

/**
 * sitemap.xml, generated from the product registry.
 *
 * Two rules it enforces structurally rather than by remembering:
 *
 * 1. **Only indexable, shipped, public products appear.** The API query behind
 *    this selects exactly those, so a private page, a `planned` one, or a
 *    `noindex` one cannot get in by mistake — not because someone excluded it,
 *    but because the query cannot return it. Sitemap entries and canonical tags
 *    therefore always agree.
 *
 * 2. **lastmod is real.** It used to be `new Date()` for the listing pages,
 *    which told search engines every page changed on every regeneration. That
 *    is false, and a feed that cries wolf gets its lastmod ignored. Listing
 *    pages now take the newest updated_at of the products they list, which is
 *    genuinely when their content last changed. Where there is nothing to
 *    derive a date from, lastmod is omitted rather than invented.
 */
export const revalidate = 3600;

/** The gazette date, which is when every pay-scale page's content last changed. */
const GAZETTE_DATE = '2026-09-17';

const PAY_SCALE_ROUTES: { path: string; priority: number }[] = [
  { path: '/salary-calculator', priority: 0.9 },
  { path: '/pay-scale-2026', priority: 0.9 },
  { path: '/pay-fixation-2026', priority: 0.8 },
  { path: '/2015-vs-2026-pay-scale', priority: 0.8 },
  { path: '/increment-calculator', priority: 0.7 },
  { path: '/gross-salary-calculator', priority: 0.7 },
  { path: '/salary-checker', priority: 0.7 },
  { path: '/govt-salary-calculator-bangladesh', priority: 0.7 },
  ...Array.from({ length: 20 }, (_, i) => ({
    path: `/grade-${i + 1}-salary`,
    priority: 0.6,
  })),
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await apiFetchOrNull<SitemapData>('/sitemap-data', {
    revalidate: 3600,
  });

  const siteChanged = data?.lastmod?.site;
  const perVertical = data?.lastmod?.verticals ?? {};

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      changeFrequency: 'daily',
      priority: 1,
      ...(siteChanged ? { lastModified: new Date(siteChanged) } : {}),
    },
    ...VERTICALS.map((v) => {
      const changed = perVertical[v.slug];
      return {
        url: absoluteUrl(`/${v.slug}`),
        changeFrequency: 'weekly' as const,
        // A section with nothing shipped in it is a real page worth crawling,
        // but it ranks below one that has products, and says so here.
        priority: changed ? 0.8 : 0.5,
        ...(changed ? { lastModified: new Date(changed) } : {}),
      };
    }),
    ...Object.entries(SUBMENUS).flatMap(([vertical, items]) =>
      (items ?? []).filter((s) => !s.href).map((s) => ({
        url: absoluteUrl(`/${vertical}/${s.slug}`),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      })),
    ),
    // The pay-scale section is not in the product registry: it is static pages
    // built from a gazette rather than a registered app, so it is listed from
    // code. lastModified is the gazette date, which is genuinely when this
    // content last changed and will not move until the next pay order.
    ...PAY_SCALE_ROUTES.map((route) => ({
      url: absoluteUrl(route.path),
      lastModified: new Date(GAZETTE_DATE),
      changeFrequency: 'yearly' as const,
      priority: route.priority,
    })),
  ];

  // If the API is unreachable the static pages are still listed. A briefly
  // short sitemap beats a 500 where the sitemap should be.
  if (!data) return entries;

  for (const app of data.apps) {
    entries.push({
      url: absoluteUrl(app.route),
      lastModified: new Date(app.updated_at),
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  return entries;
}
