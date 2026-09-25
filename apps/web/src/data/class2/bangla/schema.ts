/**
 * The content model for Class 2 Bangla — "আমার বাংলা বই, দ্বিতীয় শ্রেণি" (NCTB).
 *
 * A third schema rather than a reuse of English's or Maths', for the same
 * reason those two are separate from each other: the three books teach
 * different things, and a field that means something different depending on
 * which subject is reading it is worse than three small schemas that each say
 * only what is true.
 *
 * What is different here:
 *
 * **This is a reading book, so the unit of content is a পাঠ, not a word.**
 * English is built from vocabulary items with a Bangla gloss; Maths from
 * numbers shown as blocks. Bangla is built from *texts* — গল্প, ছড়া, কবিতা,
 * কথোপকথন — plus the letter mechanics that let a child decode them. So a
 * lesson carries `words` (the book's own শব্দ শিখি glossary) and `builds`
 * (letter arithmetic), and the reading itself lives in the steps.
 *
 * **Letter arithmetic is checkable, and is checked.** Maths' safeguard is
 * that a `BlockCount` must add up to its own `value`, so a picture and a
 * label can never quietly disagree. Bangla's equivalent is `LetterBuild`: the
 * book teaches ক + া = কা, ন + ধ = ন্ধ, র + চ = র্চ, স + ব = স্ব, and every
 * one of those is a claim about Unicode that `compose()` can evaluate. A typo
 * in a conjunct is exactly the mistake a hand-transcribed scanned book
 * produces, it is invisible on the page, and to a seven-year-old learning to
 * read it is not a typo — it is a wrong letter.
 *
 * **Every gloss says where it came from.** The Bangla book, unlike the
 * English one, glosses its own hard words in শব্দ শিখি boxes. Those are
 * `'textbook'`. Anything Pickixo adds is `'enrichment'`, so the UI can show
 * it differently and a reader can always tell the curriculum from the
 * commentary.
 *
 * Content lives in chapter01.json … chapter08.json. These types and
 * `validateChapter` are what stop a transcription slip reaching a child as a
 * broken lesson.
 */

/** Where a piece of content came from. */
export type Source = 'textbook' | 'enrichment';

/** The nine shapes every পাঠ in this book is built from. */
export type LessonShape =
  | 'dialogue'    // পাঠ ১, ২, ৩ — শুনি / বলি
  | 'story'       // পাঠ ৪, ৮, ২০, ২৫, ২৭
  | 'rhyme'       // পাঠ ৬, ১১, ১৫, ১৯, ২৩, ২৬
  | 'alphabet'    // পাঠ ৫ — স্বরবর্ণ ও ব্যঞ্জনবর্ণ
  | 'kar'         // পাঠ ৭ — কারচিহ্ন
  | 'jukto'       // পাঠ ১০ — যুক্তবর্ণ
  | 'fola'        // পাঠ ১২, ১৩ — ফলাচিহ্ন ও রেফ
  | 'sentence'    // পাঠ ১৬, ১৭, ২৪, ২৯ — বাক্য লিখি
  | 'reading';    // পাঠ ৯, ১৪, ১৮, ২১, ২২, ২৮ — তথ্যপাঠ

/* -------------------------------------------------------------------------- */
/* Words                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A word worth stopping on.
 *
 * Mostly these are the book's own শব্দ শিখি entries, which is why `meaning`
 * carries a `meaningSource` rather than being assumed to be ours: "ঝাঁক – দল"
 * is the textbook teaching, not Pickixo annotating, and the difference
 * matters to anyone checking this against the book.
 */
export interface WordItem {
  id: string;
  /** Exactly as printed in the textbook. */
  word: string;
  /**
   * What it means, in Bangla.
   *
   * `null` wherever a meaning would be a guess — the UI then shows the word
   * on its own rather than showing something wrong to a child who cannot yet
   * tell the difference.
   */
  meaning: string | null;
  meaningSource: Source | null;
  /** Which page of the book this word appears on. Makes every item checkable. */
  bookPage: number;
  /** Key into the illustration set — never a textbook image. */
  illustration: string | null;
  /** Recorded audio path, or null to use speech synthesis. */
  audio: string | null;
}

