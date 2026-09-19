/**
 * Tests for the adaptive, mastery and revision engines.
 *
 *   cd apps/web
 *   npx tsc src/lib/kids/*.ts --outDir .tmp-kids \
 *       --module commonjs --target es2020 --skipLibCheck
 *   node src/lib/kids/engine.test.mjs .tmp-kids
 *
 * These are the rules that decide what a four-year-old is asked to do next, so
 * the things worth pinning down are the ones that would be invisible if they
 * broke: that a struggling child actually gets easier work, that a lucky guess
 * does not promote anybody, that mastery survives a bad minute, and that
 * nothing anywhere produces a message harsher than "আবার চেষ্টা করি".
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const dir = process.argv[2];
if (!dir) {
  console.error('usage: node engine.test.mjs <compiled dir>');
  process.exit(1);
}
const load = (name) => require(path.resolve(dir, name));

const { emptyItem, applyAttempt, masteryFor, confusions } = load('mastery.js');
const { decide, applyDecision, lessonLevel, nextActivity, nextItems, feedback } =
  load('adaptive.js');
const { schedule, due, discriminationSet, clearConfusion } = load('revision.js');
const { activitiesFor } = load('content.js');

let passed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); passed += 1; } catch (e) { failures.push(`${name}\n    ${e.message.split('\n')[0]}`); }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const DAY = '2026-09-18';
function attempt(correct, over = {}) {
  return {
    correct,
    level: over.level ?? 'learn',
    ms: over.ms ?? 3000,
    helped: over.helped ?? false,
    activity: over.activity ?? 'find-letter',
    confusedWith: over.confusedWith,
    at: over.at ?? `${DAY}T10:00:00.000Z`,
  };
}

/** Feed a sequence of attempts through the full loop, as progress.ts does. */
function run(item, attempts) {
  let current = item;
  for (const a of attempts) {
    current = applyAttempt(current, a);
    current = applyDecision(current, decide(current, a));
  }
  return current;
}

/* -------------------------------------------------------------------------- */
/* Levels                                                                     */
/* -------------------------------------------------------------------------- */

check('a new item starts at explore', () => {
  assert.equal(emptyItem('ka').level, 'explore');
  assert.equal(emptyItem('ka').mastery, 'not_started');
});

check('four quick unaided correct answers promote', () => {
  const item = run(emptyItem('ka'), Array(4).fill(attempt(true, { level: 'explore' })));
  assert.equal(item.level, 'learn', 'should have moved up one level');
});

check('a promotion is only one level at a time', () => {
  const item = run(emptyItem('ka'), Array(4).fill(attempt(true, { level: 'explore' })));
  assert.notEqual(item.level, 'practice', 'jumped two levels on one run');
});

check('being helped withholds promotion', () => {
  const item = run(emptyItem('ka'), Array(6).fill(attempt(true, { helped: true })));
  assert.equal(item.level, 'explore', 'promoted a child who used a hint every time');
});

check('being slow withholds promotion but never demotes', () => {
  const item = run(emptyItem('ka'), Array(5).fill(attempt(true, { ms: 30000 })));
  assert.equal(item.level, 'explore', 'promoted on slow answers');
  assert.equal(item.wrong, 0);
});

check('two wrong in a row drops a level', () => {
  let item = { ...emptyItem('ka'), level: 'practice' };
  item = run(item, [attempt(false), attempt(false)]);
  assert.equal(item.level, 'learn');
});

check('three wrong in the last five drops a level', () => {
  let item = { ...emptyItem('ka'), level: 'practice' };
  item = run(item, [
    attempt(false), attempt(true), attempt(false), attempt(true), attempt(false),
  ]);
  assert.equal(item.level, 'learn');
});

check('explore is the floor — a struggling child is never stranded', () => {
  const item = run(emptyItem('ka'), Array(10).fill(attempt(false)));
  assert.equal(item.level, 'explore', 'fell below the easiest level');
});

check('master is the ceiling', () => {
  let item = { ...emptyItem('ka'), level: 'master' };
  item = run(item, Array(8).fill(attempt(true, { level: 'master' })));
  assert.equal(item.level, 'master');
});

check('a streak does not carry across a level change', () => {
  const item = run(emptyItem('ka'), Array(4).fill(attempt(true)));
  assert.equal(item.streak, 0, 'kept the streak, so it would promote twice on one run');
});

check('level is per item, not per child', () => {
  const ka = run(emptyItem('ka'), Array(4).fill(attempt(true)));
  const nga = run(emptyItem('nga'), [attempt(false), attempt(false)]);
  assert.equal(ka.level, 'learn');
  assert.equal(nga.level, 'explore');
});

/* -------------------------------------------------------------------------- */
/* Mastery                                                                    */
/* -------------------------------------------------------------------------- */

check('one correct answer is learning, not mastered', () => {
  const item = run(emptyItem('ka'), [attempt(true)]);
  assert.equal(item.mastery, 'learning');
});

check('seeing an item without getting it right is only introduced', () => {
  const item = run(emptyItem('ka'), [attempt(false)]);
  assert.equal(item.mastery, 'introduced');
});

