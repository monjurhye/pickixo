/**
 * Turning curriculum data into a question.
 *
 * Kept pure and separate from the player on purpose: "does this game ever
 * produce a round with no correct answer?" is a question worth being able to
 * answer with a test rather than by clicking through as a four-year-old would.
 *
 * Every generator returns `null` rather than an impossible round. A game that
 * cannot be built from the current lesson is skipped by the player, which is
 * always better than showing a child a question that has no right answer —
 * they cannot tell the app is broken rather than themselves, and they will
 * assume it is themselves.
 *
 * Distractors come from the same lesson wherever possible. Asking a child to
 * tell ক from ৯ teaches nothing; telling ক from খ is the actual skill, and it
 * is also what generates the confusion data that drives revision (§18).
 */

import type { Item, Lesson, ActivityKind } from './content';
import { hasArtWord } from './art-keys';

/** What the child is shown. Every game reduces to this. */
export interface Round {
  id: string;
  activity: ActivityKind;
  /** The item being tested, for the progress record. */
  itemId: string;
  /** Short Bangla instruction. Always spoken as well as shown. */
  ask: string;
  /** Spoken before the options, when the game is a listening one. */
  speak?: string;
  /** A picture the question is *about*. */
  image?: string;
  /** The word or letter being displayed large. */
  display?: string;
  options: RoundOption[];
  /** Index into options. */
  answer: number;
  /** For build-word: the letters to drag, already shuffled. */
  parts?: string[];
  /** For trace: the glyph to trace over. */
  trace?: string;
  /** For count / fill-dots: how many. */
  count?: number;

  /* ---- the multi-step games, which do not reduce to one tap ---- */

  /** memory: the pairs to find. Each becomes two cards, letter and picture. */
  pairs?: MemoryPair[];
  /** drag-drop: two columns the child connects, one pairing at a time. */
  match?: { left: MatchCell[]; right: MatchCell[] };
  /** sort: two labelled buckets and the tokens that belong in them. */
  sort?: { buckets: SortBucket[]; tokens: SortToken[] };
  /** spot-difference: two rows of pictures, differing in exactly one place. */
  panels?: { a: string[]; b: string[] };
}

export interface MemoryPair {
  id: string;
  glyph: string;
  /** The picture half, for letters and words. */
  image?: string;
  /** The quantity half, for numbers — a numeral card against a dot card. */
  count?: number;
}

export interface MatchCell {
  /** Which pairing this cell belongs to. Cells pair by equal `pairId`. */
  pairId: string;
  label?: string;
  image?: string;
  /** The item recorded when this pairing is got right or wrong. */
  itemId: string;
}

export interface SortBucket {
  id: string;
  label: string;
}

export interface SortToken {
  id: string;
  label?: string;
  image?: string;
  /** The bucket this belongs in. */
  bucket: string;
  itemId: string;
}

export interface RoundOption {
  /** Shown as text — a letter, a word, a numeral. */
  label?: string;
  /** Shown as a picture. */
  image?: string;
  /** The item this option belongs to, so a wrong tap records the confusion. */
  itemId?: string;
}

/** Deterministic in tests, random in play. */
export type Pick = () => number;

