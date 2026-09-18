/**
 * Tests for the background remover's geometry, run against the compiled source.
 *
 *   cd apps/web
 *   npx tsc src/lib/background-removal/geometry.ts --outDir .tmp-test \
 *       --module commonjs --target es2020 --skipLibCheck
 *   node src/lib/background-removal/geometry.test.mjs .tmp-test/geometry.js
 *
 * The rule these exist to protect: in the browser the model runs at exactly
 * 1024x1024 and nothing else. A sweep of every multiple of 64 from 320 to 960
 * failed in a real browser, and a small image would have been the first
 * casualty — the earlier version of this code sized the canvas to the image,
 * so a 200x150 thumbnail would have crashed on its own.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const target = process.argv[2];
if (!target) {
  console.error('usage: node geometry.test.mjs <path to compiled geometry.js>');
  process.exit(1);
}
const g = require(path.resolve(target));

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    console.error(`  FAIL  ${name}\n        ${err.message}`);
    process.exitCode = 1;
  }
}

// ------------------------------------------------------------------ snapTo64
check('snapTo64 always returns a positive multiple of 64', () => {
  for (const value of [0, -5, 1, 31, 32, 33, 63, 64, 65, 100, 672, 1023, 4000]) {
    const out = g.snapTo64(value);
    assert.equal(out % 64, 0, `${value} -> ${out} is not a multiple of 64`);
    assert.ok(out >= 64, `${value} -> ${out} is below the minimum`);
  }
});

check('snapTo64 rounds to the nearest', () => {
  assert.equal(g.snapTo64(96), 128);   // exact midpoint rounds up
  assert.equal(g.snapTo64(95), 64);
  assert.equal(g.snapTo64(1024), 1024);
});

// ------------------------------------------------------------- planLetterbox
check('the model side is the one size the browser runtime accepts', () => {
  assert.equal(g.MODEL_SIDE, 1024);
  assert.equal(g.MODEL_SIDE % 64, 0);
});

check('every image shape is run at exactly 1024', () => {
  // The regression that matters. Includes 3:2, 16:9, panoramas, thin strips
  // and squares, plus a pseudo-random sweep.
  const shapes = [
    [1024, 672], [1920, 1280], [1920, 1080], [4032, 3024], [3024, 4032],
    [1, 1], [7, 3000], [3000, 7], [640, 640], [1919, 1439], [100, 99],
  ];
  for (let i = 0; i < 400; i++) {
    shapes.push([1 + ((i * 7919) % 5000), 1 + ((i * 104729) % 5000)]);
  }
  for (const [w, h] of shapes) {
    const plan = g.planLetterbox(w, h);
    assert.equal(plan.side, g.MODEL_SIDE,
      `${w}x${h} -> side ${plan.side}; only ${g.MODEL_SIDE} runs in the browser`);
    assert.ok(plan.drawWidth >= 1 && plan.drawHeight >= 1,
      `${w}x${h} -> degenerate draw size`);
    assert.ok(plan.drawWidth <= plan.side && plan.drawHeight <= plan.side,
      `${w}x${h} -> draw ${plan.drawWidth}x${plan.drawHeight} overflows ${plan.side}`);
    assert.ok(plan.offsetX >= 0 && plan.offsetY >= 0, `${w}x${h} -> negative offset`);
    assert.ok(plan.offsetX + plan.drawWidth <= plan.side
      && plan.offsetY + plan.drawHeight <= plan.side,
      `${w}x${h} -> drawn region falls outside the canvas`);
  }
});

check('letterbox preserves aspect ratio', () => {
  for (const [w, h] of [[1920, 1080], [3024, 4032], [1000, 1000], [2400, 800]]) {
    const plan = g.planLetterbox(w, h);
    const wanted = w / h;
    const got = plan.drawWidth / plan.drawHeight;
    // Rounding to whole pixels moves this slightly; 2% is well inside what a
    // squash would produce and comfortably outside rounding noise.
    assert.ok(Math.abs(wanted - got) / wanted < 0.02,
      `${w}x${h}: aspect ${wanted.toFixed(3)} became ${got.toFixed(3)}`);
  }
});

check('letterbox fills one axis of the canvas', () => {
  // Otherwise the subject is needlessly small in frame and detail is wasted.
  for (const [w, h] of [[1920, 1080], [1080, 1920], [2000, 2000]]) {
    const plan = g.planLetterbox(w, h);
    const fills = plan.drawWidth === plan.side || plan.drawHeight === plan.side;
    assert.ok(fills, `${w}x${h}: drew ${plan.drawWidth}x${plan.drawHeight} `
      + `inside ${plan.side} without touching an edge`);
  }
});

check('a small image still runs at the full canvas', () => {
  // It would be tempting to run a thumbnail at its own size to save time. The
  // browser runtime cannot, and doing it anyway is a crash, not a slowdown.
  const plan = g.planLetterbox(200, 150);
  assert.equal(plan.side, g.MODEL_SIDE);
  assert.ok(plan.drawWidth === g.MODEL_SIDE || plan.drawHeight === g.MODEL_SIDE);
});

check('images with no dimensions are rejected', () => {
  for (const [w, h] of [[0, 100], [100, 0], [-1, 10], [NaN, 10]]) {
    assert.throws(() => g.planLetterbox(w, h), /dimensions/,
      `${w}x${h} should have been refused`);
  }
});

// ----------------------------------------------------------------- fitWithin
check('fitWithin caps the pixel count and keeps the aspect', () => {
  const { width, height, scaled } = g.fitWithin(12000, 9000, 40_000_000);
  assert.ok(scaled);
  assert.ok(width * height <= 40_000_000, `${width}x${height} is still too large`);
  assert.ok(Math.abs((width / height) - (12000 / 9000)) < 0.01);
});

check('fitWithin leaves ordinary photos alone', () => {
  const { width, height, scaled } = g.fitWithin(4032, 3024, 40_000_000);
  assert.equal(scaled, false);
  assert.equal(width, 4032);
  assert.equal(height, 3024);
});

// --------------------------------------------------------------- formatBytes
check('formatBytes is readable at every magnitude', () => {
  assert.equal(g.formatBytes(0), '0 B');
  assert.equal(g.formatBytes(512), '512 B');
  assert.equal(g.formatBytes(2048), '2 KB');
  assert.equal(g.formatBytes(88_171_951), '84.1 MB');
  assert.equal(g.formatBytes(-1), '—');
});

console.log(`\n${passed} passed${process.exitCode ? ', with failures' : ''}`);
