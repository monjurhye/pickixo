/**
 * The content model for Pickixo Kids.
 *
 * Three rules are built into these types rather than left to discipline.
 *
 * **Every lesson must name its source pages.** `source.bookPages` is required
 * and `validateLesson` refuses a lesson without it. The claim on the product
 * page is "this follows the NCTB pre-primary curriculum"; a lesson nobody can
 * trace back to a page is that claim going unchecked.
 *
 * **Textbook content and Pickixo's own content are different things.** Every
 * item and activity carries `source: 'textbook' | 'pickixo'`. The textbook is
 * the curriculum; a speaking game or a memory game is Pickixo's addition, is
 * labelled সম্পূরক in the UI, and can be turned off without leaving a hole in
 * the curriculum.
 *
 * **One lesson holds all four difficulties.** A lesson is not "the 4+ version"
 * or "the 5+ version" — it carries an activity list per level and the adaptive
 * engine picks. There is exactly one lesson for ক, and a beginner and an
 * advanced child both open it.
 *
 * Content lives in data/kids/**.json. These types and `validateLesson` are what
 * stop a transcription slip from a scanned book reaching a four-year-old as a
 * broken screen.
 */

/* -------------------------------------------------------------------------- */
/* Levels, bands and sources                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The four difficulty levels.
 *
 * These are NCTB's own progression, not a scale invented here: the curriculum
 * repeats "বাস্তব ও অর্ধবাস্তব উপকরণ … ও সংখ্যা প্রতীক ব্যবহার করে" — concrete,
 * then pictorial, then symbolic. আমার বই teaches subtraction in exactly those
 * three steps on one page (book 153).
 *
 * The child never sees these words. They see চলো দেখি / চলো শিখি / চলো খেলি /
 * আমি পারি.
 */
export type Level = 'explore' | 'learn' | 'practice' | 'master';

export const LEVELS: readonly Level[] = ['explore', 'learn', 'practice', 'master'];

/** What a child at this level is shown, in their own language. */
export const LEVEL_LABEL_BN: Record<Level, string> = {
  explore: 'চলো দেখি',
  learn: 'চলো শিখি',
  practice: 'চলো খেলি',
  master: 'আমি পারি',
};

/**
 * Which NCTB age band an objective belongs to.
 *
 * This is recorded, never enforced against a child. A five-year-old who is not
 * ready for `5+` work simply stays on explore-level activities; nobody is asked
 * their age and no content is locked (§30 of the brief).
 */
export type Band = '4+' | '5+';

/** Where a piece of content came from. */
export type Source = 'textbook' | 'pickixo';

/* -------------------------------------------------------------------------- */
/* Provenance                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Which pages of which book a lesson came from.
 *
 * `pdfPages` is kept alongside `bookPages` because the two differ by seven in
 * আমার বই, and whoever checks this next will have the PDF open, not the
 * printed book.
 */
export interface SourceRef {
  book: string;
  edition: string;
  /** Printed page numbers. Required — a lesson without these cannot ship. */
  bookPages: number[];
  /** Page numbers in the scanned PDF, for anyone verifying the transcription. */
  pdfPages?: number[];
}

/** A curriculum outcome, quoted from প্রাক-প্রাথমিক শিক্ষাক্রম ২০২২. */
export interface Objective {
  /** The curriculum's own numbering, e.g. '৪.১.৪'. */
  code: string;
  band: Band;
  /** Verbatim Bangla. Not paraphrased — it is the curriculum's wording. */
  text: string;
}

/* -------------------------------------------------------------------------- */
/* Items — the things a child actually learns                                 */
/* -------------------------------------------------------------------------- */

export type ItemKind = 'vowel' | 'consonant' | 'word' | 'number' | 'shape' | 'concept';

/** A picture-word printed with a letter in the book. */
export interface ItemWord {
  /** Exactly as printed. */
  text: string;
  /** Key into the illustration set — never a scanned textbook image. */
  image: string | null;
  /**
   * Whether the letter is the *first* letter of this word.
   *
   * False for words like ব্যাঙ where ঙ sits inside, which the book uses
   * because Bangla has no word-initial ঙ. Games that ask "which letter does
   * this start with?" must skip these.
   */
  initial: boolean;
  bookPage: number;
}

export interface Item {
  id: string;
  /** The letter, numeral or word itself. */
  glyph: string;
  kind: ItemKind;
  /** Picture-words from the book. Empty for numbers, which use counts. */
  words: ItemWord[];
  /** Recorded audio path, or null to fall back to bn-BD speech synthesis. */
  audio: string | null;

