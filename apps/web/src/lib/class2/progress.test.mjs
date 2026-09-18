/**
 * Tests for progress, mastery and rewards.
 *
 *   cd apps/web
 *   npx tsc src/lib/class2/progress.ts --outDir .tmp-test --module commonjs \
 *       --target es2020 --skipLibCheck
 *   node src/lib/class2/progress.test.mjs .tmp-test/progress.js
 *
 * The properties here are about a child's experience rather than arithmetic:
 *
 *   * a lucky guess must not remove a word from practice;
 *   * a wrong answer must put it back;
 *   * repeating a lesson must not mint new stars, or the star count stops
 *     meaning anything;
 *   * a missed day must not zero the streak.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const target = process.argv[2];
if (!target) {
  console.error('usage: node progress.test.mjs <path to compiled progress.js>');
  process.exit(1);
}
const p = require(path.resolve(target));

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

const blank = () => ({
  version: 1, stars: 0, badges: [], lastActiveDay: null, streak: 0,
  lessons: {}, vocabulary: {}, minutes: 0, updatedAt: new Date(0).toISOString(),
});

// ------------------------------------------------------------------ mastery
check('a word starts unseen and moves forward when answered correctly', () => {
  let s = blank();
  s = p.recordAnswer(s, 'crow', true);
  assert.equal(s.vocabulary.crow.mastery, 'learning');
  s = p.recordAnswer(s, 'crow', true);
  assert.equal(s.vocabulary.crow.mastery, 'practicing');
  s = p.recordAnswer(s, 'crow', true);
  assert.equal(s.vocabulary.crow.mastery, 'mastered');
});

check('mastery cannot be reached from nothing in a single guess', () => {
  let s = blank();
  s = p.recordAnswer(s, 'deer', true);
  assert.notEqual(s.vocabulary.deer.mastery, 'mastered',
    'one correct answer should not master a word');
});

check('a wrong answer moves the word backwards', () => {
  let s = blank();
  s = p.recordAnswer(s, 'deer', true);
  s = p.recordAnswer(s, 'deer', true);
  assert.equal(s.vocabulary.deer.mastery, 'practicing');
  s = p.recordAnswer(s, 'deer', false);
  assert.equal(s.vocabulary.deer.mastery, 'learning');
});

check('a wrong answer puts the word into the revision queue', () => {
  let s = blank();
  s = p.recordAnswer(s, 'deer', false);
  assert.equal(s.vocabulary.deer.needsPractice, true);
  const queue = p.revisionQueue(s);
  assert.ok(queue.some((v) => v.id === 'deer'), 'deer should be queued');
});

check('the brief\'s own example: a repeatedly missed word keeps coming back', () => {
  let s = blank();
  for (let i = 0; i < 3; i++) s = p.recordAnswer(s, 'deer', false);
  s = p.recordAnswer(s, 'crow', false);
  const queue = p.revisionQueue(s);
  assert.equal(queue[0].id, 'deer', 'the most-missed word should come first');
});

check('mastery never runs off either end of the scale', () => {
  let s = blank();
  for (let i = 0; i < 10; i++) s = p.recordAnswer(s, 'ant', true);
  assert.equal(s.vocabulary.ant.mastery, 'mastered');
  for (let i = 0; i < 10; i++) s = p.recordAnswer(s, 'ant', false);
  assert.equal(s.vocabulary.ant.mastery, 'not_started');
});

// -------------------------------------------------------------------- stars
check('finishing a lesson awards stars', () => {
  const s = blank();
  const out = p.completeLesson(s, { id: 'u1l1', unitId: 'u1', minutes: 6 },
                               { score: 3, total: 5 });
  assert.equal(out.starsAwarded, p.STARS_PER_LESSON);
  assert.equal(out.progress.stars, p.STARS_PER_LESSON);
  assert.equal(out.firstTime, true);
});

check('a perfect quiz earns the quiz bonus', () => {
  const out = p.completeLesson(blank(), { id: 'u1l1', unitId: 'u1', minutes: 6 },
                               { score: 5, total: 5 });
  assert.equal(out.starsAwarded, p.STARS_PER_LESSON + p.STARS_PER_QUIZ);
});

check('repeating a lesson does not mint new stars', () => {
  let s = blank();
  s = p.completeLesson(s, { id: 'u1l1', unitId: 'u1', minutes: 6 },
                       { score: 5, total: 5 }).progress;
  const before = s.stars;
  const again = p.completeLesson(s, { id: 'u1l1', unitId: 'u1', minutes: 6 },
                                 { score: 5, total: 5 });
  assert.equal(again.starsAwarded, 0);
  assert.equal(again.progress.stars, before);
  assert.equal(again.firstTime, false);
});

check('repeating still records the attempt and the best score', () => {
  let s = blank();
  s = p.completeLesson(s, { id: 'u1l1', unitId: 'u1', minutes: 6 },
                       { score: 2, total: 5 }).progress;
  s = p.completeLesson(s, { id: 'u1l1', unitId: 'u1', minutes: 6 },
                       { score: 4, total: 5 }).progress;
  assert.equal(s.lessons.u1l1.bestScore, 4);
  assert.equal(s.lessons.u1l1.attempts, 2);
});

check('a lower repeat score does not replace a better one', () => {
  let s = blank();
  s = p.completeLesson(s, { id: 'u1l1', unitId: 'u1', minutes: 6 },
                       { score: 5, total: 5 }).progress;
  s = p.completeLesson(s, { id: 'u1l1', unitId: 'u1', minutes: 6 },
                       { score: 1, total: 5 }).progress;
  assert.equal(s.lessons.u1l1.bestScore, 5);
});

// ------------------------------------------------------------------- streak
check('a first session starts the streak at one', () => {
  const out = p.completeLesson(blank(), { id: 'u1l1', unitId: 'u1', minutes: 6 }, null);
  assert.equal(out.progress.streak, 1);
});

check('two lessons on the same day do not double the streak', () => {
  let s = blank();
  s = p.completeLesson(s, { id: 'a', unitId: 'u1', minutes: 6 }, null).progress;
  s = p.completeLesson(s, { id: 'b', unitId: 'u1', minutes: 6 }, null).progress;
  assert.equal(s.streak, 1);
});

check('a missed day resets to one, never to zero', () => {
  // Nothing should ever tell a child their streak is gone.
  const stale = { ...blank(), streak: 9, lastActiveDay: '2020-01-01' };
  const out = p.completeLesson(stale, { id: 'a', unitId: 'u1', minutes: 6 }, null);
  assert.equal(out.progress.streak, 1);
});

// ------------------------------------------------------------------ badges
check('a badge is only awarded once', () => {
  let s = p.awardBadge(blank(), 'unit-1');
  s = p.awardBadge(s, 'unit-1');
  assert.deepEqual(s.badges, ['unit-1']);
});

check('a unit counts as complete only when every lesson is done', () => {
  let s = blank();
  s = p.completeLesson(s, { id: 'u1l1', unitId: 'u1', minutes: 6 }, null).progress;
  assert.equal(p.unitComplete(s, 'u1', ['u1l1', 'u1l2', 'u1l3']), false);
  s = p.completeLesson(s, { id: 'u1l2', unitId: 'u1', minutes: 6 }, null).progress;
  s = p.completeLesson(s, { id: 'u1l3', unitId: 'u1', minutes: 7 }, null).progress;
  assert.equal(p.unitComplete(s, 'u1', ['u1l1', 'u1l2', 'u1l3']), true);
});

// ------------------------------------------------------------- star rating
check('score maps to stars, and a wrong answer never means zero stars', () => {
  assert.equal(p.scoreToStars(5, 5), 5);
  assert.equal(p.scoreToStars(4, 5), 4);
  assert.equal(p.scoreToStars(3, 5), 3);
  assert.equal(p.scoreToStars(0, 5), 1,
    'even a child who got everything wrong should not see zero stars');
});

console.log(`\n${passed} passed${process.exitCode ? ', with failures' : ''}`);