/* -------------------------------------------------------------------------- */
/* Letter arithmetic                                                          */
/* -------------------------------------------------------------------------- */

/**
 * How the pieces of a `LetterBuild` join.
 *
 * `kar` is plain concatenation — a vowel sign simply follows its consonant
 * (ক + া). The other three are all hasanta (্) joins under the hood, and are
 * kept apart because the book teaches them as four different ideas in four
 * different পাঠ, and the app labels them the way the book does.
 */
export type JoinKind =
  | 'kar'     // কারচিহ্ন — পাঠ ৭
  | 'jukto'   // যুক্তবর্ণ — পাঠ ১০
  | 'fola'    // ফলা — পাঠ ১২
  | 'ref';    // রেফ — পাঠ ১৩

/** Bangla hasanta (virama), the character that fuses two consonants. */
export const HASANTA = '্';

/**
 * One line of the book's letter arithmetic: the pieces, and what they make.
 *
 * Kept as pieces plus a result rather than only the result, so that "the book
 * says ন + ধ and prints ন্ধ" is a statement a test can evaluate instead of a
 * spelling nobody re-checks. See `compose`.
 */
export interface LetterBuild {
  id: string;
  /** The pieces in the order the book prints them: ['ক', 'া'], ['র', 'চ']. */
  parts: string[];
  /** The joined form as the book prints it: 'কা', 'র্চ'. */
  result: string;
  join: JoinKind;
  bookPage: number;
  /** A word from the book that uses it — 'বন্ধু' for ন্ধ. */
  example: string | null;
  exampleSource: Source | null;
}

/**
 * Join the pieces the way the book says they join.
 *
 * Deliberately the whole rule, in one place: a কার follows its consonant
 * directly, and everything else is glued with hasanta. `result` is then a
 * claim this function can confirm or refute, which is the only reason the
 * `parts`/`result` split earns its keep.
 */
export function compose(build: Pick<LetterBuild, 'parts' | 'join'>): string {
  const glue = build.join === 'kar' ? '' : HASANTA;
  return build.parts.join(glue).normalize('NFC');
}

/* -------------------------------------------------------------------------- */
/* Lesson steps                                                               */
/* -------------------------------------------------------------------------- */

export type Step =
  | IntroStep | ReadStep | DialogueStep | RhymeStep | StoryStep
  | LettersStep | BuildStep | WordsStep | GameStep | QuizStep | DoneStep;

interface StepBase {
  id: string;
  /** Short, in the child's words. Kept under about eight words. */
  title: string;
  /** Which named activity in the book this comes from, e.g. 'শুনি', 'বলি'. */
  bookActivity?: string;
}

export interface IntroStep extends StepBase {
  type: 'intro';
  /** One sentence. A 7-year-old does not read a paragraph. */
  say: string;
  illustration?: string;
}

/**
 * Prose read aloud — the book's own paragraphs, unaltered.
 *
 * `paragraphs` rather than one blob because the 🔊 is per paragraph: a child
 * who loses the thread needs to replay one paragraph, not the whole page.
 */
export interface ReadStep extends StepBase {
  type: 'read';
  paragraphs: string[];
  source: Source;
  illustration?: string;
}

export interface DialogueLine {
  speaker: string;
  text: string;
  /** Blanks the child fills with their own information, as in the book. */
  blanks?: boolean;
}

export interface DialogueStep extends StepBase {
  type: 'dialogue';
  lines: DialogueLine[];
  source: Source;
}

export interface RhymeStep extends StepBase {
  type: 'rhyme';
  /** Grouped as the book prints them, one array per stanza. */
  verses: string[][];
  /** The poet, as the book credits them. */
  poet?: string;
  source: Source;
}

export interface StoryScene {
  id: string;
  /** The book's own panel text, unaltered. */
  text: string;
  illustration: string | null;
  audio: string | null;
}

export interface StoryStep extends StepBase {
  type: 'story';
  scenes: StoryScene[];
  source: Source;
}

/**
 * The alphabet as a grid — পাঠ ৫'s স্বরবর্ণ and ব্যঞ্জনবর্ণ tables.
 *
 * `perRow` mirrors the book's own table width (4 for vowels, 5 for
 * consonants) so a child who has the book open sees the same shape.
 */
