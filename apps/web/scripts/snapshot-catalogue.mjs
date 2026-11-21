/**
 * Copy the product catalogue out of the API into a JSON file.
 *
 *   node scripts/snapshot-catalogue.mjs
 *
 * The static build of the site (scripts/build-static.mjs) has no API to ask,
 * so the catalogue pages are rendered from src/data/catalogue.snapshot.json
 * instead. This script is how that file is made, and it has to run somewhere
 * the API is reachable — the server, while it still exists.
 *
 * Re-run it and commit the result whenever a product is added, renamed or
 * changes status. Once the API is gone the JSON file is the catalogue: edit it
 * by hand.
 *
 * Order matters and is preserved: the API returns live products first, then by
 * sort_order and name, and every filtered list on the site is a slice of that
 * one ordering.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = (process.env.INTERNAL_API_URL ?? 'http://127.0.0.1:8010').replace(/\/$/, '');
const target = join(
  dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'catalogue.snapshot.json',
);

async function get(path) {
  const response = await fetch(`${API}/api${path}`);
  if (!response.ok) throw new Error(`${path} answered ${response.status}`);
  return response.json();
}

const summaries = await get('/apps?limit=200');
const apps = [];
for (const summary of summaries) {
  const detail = await get(`/apps/${encodeURIComponent(summary.slug)}`);
  // Per-visitor and per-moment fields have no meaning in a file.
  apps.push({ ...detail, in_my_apps: null, use_count: 0 });
}
const sitemap = await get('/sitemap-data');

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify({ apps, sitemap }, null, 2)}\n`, 'utf8');
console.log(`[catalogue] wrote ${apps.length} products to src/data/catalogue.snapshot.json`);