check('practicing needs more than one kind of activity', () => {
  const same = run(emptyItem('ka'), Array(4).fill(attempt(true, { activity: 'find-letter' })));
  assert.equal(same.mastery, 'learning', 'called it practice after one activity type');

  const mixed = run(emptyItem('kb'), [
    attempt(true, { activity: 'find-letter' }),
    attempt(true, { activity: 'trace' }),
    attempt(true, { activity: 'tap-answer' }),
  ]);
  assert.equal(mixed.mastery, 'practicing');
});

check('mastery cannot be reached in a single day', () => {
  const item = run(emptyItem('ka'), [
    ...Array(6).fill(attempt(true, { level: 'master', activity: 'find-letter' })),
    ...Array(6).fill(attempt(true, { level: 'master', activity: 'trace' })),
  ]);
  assert.notEqual(item.mastery, 'mastered', 'mastered a letter in one sitting');
  assert.equal(item.mastery, 'confident');
});

/**
 * A child who has already worked their way up to master level on this item.
 *
 * Built explicitly so the day-boundary rules can be tested on their own. The
 * long climb from explore to master is covered by the level tests above; it
 * takes a dozen correct answers, which is the intended pace and not what these
 * two tests are about.
 */
function atMasterLevel(id) {
  return { ...emptyItem(id), level: 'master' };
}

check('mastery arrives on a second day', () => {
  let item = run(atMasterLevel('ka'), [
    ...Array(3).fill(attempt(true, { level: 'master', activity: 'find-letter' })),
    ...Array(3).fill(attempt(true, { level: 'master', activity: 'trace' })),
  ]);
  assert.equal(item.mastery, 'confident', 'not confident after a full first day');

  item = run(item, Array(2).fill(
    attempt(true, { level: 'master', activity: 'tap-answer', at: '2026-09-19T10:00:00.000Z' }),
  ));
  assert.equal(item.mastery, 'mastered');
});

check('mastery needs one unaided answer at master level', () => {
  const item = run(emptyItem('ka'), [
    ...Array(4).fill(attempt(true, { level: 'practice', activity: 'find-letter' })),
    ...Array(4).fill(attempt(true, { level: 'practice', activity: 'trace' })),
    ...Array(3).fill(attempt(true, {
      level: 'practice', activity: 'tap-answer', at: '2026-09-19T10:00:00.000Z',
    })),
  ]);
  assert.equal(item.masteredTouch, false);
  assert.notEqual(item.mastery, 'mastered', 'mastered without ever working symbolically');
});

check('one miss does not undo mastery', () => {
  let item = run(atMasterLevel('ka'), [
    ...Array(3).fill(attempt(true, { level: 'master', activity: 'find-letter' })),
    ...Array(3).fill(attempt(true, { level: 'master', activity: 'trace' })),
  ]);
  item = run(item, Array(2).fill(
    attempt(true, { level: 'master', activity: 'tap-answer', at: '2026-09-19T10:00:00.000Z' }),
  ));
  assert.equal(item.mastery, 'mastered');

  const after = run(item, [attempt(false, { at: '2026-09-19T10:05:00.000Z' })]);
  assert.ok(
    after.mastery === 'mastered' || after.mastery === 'confident',
    `one miss knocked mastery all the way to ${after.mastery}`,
  );
});

check('a miss makes the work easier immediately, even at mastered', () => {
  // The separation that the whole design rests on: the *task* gets easier at
  // once so the child is not stuck, while the *record* stays honest.
  let item = run(atMasterLevel('ka'), [
    ...Array(3).fill(attempt(true, { level: 'master', activity: 'find-letter' })),
    ...Array(3).fill(attempt(true, { level: 'master', activity: 'trace' })),
  ]);
  item = run(item, [
    attempt(false, { level: 'master', at: '2026-09-19T10:00:00.000Z' }),
    attempt(false, { level: 'master', at: '2026-09-19T10:01:00.000Z' }),
  ]);
  assert.equal(item.level, 'practice', 'the next question was not made easier');
  assert.notEqual(item.mastery, 'not_started');
});

/* -------------------------------------------------------------------------- */
/* Revision                                                                   */
/* -------------------------------------------------------------------------- */

check('an item still being learned comes back immediately', () => {
  const item = run(emptyItem('ka'), [attempt(true)]);
  assert.equal(schedule(item, `${DAY}T10:00:00.000Z`), `${DAY}T10:00:00.000Z`);
});

check('a missed item comes back tomorrow, not in a month', () => {
  let item = run(emptyItem('ka'), [
    ...Array(3).fill(attempt(true, { activity: 'a' })),
    ...Array(2).fill(attempt(true, { activity: 'b' })),
  ]);
  item = run(item, [attempt(false)]);
  const next = schedule(item, `${DAY}T10:00:00.000Z`);
  assert.ok(next > `${DAY}T10:00:00.000Z`, 'not scheduled forward at all');
  assert.ok(next < '2026-09-20T00:00:00.000Z', `pushed out to ${next}`);
});