function shuffle<T>(values: T[], pick: Pick): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(pick() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** A word for this item that has a drawing, or null. */
function pictureWord(item: Item): string | null {
  const drawable = item.words.find((w) => hasArtWord(w.text));
  return drawable?.text ?? null;
}

/**
 * Other items from the same lesson, to use as wrong answers.
 *
 * Same lesson means same বর্গ, which means genuinely confusable — ক against খ
 * and গ, not against ৯.
 */
function others(lesson: Lesson, itemId: string, count: number, pick: Pick): Item[] {
  const pool = lesson.items.filter((i) => i.id !== itemId);
  return shuffle(pool, pick).slice(0, count);
}

/**
 * Place the correct option among the wrong ones.
 *
 * Shuffled, because a child who notices the answer is always second has
 * learned the game and not the letter.
 */
function assemble(
  correct: RoundOption,
  wrong: RoundOption[],
  pick: Pick,
): { options: RoundOption[]; answer: number } {
  const options = shuffle([correct, ...wrong], pick);
  return { options, answer: options.indexOf(correct) };
}

/* -------------------------------------------------------------------------- */
/* The generators                                                             */
/* -------------------------------------------------------------------------- */

export function buildRound(
  lesson: Lesson,
  activity: ActivityKind,
  itemId: string,
  pick: Pick = Math.random,
): Round | null {
  const item = lesson.items.find((i) => i.id === itemId);
  if (!item) return null;

  const id = `${lesson.id}:${activity}:${itemId}`;
  const base = { id, activity, itemId } as const;

  switch (activity) {
    /* ---- Presentation. No wrong answer; the child taps to continue. ---- */
    case 'listen-look': {
      const word = pictureWord(item) ?? item.words[0]?.text ?? item.glyph;
      return {
        ...base,
        ask: 'শুনি আর দেখি',
        speak: item.kind === 'number' ? item.glyph : `${item.glyph}। ${word}।`,
        image: hasArtWord(word) ? word : undefined,
        display: item.glyph,
        options: [{ label: 'ঠিক আছে' }],
        answer: 0,
        count: item.count,
      };
    }

    case 'chart':
      return {
        ...base,
        ask: 'বর্ণগুলো পড়ি',
        speak: lesson.items.map((i) => i.glyph).join('। '),
        display: item.glyph,
        options: [{ label: 'ঠিক আছে' }],
        answer: 0,
      };

    /* ---- Recognition ---- */
    case 'picture-quiz': {
      // Show a picture, choose the picture that was named. Needs three
      // drawable words across the lesson, or there is nothing to choose from.
      const word = pictureWord(item);
      if (!word) return null;
      const wrong = others(lesson, itemId, 2, pick)
        .map((o) => ({ item: o, word: pictureWord(o) }))
        .filter((o): o is { item: Item; word: string } => Boolean(o.word))
        .map((o) => ({ image: o.word, itemId: o.item.id }));
      if (wrong.length < 1) return null;

      const { options, answer } = assemble({ image: word, itemId }, wrong, pick);
      return { ...base, ask: `${word} কোনটি?`, speak: word, options, answer };
    }

    case 'tap-answer': {
      // The letter is spoken; the child taps it among its neighbours.
      const wrong = others(lesson, itemId, 2, pick)
        .map((o) => ({ label: o.glyph, itemId: o.id }));
      if (!wrong.length) return null;

      const { options, answer } = assemble({ label: item.glyph, itemId }, wrong, pick);
      return {
        ...base,
        ask: `${item.glyph} কোনটি?`,
        speak: item.glyph,
        options,
        answer,
      };
    }

    case 'find-letter': {
      // Which word contains this letter? Straight from book 44.
      const mine = item.words[0];
      if (!mine) return null;
      const wrong = others(lesson, itemId, 2, pick)
        .map((o) => ({ word: o.words[0]?.text, id: o.id }))
        .filter((o): o is { word: string; id: string } => Boolean(o.word))
        .map((o) => ({ label: o.word, itemId: o.id }));
      if (!wrong.length) return null;

      const { options, answer } = assemble({ label: mine.text, itemId }, wrong, pick);
      return {
        ...base,
        ask: `${item.glyph} কোন শব্দে আছে?`,
        speak: item.glyph,
        display: item.glyph,
        options,
        answer,
      };
    }

    case 'find-initial': {
      // Which word *starts* with this letter? Only ever built for letters that
      // can begin a Bangla word — ঙ, ঞ, ণ and the rest are excluded here and
      // by validateLesson, because for them the question has no answer.
      if (!item.wordInitial) return null;
      const mine = item.words.find((w) => w.initial);
      if (!mine) return null;

      const wrong = others(lesson, itemId, 2, pick)
        .map((o) => ({ word: o.words.find((w) => w.initial)?.text, id: o.id }))
        .filter((o): o is { word: string; id: string } => Boolean(o.word))
        .map((o) => ({ label: o.word, itemId: o.id }));
      if (!wrong.length) return null;

      const { options, answer } = assemble({ label: mine.text, itemId }, wrong, pick);
      return {
        ...base,
        ask: `${item.glyph} দিয়ে কোনটি শুরু?`,
        speak: item.glyph,
        display: item.glyph,
        options,
        answer,
      };
    }

    /* ---- Matching ---- */
    case 'match-picture-letter': {
      const word = pictureWord(item);
      if (!word) return null;
      const wrong = others(lesson, itemId, 2, pick).map((o) => ({
        label: o.glyph, itemId: o.id,
      }));
      if (!wrong.length) return null;

      const { options, answer } = assemble({ label: item.glyph, itemId }, wrong, pick);
      return {
        ...base,
        ask: 'ছবির বর্ণ কোনটি?',
        speak: word,
        image: word,
        options,
        answer,
      };
    }

    case 'match-picture-word': {
      const word = pictureWord(item);
      if (!word) return null;
      const wrong = others(lesson, itemId, 2, pick)
        .map((o) => ({ label: o.glyph, itemId: o.id }));
      if (!wrong.length) return null;

      const { options, answer } = assemble({ label: word, itemId }, wrong, pick);
      return {
        ...base,
        ask: 'ছবির শব্দ কোনটি?',
        speak: word,
        image: word,
        options,
        answer,
      };
    }

    /* ---- Production ---- */
    case 'missing-letter': {
      // The word with the letter blanked out, from book 34.
      const word = item.words[0]?.text ?? item.glyph;
      const blanked = word.replace(item.glyph, '__');
      if (blanked === word) return null;

      const wrong = others(lesson, itemId, 2, pick)
        .map((o) => ({ label: o.glyph, itemId: o.id }));
      if (!wrong.length) return null;

      const { options, answer } = assemble({ label: item.glyph, itemId }, wrong, pick);
      return {
        ...base,
        ask: 'কোন বর্ণটি হারিয়ে গেছে?',
        speak: word,
        display: blanked,
        image: hasArtWord(word) ? word : undefined,
        options,
        answer,
      };
    }

    case 'sequence': {
      // Which letter comes next, from book 52.
      const index = lesson.items.findIndex((i) => i.id === itemId);
      const next = lesson.items[index + 1];
      if (!next) return null;

      const wrong = lesson.items
        .filter((i) => i.id !== next.id && i.id !== itemId)
        .slice(0, 2)
        .map((o) => ({ label: o.glyph, itemId: o.id }));
      if (!wrong.length) return null;

      const { options, answer } = assemble({ label: next.glyph, itemId: next.id }, wrong, pick);
      return {
        ...base,
        // The round tests the *next* item, so a miss is recorded against it.
        itemId: next.id,
        ask: `${item.glyph} এর পরে কোনটি?`,
        speak: item.glyph,
        display: item.glyph,
        options,
        answer,
      };
    }

    case 'build-word': {
      // Drag the letters into place — শব্দ গঠন, book 76.
      const letters = [...item.glyph];
      if (letters.length < 2) return null;
      return {
        ...base,
        ask: 'শব্দটি বানাই',
        speak: item.glyph,
        image: hasArtWord(item.glyph) ? item.glyph : undefined,
        parts: shuffle(letters, pick),
        options: letters.map((l) => ({ label: l })),
        answer: 0,
      };
    }

    case 'trace':
      return {
        ...base,
        ask: 'দাগের উপর লিখি',
        speak: item.glyph,
        trace: item.glyph,
        options: [{ label: 'হয়েছে' }],
        answer: 0,
      };

    /* ---- Number ---- */
    case 'count': {
      if (typeof item.count !== 'number') return null;
      const wrong = others(lesson, itemId, 2, pick)
        .filter((o) => typeof o.count === 'number')
        .map((o) => ({ label: o.glyph, itemId: o.id }));
      if (!wrong.length) return null;

      const { options, answer } = assemble({ label: item.glyph, itemId }, wrong, pick);
      return {
        ...base,
        ask: 'কয়টি আছে?',
        speak: 'কয়টি আছে?',
        count: item.count,
        options,
        answer,
      };
    }

    case 'match-count': {
      if (typeof item.count !== 'number') return null;
      // The numeral is shown; the child picks the matching quantity.
      const wrong = others(lesson, itemId, 2, pick)
        .filter((o) => typeof o.count === 'number')
        .map((o) => ({ label: String(o.count), itemId: o.id }));
      if (!wrong.length) return null;

      const { options, answer } = assemble(
        { label: String(item.count), itemId }, wrong, pick,
      );
      return {
        ...base,
        ask: `${item.glyph} — কোনটি?`,
        speak: item.glyph,
        display: item.glyph,
        options,
        answer,
      };
    }

    case 'fill-dots': {
      if (typeof item.count !== 'number') return null;
      return {
        ...base,
        ask: 'সংখ্যা অনুযায়ী ভরাট করি',
        speak: item.glyph,
        display: item.glyph,
        count: item.count,
        options: [{ label: 'হয়েছে' }],
        answer: 0,
      };
    }

    case 'order-numbers': {
      if (typeof item.count !== 'number') return null;
      // Which is smaller, from book 148.
      const other = others(lesson, itemId, 1, pick)[0];
      if (!other || typeof other.count !== 'number' || other.count === item.count) {
        return null;
      }
      const smaller = item.count < other.count ? item : other;
      const { options, answer } = assemble(
        { label: smaller.glyph, itemId: smaller.id },
        [{ label: (smaller === item ? other : item).glyph,
           itemId: (smaller === item ? other : item).id }],
        pick,
      );
      return {
        ...base,
        itemId: smaller.id,
        ask: 'কোনটি ছোট?',
        speak: 'কোনটি ছোট?',
        options,
        answer,
      };
    }

    case 'add-subtract': {
      if (typeof item.count !== 'number' || item.count < 2) return null;
      // Split the item's own value, so the answer is always the item being
      // practised and the sum is always within what the child has met.
      const left = 1 + Math.floor(pick() * (item.count - 1));
      const right = item.count - left;
      const wrong = others(lesson, itemId, 2, pick)
        .filter((o) => typeof o.count === 'number')
        .map((o) => ({ label: o.glyph, itemId: o.id }));
      if (!wrong.length) return null;

      const { options, answer } = assemble({ label: item.glyph, itemId }, wrong, pick);
      return {
        ...base,
        ask: 'কত হলো?',
        speak: 'কত হলো?',
        display: `${toBangla(left)} + ${toBangla(right)}`,
        count: item.count,
        options,
        answer,
      };
    }

    /* ---- Pickixo's own ---- */
    case 'listen-repeat':
      return {
        ...base,
        ask: `${item.glyph} বলো`,
        speak: item.glyph,
        display: item.glyph,
        options: [{ label: 'বলেছি' }],
        answer: 0,
      };

    case 'sound-match': {
      // Hear a letter, tap it — no picture and no written prompt, so it is
      // genuinely about the sound.
      const wrong = others(lesson, itemId, 2, pick)
        .map((o) => ({ label: o.glyph, itemId: o.id }));
      if (!wrong.length) return null;

      const { options, answer } = assemble({ label: item.glyph, itemId }, wrong, pick);
      return { ...base, ask: 'শুনে খুঁজি', speak: item.glyph, options, answer };
    }

    case 'listen-choose': {
      // Hear a word — never see it written — and pick its picture. The whole
      // point is that the prompt is audio only, so `ask` stays generic.
      const word = pictureWord(item);
      if (!word) return null;
      const wrong = others(lesson, itemId, 2, pick)
        .map((o) => ({ item: o, word: pictureWord(o) }))
        .filter((o): o is { item: Item; word: string } => Boolean(o.word))
        .map((o) => ({ image: o.word, itemId: o.item.id }));
      if (!wrong.length) return null;

      const { options, answer } = assemble({ image: word, itemId }, wrong, pick);
      return { ...base, ask: 'শুনে ছবি বেছে নাও', speak: word, options, answer };
    }

    /* ---- Games with their own interaction ---- */

    case 'odd-one-out': {
      // কোনটি আলাদা — book 26. Three words beginning with one letter and one
      // that does not, so "different" has a reason a child can hear, rather
      // than being a spot-the-odd-shape puzzle with no curriculum content.
      if (!item.wordInitial) return null;
      const mine = item.words.filter((w) => w.initial && hasArtWord(w.text));
      if (mine.length < 2) return null;

      const stranger = others(lesson, itemId, 3, pick)
        .map((o) => ({ o, w: pictureWord(o) }))
        .find((x): x is { o: Item; w: string } => Boolean(x.w));
      if (!stranger) return null;

      const same = mine.slice(0, 2).map((w) => ({ image: w.text, itemId }));
      // A third same-letter picture if the lesson has one, else two is enough
      // to establish the rule.
      const { options, answer } = assemble(
        { image: stranger.w, itemId: stranger.o.id },
        same,
        pick,
      );
      return {
        ...base,
        // The miss is recorded against the *odd* item, since that is what the
        // child had to recognise as not belonging.
        itemId: stranger.o.id,
        ask: 'কোনটি আলাদা?',
        speak: `${item.glyph} দিয়ে নয়, কোনটি?`,
        display: item.glyph,
        options,
        answer,
      };
    }

    case 'spot-difference': {
      // অমিল খুঁজি — book 27. Two rows of the same pictures with exactly one
      // swapped; the child taps the one that changed. Visual discrimination,
      // which the book teaches before letters and a beginner can always do.
      const drawable = lesson.items
        .map((i) => ({ i, w: pictureWord(i) }))
        .filter((x): x is { i: Item; w: string } => Boolean(x.w));
      if (drawable.length < 3) return null;

      const row = shuffle(drawable, pick).slice(0, 3);
      const changed = Math.floor(pick() * row.length);
      // Prefer a picture not already on screen. Where the lesson has only
      // three drawable items there is none, so the changed cell becomes a
      // second copy of one of its neighbours — still a real "which one is
      // different from before?", and better than dropping the game from a
      // lesson that can otherwise support it.
      const spare = drawable.find((d) => !row.some((r) => r.i.id === d.i.id))
        ?? row.find((_, i) => i !== changed);
      if (!spare) return null;
      const a = row.map((r) => r.w);
      const b = a.map((w, i) => (i === changed ? spare.w : w));

      return {
        ...base,
        itemId: spare.i.id,
        ask: 'কোনটি বদলে গেছে?',
        speak: 'কোনটি বদলে গেছে?',
        panels: { a, b },
        options: b.map((w, i) => ({ image: w, itemId: row[i]!.i.id })),
        answer: changed,
      };
    }

    case 'sort': {
      // শ্রেণিকরণ — book 55 for letters, NCTB ৫.২.৮ (কম-বেশি) for numbers.
      if (item.kind === 'number') {
        const pivot = item.count;
        if (typeof pivot !== 'number') return null;
        const pool = lesson.items.filter(
          (i) => typeof i.count === 'number' && i.count !== pivot,
        );
        if (pool.length < 3) return null;

        const tokens: SortToken[] = shuffle(pool, pick).slice(0, 4).map((o) => ({
          id: o.id,
          label: o.glyph,
          bucket: o.count! < pivot ? 'less' : 'more',
          itemId: o.id,
        }));
        // A round where everything lands in one bucket teaches nothing.
        if (new Set(tokens.map((t) => t.bucket)).size < 2) return null;

        return {
          ...base,
          ask: `${item.glyph} থেকে ছোট না বড়?`,
          speak: `${item.glyph} থেকে ছোট না বড়?`,
          sort: {
            buckets: [
              { id: 'less', label: `${item.glyph} থেকে ছোট` },
              { id: 'more', label: `${item.glyph} থেকে বড়` },
            ],
            tokens,
          },
          options: [{ label: 'হয়েছে' }],
          answer: 0,
        };
      }

      // Letters: two letters as buckets, words sorted by which they start with.
      if (!item.wordInitial) return null;
      const partner = others(lesson, itemId, 3, pick).find(
        (o) => o.wordInitial && o.words.some((w) => w.initial),
      );
      if (!partner) return null;

      const take = (from: Item) => from.words
        .filter((w) => w.initial)
        .slice(0, 2)
        .map((w) => ({
          id: `${from.id}-${w.text}`,
          label: w.text,
          image: hasArtWord(w.text) ? w.text : undefined,
          bucket: from.id,
          itemId: from.id,
        }));

      const tokens = shuffle([...take(item), ...take(partner)], pick);
      if (tokens.length < 3) return null;

      return {
        ...base,
        ask: 'ঠিক ঘরে রাখি',
        speak: `${item.glyph} আর ${partner.glyph}`,
        sort: {
          buckets: [
            { id: item.id, label: item.glyph },
            { id: partner.id, label: partner.glyph },
          ],
          tokens,
        },
        options: [{ label: 'হয়েছে' }],
        answer: 0,
      };
    }

    case 'drag-drop': {
      // দাগ টেনে মিলাই — book 32 (letter to word) and 78 (picture to word).
      // Tap one side then the other to join them; three pairs at a time.
      const drawable = lesson.items
        .map((i) => ({ i, w: pictureWord(i) }))
        .filter((x): x is { i: Item; w: string } => Boolean(x.w));
      if (drawable.length < 2) return null;

      const chosen = shuffle(drawable, pick).slice(0, 3);
      return {
        ...base,
        ask: 'মিলিয়ে দাও',
        speak: 'ছবির সাথে বর্ণ মিলাও',
        match: {
          left: chosen.map((c) => ({
            pairId: c.i.id, image: c.w, itemId: c.i.id,
          })),
          right: shuffle(chosen, pick).map((c) => ({
            pairId: c.i.id, label: c.i.glyph, itemId: c.i.id,
          })),
        },
        options: [{ label: 'হয়েছে' }],
        answer: 0,
      };
    }

    case 'memory': {
      // স্মৃতির খেলা — Pickixo's own. The two halves of a pair are the two
      // representations of the same thing, so remembering the card is
      // remembering the letter: picture against letter, or — for numbers —
      // a dot card against its numeral, which is NCTB ৫.২.৩ exactly.
      //
      // Three pairs is six cards: as many as fit a phone without shrinking
      // them below a comfortable tap.
      const numeric = lesson.items.filter((i) => typeof i.count === 'number');
      const pairs: MemoryPair[] = numeric.length >= 2
        ? shuffle(numeric, pick).slice(0, 3).map((i) => ({
          id: i.id, glyph: i.glyph, count: i.count,
        }))
        : shuffle(
          lesson.items
            .map((i) => ({ i, w: pictureWord(i) }))
            .filter((x): x is { i: Item; w: string } => Boolean(x.w)),
          pick,
        ).slice(0, 3).map((c) => ({ id: c.i.id, glyph: c.i.glyph, image: c.w }));

      if (pairs.length < 2) return null;

      return {
        ...base,
        ask: 'জোড়া মেলাও',
        speak: 'জোড়া মেলাও',
        pairs,
        options: [{ label: 'হয়েছে' }],
        answer: 0,
      };
    }

    default:
      return null;
  }
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

export function toBangla(n: number): string {
  return String(n).split('').map((d) => BN_DIGITS[Number(d)] ?? d).join('');
}

/**
 * Build the next playable round, trying each activity the level offers.
 *
 * Some activities cannot be built for some items — ঞ has no initial word, a
 * one-letter item cannot be built from parts, a word with no drawing cannot be
 * a picture question. Rather than showing a broken screen, the player walks
 * the list until something works, and only gives up when nothing does.
 */
export function firstPlayable(
  lesson: Lesson,
  activities: ActivityKind[],
  itemId: string,
  pick: Pick = Math.random,
): Round | null {
  for (const activity of activities) {
    const round = buildRound(lesson, activity, itemId, pick);
    if (round) return round;
  }
  return null;
}
