/**
 * Copy the ONNX Runtime Web binaries out of node_modules into public/ort/.
 *
 * ORT fetches its WebAssembly binary at runtime. Left alone it pulls it from a
 * public CDN, which would make the background remover depend on a third party
 * being up, leak a request to them on every visit, and be the first thing to
 * break under a Content-Security-Policy. Self-hosting avoids all three.
 *
 * public/ort/ is generated, not committed: these are 42 MB of binaries that
 * belong to a pinned dependency, so git is the wrong place for them. Run by
 * `prebuild` and `predev`, so a fresh clone gets them without anyone
 * remembering to.
 *
 * The binaries and the JavaScript that drives them are two halves of one
 * release. If they ever disagree the failure is an obscure runtime abort, so
 * the copied files are stamped with the version they came from and re-copied
 * whenever it changes.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync,
} from 'node:fs';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');

const pkgPath = join(webRoot, 'node_modules', 'onnxruntime-web', 'package.json');
if (!existsSync(pkgPath)) {
  console.error('[ort] onnxruntime-web is not installed — run npm install first');
  process.exit(1);
}
const version = JSON.parse(readFileSync(pkgPath, 'utf8')).version;
const dist = join(webRoot, 'node_modules', 'onnxruntime-web', 'dist');
const target = join(webRoot, 'public', 'ort');

/**
 * Only the two builds actually used.
 *
 * `.jsep` is the WebGPU-capable build and is twice the size; the plain build
 * is what a device without WebGPU downloads. Shipping only the big one would
 * charge every phone 14 MB extra for an accelerator it cannot use. The
 * asyncify and jspi builds are not used at all.
 */
const FILES = [
  // The WebAssembly, and the loader each build fetches next to it.
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
  // The JavaScript entry points, as plain scripts that define a global `ort`.
  //
  // These are loaded with importScripts() from a classic worker rather than
  // being bundled. Bundling them is the obvious thing to try and it does not
  // work: webpack emits worker chunks as classic scripts, Next 14 gives no way
  // to turn that off, and ORT's ESM build then fails the build outright with
  // "'import.meta' cannot be used outside of module code". These are ~60 KB
  // each; the bulk is the .wasm above, which they fetch at runtime.
  'ort.wasm.min.js',
  'ort.webgpu.min.js',
];

const stamp = join(target, '.version');
if (existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === version
    && FILES.every((f) => existsSync(join(target, f)))) {
  console.log(`[ort] public/ort already at ${version}`);
  process.exit(0);
}

mkdirSync(target, { recursive: true });
let total = 0;
for (const file of FILES) {
  const from = join(dist, file);
  if (!existsSync(from)) {
    console.error(`[ort] ${file} is missing from onnxruntime-web@${version}.`);
    console.error('[ort] The release layout changed; update FILES in this script.');
    process.exit(1);
  }
  copyFileSync(from, join(target, file));
  total += statSync(from).size;
}
writeFileSync(stamp, `${version}\n`, 'utf8');
console.log(`[ort] copied ${FILES.length} files (${(total / 1e6).toFixed(1)} MB) `
  + `from onnxruntime-web@${version} -> public/ort/`);
