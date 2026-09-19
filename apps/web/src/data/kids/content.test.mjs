/**
 * Validates the Pickixo Kids curriculum files.
 *
 *   cd apps/web
 *   npx tsc src/lib/kids/content.ts --outDir .tmp-kids \
 *       --module commonjs --target es2020 --skipLibCheck
 *   node src/data/kids/content.test.mjs .tmp-kids/content.js
 *
 * The content is hand-transcribed from a 165-page scanned book, so the
 * realistic mistakes are silent: a word that does not actually contain the
 * letter it is filed under, a "which letter does this start with?" game built
 * on ঙ (which cannot start a Bangla word, so the game has no answer), a lesson
 * that lost its book pages and can no longer be checked against the source.
 *
 * None of those throw. They produce a screen that is wrong for a four-year-old
 * who has no way to tell the app is broken rather than themselves.
 *
 * The last group of checks is about honesty to the source: the product claims
 * to follow the NCTB curriculum, and these are what make that claim checkable
 * rather than asserted.
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
  console.error('usage: node content.test.mjs <path to compiled content.js>');
  process.exit(1);
}
const { validateUnit, LEVELS, PICKIXO_ACTIVITIES } = require(path.resolve(compiled));
const { ART_WORDS } = require(path.resolve(path.dirname(compiled), 'art-keys.js'));
const { buildRound } = require(path.resolve(path.dirname(compiled), 'rounds.js'));

const here = path.dirname(fileURLToPath(import.meta.url));

/** Every unit JSON under data/kids, whatever subject folder it is in. */
function findUnits(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findUnits(full));
    else if (entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

const unitFiles = findUnits(here).sort();
const units = unitFiles.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));

let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failures.push(`${name}\n    ${error.message.split('\n')[0]}`);
  }
}

/* -------------------------------------------------------------------------- */

check('there is content at all', () => {
  assert.ok(units.length >= 4, `only ${units.length} unit files found`);
});

