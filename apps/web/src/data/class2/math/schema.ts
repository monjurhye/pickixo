/**
 * The content model for Class 2 Maths — "প্রাথমিক গণিত, দ্বিতীয় শ্রেণি" (NCTB).
 *
 * Deliberately a separate schema from Class 2 English's, not a shared one.
 * The two books teach differently: English content is built from words,
 * dialogues and rhymes; maths content is built from *numbers* shown as
 * base-ten blocks, and every book sentence is already in Bangla — there is no
 * English/Bangla pair to keep straight here, so a step only ever carries one
 * language. Forcing both subjects through one schema would mean a field that
 * means something different depending on which subject is reading it, which
 * is worse than two small schemas that each say only what is true.
 *
 * The book's own structure survives directly in this schema, because it is a
 * good structure: every lesson is a **মূল প্রশ্ন** (a question the whole class
 * answers together), worked **উদাহরণ** boxes, **অনুশীলন** practice, and
 * **নিজে করি** solo work. That maps onto `intro → worked → game → quiz →
 * done`.
 *
 * **Every number shown as blocks is checkable.** A `BlockCount` is
 * `{ hundreds, tens, ones }`, never a bare total — so a content bug where the
 * blocks and the printed number disagree is something `validateChapter` can
 * actually catch, the same way the English schema catches a quiz answer
 * pointing past its options.
 */

/** Where a piece of content came from. */
export type Source = 'textbook' | 'enrichment';

/** The eight kinds of screen a maths topic is built from. */
export type TopicShape =
  | 'number'        // reading, counting, comparing, place value
  | 'pattern'       // odd/even, number patterns, ordinals
  | 'arithmetic'    // addition, subtraction, multiplication
  | 'shape'         // geometric shapes and patterns
  | 'measurement'   // length, weight, liquid volume, time
  | 'money'         // Bangladeshi currency
  | 'data';         // collecting and organising data

/* -------------------------------------------------------------------------- */
/* Numbers, shown as base-ten blocks                                         */
/* -------------------------------------------------------------------------- */

/**
 * A quantity as hundreds/tens/ones blocks — the book's own way of showing a
 * number (দল, "groups of ten"). Kept as three counts rather than one total so
 * a mistake ("blocks say 45, the label says 54") is a value mismatch a test
 * can catch, not a typo a child has to absorb.
 */
export interface BlockCount {
  hundreds: number;
  tens: number;
  ones: number;
}

export interface NumberItem {
  id: string;
  /** The number itself. Always equal to hundreds*100 + tens*10 + ones. */
  value: number;
  blocks: BlockCount;
  /** As the book spells it: "চুয়ান্ন", "তিনশত পঁয়তাল্লিশ". */
  wordBn: string;
  bookPage: number;
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                      */
/* -------------------------------------------------------------------------- */

export type Step =
  | IntroStep | WorkedStep | TableStep | GameStep | QuizStep | DoneStep;

interface StepBase {
  id: string;
  title: string;
  /** Which lettered/numbered activity in the book this comes from. */
  bookActivity?: string;
}

export interface IntroStep extends StepBase {
  type: 'intro';
  /** The মূল প্রশ্ন — one line, in Bangla, read aloud. */
  say: string;
  illustration?: string;
}

/**
 * A worked example: the book's own boxed illustration + explanation, read
 * through rather than answered. "৬২ ও ৪৫ এর মধ্যে কোন সংখ্যাটি বড়?" and its
 * two-character discussion are this, not a game — nothing here is scored,
 * because the point is to watch the reasoning once before doing it yourself.
 */
export interface WorkedLine {
  text: string;
  /** Tuli or Rafi, when the book gives the line to one of the two characters. */
  speaker?: 'tuli' | 'rafi';
  illustration?: string;
}

export interface WorkedStep extends StepBase {
  type: 'worked';
  lines: WorkedLine[];
  source: Source;
}

/**
 * A row-by-row reading table — "সংখ্যা পড়ি ও কথায় লিখি" is exactly this: a
 * number, its blocks, and the Bangla word, one row per number, each with its
 * own 🔊.
 */
export interface TableRow {
  id: string;
  illustration?: string;
  /** What the row reads out and shows as text — usually a NumberItem's word. */
  text: string;
  /** The vocabulary id this row teaches, so a miss anywhere feeds revision. */
  tests?: string;
}

export interface TableStep extends StepBase {
  type: 'table';
  rows: TableRow[];
}

/* -------------------------------------------------------------------------- */
/* Games and quiz                                                             */
/* -------------------------------------------------------------------------- */

export type GameKind =
  | 'compare' | 'order' | 'place-value' | 'odd-even' | 'pattern' | 'ordinal'
  | 'count-blocks' | 'match-pairs' | 'true-false' | 'arithmetic' | 'shape'
  | 'measure' | 'money' | 'tally';

export interface RoundOption {
  label?: string;
  illustration?: string;
}

export interface GameRound {
  id: string;
  ask: string;
  /** The figure the round is about — the blocks to count, the shape to name. */
  illustration?: string;
  /** Spoken aloud before the options, for a listening round. */
  speak?: string;
  options: RoundOption[];
  answer: number;
  hint?: string;
  tests?: string;
}

export interface GameStep extends StepBase {
  type: 'game';
  kind: GameKind;
  rounds: GameRound[];
}

export interface Question extends GameRound {
  explain?: string;
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
/* Topic and chapter                                                         */
/* -------------------------------------------------------------------------- */

export interface Topic {
  id: string;
  chapterId: string;
  number: number;
  title: string;
  shape: TopicShape;
  /** Book pages this topic covers — every claim stays checkable. */
  bookPages: number[];
  /** What the child can do afterwards. Written for a parent, not a syllabus. */
  objective: string;
  numbers: NumberItem[];
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
  topics: Topic[];
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

export interface ValidationIssue {
  where: string;
  problem: string;
}

/**
 * Check a chapter file before it can reach a child.
 *
 * The realistic mistakes here are numeric: a NumberItem whose blocks do not
 * add up to its own value, a quiz answer index past the end of its options, a
 * round whose `tests` id points at nothing. None of these throw in plain
 * JSON, and every one of them looks like a broken app to a seven-year-old who
 * cannot yet tell "the app is wrong" from "I am wrong".
 */
export function validateChapter(chapter: Chapter): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (where: string, problem: string) => issues.push({ where, problem });

