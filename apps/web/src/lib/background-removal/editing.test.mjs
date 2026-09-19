/**
 * Tests for the parts of the background remover's editing tools that need no
 * DOM: subject bounds, the brush, and the zip writer.
 *
 *   cd apps/web
 *   npx tsc src/lib/background-removal/geometry.ts src/lib/background-removal/brush.ts \
 *       src/lib/background-removal/zip.ts --outDir .tmp-test \
 *       --module commonjs --target es2020 --skipLibCheck
 *   node src/lib/background-removal/editing.test.mjs .tmp-test
 *
 * The zip test also asks Python's zipfile to read the archive back, because a
 * writer that only agrees with its own reader proves nothing. That step is
 * skipped, and said so, when Python is not on the PATH.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const dir = process.argv[2];
if (!dir) {
  console.error('usage: node editing.test.mjs <dir of compiled js>');
  process.exit(1);
}
const geometry = require(path.resolve(dir, 'geometry.js'));
const brush = require(path.resolve(dir, 'brush.js'));
const zip = require(path.resolve(dir, 'zip.js'));

let passed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    console.error(`  FAIL  ${name}\n        ${err.message}`);
    process.exitCode = 1;
  }
}

function matte(width, height, fill = 0) {
  return new Uint8ClampedArray(width * height).fill(fill);
}

// ------------------------------------------------------------- alphaBounds
await check('alphaBounds finds the subject and pads it', () => {
  const a = matte(100, 100);
  for (let y = 30; y < 60; y++) for (let x = 20; x < 70; x++) a[y * 100 + x] = 255;
  assert.deepEqual(geometry.alphaBounds(a, 100, 100, 40, 0),
    { x: 20, y: 30, w: 50, h: 30 });
  const padded = geometry.alphaBounds(a, 100, 100, 40, 0.1);
  assert.equal(padded.x, 15);
  assert.equal(padded.w, 60);
});

await check('alphaBounds ignores haze below the threshold', () => {
  const a = matte(50, 50);
  a[0] = 30;                  // a faint speck in the corner
  a[24 * 50 + 24] = 255;      // the actual subject
  const r = geometry.alphaBounds(a, 50, 50, 40, 0);
  assert.deepEqual(r, { x: 24, y: 24, w: 1, h: 1 });
});

await check('alphaBounds never leaves the image and returns null when empty', () => {
  const a = matte(40, 40, 255);
  assert.deepEqual(geometry.alphaBounds(a, 40, 40, 40, 0.5), { x: 0, y: 0, w: 40, h: 40 });
  assert.equal(geometry.alphaBounds(matte(40, 40), 40, 40), null);
});

await check('the pixel cap is the size iOS Safari accepts', () => {
  assert.equal(geometry.MAX_SOURCE_PIXELS, 4096 * 4096);
});

// ------------------------------------------------------------------- brush
await check('erase clears the centre and leaves outside the radius untouched', () => {
  const a = matte(60, 60, 255);
  const rect = brush.paintDab(a, 60, 60, 30, 30, 10, 'erase');
  assert.equal(a[30 * 60 + 30], 0, 'centre should be fully erased');
  assert.equal(a[30 * 60 + 45], 255, 'outside the radius must not change');
  assert.equal(a[5 * 60 + 5], 255);
  assert.ok(rect.w <= 22 && rect.h <= 22, 'dirty rect should hug the brush');
});

await check('the brush has a soft edge', () => {
  const a = matte(60, 60, 255);
  brush.paintDab(a, 60, 60, 30, 30, 20, 'erase');
  const rim = a[30 * 60 + 30 + 18];
  assert.ok(rim > 0 && rim < 255, `expected a partial value at the rim, got ${rim}`);
});

await check('restore brings alpha back towards 255', () => {
  const a = matte(60, 60, 0);
  brush.paintDab(a, 60, 60, 30, 30, 10, 'restore');
  assert.equal(a[30 * 60 + 30], 255);
  assert.equal(a[0], 0);
});

await check('the brush is safe at and beyond the image edge', () => {
  const a = matte(20, 20, 255);
  assert.doesNotThrow(() => brush.paintDab(a, 20, 20, 0, 0, 15, 'erase'));
  assert.doesNotThrow(() => brush.paintDab(a, 20, 20, 19, 19, 15, 'erase'));
  assert.equal(brush.paintDab(a, 20, 20, -100, -100, 5, 'erase'), null);
  assert.equal(brush.paintDab(a, 20, 20, 10, 10, 0, 'erase'), null);
  assert.equal(a.length, 400);
});

await check('a fast stroke leaves no gaps', () => {
  const a = matte(300, 40, 255);
  brush.paintStroke(a, 300, 40, { x: 10, y: 20 }, { x: 290, y: 20 }, 8, 'erase');
  for (let x = 15; x <= 285; x++) {
    assert.equal(a[20 * 300 + x], 0, `gap at x=${x}`);
  }
});

await check('copyRegion and writeRegion round-trip for undo', () => {
  const a = matte(50, 50, 200);
  const before = Uint8ClampedArray.from(a);
  const rect = brush.paintStroke(a, 50, 50, { x: 5, y: 5 }, { x: 40, y: 30 }, 6, 'erase');
  assert.notDeepEqual(a, before);
  // The saved region must come from the state before painting.
  const saved = brush.copyRegion(before, 50, rect);
  brush.writeRegion(a, 50, rect, saved);
  assert.deepEqual(a, before);
});

await check('writeAlphaToRgba only touches the rectangle and the alpha byte', () => {
  const alpha = matte(4, 4, 77);
  const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(9);
  brush.writeAlphaToRgba(rgba, alpha, 4, { x: 1, y: 1, w: 2, h: 2 });
  assert.equal(rgba[(1 * 4 + 1) * 4 + 3], 77);
  assert.equal(rgba[(1 * 4 + 1) * 4], 9, 'colour channels must not change');
  assert.equal(rgba[3], 9, 'pixels outside the rectangle must not change');
});

await check('unionRect covers both rectangles', () => {
  const u = brush.unionRect({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 5, w: 5, h: 30 });
  assert.deepEqual(u, { x: 0, y: 0, w: 25, h: 35 });
  assert.deepEqual(brush.unionRect(null, { x: 1, y: 2, w: 3, h: 4 }), { x: 1, y: 2, w: 3, h: 4 });
});

// --------------------------------------------------------------------- zip
await check('crc32 matches the standard check value', () => {
  assert.equal(zip.crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  assert.equal(zip.crc32(new Uint8Array(0)), 0);
});

await check('createZip produces an archive Python can read back', async () => {
  const files = [
    { name: 'a-no-bg.png', data: new Blob([Uint8Array.from({ length: 5000 }, (_, i) => i % 251)]) },
    { name: 'ছবি-white-bg.jpg', data: new Blob([new TextEncoder().encode('hello zip')]) },
    { name: 'empty.webp', data: new Blob([]) },
  ];
  const blob = await zip.createZip(files, new Date(2026, 8, 18, 10, 30, 0));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);

  const file = path.join(mkdtempSync(path.join(tmpdir(), 'zip-')), 'out.zip');
  writeFileSync(file, bytes);
  // ASCII only in the script and its output: the Windows console is cp1252 and
  // would fail on the Bengali file name for reasons that have nothing to do
  // with the archive. The name is checked through escapes instead.
  const script = [
    'import zipfile,sys',
    'z=zipfile.ZipFile(sys.argv[1])',
    'assert z.testzip() is None',
    'info=z.infolist()',
    'assert [i.file_size for i in info]==[5000,9,0]',
    'assert info[1].filename=="\\u099b\\u09ac\\u09bf-white-bg.jpg", ascii(info[1].filename)',
    'assert info[0].filename=="a-no-bg.png" and info[2].filename=="empty.webp"',
    'assert z.read(info[0])[:4]==bytes([0,1,2,3])',
    'assert z.read(info[1])==b"hello zip"',
    'print("ok")',
  ].join('\n');
  const py = spawnSync('python', ['-c', script, file], { encoding: 'utf8' });
  if (py.error) {
    console.log('        (python not available - structure checked only)');
    return;
  }
  assert.equal(py.status, 0, py.stderr);
  assert.equal(py.stdout.trim(), 'ok');
});

console.log(`\n${passed} passed${process.exitCode ? ', with failures' : ''}`);
