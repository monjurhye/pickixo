/**
 * Validates the Class 2 Bangla content files.
 *
 *   cd apps/web
 *   npm run test:class2bangla
 *
 * Same reasoning as the English and Maths courses' content tests: this
 * content is hand-transcribed from a scanned textbook, so the realistic
 * mistakes are silent ones — a quiz answer index off by one, a step pointing
 * at a word id that does not exist, a picture name nobody drew.
 *
 * Bangla adds one check the other two cannot have, and it is the important
 * one: **the book's letter arithmetic has to be true.** ন + ধ = ন্ধ is a
 * claim about Unicode, and `compose()` evaluates it. A wrong conjunct is
 * invisible on the page and is exactly what hand-transcription produces; to a
 * child learning to decode, it is not a typo, it is a wrong letter.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const compiledDir = process.argv[2];
if (!compiledDir) {
  console.error('usage: node content.test.mjs <dir with compiled schema.js + illustrations.js>');
  process.exit(1);
}
const { validateChapter, chapterWords, chapterBuilds, chapterStarTotal, compose } =
  require(path.resolve(compiledDir, 'schema.js'));
const { isIllustrationName } = require(path.resolve(compiledDir, 'illustrations.js'));

const here = path.dirname(fileURLToPath(import.meta.url));
const chapterFiles = fs.readdirSync(here)
  .filter((f) => /^chapter\d+\.json$/.test(f))
  .sort();

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

const read = (file) => JSON.parse(fs.readFileSync(path.join(here, file), 'utf8'));

/** Every picture a lesson can put on screen, wherever it may be named. */
function* illustrationsOf(lesson) {
  for (const word of lesson.words ?? []) {
    if (word.illustration) yield [`${lesson.id}/${word.id}`, word.illustration];
  }
  for (const step of lesson.steps ?? []) {
    if (step.illustration) yield [`${lesson.id}/${step.id}`, step.illustration];
    for (const scene of step.scenes ?? []) {
      if (scene.illustration) yield [`${lesson.id}/${step.id}/${scene.id}`, scene.illustration];
    }
    for (const round of [...(step.rounds ?? []), ...(step.questions ?? [])]) {
      if (round.illustration) yield [`${lesson.id}/${step.id}/${round.id}`, round.illustration];
      for (const [i, option] of (round.options ?? []).entries()) {
        if (option.illustration) {
          yield [`${lesson.id}/${step.id}/${round.id}[${i}]`, option.illustration];
        }
      }
    }
  }
}

check('there is at least one chapter file', () => {
  assert.ok(chapterFiles.length > 0, 'no chapter JSON files found');
});

for (const file of chapterFiles) {
  const chapter = read(file);

  check(`${file} passes the schema validator`, () => {
    const issues = validateChapter(chapter);
    assert.equal(
      issues.length, 0,
      `\n${issues.map((i) => `        - ${i.where}: ${i.problem}`).join('\n')}`,
    );
  });

  check(`${file} — every lesson cites its book pages`, () => {
    for (const lesson of chapter.lessons) {
      assert.ok(lesson.bookPages?.length,
        `${lesson.id} cites no page, so its content cannot be checked`);
    }
  });

  check(`${file} — every quoted text says where it came from`, () => {
    const quoting = new Set(['read', 'dialogue', 'rhyme', 'story', 'letters']);
    for (const lesson of chapter.lessons) {
      for (const step of lesson.steps) {
        if (quoting.has(step.type)) {
          assert.ok(step.source,
            `${lesson.id}/${step.id} does not say whether it came from the book`);
        }
      }
    }
  });

  check(`${file} — every letter build actually composes`, () => {
    for (const lesson of chapter.lessons) {
      for (const build of lesson.builds ?? []) {
        assert.equal(
          compose(build), build.result.normalize('NFC'),
          `${lesson.id}/${build.id}: ${build.parts.join(' + ')} does not make "${build.result}"`,
        );
      }
    }
  });

  check(`${file} — every picture named actually exists`, () => {
    for (const lesson of chapter.lessons) {
      for (const [where, name] of illustrationsOf(lesson)) {
        assert.ok(isIllustrationName(name), `${where} names picture "${name}", which is not drawn`);
      }
    }
  });

  check(`${file} — no lesson is longer than a child's attention`, () => {
    for (const lesson of chapter.lessons) {
      assert.ok(lesson.minutes > 0 && lesson.minutes <= 20,
        `${lesson.id} claims ${lesson.minutes} minutes`);
    }
  });

  check(`${file} — every quiz has real questions`, () => {
    for (const lesson of chapter.lessons) {
      const quiz = lesson.steps.find((s) => s.type === 'quiz');
      assert.ok(quiz, `${lesson.id} has no quiz`);
      assert.ok(quiz.questions.length >= 3,
        `${lesson.id} quiz has only ${quiz.questions.length} questions`);
      for (const q of quiz.questions) {
        assert.ok(q.options.length >= 2, `${lesson.id}/${q.id} has too few options`);
      }
    }
  });

  check(`${file} — no off-curriculum step types`, () => {
    const allowed = new Set([
      'intro', 'read', 'dialogue', 'rhyme', 'story', 'letters', 'build',
      'words', 'game', 'quiz', 'done',
    ]);
    for (const lesson of chapter.lessons) {
      for (const step of lesson.steps) {
        assert.ok(allowed.has(step.type),
          `${lesson.id}/${step.id} has unknown type "${step.type}"`);
      }
    }
  });
}

