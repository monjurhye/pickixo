/**
 * The names a Bangla content file is allowed to point a picture at.
 *
 * This list lives in `data/` rather than beside the drawings because it is
 * part of the content contract, not part of the rendering: a lesson that
 * names a picture which does not exist is a content bug, and
 * `content.test.mjs` should be able to catch it without compiling React.
 *
 * Drift between this list and the actual artwork is prevented by the type,
 * not by discipline — `banglaDrawings.tsx` declares its drawing map as
 * `Record<SceneName, Draw>`, so adding a name here without drawing it, or
 * drawing something without listing it here, fails the typecheck.
 */

/** Every fixed scene. Generated names (letters, builds) are matched separately. */
export const SCENE_NAMES = [
  // the book's cast
  'tuli', 'rafi', 'mitu', 'raju', 'tithi', 'jhimit', 'tapu', 'ma', 'baba',
  'teacher', 'friends',
  // school and things
  'school', 'flag', 'book', 'bag', 'ball', 'house', 'market',
  // moods — পাঠ ২
  'mood-joy', 'mood-surprise', 'mood-sad', 'mood-fun',
  // signs — পাঠ ৯
  'sign-bin', 'sign-toilet', 'sign-handwash', 'sign-zebra', 'sign-together',
  // animals
  'lion', 'mouse', 'cat-white', 'cat-black', 'cow', 'dog', 'goat', 'deer',
  'fox', 'tiger', 'duck', 'hen', 'bird', 'crow', 'ant', 'bee', 'butterfly',
  'fish', 'horse-winged',
  // story props
  'net', 'sword', 'pot', 'bee-swarm',
  // nature and place
  'tree', 'flower', 'river', 'boat', 'pond', 'field', 'village', 'city',
  'zoo', 'park', 'potter',
  // seasons — পাঠ ২১
  'season-grishmo', 'season-borsha', 'season-shorot', 'season-hemonto',
  'season-sheet', 'season-bosonto',
  // culture
  'shaheed-minar', 'boishakh', 'nagordola', 'nouka-baich', 'dhol', 'kite',
  'muktijoddha', 'nazrul',
  // sports — পাঠ ২৮
  'run', 'rope-jump', 'long-jump', 'morog-lorai', 'biscuit-run', 'ball-throw',
  // writing — পাঠ ১৪, ১৬
  'handwriting', 'phone', 'signboard', 'question', 'star',
] as const;

export type SceneName = (typeof SCENE_NAMES)[number];

/** `letter-<ch>` — a single Bangla letter or sign on a card. */
export const LETTER_PATTERN = /^letter-(.+)$/u;

/** `build-<a>+<b>=<result>` — the book's own letter arithmetic, drawn. */
export const BUILD_PATTERN = /^build-(.+)=(.+)$/u;

const SCENES: ReadonlySet<string> = new Set(SCENE_NAMES);

/**
 * Whether a content file may use this name.
 *
 * Used by the player (to decide whether to draw the "?" placeholder) and by
 * the content test (to reject a lesson pointing at art that does not exist).
 * A missing picture is not cosmetic here: several rounds ask "এটি কী?" about
 * the picture, so a blank tile turns a question into an unanswerable one.
 */
export function isIllustrationName(name: string | null | undefined): boolean {
  if (!name) return false;
  return SCENES.has(name) || BUILD_PATTERN.test(name) || LETTER_PATTERN.test(name);
}
