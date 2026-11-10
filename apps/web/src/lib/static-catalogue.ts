import snapshot from '@/data/catalogue.snapshot.json';
import type { AppDetail, AppSummary } from './api';

/**
 * The catalogue endpoints, answered from a file.
 *
 * The static site is built where there is no API (see static-site.ts), so the
 * handful of public catalogue reads the pages make are resolved here against
 * src/data/catalogue.snapshot.json. Each branch mirrors the query the API runs
 * in apps/api/app/services/registry.py; the snapshot is already in the API's
 * order (live first, then sort_order, then name), so filtering it preserves
 * that order and no sorting happens here.
 *
 * Anything this does not recognise returns undefined, which the caller turns
 * into the same "no data" a failed request would be.
 */

const apps = snapshot.apps as unknown as AppDetail[];

/**
 * Products whose page is not part of the static site, because the work happens
 * on the server. Listing them would be a card that leads nowhere.
 *
 * The background remover runs in the browser and stays — unless there is
 * nowhere to load its 88 MB model from, in which case its page is left out of
 * the build too (see scripts/build-static.mjs).
 */
const UNAVAILABLE = new Set<string>([
  'youtube-transcript',
  'ai-chat',
  ...(process.env.NEXT_PUBLIC_MODEL_URL ? [] : ['background-remover']),
]);

const listed = apps.filter((app) => !UNAVAILABLE.has(app.slug));

function toSummary(app: AppDetail): AppSummary {
  return {
    id: app.id,
    slug: app.slug,
    vertical: app.vertical,
    name: app.name,
    name_bn: app.name_bn,
    tagline: app.tagline,
    icon: app.icon,
    route: app.route,
    status: app.status,
    is_featured: app.is_featured,
    supports_my_apps: app.supports_my_apps,
    requires_auth: app.requires_auth,
  };
}

/** The API matches on app_categories.slug; the snapshot only has the name. */
function categorySlug(name: string | null): string {
  return (name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Every product the static site lists, for generateStaticParams. */
export function staticCatalogueApps(): AppDetail[] {
  return listed;
}

export function resolveStaticCatalogue(path: string): unknown {
  const url = new URL(path, 'http://catalogue.invalid');
  const query = url.searchParams;

  if (url.pathname === '/apps') {
    const vertical = query.get('vertical');
    const category = query.get('category');
    const featured = query.get('featured') === 'true';
    const limit = Number(query.get('limit') ?? 100);
    return listed
      .filter((app) => !vertical || app.vertical === vertical)
      // As in the API, a category only narrows a listing that names a vertical.
      .filter((app) => !vertical || !category || categorySlug(app.category) === category)
      .filter((app) => !featured || app.is_featured)
      .slice(0, limit)
      .map(toSummary);
  }

  if (url.pathname === '/app-by-route') {
    return listed.find((app) => app.route === query.get('route'));
  }

  if (url.pathname === '/sitemap-data') {
    const hidden = new Set(apps.filter((a) => UNAVAILABLE.has(a.slug)).map((a) => a.route));
    return {
      ...snapshot.sitemap,
      apps: snapshot.sitemap.apps.filter((entry) => !hidden.has(entry.route)),
    };
  }

  const slug = url.pathname.match(/^\/apps\/([^/]+)$/)?.[1];
  if (slug) return listed.find((app) => app.slug === decodeURIComponent(slug));

  return undefined;
}
