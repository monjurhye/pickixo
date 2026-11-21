/**
 * Build the static site: plain files in out/, for a file host with no server.
 *
 *   npm run build:static        (on the host's build machine, not on a desk)
 *
 * The ordinary build produces a Node server that renders pages per request and
 * forwards /api to the backend. This one produces files only. It is the same
 * source with NEXT_PUBLIC_STATIC_SITE=1, which switches off everything that
 * needs to know who is asking — see src/lib/static-site.ts.
 *
 * Cloudflare Pages settings:
 *   Root directory          apps/web
 *   Build command           npm run build:static
 *   Build output directory  out
 *   Variable (optional)     NEXT_PUBLIC_MODEL_URL = where the background
 *                           remover's model file is hosted (see below)
 *
 * THIS SCRIPT DELETES SOURCE FOLDERS. Pages that cannot exist without the API
 * are removed from the checkout before building, because a static build fails
 * on any page that insists on being rendered per request. On a build machine
 * the checkout is thrown away afterwards, so that is harmless; in a working
 * copy it would destroy uncommitted work. It therefore refuses to run unless
 * the environment says it is a build machine.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const log = (message) => console.log(`[static] ${message}`);

if (!process.env.CI && !process.env.CF_PAGES) {
  console.error('[static] Refusing to run: this script deletes source folders and is meant');
  console.error('[static] for a build machine (CI or CF_PAGES set). To try it by hand, use a');
  console.error('[static] fresh clone made for the purpose and run it there with CI=1.');
  process.exit(1);
}

/** Per-file limit on Cloudflare Pages. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

// --- 1. pages that need the API -------------------------------------------
const SERVER_ONLY = [
  'src/app/(app)',                     // dashboard, My Apps, settings, activity
  'src/app/(auth)',                    // sign-in, sign-up
  'src/app/search',
  'src/app/t',                         // closed-testing tester links
  'src/app/apps/pickbot',
  'src/app/tools/youtube-transcript',
];

// The background remover runs in the browser, but its model is an 88 MB file
// that no page host will carry. With nowhere to fetch it from, the page would
// load and then fail, so it is left out instead — and out of the catalogue, by
// the same variable, in src/lib/static-catalogue.ts.
const modelUrl = process.env.NEXT_PUBLIC_MODEL_URL;
if (!modelUrl) {
  SERVER_ONLY.push('src/app/tools/background-remover');
  log('NEXT_PUBLIC_MODEL_URL is not set: building WITHOUT the background remover');
} else {
  log(`background remover model: ${modelUrl}`);
}

for (const path of SERVER_ONLY) {
  rmSync(join(webRoot, path), { recursive: true, force: true });
  log(`left out ${path}`);
}

// --- 2. the ONNX runtime ---------------------------------------------------
// The server build copies the runtime into public/ort. One of those files is
// 26.5 MiB, over the limit, so the static site loads the identical release
// from a CDN and ships none of it.
rmSync(join(webRoot, 'public', 'ort'), { recursive: true, force: true });
const ortVersion = JSON.parse(
  readFileSync(join(webRoot, 'node_modules', 'onnxruntime-web', 'package.json'), 'utf8'),
).version;

const env = {
  ...process.env,
  NEXT_PUBLIC_STATIC_SITE: '1',
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://pickixo.com',
  NEXT_PUBLIC_ORT_BASE: process.env.NEXT_PUBLIC_ORT_BASE
    || `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ortVersion}/dist/`,
};

// --- 3. build --------------------------------------------------------------
const next = join(webRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const built = spawnSync(process.execPath, [next, 'build'], { cwd: webRoot, env, stdio: 'inherit' });
if (built.status !== 0) process.exit(built.status ?? 1);

// --- 4. check what came out ------------------------------------------------
const out = join(webRoot, 'out');
if (!existsSync(join(out, 'index.html'))) {
  console.error('[static] the build finished but out/index.html is missing');
  process.exit(1);
}

let pages = 0;
const tooBig = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (entry.name.endsWith('.html')) pages += 1;
    const { size } = statSync(full);
    if (size > MAX_FILE_BYTES) tooBig.push(`${relative(out, full)} (${(size / 1048576).toFixed(1)} MiB)`);
  }
})(out);

if (tooBig.length > 0) {
  console.error('[static] these files are over the 25 MiB per-file limit and would fail the deploy:');
  for (const file of tooBig) console.error(`[static]   ${file}`);
  process.exit(1);
}

log(`done: ${pages} pages in out/`);
