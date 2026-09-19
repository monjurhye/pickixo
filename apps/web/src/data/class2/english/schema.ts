/**
 * The content model for Class 2 English.
 *
 * Two rules are built into these types rather than left to discipline.
 *
 * **Textbook content and added content are different things.** Every field
 * that could carry either has a `source` of `'textbook'` or `'enrichment'`.
 * The textbook is the curriculum; anything Pickixo adds — a Bangla gloss, an
 * extra example sentence — is labelled, and the UI can show it differently or
 * hide it. A curriculum that quietly drifts from the book it claims to teach
 * is worse than one with gaps.
 *
 * **Audio is data, not behaviour.** Every spoken item carries `audio`, which
 * is `null` until a real recording exists. The player falls back to speech
 * synthesis only where it is null, so adding recorded audio later is a change
 * to JSON and nothing else.
 *
 * Content lives in unit01.json … unit10.json. These types and `validateUnit`
 * are what stop a typo in one of those files reaching a child as a broken
 * lesson.
 */

/** Where a piece of content came from. */
export type Source = 'textbook' | 'enrichment';

/** The eight shapes every lesson in this book is built from. */
export type LessonShape =
  | 'dialogue'      // Units 1, 3, 4, 8 — listen, repeat, complete, act out
  | 'vocabulary'    // Unit 2 letters, Units 7 and 9
  | 'numbers'       // Unit 2's six number lessons
  | 'rhyme'         // U1 L3, U2 L5, U8 L5, U9 L4
  | 'command'       // Unit 3
  | 'phonics'       // Unit 6
  | 'category'      // Units 7, 9
  | 'story';        // U5 L4-6, Unit 10

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                 */
/* -------------------------------------------------------------------------- */

export interface VocabItem {
  id: string;
  /** Exactly as printed in the textbook. */
  word: string;
  /**
   * Bangla meaning.
   *
   * The textbook does not gloss its own vocabulary, so every value here is
   * Pickixo's addition — hence `banglaSource` is always 'enrichment'. It is
   * `null` wherever the meaning would be a guess; the UI then shows the word
   * without a gloss rather than showing something wrong to a child who cannot
   * yet tell the difference.
   */
  bangla: string | null;
  /** How the English word sounds, written in Bangla script. Also enrichment. */
  banglaPronunciation: string | null;
  banglaSource: Source;

  /** Which page of the book this word appears on. Makes every item checkable. */
  bookPage: number;
  category: VocabCategory;

  /** Key into the illustration set — never a textbook image. */
  image: string | null;
  /** Recorded audio path, or null to use speech synthesis. */
  audio: string | null;

  /** A sentence using the word, and whether the book supplied it. */
  example: string | null;
  exampleSource: Source | null;
}

export type VocabCategory =
  | 'greeting' | 'animal' | 'bird' | 'food' | 'object' | 'place'
  | 'person' | 'family' | 'colour' | 'shape' | 'number' | 'action'
  | 'plant' | 'vehicle' | 'nature' | 'body' | 'sign' | 'day' | 'expression';

/* -------------------------------------------------------------------------- */
/* Lesson steps                                                               */
/* -------------------------------------------------------------------------- */

export type Step =
  | IntroStep | VocabStep | DialogueStep | RhymeStep | StoryStep
  | CommandStep | SpeakStep | GameStep | QuizStep | DoneStep;

interface StepBase {
  id: string;
  /** Short, in the child's words. Kept under about eight words. */
  title: string;
  titleBn?: string;
  /** Which lettered activity in the book this comes from, e.g. 'B'. */
  bookActivity?: string;
}

export interface IntroStep extends StepBase {
  type: 'intro';
  /** One sentence. A 7-year-old does not read a paragraph. */
  say: string;
  sayBn?: string;
  illustration?: string;
}

