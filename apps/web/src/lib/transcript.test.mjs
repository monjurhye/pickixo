/**
 * Tests for the transcript formatters, run against the real compiled source.
 *
 *   cd apps/web
 *   npx tsc src/lib/transcript.ts --outDir .tmp-test --module commonjs \
 *       --target es2020 --skipLibCheck
 *   node src/lib/transcript.test.mjs .tmp-test/transcript.js
 *
 * These functions produce files people load into video editors. A malformed
 * SRT does not throw — it silently shows nothing, or shows two subtitles at
 * once — so the failure mode is invisible without a test.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const modulePath = process.argv[2];
if (!modulePath) {
  console.error('usage: node transcript.test.mjs <path to compiled transcript.js>');
  process.exit(1);
}
const t = require(process.argv[2].startsWith('.') || process.argv[2].startsWith('/')
  ? require('node:path').resolve(process.argv[2])
  : process.argv[2]);

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

// ---------------------------------------------------------------- timestamps
check('timestamp is mm:ss until an hour, then h:mm:ss', () => {
  assert.equal(t.formatTimestamp(0), '00:00');
  assert.equal(t.formatTimestamp(9), '00:09');
  assert.equal(t.formatTimestamp(75), '01:15');
  assert.equal(t.formatTimestamp(3599), '59:59');
  assert.equal(t.formatTimestamp(3600), '1:00:00');
  assert.equal(t.formatTimestamp(7325), '2:02:05');
});

check('srt time uses a comma and three millisecond digits', () => {
  assert.equal(t.formatSrtTime(0), '00:00:00,000');
  assert.equal(t.formatSrtTime(3.2), '00:00:03,200');
  assert.equal(t.formatSrtTime(61.5), '00:01:01,500');
  assert.equal(t.formatSrtTime(3661.25), '01:01:01,250');
});

check('srt milliseconds carry instead of producing 1000', () => {
  // Rounding 3.9996 must give 4.000, never 3.1000 — which is not a valid time
  // and which players reject outright.
  assert.equal(t.formatSrtTime(3.9996), '00:00:04,000');
  assert.equal(t.formatSrtTime(59.9999), '00:01:00,000');
  assert.equal(t.formatSrtTime(3599.9999), '01:00:00,000');
});

// ----------------------------------------------------------------------- srt
const SEGMENTS = [
  { start: 0, duration: 3.2, text: 'Hello everyone' },
  { start: 3.2, duration: 3.3, text: 'Today we are going to' },
  // Overlaps the next segment — YouTube really does emit these.
  { start: 6.5, duration: 10, text: 'talk about testing' },
  { start: 9.0, duration: 2, text: 'and why it matters' },
];

check('srt cues are numbered from 1 with no gaps', () => {
  const srt = t.toSrtFile(SEGMENTS);
  const numbers = srt.split('\n').filter((l) => /^\d+$/.test(l)).map(Number);
  assert.deepEqual(numbers, [1, 2, 3, 4]);
});

check('srt cue never runs past the next cue start', () => {
  const srt = t.toSrtFile(SEGMENTS);
  // Segment 3 claims 10s but the next starts at 9.0, so it must be clamped.
  assert.ok(
    srt.includes('00:00:06,500 --> 00:00:09,000'),
    `overlapping cue was not clamped:\n${srt}`,
  );
});

check('srt has no zero-length cues', () => {
  const srt = t.toSrtFile([{ start: 5, duration: 0, text: 'instant' }]);
  const [, times] = srt.split('\n');
  const [from, to] = times.split(' --> ');
  assert.notEqual(from, to, 'a zero-length cue is invalid and will not display');
});

check('srt block structure is well formed', () => {
  const srt = t.toSrtFile(SEGMENTS.slice(0, 1));
  assert.equal(srt, '1\n00:00:00,000 --> 00:00:03,200\nHello everyone\n');
});

// ----------------------------------------------------------------------- txt
check('plain text is just the words', () => {
  const text = t.toPlainText(SEGMENTS);
  assert.equal(text, 'Hello everyone Today we are going to talk about testing and why it matters');
  assert.ok(!text.includes('['), 'plain copy must not contain timestamps');
});

check('timestamped text puts one segment per line', () => {
  const text = t.toTimestampedText(SEGMENTS);
  assert.equal(text.split('\n').length, 4);
  assert.ok(text.startsWith('[00:00] Hello everyone'));
});

check('txt file carries the video identity', () => {
  const txt = t.toTxtFile({
    video: { id: 'abc', url: 'https://www.youtube.com/watch?v=abc', title: 'My Video',
             channel: 'My Channel', channel_url: null, thumbnail_url: null,
             duration_seconds: 12 },
    language: 'en', segment_count: 4, transcript: SEGMENTS, cached: false,
  });
  assert.ok(txt.includes('My Video'));
  assert.ok(txt.includes('My Channel'));
  assert.ok(txt.includes('https://www.youtube.com/watch?v=abc'));
  assert.ok(txt.includes('[00:00] Hello everyone'));
});

// ------------------------------------------------------------------ filename
check('filename is safe and falls back to the video id', () => {
  assert.equal(t.safeFilename('Hello: World / Test?', 'abc123'), 'Hello-World-Test');
  assert.equal(t.safeFilename(null, 'abc123'), 'youtube-transcript-abc123');
  assert.equal(t.safeFilename('!!!', 'abc123'), 'youtube-transcript-abc123');
});

// ----------------------------------------------------------- url validation
check('accepts the url shapes youtube hands out', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ?si=abc',
    'dQw4w9WgXcQ',
  ]) {
    assert.ok(t.looksLikeYouTubeUrl(url), `should accept ${url}`);
  }
});

check('rejects look-alike hosts and junk', () => {
  for (const url of [
    '', '   ', 'not a url',
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch',
    'https://www.youtube.com/watch?v=tooshort',
  ]) {
    assert.ok(!t.looksLikeYouTubeUrl(url), `should reject ${url}`);
  }
});

console.log(`\n${passed} passed${process.exitCode ? ', with failures' : ''}`);