for (const [i, unit] of units.entries()) {
  const name = path.basename(unitFiles[i]);

  check(`${name} — passes validateUnit`, () => {
    const issues = validateUnit(unit);
    assert.deepEqual(
      issues, [],
      issues.map((x) => `${x.where}: ${x.problem}`).join('\n    '),
    );
  });

  check(`${name} — every lesson names its book pages`, () => {
    for (const lesson of unit.lessons) {
      assert.ok(
        lesson.source?.bookPages?.length,
        `${lesson.id} has no bookPages — the NCTB claim is unverifiable`,
      );
      for (const page of lesson.source.bookPages) {
        // আমার বই runs to book page 158.
        assert.ok(
          page >= 1 && page <= 158,
          `${lesson.id} cites book page ${page}, which is outside আমার বই`,
        );
      }
    }
  });

  check(`${name} — every objective quotes an NCTB code`, () => {
    for (const lesson of unit.lessons) {
      for (const objective of lesson.objectives) {
        assert.match(
          objective.code, /^[০-৯]+(\.[০-৯]+)*$/u,
          `${lesson.id}: "${objective.code}" is not an NCTB outcome code`,
        );
        assert.ok(
          objective.band === '4+' || objective.band === '5+',
          `${lesson.id}: objective ${objective.code} has no age band`,
        );
      }
    }
  });

  check(`${name} — words really contain their letter`, () => {
    for (const lesson of unit.lessons) {
      for (const item of lesson.items) {
        for (const word of item.words) {
          assert.ok(
            word.text.includes(item.glyph),
            `${lesson.id}/${item.id}: "${word.text}" does not contain ${item.glyph}`,
          );
        }
      }
    }
  });

  check(`${name} — non-initial letters claim no initial word`, () => {
    for (const lesson of unit.lessons) {
      for (const item of lesson.items) {
        if (item.wordInitial) continue;
        for (const word of item.words) {
          assert.equal(
            word.initial, false,
            `${lesson.id}/${item.id}: ${item.glyph} cannot start a word, `
            + `but "${word.text}" is marked initial`,
          );
        }
      }
    }
  });

  check(`${name} — every lesson has somewhere easier to go`, () => {
    for (const lesson of unit.lessons) {
      assert.ok(
        (lesson.activities.explore ?? []).length,
        `${lesson.id} has no explore activity — a struggling child is stranded`,
      );
    }
  });

  check(`${name} — sessions stay short`, () => {
    for (const lesson of unit.lessons) {
      assert.ok(
        lesson.minutes > 0 && lesson.minutes <= 15,
        `${lesson.id} claims ${lesson.minutes} minutes`,
      );
    }
  });

  check(`${name} — item ids are unique within each lesson`, () => {
    for (const lesson of unit.lessons) {
      const seen = new Set();
      for (const item of lesson.items) {
        assert.ok(!seen.has(item.id), `${lesson.id} repeats item ${item.id}`);
        seen.add(item.id);
      }
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Cross-unit checks                                                          */
/* -------------------------------------------------------------------------- */

const allLessons = units.flatMap((u) => u.lessons);

check('a shared item id means the same thing everywhere', () => {
  // Item ids are *deliberately* shared across lessons: ছোট থেকে বড় practises
  // the same ১-৯ that শংখ্যা ১ introduced, so the child's mastery of ১ carries
  // instead of restarting. That only works if both lessons mean the same ১ —
  // two different items under one id would record contradictory progress.
  const byId = new Map();
  for (const lesson of allLessons) {
    for (const item of lesson.items) {
      const existing = byId.get(item.id);
      if (!existing) { byId.set(item.id, { item, lesson: lesson.id }); continue; }
      assert.equal(
        item.glyph, existing.item.glyph,
        `${item.id} is "${item.glyph}" in ${lesson.id} but `
        + `"${existing.item.glyph}" in ${existing.lesson}`,
      );
      assert.equal(
        item.count, existing.item.count,
        `${item.id} counts ${item.count} in ${lesson.id} but `
        + `${existing.item.count} in ${existing.lesson}`,
      );
      assert.equal(
        item.kind, existing.item.kind,
        `${item.id} is a ${item.kind} in ${lesson.id} but `
        + `a ${existing.item.kind} in ${existing.lesson}`,
      );
    }
  }
});

check('lesson ids are unique across the whole curriculum', () => {
  const seen = new Set();
  for (const lesson of allLessons) {
    assert.ok(!seen.has(lesson.id), `duplicate lesson id ${lesson.id}`);
    seen.add(lesson.id);
  }
});

check('the Bangla alphabet is complete', () => {
  const letters = allLessons
    .filter((l) => l.unit === 'shoroborno' || l.unit === 'banjonborno')
    .flatMap((l) => l.items.map((i) => i.glyph));

  // আমার বই teaches 11 vowels (chart, book 38) and 39 consonants
  // (chart, book 71).
  const vowels = allLessons
    .filter((l) => l.unit === 'shoroborno')
    .flatMap((l) => l.items).length;
  const consonants = allLessons
    .filter((l) => l.unit === 'banjonborno')
    .flatMap((l) => l.items).length;

  assert.equal(vowels, 11, `${vowels} vowels — the book's chart has 11`);
  assert.equal(consonants, 39, `${consonants} consonants — the book's chart has 39`);
  assert.equal(new Set(letters).size, letters.length, 'a letter is taught twice');
});

check('every letter that cannot begin a word is marked so', () => {
  // From আমার বই: each of these is taught inside a word, never word-initial.
  const cannot = new Set(['ঙ', 'ঞ', 'ণ', 'ড়', 'ঢ়', 'য়', 'ৎ', 'ং', 'ঃ', 'ঁ']);
  for (const lesson of allLessons) {
    for (const item of lesson.items) {
      if (item.kind !== 'vowel' && item.kind !== 'consonant') continue;
      assert.equal(
        item.wordInitial, !cannot.has(item.glyph),
        `${item.glyph} is marked wordInitial=${item.wordInitial}`,
      );
    }
  }
});

check('word building only uses the ten words in the book', () => {
  // Book pages 76-77. Any other word would be Pickixo's invention presented
  // as curriculum, which §2 of the brief forbids.
  const inBook = new Set([
    'বল', 'বই', 'মই', 'ঘর', 'বক', 'ফল', 'জগ', 'খই', 'কলম', 'কলস',
  ]);
  const built = allLessons
    .filter((l) => l.unit === 'shobdo-gothon')
    .flatMap((l) => l.items.map((i) => i.glyph));

  assert.equal(built.length, 10, `${built.length} words, the book has 10`);
  for (const word of built) {
    assert.ok(inBook.has(word), `"${word}" is not in the textbook's শব্দ গঠন`);
  }
});

check('numbers cover ০ to ২০', () => {
  const counts = allLessons
    .filter((l) => l.unit === 'shongkha')
    .flatMap((l) => l.items)
    .map((i) => i.count)
    .filter((c) => typeof c === 'number');

  for (let n = 0; n <= 20; n += 1) {
    assert.ok(counts.includes(n), `number ${n} is missing`);
  }
});

check('every picture-word in the curriculum has a drawing', () => {
  // The product promises a picture-first experience to a child who cannot
  // read. A word with no drawing falls back to a card with the word written
  // on it — which is honest, but it is text shown to a non-reader, and it
  // quietly removes that word from every picture game. So: adding a word to a
  // lesson without drawing it fails here rather than reaching a child.
  const drawn = new Set(ART_WORDS);
  const missing = [];
  for (const lesson of allLessons) {
    for (const item of lesson.items) {
      for (const word of item.words) {
        if (!drawn.has(word.text)) missing.push(`${lesson.id}: ${word.text}`);
      }
    }
  }
  assert.deepEqual(missing, [], `${missing.length} words have no drawing:\n    `
    + missing.join('\n    '));
});

check('no drawing exists for a word the curriculum does not use', () => {
  // The other direction. A stray drawing is dead weight in every bundle, and
  // more importantly it usually means a word was renamed in the lesson data
  // and the old spelling was left behind — in which case the *renamed* word
  // is the one silently without a picture.
  const used = new Set(
    allLessons.flatMap((l) => l.items.flatMap((i) => i.words.map((w) => w.text))),
  );
  const orphans = ART_WORDS.filter((w) => !used.has(w));
  assert.deepEqual(orphans, [], `drawings nothing uses: ${orphans.join(', ')}`);
});

check('every level a lesson offers is a real level', () => {
  for (const lesson of allLessons) {
    for (const key of Object.keys(lesson.activities)) {
      assert.ok(LEVELS.includes(key), `${lesson.id} has unknown level "${key}"`);
    }
  }
});

check('supplementary activities are the four we declared', () => {
  // If this fails, something Pickixo invented is being presented as textbook
  // content, or a textbook activity has been wrongly labelled as an addition.
  // All four are listening or memory work — the two things a printed book
  // cannot do. Everything else must trace to a page.
  assert.deepEqual(
    [...PICKIXO_ACTIVITIES].sort(),
    ['listen-choose', 'listen-repeat', 'memory', 'sound-match'],
  );
});

check('every activity a lesson offers can actually be played', () => {
  // The failure this exists for: an activity kind that is listed in a ladder
  // but whose generator always returns null. The player silently falls back to
  // something else, so nothing looks broken — the game just never appears, and
  // nobody notices for months. Four of these were stubs until recently.
  const dead = [];
  for (const lesson of allLessons) {
    for (const level of LEVELS) {
      for (const activity of lesson.activities[level] ?? []) {
        // Deterministic pick, so a flaky shuffle cannot turn this green.
        const playable = lesson.items.some(
          (item) => buildRound(lesson, activity, item.id, () => 0.5) !== null,
        );
        if (!playable) dead.push(`${lesson.id}/${level}/${activity}`);
      }
    }
  }
  assert.deepEqual(dead, [], `${dead.length} listed but unplayable:\n    `
    + dead.join('\n    '));
});

check('no activity kind is dead across the whole curriculum', () => {
  // Weaker but wider: a kind that no lesson can ever produce is either a typo
  // in a ladder or a generator that never fires.
  const used = new Set(
    allLessons.flatMap((l) => LEVELS.flatMap((lv) => l.activities[lv] ?? [])),
  );
  const never = [...used].filter((activity) => !allLessons.some(
    (lesson) => lesson.items.some(
      (item) => buildRound(lesson, activity, item.id, () => 0.5) !== null,
    ),
  ));
  assert.deepEqual(never, [], `never playable anywhere: ${never.join(', ')}`);
});

check('no lesson is entirely Pickixo-invented', () => {
  for (const lesson of allLessons) {
    const kinds = LEVELS.flatMap((l) => lesson.activities[l] ?? []);
    const own = kinds.filter((k) => PICKIXO_ACTIVITIES.has(k));
    assert.ok(
      own.length < kinds.length,
      `${lesson.id} is made entirely of Pickixo activities — it is not a curriculum lesson`,
    );
  }
});

/* -------------------------------------------------------------------------- */

if (failures.length) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}\n`);
  process.exit(1);
}
console.log(`✓ ${passed} content checks passed across ${units.length} units, `
  + `${allLessons.length} lessons`);