export interface VocabStep extends StepBase {
  type: 'vocab';
  /** Ids into the lesson's vocabulary list. */
  items: string[];
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
  /** Grouped as the book prints them. */
  verses: string[][];
  source: Source;
  /**
   * The book also has short prose passages ("Myself", "My mother") that are
   * read aloud the same way as a rhyme. Setting this changes the button from
   * "Listen to the rhyme" to something that is true of a passage.
   */
  listenLabel?: string;
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

export interface CommandStep extends StepBase {
  type: 'command';
  /**
   * Each command is spoken aloud and acted out. `textBn` is Pickixo's own
   * gloss (enrichment), like every Bangla meaning in this file.
   */
  commands: { text: string; textBn?: string; illustration: string | null }[];
  source: Source;
}

export interface SpeakStep extends StepBase {
  type: 'speak';
  /** What the child is asked to say. */
  prompt: string;
  promptBn?: string;
  /** A model answer, with a blank the child fills in aloud. */
  modelAnswer: string;
}

/* -------------------------------------------------------------------------- */
/* Games and quiz                                                             */
/* -------------------------------------------------------------------------- */

export type GameKind =
  | 'picture-to-word' | 'word-to-picture' | 'listen-and-choose'
  | 'missing-letter' | 'unscramble' | 'memory' | 'match-pairs'
  | 'order-the-lines' | 'choose-the-reply' | 'count-objects'
  | 'same-sound' | 'sort-pictures' | 'order-the-scenes' | 'true-false';

export interface GameStep extends StepBase {
  type: 'game';
  kind: GameKind;
  /** Vocabulary ids, or game-specific rounds. */
  items?: string[];
  rounds?: GameRound[];
}

export interface GameRound {
  id: string;
  /** What the child is asked. Short. */
  ask: string;
  askBn?: string;
  /**
   * The picture the question is *about* — the ant to name, the dots to count.
   * Without it a question like "How many?" has no subject, and a picture game
   * is not a picture game.
   */
  image?: string;
  /** Spoken aloud before the options, when the game is listening-based. */
  speak?: string;
  options: GameOption[];
  /** Index into options. */
  answer: number;
  /** Shown after a wrong attempt — a nudge, never a telling-off. */
  hint?: string;
  /** The vocabulary item this round practises, so a miss feeds revision. */
  tests?: string;
}

export interface GameOption {
  label?: string;
  image?: string;
  /** For unscramble and missing-letter. */
  letters?: string[];
}

export type QuestionType =
  | 'tap-picture' | 'tap-word' | 'listen-choose' | 'true-false' | 'fill-blank';

export interface Question {
  id: string;
  type: QuestionType;
  ask: string;
  askBn?: string;
  /** The picture the question is about. See GameRound.image. */
  image?: string;
  speak?: string;
  options: GameOption[];
  answer: number;
  /** Shown once the child has answered — why, in one short sentence. */
  explain?: string;
  /** The vocabulary item this tests, so a wrong answer feeds revision. */
  tests?: string;
}

export interface QuizStep extends StepBase {
  type: 'quiz';
  questions: Question[];
}

export interface DoneStep extends StepBase {
  type: 'done';
  say: string;
  sayBn?: string;
}

/* -------------------------------------------------------------------------- */
/* Lesson and unit                                                            */
/* -------------------------------------------------------------------------- */

export interface Lesson {
  id: string;
  unitId: string;
  /** The book's own lesson number. */
  number: number;
  title: string;
  titleBn?: string;
  shape: LessonShape;
  /** Book pages this lesson covers — every claim stays checkable. */
  bookPages: number[];
  /** What the child can do afterwards. Written for a parent, not a syllabus. */
  objective: string;
  objectiveBn?: string;
  vocabulary: VocabItem[];
  steps: Step[];
  /** Roughly how long, in minutes. Sessions are meant to stay short. */
  minutes: number;
}

export interface Unit {
  id: string;
  number: number;
  title: string;
  titleBn?: string;
  /** Tailwind-ish token, so units are visually distinct for a non-reader. */
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
 * Check a unit file before it can reach a child.
 *
 * This exists because the content is hand-transcribed from a scanned book.
 * The realistic mistakes are a quiz answer index pointing past the end of its
 * options, a vocab step naming an id that does not exist, or a lesson with no
 * objective — none of which TypeScript can catch in a JSON file, and all of
 * which look like a broken app to a seven-year-old.
 */
export function validateUnit(unit: Unit): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (where: string, problem: string) => issues.push({ where, problem });

  if (!unit.id) add('unit', 'missing id');
  if (!unit.lessons?.length) add(`unit ${unit.id}`, 'has no lessons');

