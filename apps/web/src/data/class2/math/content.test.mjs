/**
 * Validates the Class 2 Maths content files.
 *
 *   cd apps/web
 *   npx tsc src/data/class2/math/schema.ts --outDir .tmp-test-math \
 *       --module commonjs --target es2020 --skipLibCheck
 *   node src/data/class2/math/content.test.mjs .tmp-test-math/schema.js
 *
 * Same reasoning as the English course's content.test.mjs: this content is
 * hand-authored (via a generator script) from a scanned textbook, so the
 * realistic mistakes are silent ones — a quiz answer index off by one, a
 * NumberItem whose blocks do not add up to its own value, a step pointing at
 * a number id that does not exist.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const compiled = process.argv[2];
if (!compiled) {
  console.error('usage: node content.test.mjs <path to compiled schema.js>');
  process.exit(1);
}
const { validateChapter, chapterNumbers, chapterStarTotal } = require(path.resolve(compiled));

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

check('there is at least one chapter file', () => {
  assert.ok(chapterFiles.length > 0, 'no chapter JSON files found');
});

for (const file of chapterFiles) {
  const chapter = JSON.parse(fs.readFileSync(path.join(here, file), 'utf8'));

  check(`${file} passes the schema validator`, () => {
    const issues = validateChapter(chapter);
    assert.equal(
      issues.length, 0,
      `\n${issues.map((i) => `        - ${i.where}: ${i.problem}`).join('\n')}`,
    );
  });

  check(`${file} — every topic cites its book pages`, () => {
    for (const topic of chapter.topics) {
      assert.ok(topic.bookPages?.length,
        `${topic.id} cites no page, so its content cannot be checked`);
    }
  });

  check(`${file} — every worked example says where it came from`, () => {
    for (const topic of chapter.topics) {
      for (const step of topic.steps) {
        if (step.type === 'worked') {
          assert.ok(step.source, `${topic.id}/${step.id} does not say whether it came from the book`);
        }
      }
    }
  });

  check(`${file} — no lesson is longer than a child's attention`, () => {
    for (const topic of chapter.topics) {
      assert.ok(topic.minutes > 0 && topic.minutes <= 20,
        `${topic.id} claims ${topic.minutes} minutes`);
    }
  });

  check(`${file} — every quiz has real questions`, () => {
    for (const topic of chapter.topics) {
      const quiz = topic.steps.find((s) => s.type === 'quiz');
      if (!quiz) continue;
      assert.ok(quiz.questions.length >= 3, `${topic.id} quiz has only ${quiz.questions.length} questions`);
      for (const q of quiz.questions) {
        assert.ok(q.options.length >= 2, `${topic.id}/${q.id} has too few options`);
      }
    }
  });

  check(`${file} — no off-curriculum step types`, () => {
    const allowed = new Set(['intro', 'worked', 'table', 'game', 'quiz', 'done']);
    for (const topic of chapter.topics) {
      for (const step of topic.steps) {
        assert.ok(allowed.has(step.type), `${topic.id}/${step.id} has unknown type "${step.type}"`);
      }
    }
  });
}

// --- the validator must actually catch things -----------------------------
check('validator rejects blocks that do not add up to the number', () => {
  const broken = JSON.parse(fs.readFileSync(path.join(here, chapterFiles[0]), 'utf8'));
  broken.topics[0].numbers[0].blocks.ones += 1;
  assert.ok(validateChapter(broken).length > 0, 'mismatched blocks slipped through');
});

check('validator rejects a quiz answer pointing past its options', () => {
  const broken = JSON.parse(fs.readFileSync(path.join(here, chapterFiles[0]), 'utf8'));
  const quiz = broken.topics[0].steps.find((s) => s.type === 'quiz');
  quiz.questions[0].answer = 99;
  assert.ok(validateChapter(broken).length > 0, 'a bad answer index slipped through');
});

check('validator rejects a topic that never ends', () => {
  const broken = JSON.parse(fs.readFileSync(path.join(here, chapterFiles[0]), 'utf8'));
  broken.topics[0].steps = broken.topics[0].steps.filter((s) => s.type !== 'done');
  assert.ok(validateChapter(broken).length > 0, 'a topic with no ending slipped through');
});

// --- report ----------------------------------------------------------------
for (const file of chapterFiles) {
  const chapter = JSON.parse(fs.readFileSync(path.join(here, file), 'utf8'));
  const numbers = chapterNumbers(chapter);
  console.log(
    `\n  ${file}: chapter ${chapter.number} "${chapter.title}"\n`
    + `    ${chapter.topics.length} topic(s), ${numbers.length} numbers, `
    + `${chapterStarTotal(chapter)} stars available`,
  );
}

console.log(`\n${passed} passed${process.exitCode ? ', with failures' : ''}`);