/* --- the whole course, across files --------------------------------------- */

const allChapters = chapterFiles.map(read);
const allLessons = allChapters.flatMap((c) => c.lessons);

check('the book\'s 29 পাঠ are all present, exactly once', () => {
  const numbers = allLessons.map((l) => l.number).sort((a, b) => a - b);
  const expected = Array.from({ length: 29 }, (_, i) => i + 1);
  assert.deepEqual(numbers, expected,
    `missing: [${expected.filter((n) => !numbers.includes(n))}]`);
});

check('lesson ids are unique across the whole course', () => {
  const ids = allLessons.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length, 'a lesson id is reused in another chapter');
});

check('chapter numbers are unique and start at 1', () => {
  const numbers = allChapters.map((c) => c.number).sort((a, b) => a - b);
  assert.deepEqual(numbers, Array.from({ length: allChapters.length }, (_, i) => i + 1));
});

/* --- the validator must actually catch things ----------------------------- */

check('validator rejects a conjunct whose pieces do not make it', () => {
  const broken = read(chapterFiles.find((f) => read(f).lessons.some((l) => l.builds?.length)));
  const lesson = broken.lessons.find((l) => l.builds?.length);
  lesson.builds[0].result = 'ভুল';
  assert.ok(validateChapter(broken).length > 0, 'a wrong conjunct slipped through');
});

check('validator rejects a quiz answer pointing past its options', () => {
  const broken = read(chapterFiles[0]);
  const quiz = broken.lessons[0].steps.find((s) => s.type === 'quiz');
  quiz.questions[0].answer = 99;
  assert.ok(validateChapter(broken).length > 0, 'a bad answer index slipped through');
});

check('validator rejects a lesson that never ends', () => {
  const broken = read(chapterFiles[0]);
  broken.lessons[0].steps = broken.lessons[0].steps.filter((s) => s.type !== 'done');
  assert.ok(validateChapter(broken).length > 0, 'a lesson with no ending slipped through');
});

check('validator rejects a step naming a word that does not exist', () => {
  const broken = read(chapterFiles[0]);
  const step = broken.lessons.flatMap((l) => l.steps).find((s) => s.type === 'words');
  step.items = ['w-does-not-exist'];
  assert.ok(validateChapter(broken).length > 0, 'a dangling word reference slipped through');
});

/* --- report ---------------------------------------------------------------- */

let lessons = 0;
let words = 0;
let builds = 0;
let stars = 0;
for (const [i, chapter] of allChapters.entries()) {
  const w = chapterWords(chapter).length;
  const b = chapterBuilds(chapter).length;
  lessons += chapter.lessons.length;
  words += w;
  builds += b;
  stars += chapterStarTotal(chapter);
  console.log(
    `\n  ${chapterFiles[i]}: অধ্যায় ${chapter.number} "${chapter.title}"\n`
    + `    ${chapter.lessons.length} lesson(s), ${w} words, ${b} letter builds, `
    + `${chapterStarTotal(chapter)} stars available`,
  );
}
console.log(`\n  TOTAL: ${lessons} lessons, ${words} words, ${builds} builds, ${stars} stars`);

console.log(`\n${passed} passed${process.exitCode ? ', with failures' : ''}`);
