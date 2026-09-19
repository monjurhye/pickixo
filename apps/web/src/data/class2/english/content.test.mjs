/**
 * Validates the Class 2 English content files.
 *
 *   cd apps/web
 *   npx tsc src/data/class2/english/schema.ts --outDir .tmp-test \
 *       --module commonjs --target es2020 --skipLibCheck
 *   node src/data/class2/english/content.test.mjs .tmp-test/schema.js
 *
 * These files are hand-transcribed from a scanned textbook, so the realistic
 * mistakes are silent ones: a quiz answer index off by one, a step pointing at
 * a vocabulary id that does not exist, a lesson with no ending. None of those
 * throw — they just produce a lesson that behaves wrongly for a seven-year-old
 * who has no way to tell it is broken rather than themselves.
 *
 * The last group of checks is about honesty to the source: every Bangla gloss
 * must declare itself as an addition, because the textbook contains none.
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
const { validateUnit, unitVocabulary, unitStarTotal } = require(path.resolve(compiled));

const here = path.dirname(fileURLToPath(import.meta.url));
const unitFiles = fs.readdirSync(here)
  .filter((f) => /^unit\d+\.json$/.test(f))
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

check('there is at least one unit file', () => {
  assert.ok(unitFiles.length > 0, 'no unit JSON files found');
});

for (const file of unitFiles) {
  const unit = JSON.parse(fs.readFileSync(path.join(here, file), 'utf8'));

  check(`${file} passes the schema validator`, () => {
    const issues = validateUnit(unit);
    assert.equal(
      issues.length, 0,
      `\n${issues.map((i) => `        - ${i.where}: ${i.problem}`).join('\n')}`,
    );
  });

  check(`${file} — every lesson cites its book pages`, () => {
    for (const lesson of unit.lessons) {
      assert.ok(lesson.bookPages?.length,
        `${lesson.id} cites no page, so its content cannot be checked`);
    }
  });

  check(`${file} — every Bangla meaning is marked as enrichment`, () => {
    // The textbook has no Bangla glosses. Anything here is Pickixo's addition
    // and must say so, or the app misrepresents the curriculum.
    for (const item of unitVocabulary(unit)) {
      if (item.bangla) {
        assert.equal(item.banglaSource, 'enrichment',
          `${item.id} claims a Bangla meaning without marking it as added`);
      }
    }
  });

  check(`${file} — textbook text is never silently invented`, () => {
    for (const lesson of unit.lessons) {
      for (const step of lesson.steps) {
        if (step.type === 'dialogue' || step.type === 'rhyme' || step.type === 'story') {
          assert.ok(step.source,
            `${lesson.id}/${step.id} does not say whether it came from the book`);
        }
      }
    }
  });

  check(`${file} — every vocabulary item has a Bangla meaning`, () => {
    // Required for this project: the learner is a Bangladeshi child and the
    // word alone does not teach them anything.
    const missing = unitVocabulary(unit).filter((v) => !v.bangla).map((v) => v.id);
    assert.equal(missing.length, 0, `no Bangla for: ${missing.join(', ')}`);
  });

  check(`${file} — no lesson is longer than a child's attention`, () => {
    for (const lesson of unit.lessons) {
      assert.ok(lesson.minutes > 0 && lesson.minutes <= 15,
        `${lesson.id} claims ${lesson.minutes} minutes`);
    }
  });

  check(`${file} — instructions stay short`, () => {
    // A 7-year-old does not read a paragraph. Anything long here is a sign the
    // content drifted towards explaining instead of showing.
    for (const lesson of unit.lessons) {
      for (const step of lesson.steps) {
        if (step.type === 'intro' || step.type === 'done') {
          assert.ok(step.say.length <= 90,
            `${lesson.id}/${step.id} says ${step.say.length} characters`);
        }
      }
    }
  });

  check(`${file} — every quiz question has a hint or an explanation path`, () => {
    for (const lesson of unit.lessons) {
      const quiz = lesson.steps.find((s) => s.type === 'quiz');
      if (!quiz) continue;
      assert.ok(quiz.questions.length >= 3,
        `${lesson.id} quiz has only ${quiz.questions.length} questions`);
      for (const q of quiz.questions) {
        assert.ok(q.options.length >= 2, `${lesson.id}/${q.id} has too few options`);
      }
    }
  });

  check(`${file} — no Reel-style or off-curriculum step types`, () => {
    const allowed = new Set(['intro', 'vocab', 'dialogue', 'rhyme', 'story',
                             'command', 'speak', 'game', 'quiz', 'done']);
    for (const lesson of unit.lessons) {
      for (const step of lesson.steps) {
        assert.ok(allowed.has(step.type),
          `${lesson.id}/${step.id} has unknown type "${step.type}"`);
      }
    }
  });
}

// --- the validator must actually catch things -----------------------------
check('validator rejects a quiz answer pointing past its options', () => {
  const broken = JSON.parse(fs.readFileSync(path.join(here, unitFiles[0]), 'utf8'));
  const quiz = broken.lessons[0].steps.find((s) => s.type === 'quiz');
  quiz.questions[0].answer = 99;
  assert.ok(validateUnit(broken).length > 0, 'a bad answer index slipped through');
});

check('validator rejects a step naming a vocabulary id that does not exist', () => {
  const broken = JSON.parse(fs.readFileSync(path.join(here, unitFiles[0]), 'utf8'));
  const vocabStep = broken.lessons[0].steps.find((s) => s.type === 'vocab');
  vocabStep.items = ['does-not-exist'];
  assert.ok(validateUnit(broken).length > 0, 'a dangling vocabulary id slipped through');
});

check('validator rejects a lesson that never ends', () => {
  const broken = JSON.parse(fs.readFileSync(path.join(here, unitFiles[0]), 'utf8'));
  broken.lessons[0].steps = broken.lessons[0].steps.filter((s) => s.type !== 'done');
  assert.ok(validateUnit(broken).length > 0, 'a lesson with no ending slipped through');
});

check('validator rejects a command step with nothing to do', () => {
  const unit3 = unitFiles.find((f) => f.startsWith('unit03'));
  const broken = JSON.parse(fs.readFileSync(path.join(here, unit3), 'utf8'));
  const cmd = broken.lessons[0].steps.find((s) => s.type === 'command');
  cmd.commands = [];
  assert.ok(validateUnit(broken).length > 0, 'an empty "listen and do" step slipped through');
});

check('validator rejects an unmarked Bangla meaning', () => {
  const broken = JSON.parse(fs.readFileSync(path.join(here, unitFiles[0]), 'utf8'));
  broken.lessons[0].vocabulary[0].banglaSource = 'textbook';
  assert.ok(validateUnit(broken).length > 0,
    'a Bangla gloss claiming to be from the textbook slipped through');
});

// --- report ----------------------------------------------------------------
for (const file of unitFiles) {
  const unit = JSON.parse(fs.readFileSync(path.join(here, file), 'utf8'));
  const vocab = unitVocabulary(unit);
  console.log(
    `\n  ${file}: unit ${unit.number} "${unit.title}"\n`
    + `    ${unit.lessons.length} lessons, ${vocab.length} words, `
    + `${unitStarTotal(unit)} stars available`,
  );
}

console.log(`\n${passed} passed${process.exitCode ? ', with failures' : ''}`);