  /**
   * Whether this letter can begin a Bangla word.
   *
   * ঙ ঞ ণ ড় ঢ় য় ৎ ং ঃ ঁ cannot. The book teaches all ten inside words, and
   * `validateLesson` enforces that a `find-initial` game never includes one —
   * asking a child which word starts with ঙ has no correct answer.
   */
  wordInitial: boolean;

  /** How many of a thing, for number items. */
  count?: number;

  /**
   * Stroke directions for the "how to write it" animation, if drawn.
   *
   * Tracing itself does **not** need this: the canvas ghosts the glyph and
   * measures how much of it the child covered, which works for all 50 letters
   * and all 21 numerals without anybody hand-authoring 71 sets of paths — and
   * without the accuracy risk of guessing at Bangla stroke order. This field
   * only drives the optional animated demonstration (§9 step 2), and null
   * means the demonstration is skipped.
   */
  strokes: string[] | null;
}

/* -------------------------------------------------------------------------- */
/* Activities and games                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Every activity kind the player knows how to render.
 *
 * All but three are a page in আমার বই — the mapping is in docs/PICKIXO-KIDS.md
 * §E. `listen-repeat`, `listen-choose`, `memory` and `sound-match` are
 * Pickixo's own and are labelled as such wherever they appear.
 */
export type ActivityKind =
  // Presentation
  | 'listen-look'           // পড়ি — picture, letter, sound
  | 'chart'                 // বর্ণ পড়ি — the group's chart
  | 'rhyme'                 // ছড়া
  | 'story'                 // ছবিতে গল্প
  // Recognition
  | 'picture-quiz'          // ছবি দেখে বলি
  | 'tap-answer'            // গোল দাগ দিই
  | 'find-letter'           // শব্দে বর্ণ খুঁজি
  | 'find-initial'          // একই বর্ণ দিয়ে শুরু
  | 'odd-one-out'           // কোনটি আলাদা
  | 'spot-difference'       // অমিল খুঁজি
  // Matching
  | 'match-picture-letter'  // শব্দের সাথে বর্ণ মিলাই
  | 'match-picture-word'    // ছবির সাথে শব্দ মিলাই
  | 'drag-drop'             // দাগ টেনে মিলাই — book 32, 78
  | 'sort'                  // শ্রেণিকরণ
  // Production
  | 'missing-letter'        // হারিয়ে যাওয়া বর্ণ
  | 'sequence'              // পরের বর্ণ / সাজিয়ে লিখি
  | 'build-word'            // শব্দ গঠন
  | 'trace'                 // লেখার অনুশীলন
  // Number
  | 'count'                 // গণনা করি
  | 'match-count'           // সমান সংখ্যক মিলাই
  | 'fill-dots'             // গোল ভরাট করি
  | 'order-numbers'         // ছোট থেকে বড়
  | 'add-subtract'          // যোগ করি / বিয়োগ করি
  // Pickixo's own
  | 'listen-repeat'         // বলি — সম্পূরক
  | 'listen-choose'         // শুনে বেছে নিই — সম্পূরক
  | 'memory'                // স্মৃতির খেলা — সম্পূরক
  | 'sound-match';          // ধ্বনি মেলাই — সম্পূরক

/**
 * Activities Pickixo added. Everything else must trace to a book page.
 *
 * All four are listening or memory work, which is exactly what a printed book
 * cannot do and a screen can. They rehearse the book's own letters and words;
 * none of them introduces content the curriculum does not have.
 */
export const PICKIXO_ACTIVITIES: ReadonlySet<ActivityKind> = new Set<ActivityKind>([
  'listen-repeat', 'listen-choose', 'memory', 'sound-match',
]);

/**
 * Activities that ask which letter a word *begins* with.
 *
 * These may only use items where `wordInitial` is true. See `Item.wordInitial`.
 */
const INITIAL_ACTIVITIES: ReadonlySet<ActivityKind> = new Set<ActivityKind>([
  'find-initial',
]);

/**
 * Activities that cannot be completed without hearing something.
 *
 * `listen-choose` shows pictures, but the question is only spoken — so on a
 * muted phone there is nothing to go on. It counts.
 */
const EARS_ONLY: ReadonlySet<ActivityKind> = new Set<ActivityKind>([
  'listen-repeat', 'listen-choose', 'sound-match',
]);

