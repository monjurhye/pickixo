/**
 * Drop Next's cached `fetch` results before a build.
 *
 * Several pages are generated from the product registry — sitemap.xml above
 * all — and they fetch it with a `revalidate` window. Next persists those fetch
 * results in .next/cache/fetch-cache and reuses them across builds, so a deploy
 * that ships a new product can prerender a sitemap that does not contain it,
 * from data captured before the product existed.
 *
 * That is exactly what happened when the background remover launched: the tool
 * was live, the API returned it, and sitemap.xml served a copy built the
 * previous day. It would have healed an hour later on its own, which is both
 * long enough to matter for a launch and quiet enough that nobody would notice
 * the pattern — every future launch would have had the same hour-long hole.
 *
 * Only the fetch cache goes. .next/cache/webpack is the build cache and is
 * worth keeping: removing it makes every deploy a cold build for no benefit.
 */
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fetchCache = join(webRoot, '.next', 'cache', 'fetch-cache');

if (existsSync(fetchCache)) {
  rmSync(fetchCache, { recursive: true, force: true });
  console.log('[cache] cleared .next/cache/fetch-cache so the build sees live data');
} else {
  console.log('[cache] no fetch cache to clear');
}