export interface LettersStep extends StepBase {
  type: 'letters';
  letters: string[];
  perRow: number;
  source: Source;
}

/** A screen of letter arithmetic — ids into the lesson's `builds`. */
export interface BuildStep extends StepBase {
  type: 'build';
  items: string[];
}

/** A screen of শব্দ শিখি — ids into the lesson's `words`. */
export interface WordsStep extends StepBase {
  type: 'words';
  items: string[];
}

/* -------------------------------------------------------------------------- */
/* Games and quiz                                                             */
/* -------------------------------------------------------------------------- */

export type GameKind =
  | 'word-to-meaning' | 'meaning-to-word' | 'pick-letter' | 'join-letters'
  | 'missing-word' | 'match-pairs' | 'order-the-scenes' | 'true-false'
  | 'listen-and-choose' | 'picture-to-word' | 'which-line' | 'sort-words';

export interface Option {
  label?: string;
  illustration?: string;
}

export interface GameRound {
  id: string;
  /** What the child is asked. Short. */
  ask: string;
  /**
   * The picture the question is *about* — the cat to name, the season to
   * pick. Without it a question like "এটি কোন ঋতু?" has no subject.
   */
  illustration?: string;
  /** Spoken aloud before the options, when the round is listening-based. */
  speak?: string;
  options: Option[];
  /** Index into options. */
  answer: number;
  /** Shown after a wrong attempt — a nudge, never a telling-off. */
  hint?: string;
  /** The word or build this round practises, so a miss feeds revision. */
  tests?: string;
}

export interface Question extends GameRound {
  /** Shown once the child has answered — why, in one short sentence. */
  explain?: string;
}

export interface GameStep extends StepBase {
  type: 'game';
  kind: GameKind;
  rounds: GameRound[];
}

export interface QuizStep extends StepBase {
  type: 'quiz';
  questions: Question[];
}

export interface DoneStep extends StepBase {
  type: 'done';
  say: string;
}

/* -------------------------------------------------------------------------- */
/* Lesson and chapter                                                         */
/* -------------------------------------------------------------------------- */

export interface Lesson {
  id: string;
  chapterId: string;
  /** The book's own পাঠ number — 1..29, and not necessarily in chapter order. */
  number: number;
  title: string;
  shape: LessonShape;
  /** Book pages this lesson covers — every claim stays checkable. */
  bookPages: number[];
  /** What the child can do afterwards. Written for a parent, not a syllabus. */
  objective: string;
  words: WordItem[];
  builds: LetterBuild[];
  steps: Step[];
  /** Roughly how long, in minutes. Sessions are meant to stay short. */
  minutes: number;
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  /** Tailwind-ish token, so chapters are visually distinct for a non-reader. */
  colour: string;
  icon: string;
  lessons: Lesson[];
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

export interface ValidationIssue {
  where: string;
  problem: string;
}

/**
 * Games that are about a picture. A round of one of these with no picture is
 * not merely plain: "এটি কী?" with three word cards and nothing to look at is
 * a question with no subject, and no child can answer it.
 */
const PICTURE_GAMES: ReadonlySet<GameKind> = new Set<GameKind>([
  'picture-to-word', 'order-the-scenes', 'sort-words',
]);

/**
 * Games where the child is *meant* to hear the answer.
 *
 * In "listen and choose" the whole exercise is that the ear does the work, so
 * flagging the spoken prompt for matching the correct option would be
 * flagging the exercise.
 */
const ECHO_GAMES: ReadonlySet<GameKind> = new Set<GameKind>([
  'listen-and-choose', 'match-pairs', 'join-letters',
]);

/**
 * Check a chapter file before it can reach a child.
 *
 * This content is hand-transcribed from a scanned book, so the realistic
 * mistakes are silent: a quiz answer index pointing past the end of its
 * options, a step naming a word id that does not exist, a conjunct whose
 * pieces do not actually make the letter printed beside them. None of these
 * throw in plain JSON, and every one of them looks like a broken app to a
 * seven-year-old who cannot yet tell "the app is wrong" from "I am wrong".
 */
export function validateChapter(chapter: Chapter): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (where: string, problem: string) => issues.push({ where, problem });