check('intervals expand as an item is repeatedly right', () => {
  const at = `${DAY}T10:00:00.000Z`;
  const few = { ...emptyItem('ka'), mastery: 'confident', correct: 1, recent: [true] };
  const many = { ...emptyItem('kb'), mastery: 'confident', correct: 4, recent: [true] };
  assert.ok(schedule(many, at) > schedule(few, at), 'a well-known item came back sooner');
});

check('two confusions build a discrimination set, one does not', () => {
  const once = { ka: run(emptyItem('ka'), [attempt(false, { confusedWith: 'kha' })]) };
  assert.equal(discriminationSet(once), null, 'built an intervention from one slip');

  const twice = { ka: run(emptyItem('ka'), Array(2).fill(attempt(false, { confusedWith: 'kha' }))) };
  const set = discriminationSet(twice);
  assert.ok(set, 'no set after two confusions');
  assert.equal(set.target, 'ka');
  assert.equal(set.against, 'kha');
});

check('a discrimination set does not always answer the same side', () => {
  const items = { ka: run(emptyItem('ka'), Array(3).fill(attempt(false, { confusedWith: 'kha' }))) };
  const answers = discriminationSet(items).rounds
    .filter((r) => r.kind === 'choose').map((r) => r.answer);
  assert.ok(new Set(answers).size > 1, 'the answer is always the same letter');
});

check('a resolved confusion can be cleared', () => {
  const item = run(emptyItem('ka'), Array(2).fill(attempt(false, { confusedWith: 'kha' })));
  assert.ok(item.confusedWith.kha >= 2);
  assert.deepEqual(clearConfusion(item, 'kha').confusedWith, {});
});

check('the revision queue puts the most-missed first', () => {
  const items = {
    a: { ...emptyItem('a'), mastery: 'confident', wrong: 1, dueAt: null },
    b: { ...emptyItem('b'), mastery: 'confident', wrong: 5, dueAt: null },
  };
  assert.equal(due(items, `${DAY}T10:00:00.000Z`)[0].id, 'b');
});

check('an untouched item is never called due', () => {
  const items = { a: emptyItem('a') };
  assert.deepEqual(due(items, `${DAY}T10:00:00.000Z`), []);
});

/* -------------------------------------------------------------------------- */
/* Choosing what is next                                                      */
/* -------------------------------------------------------------------------- */

const lesson = {
  id: 'test', subject: 'bangla', unit: 'u', number: 1, title: 't',
  source: { book: 'b', edition: '2018', bookPages: [1] },
  objectives: [{ code: '৪.১.৪', band: '5+', text: 'x' }],
  items: [{ id: 'ka', glyph: 'ক', kind: 'consonant', words: [], audio: null, wordInitial: true, strokes: null },
          { id: 'kha', glyph: 'খ', kind: 'consonant', words: [], audio: null, wordInitial: true, strokes: null }],
  activities: {
    explore: ['listen-look'], learn: ['trace', 'find-letter'],
    practice: ['tap-answer'], master: [],
  },
  minutes: 5,
};

check('an unopened lesson starts at explore', () => {
  assert.equal(lessonLevel(lesson, {}), 'explore');
});

check('lesson level is the median, so one hard letter does not drag it down', () => {
  const progress = {
    ka: { ...emptyItem('ka'), level: 'practice', correct: 5 },
    kha: { ...emptyItem('kha'), level: 'explore', correct: 1 },
  };
  assert.equal(lessonLevel(lesson, progress), 'learn');
});

check('a level with no activities falls back down, never up', () => {
  assert.deepEqual(activitiesFor(lesson, 'master'), ['tap-answer']);
});

check('the next activity avoids repeating the last one', () => {
  const next = nextActivity(lesson, 'learn', 'trace', () => 0);
  assert.equal(next, 'find-letter');
});

check('repeating is better than an empty screen', () => {
  assert.equal(nextActivity(lesson, 'explore', 'listen-look', () => 0), 'listen-look');
});

check('unseen items are introduced before anything is drilled', () => {
  const progress = { ka: { ...emptyItem('ka'), correct: 1, wrong: 0 } };
  assert.deepEqual(nextItems(lesson, progress, 1), ['kha']);
});

check('after that, the weakest item comes first', () => {
  const progress = {
    ka: { ...emptyItem('ka'), correct: 1, wrong: 4 },
    kha: { ...emptyItem('kha'), correct: 4, wrong: 1 },
  };
  assert.deepEqual(nextItems(lesson, progress, 1), ['ka']);
});

/* -------------------------------------------------------------------------- */
/* Tone                                                                       */
/* -------------------------------------------------------------------------- */

check('a wrong answer is never called wrong', () => {
  const message = feedback(false, false);
  assert.equal(message, 'আবার চেষ্টা করি ❤️');
  for (const harsh of ['ভুল', 'Wrong', 'wrong', 'X', 'Incorrect', 'fail']) {
    assert.ok(!message.includes(harsh), `feedback says "${harsh}"`);
  }
});

check('a helped answer is still praised', () => {
  assert.ok(feedback(true, true).length > 0);
  assert.notEqual(feedback(true, true), feedback(false, false));
});

/* -------------------------------------------------------------------------- */

if (failures.length) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}
console.log(`✓ ${passed} engine checks passed`);