  if (!chapter.id) add('chapter', 'missing id');
  if (!chapter.topics?.length) add(`chapter ${chapter.id}`, 'has no topics');

  const topicIds = new Set<string>();
  for (const topic of chapter.topics ?? []) {
    const at = `${chapter.id}/${topic.id}`;

    if (topicIds.has(topic.id)) add(at, 'duplicate topic id');
    topicIds.add(topic.id);

    if (topic.chapterId !== chapter.id) add(at, `chapterId is ${topic.chapterId}`);
    if (!topic.objective) add(at, 'no learning objective');
    if (!topic.bookPages?.length) add(at, 'no book pages — content is unverifiable');
    if (!topic.steps?.length) add(at, 'no steps');

    const numberIds = new Set<string>();
    for (const item of topic.numbers ?? []) {
      const nAt = `${at}/${item.id}`;
      if (numberIds.has(item.id)) add(nAt, 'duplicate number id');
      numberIds.add(item.id);
      if (!item.wordBn) add(nAt, 'no Bangla word');
      if (!item.bookPage) add(nAt, 'no book page');
      const total = item.blocks.hundreds * 100 + item.blocks.tens * 10 + item.blocks.ones;
      if (total !== item.value) {
        add(nAt, `blocks add up to ${total}, but value is ${item.value}`);
      }
    }

    if (!topic.steps.some((s) => s.type === 'done')) {
      add(at, 'no completion step');
    }

    for (const step of topic.steps) {
      const sAt = `${at}/${step.id}`;
      if (!step.title) add(sAt, 'step has no title');

      if (step.type === 'table' && !step.rows.length) {
        add(sAt, 'table has no rows');
      }

      if (step.type === 'worked' && !step.lines.length) {
        add(sAt, 'worked example has no lines');
      }
      if (step.type === 'worked' && !step.source) {
        add(sAt, 'does not say whether it came from the book');
      }

      if (step.type === 'game') {
        if (!step.rounds.length) add(sAt, `a ${step.kind} game has no rounds`);
        for (const round of step.rounds) {
          const where = `${sAt}/${round.id}`;
          checkAnswer(where, round.options, round.answer, add);
          if (round.tests && !numberIds.has(round.tests)) {
            add(where, `tests unknown number "${round.tests}"`);
          }
        }
      }

      if (step.type === 'quiz') {
        if (!step.questions.length) add(sAt, 'quiz has no questions');
        let needsEars = 0;
        for (const q of step.questions) {
          const where = `${sAt}/${q.id}`;
          checkAnswer(where, q.options, q.answer, add);
          if (q.tests && !numberIds.has(q.tests)) {
            add(where, `tests unknown number "${q.tests}"`);
          }
          if (q.speak && !q.illustration) needsEars += 1;
        }
        // As in English: a quiz cannot be entirely "listen and choose" —
        // somewhere in it has to be a question the child can just look at.
        if (step.questions.length && needsEars === step.questions.length) {
          add(sAt, 'every question needs sound — add one the child can see');
        }
      }
    }
  }

  return issues;
}

function checkAnswer(
  where: string,
  options: RoundOption[],
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

/** Every number in a chapter, flattened, for a revision queue later. */
export function chapterNumbers(chapter: Chapter): NumberItem[] {
  return chapter.topics.flatMap((topic) => topic.numbers);
}

/** Total stars a chapter can award: 10 a topic, 5 a quiz. */
export function chapterStarTotal(chapter: Chapter): number {
  return chapter.topics.reduce((total, topic) => {
    const hasQuiz = topic.steps.some((s) => s.type === 'quiz');
    return total + 10 + (hasQuiz ? 5 : 0);
  }, 0);
}