  if (!chapter.id) add('chapter', 'missing id');
  if (!chapter.lessons?.length) add(`chapter ${chapter.id}`, 'has no lessons');

  const lessonIds = new Set<string>();
  for (const lesson of chapter.lessons ?? []) {
    const at = `${chapter.id}/${lesson.id}`;

    if (lessonIds.has(lesson.id)) add(at, 'duplicate lesson id');
    lessonIds.add(lesson.id);

    if (lesson.chapterId !== chapter.id) add(at, `chapterId is ${lesson.chapterId}`);
    if (!lesson.objective) add(at, 'no learning objective');
    if (!lesson.bookPages?.length) add(at, 'no book pages — content is unverifiable');
    if (!lesson.steps?.length) add(at, 'no steps');

    /* --- words --------------------------------------------------------- */
    const wordIds = new Set<string>();
    for (const item of lesson.words ?? []) {
      const wAt = `${at}/${item.id}`;
      if (wordIds.has(item.id)) add(wAt, 'duplicate word id');
      wordIds.add(item.id);
      if (!item.word) add(wAt, 'no word');
      if (!item.bookPage) add(wAt, 'no book page');
      // A meaning that does not say where it came from makes the book and
      // Pickixo's own additions indistinguishable, which is the one thing
      // this schema exists to prevent.
      if (item.meaning && !item.meaningSource) {
        add(wAt, 'meaning does not say where it came from');
      }
    }

    /* --- letter arithmetic --------------------------------------------- */
    const buildIds = new Set<string>();
    for (const build of lesson.builds ?? []) {
      const bAt = `${at}/${build.id}`;
      if (buildIds.has(build.id)) add(bAt, 'duplicate build id');
      buildIds.add(build.id);
      if (!build.bookPage) add(bAt, 'no book page');

      if (build.parts.length < 2) {
        add(bAt, 'a build needs at least two pieces');
      } else {
        const made = compose(build);
        const printed = build.result.normalize('NFC');
        if (made !== printed) {
          add(bAt, `${build.parts.join(' + ')} makes "${made}", but the result says "${printed}"`);
        }
      }

      // An example that does not contain the letter it is illustrating
      // teaches the wrong word for the right letter.
      if (build.example) {
        if (!build.exampleSource) add(bAt, 'example does not say where it came from');
        const printed = build.result.normalize('NFC');
        if (!build.example.normalize('NFC').includes(printed)) {
          add(bAt, `example "${build.example}" does not contain "${printed}"`);
        }
      }
    }

    // A lesson must actually end, or the child never gets their stars.
    if (!lesson.steps.some((s) => s.type === 'done')) {
      add(at, 'no completion step');
    }

    /* --- steps ---------------------------------------------------------- */
    for (const step of lesson.steps) {
      const sAt = `${at}/${step.id}`;
      if (!step.title) add(sAt, 'step has no title');

      switch (step.type) {
        case 'read':
          if (!step.paragraphs.length) add(sAt, 'reading step has no text');
          if (!step.source) add(sAt, 'does not say whether it came from the book');
          break;

        case 'dialogue':
          if (!step.lines.length) add(sAt, 'dialogue has no lines');
          if (!step.source) add(sAt, 'does not say whether it came from the book');
          break;

        case 'rhyme':
          if (!step.verses.length) add(sAt, 'rhyme has no verses');
          if (step.verses.some((v) => !v.length)) add(sAt, 'rhyme has an empty verse');
          if (!step.source) add(sAt, 'does not say whether it came from the book');
          break;

        case 'story':
          if (!step.scenes.length) add(sAt, 'story has no scenes');
          if (!step.source) add(sAt, 'does not say whether it came from the book');
          break;

        case 'letters':
          if (!step.letters.length) add(sAt, 'letters step has no letters');
          if (!(step.perRow > 0)) add(sAt, 'letters step needs a row width');
          break;

        case 'build':
          if (!step.items.length) add(sAt, 'build step has nothing to build');
          for (const id of step.items) {
            if (!buildIds.has(id)) add(sAt, `refers to unknown build "${id}"`);
          }
          break;

        case 'words':
          if (!step.items.length) add(sAt, 'word step has no words');
          for (const id of step.items) {
            if (!wordIds.has(id)) add(sAt, `refers to unknown word "${id}"`);
          }
          break;

        case 'game': {
          if (!step.rounds.length) add(sAt, `a ${step.kind} game has no rounds`);
          for (const round of step.rounds) {
            const where = `${sAt}/${round.id}`;
            checkAnswer(where, round.options, round.answer, add);
            checkTests(where, round.tests, wordIds, buildIds, add);
            if (PICTURE_GAMES.has(step.kind) && !round.illustration) {
              add(where, `a ${step.kind} round needs a picture to ask about`);
            }
            if (!ECHO_GAMES.has(step.kind)) {
              checkNotGivenAway(where, round.speak, round.options, round.answer, add);
            }
          }
          break;
        }

        case 'quiz': {
          if (!step.questions.length) add(sAt, 'quiz has no questions');
          let needsEars = 0;
          for (const q of step.questions) {
            const where = `${sAt}/${q.id}`;
            checkAnswer(where, q.options, q.answer, add);
            checkTests(where, q.tests, wordIds, buildIds, add);
            if (q.speak && !q.illustration) needsEars += 1;
            else checkNotGivenAway(where, q.speak, q.options, q.answer, add);
          }
          // As in English and Maths: a quiz made entirely of listening
          // questions cannot be finished on a muted phone, in a noisy room,
          // or by a child who is hard of hearing. Somewhere in every quiz
          // there has to be a question you can see.
          if (step.questions.length && needsEars === step.questions.length) {
            add(sAt, 'every question needs sound — add one the child can see');
          }
          break;
        }

        default:
          break;
      }
    }
  }