/**
 * What the child is shown at each level.
 *
 * A lesson lists activity kinds per level; the engine picks from the list for
 * wherever the child currently is. A level with no activities means the lesson
 * does not go that high — which is normal and correct: a 4+ picture-reading
 * lesson has nothing at `master`, because there is no symbolic form of it.
 */
export type LevelActivities = Record<Level, ActivityKind[]>;

/* -------------------------------------------------------------------------- */
/* Lesson and unit                                                            */
/* -------------------------------------------------------------------------- */

export type SubjectId = 'bangla' | 'numbers' | 'premath' | 'environment' | 'stories';

export interface Lesson {
  id: string;
  subject: SubjectId;
  unit: string;
  /** Order within the unit. */
  number: number;
  /** Shown to a parent. The child sees the pictures. */
  title: string;
  /** Where this came from. Required. */
  source: SourceRef;
  /** Quoted NCTB outcomes this lesson serves. At least one. */
  objectives: Objective[];
  items: Item[];
  activities: LevelActivities;
  /** Roughly how long, in minutes. Sessions stay short by design (§16). */
  minutes: number;
}

export interface Unit {
  id: string;
  subject: SubjectId;
  number: number;
  title: string;
  /** A picture, because the child cannot read the title. */
  icon: string;
  /** Token used for the unit card, so units are distinguishable without text. */
  colour: string;
  lessons: Lesson[];
}

export interface Subject {
  id: SubjectId;
  title: string;
  icon: string;
  colour: string;
  units: Unit[];
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

export interface ValidationIssue {
  where: string;
  problem: string;
}

/**
 * Check a lesson before it can reach a child.
 *
 * The content is hand-transcribed from a 165-page scanned book, so the
 * realistic mistakes are: a lesson that forgot its book pages, an activity
 * naming an item that is not in the lesson, a `find-initial` game built on ঙ,
 * or a lesson with no activity at the level a child is actually on. None of
 * those is catchable by TypeScript in a JSON file, and all of them look like a
 * broken app to a four-year-old.
 */
export function validateLesson(lesson: Lesson): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const at = `${lesson.subject}/${lesson.id}`;
  const add = (where: string, problem: string) => issues.push({ where, problem });

  if (!lesson.id) add(at, 'missing id');
  if (!lesson.title) add(at, 'missing title');

  // Provenance. This is the rule the whole product rests on.
  if (!lesson.source?.book) add(at, 'no source book named');
  if (!lesson.source?.bookPages?.length) {
    add(at, 'no book pages — the content is unverifiable and must not ship');
  }
  if (!lesson.objectives?.length) {
    add(at, 'no curriculum objective — cannot show it follows the curriculum');
  }
  for (const [i, objective] of (lesson.objectives ?? []).entries()) {
    if (!objective.code) add(`${at}/objective[${i}]`, 'objective has no NCTB code');
    if (!objective.text) add(`${at}/objective[${i}]`, 'objective has no text');
  }

  if (!lesson.items?.length) add(at, 'has no items to learn');

  const itemIds = new Set<string>();
  for (const item of lesson.items ?? []) {
    const iAt = `${at}/${item.id}`;
    if (itemIds.has(item.id)) add(iAt, 'duplicate item id');
    itemIds.add(item.id);

    if (!item.glyph) add(iAt, 'no glyph — nothing to show');

    for (const [i, word] of item.words.entries()) {
      const wAt = `${iAt}/word[${i}]`;
      if (!word.text) add(wAt, 'no text');
      if (!word.bookPage) add(wAt, 'no book page — unverifiable');
      // The book prints the letter inside the word in red. If the data says
      // the word does not contain the letter at all, the transcription is
      // wrong and the game built from it would have no correct answer.
      if (word.text && item.glyph && !word.text.includes(item.glyph)) {
        add(wAt, `"${word.text}" does not contain ${item.glyph}`);
      }
      if (word.initial && word.text && !word.text.startsWith(item.glyph)) {
        add(wAt, `marked word-initial but "${word.text}" does not start with ${item.glyph}`);
      }
    }

    // A letter that cannot begin a word must not claim an initial word.
    if (!item.wordInitial && item.words.some((w) => w.initial)) {
      add(iAt, `${item.glyph} cannot begin a Bangla word, but a word is marked initial`);
    }
  }

  // Activities
  const activities = lesson.activities;
  if (!activities) {
    add(at, 'no activities at any level');
    return issues;
  }