  const lessonIds = new Set<string>();
  for (const lesson of unit.lessons ?? []) {
    const at = `${unit.id}/${lesson.id}`;

    if (lessonIds.has(lesson.id)) add(at, 'duplicate lesson id');
    lessonIds.add(lesson.id);

    if (lesson.unitId !== unit.id) add(at, `unitId is ${lesson.unitId}`);
    if (!lesson.objective) add(at, 'no learning objective');
    if (!lesson.bookPages?.length) add(at, 'no book pages — content is unverifiable');
    if (!lesson.steps?.length) add(at, 'no steps');

    const vocabIds = new Set(lesson.vocabulary.map((v) => v.id));
    for (const item of lesson.vocabulary) {
      const vAt = `${at}/${item.id}`;
      if (!item.word) add(vAt, 'no word');
      if (!item.bookPage) add(vAt, 'no book page');
      // A Bangla gloss must declare itself as an addition, because the
      // textbook has none — claiming otherwise would misrepresent the source.
      if (item.bangla && item.banglaSource !== 'enrichment') {
        add(vAt, 'bangla meaning must be marked as enrichment');
      }
      if (item.example && !item.exampleSource) {
        add(vAt, 'example sentence does not say where it came from');
      }
    }

    // A lesson must actually end, or the child never gets their stars.
    if (!lesson.steps.some((s) => s.type === 'done')) {
      add(at, 'no completion step');
    }

    for (const step of lesson.steps) {
      const sAt = `${at}/${step.id}`;
      if (!step.title) add(sAt, 'step has no title');

      if (step.type === 'vocab') {
        for (const id of step.items) {
          if (!vocabIds.has(id)) add(sAt, `refers to unknown vocabulary "${id}"`);
        }
      }

      if (step.type === 'game') {
        for (const id of step.items ?? []) {
          if (!vocabIds.has(id)) add(sAt, `refers to unknown vocabulary "${id}"`);
        }
        for (const round of step.rounds ?? []) {
          const where = `${sAt}/${round.id}`;
          checkAnswer(where, round.options, round.answer, add);
          if (round.tests && !vocabIds.has(round.tests)) {
            add(where, `tests unknown vocabulary "${round.tests}"`);
          }
          if (PICTURE_GAMES.has(step.kind) && !round.image) {
            add(where, `a ${step.kind} round needs a picture to ask about`);
          }
          if (!ECHO_GAMES.has(step.kind)) {
            checkNotGivenAway(where, round.speak, round.options, round.answer, add);
          }
        }
      }

      if (step.type === 'quiz') {
        if (!step.questions.length) add(sAt, 'quiz has no questions');
        let needsEars = 0;
        for (const q of step.questions) {
          const where = `${sAt}/${q.id}`;
          checkAnswer(where, q.options, q.answer, add);
          if (q.tests && !vocabIds.has(q.tests)) {
            add(where, `tests unknown vocabulary "${q.tests}"`);
          }
          if (q.type === 'listen-choose') needsEars += 1;
          else checkNotGivenAway(where, q.speak, q.options, q.answer, add);
        }
        // A quiz made entirely of listening questions cannot be finished on a
        // muted phone, in a noisy room, or by a child who is hard of hearing.
        // Somewhere in every quiz there has to be a question you can see.
        if (step.questions.length && needsEars === step.questions.length) {
          add(sAt, 'every question needs sound — add one the child can see');
        }
      }

      if (step.type === 'command') {
        // A "listen and do" step with nothing to do leaves the child looking
        // at an empty screen with a button that says they have done it.
        if (!step.commands.length) add(sAt, 'command step has no commands');
        for (const [i, c] of step.commands.entries()) {
          if (!c.text) add(`${sAt}/${i}`, 'command has no text');
        }
      }

      if (step.type === 'dialogue' && !step.lines.length) {
        add(sAt, 'dialogue has no lines');
      }
      if (step.type === 'story' && !step.scenes.length) {
        add(sAt, 'story has no scenes');
      }
    }
  }

  return issues;
}

/**
 * Games that are about a picture. A round of one of these with no picture is
 * not merely plain: "How many?" with three numbered cards and nothing to count
 * is a question with no subject, and no child can answer it.
 */
const PICTURE_GAMES: ReadonlySet<GameKind> = new Set<GameKind>([
  'picture-to-word', 'count-objects', 'sort-pictures',
]);

/**
 * Games where the child is *meant* to hear the right answer.
 *
 * In "choose the reply" the whole lesson is that you answer "Good morning!"
 * with "Good morning!" — the spoken prompt and the correct option are the same
 * words on purpose, and flagging that would be flagging the exercise.
 */
const ECHO_GAMES: ReadonlySet<GameKind> = new Set<GameKind>([
  'listen-and-choose', 'choose-the-reply', 'same-sound', 'match-pairs',
]);

/**
 * Reading the answer aloud is the point of a listening question and a bug
 * everywhere else — it turns "look at the picture and name it" into "wait for
 * the voice to tell you".
 */
function checkNotGivenAway(
  where: string,
  speak: string | undefined,
  options: GameOption[],
  answer: number,
  add: (where: string, problem: string) => void,
): void {
  const correct = options?.[answer]?.label;
  if (speak && correct && speak.trim().toLowerCase() === correct.trim().toLowerCase()) {
    add(where, `speaks the answer "${correct}" aloud, so there is nothing to work out`);
  }
}

function checkAnswer(
  where: string,
  options: GameOption[],
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
    if (!option.label && !option.image && !option.letters) {
      add(where, `option ${i} is empty — nothing to show the child`);
    }
  }
}

/** Every vocabulary item in a unit, flattened, for the word list and revision. */
export function unitVocabulary(unit: Unit): VocabItem[] {
  return unit.lessons.flatMap((lesson) => lesson.vocabulary);
}

/** Total stars a unit can award: 10 a lesson, 5 a quiz. */
export function unitStarTotal(unit: Unit): number {
  return unit.lessons.reduce((total, lesson) => {
    const hasQuiz = lesson.steps.some((s) => s.type === 'quiz');
    return total + 10 + (hasQuiz ? 5 : 0);
  }, 0);
}