  return issues;
}

/** A `tests` id has to point at something, or a miss feeds revision nothing. */
function checkTests(
  where: string,
  tests: string | undefined,
  wordIds: ReadonlySet<string>,
  buildIds: ReadonlySet<string>,
  add: (where: string, problem: string) => void,
): void {
  if (!tests) return;
  if (!wordIds.has(tests) && !buildIds.has(tests)) {
    add(where, `tests "${tests}", which is neither a word nor a build in this lesson`);
  }
}

/**
 * Reading the answer aloud is the point of a listening question and a bug
 * everywhere else — it turns "look and work it out" into "wait for the voice
 * to tell you".
 */
function checkNotGivenAway(
  where: string,
  speak: string | undefined,
  options: Option[],
  answer: number,
  add: (where: string, problem: string) => void,
): void {
  const correct = options?.[answer]?.label;
  if (speak && correct && speak.trim() === correct.trim()) {
    add(where, `speaks the answer "${correct}" aloud, so there is nothing to work out`);
  }
}

function checkAnswer(
  where: string,
  options: Option[],
  answer: number,
  add: (where: string, problem: string) => void,
): void {
  if (!options?.length) {
    add(where, 'no options');
    return;
  }
  if (options.length < 2) add(where, 'only one option — nothing to choose');
  if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) {
    add(where, `answer index ${answer} is outside 0..${options.length - 1}`);
  }
  for (const [i, option] of options.entries()) {
    if (!option.label && !option.illustration) {
      add(where, `option ${i} is empty — nothing to show the child`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Derived                                                                    */
/* -------------------------------------------------------------------------- */

/** Every word in a chapter, flattened, for the word list and revision. */
export function chapterWords(chapter: Chapter): WordItem[] {
  return chapter.lessons.flatMap((lesson) => lesson.words);
}

/** Every letter build in a chapter, flattened. */
export function chapterBuilds(chapter: Chapter): LetterBuild[] {
  return chapter.lessons.flatMap((lesson) => lesson.builds);
}

/** Total stars a chapter can award: 10 a lesson, 5 a quiz. */
export function chapterStarTotal(chapter: Chapter): number {
  return chapter.lessons.reduce((total, lesson) => {
    const hasQuiz = lesson.steps.some((s) => s.type === 'quiz');
    return total + 10 + (hasQuiz ? 5 : 0);
  }, 0);
}