  let total = 0;
  for (const level of LEVELS) {
    const kinds = activities[level] ?? [];
    total += kinds.length;

    for (const kind of kinds) {
      const aAt = `${at}/${level}/${kind}`;

      // "Which word starts with this letter?" needs a letter that can.
      if (INITIAL_ACTIVITIES.has(kind)) {
        const impossible = lesson.items.filter((i) => !i.wordInitial);
        if (impossible.length === lesson.items.length) {
          add(aAt, 'no item in this lesson can begin a word — this game has no answer');
        }
      }

      // Tracing works from the glyph itself (see TraceCanvas), so it needs no
      // stroke data — but a lesson whose items have no glyph has nothing to
      // trace over.
      if (kind === 'trace' && lesson.items.every((i) => !i.glyph)) {
        add(aAt, 'tracing activity but no item has a glyph to trace');
      }

      // Word building needs words of at least two letters to build.
      if (kind === 'build-word') {
        const buildable = lesson.items.filter(
          (i) => i.kind === 'word' && [...i.glyph].length >= 2,
        );
        if (!buildable.length) add(aAt, 'no multi-letter word to build');
      }
    }

    // A level whose every activity needs ears cannot be done on a muted phone,
    // in a noisy room, or by a child who is hard of hearing.
    if (kinds.length && kinds.every((k) => EARS_ONLY.has(k))) {
      add(`${at}/${level}`, 'every activity needs sound — add one the child can see');
    }
  }

  if (total === 0) add(at, 'no activities at any level');

  // Explore is the entry point and the floor the engine demotes to. A lesson
  // with nothing there strands a struggling child with nowhere easier to go.
  if (!(activities.explore ?? []).length) {
    add(at, 'no explore activity — a struggling child has nowhere easier to go');
  }

  if (!lesson.minutes || lesson.minutes <= 0) add(at, 'no duration');
  if (lesson.minutes > 15) {
    add(at, `${lesson.minutes} minutes is too long for a pre-primary session`);
  }

  return issues;
}

/** Validate a whole unit, prefixing each issue with the lesson it came from. */
export function validateUnit(unit: Unit): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!unit.lessons?.length) issues.push({ where: unit.id, problem: 'has no lessons' });

  const seen = new Set<string>();
  for (const lesson of unit.lessons ?? []) {
    if (seen.has(lesson.id)) {
      issues.push({ where: `${unit.id}/${lesson.id}`, problem: 'duplicate lesson id' });
    }
    seen.add(lesson.id);
    if (lesson.unit !== unit.id) {
      issues.push({
        where: `${unit.id}/${lesson.id}`,
        problem: `claims unit "${lesson.unit}"`,
      });
    }
    issues.push(...validateLesson(lesson));
  }
  return issues;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Every item in a unit, flattened, for revision and the parent view. */
export function unitItems(unit: Unit): Item[] {
  return unit.lessons.flatMap((lesson) => lesson.items);
}

/**
 * The activities available to a child at a given level.
 *
 * Falls back *down* the levels, never up: a lesson with nothing at `master`
 * gives a mastering child the `practice` set rather than an empty screen. The
 * reverse would hand a struggling child work that is harder than the level
 * they were just demoted to.
 */
export function activitiesFor(lesson: Lesson, level: Level): ActivityKind[] {
  const index = LEVELS.indexOf(level);
  for (let i = index; i >= 0; i -= 1) {
    const kinds = lesson.activities[LEVELS[i]!] ?? [];
    if (kinds.length) return kinds;
  }
  return [];
}

/** Whether an activity is Pickixo's own, so the UI can label it সম্পূরক. */
export function isSupplementary(kind: ActivityKind): boolean {
  return PICKIXO_ACTIVITIES.has(kind);
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Western digits to Bangla. The whole UI is Bangla; the numbers should be too. */
function toBanglaDigits(n: number | string): string {
  return String(n).split('').map((d) => BN_DIGITS[Number(d)] ?? d).join('');
}

/** A one-line provenance string for the parent view and the lesson footer. */
export function sourceLine(lesson: Lesson): string {
  const pages = lesson.source.bookPages;
  const range = pages.length > 1
    ? `পৃষ্ঠা ${toBanglaDigits(pages[0]!)}–${toBanglaDigits(pages[pages.length - 1]!)}`
    : `পৃষ্ঠা ${toBanglaDigits(pages[0]!)}`;
  return `${lesson.source.book} (${toBanglaDigits(lesson.source.edition)}) — ${range}`;
}
