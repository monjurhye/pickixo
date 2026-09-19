'use client';

/**
 * The four games that do not reduce to "tap one of three".
 *
 * Memory, matching, sorting and spot-the-difference each run for several taps
 * before the round is over, so each keeps its own small piece of state and
 * calls `onDone` when it is finished. Everything else in the player is still a
 * single tap and lives in `LessonPlayer`.
 *
 * Two rules apply to all of them, the same ones as everywhere else:
 *
 * **Nothing can be failed.** A wrong pairing springs back, a card flips over
 * again, a token returns to the tray. The child retries with no penalty, no
 * counter and no message harsher than the wobble.
 *
 * **Everything is a tap.** No drag, even in the game the brief calls "drag and
 * drop" — dragging is hard for four-year-old fingers on a phone and impossible
 * with a screen reader, while tap-then-tap is the same gesture the rest of the
 * app already uses and is what the book's own "দাগ টেনে মিলাই" amounts to.
 */

import { useCallback, useMemo, useState } from 'react';
import type {
  MatchCell, MemoryPair, Round, SortBucket, SortToken,
} from '@/lib/kids/rounds';
import { Art, CountingDots } from './art';

/** What every game here reports back. */
export interface GameProps {
  round: Round;
  /** One pairing/placement resolved. `itemId` is what to record it against. */
  onStep: (itemId: string, correct: boolean) => void;
  /** The whole round is finished. */
  onDone: () => void;
}

const CARD =
  'grid place-items-center rounded-2xl bg-white shadow transition active:scale-95';

/* -------------------------------------------------------------------------- */
/* স্মৃতির খেলা — memory                                                      */
/* -------------------------------------------------------------------------- */

interface Card {
  key: string;
  pairId: string;
  glyph?: string;
  image?: string;
  count?: number;
}

export function MemoryGame({ round, onStep, onDone }: GameProps) {
  const cards = useMemo<Card[]>(() => {
    const pairs = round.pairs ?? [];
    // Each pair becomes two cards: the symbol, and the thing it stands for —
    // a picture for a letter, a group of dots for a number.
    const built = pairs.flatMap((p: MemoryPair) => [
      { key: `${p.id}-g`, pairId: p.id, glyph: p.glyph },
      typeof p.count === 'number'
        ? { key: `${p.id}-c`, pairId: p.id, count: p.count }
        : { key: `${p.id}-i`, pairId: p.id, image: p.image },
    ]);
    // Deterministic shuffle from the round id, so a re-render does not
    // reshuffle the board under the child's fingers mid-game.
    let seed = round.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = built.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      [built[i], built[j]] = [built[j]!, built[i]!];
    }
    return built;
  }, [round.pairs, round.id]);

  const [faceUp, setFaceUp] = useState<string[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const flip = useCallback((card: Card) => {
    if (busy || faceUp.includes(card.key) || found.includes(card.pairId)) return;

    const open = [...faceUp, card.key];
    setFaceUp(open);
    if (open.length < 2) return;

    const [a, b] = open.map((k) => cards.find((c) => c.key === k)!);
    const matched = a!.pairId === b!.pairId;
    onStep(a!.pairId, matched);

    if (matched) {
      const nextFound = [...found, a!.pairId];
      setFound(nextFound);
      setFaceUp([]);
      if (nextFound.length === (round.pairs?.length ?? 0)) {
        window.setTimeout(onDone, 500);
      }
      return;
    }

    // Wrong pair: leave both showing just long enough to be seen, then turn
    // them back. Seeing what was under the card is the whole game.
    setBusy(true);
    window.setTimeout(() => { setFaceUp([]); setBusy(false); }, 900);
  }, [busy, faceUp, found, cards, onStep, onDone, round.pairs]);

  return (
    <div className="grid w-full grid-cols-3 gap-3">
      {cards.map((card) => {
        const open = faceUp.includes(card.key) || found.includes(card.pairId);
        return (
          <button
            key={card.key}
            type="button"
            onClick={() => flip(card)}
            aria-label={
              open
                ? (card.glyph ?? card.image ?? String(card.count))
                : 'কার্ড'
            }
            className={`${CARD} min-h-[92px] p-2 ${
              found.includes(card.pairId) ? 'opacity-45' : ''
            }`}
          >
            {!open && <span className="text-4xl" aria-hidden>❓</span>}
            {open && card.image && <Art name={card.image} size={62} />}
            {open && typeof card.count === 'number' && (
              <CountingDots count={card.count} size={72} />
            )}
            {open && card.glyph && (
              <span className="font-bengali text-4xl font-bold text-[#2b3440]">
                {card.glyph}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* দাগ টেনে মিলাই — matching                                                  */
/* -------------------------------------------------------------------------- */

export function MatchGame({ round, onStep, onDone }: GameProps) {
  const left = round.match?.left ?? [];
  const right = round.match?.right ?? [];

  const [picked, setPicked] = useState<MatchCell | null>(null);
  const [joined, setJoined] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);

  const choose = (cell: MatchCell, side: 'l' | 'r') => {
    if (joined.includes(cell.pairId)) return;

    if (!picked) { setPicked(cell); setWrong(null); return; }

    // Tapping the same side again just moves the selection.
    const pickedSide = left.includes(picked) ? 'l' : 'r';
    if (pickedSide === side) { setPicked(cell); return; }

    const matched = picked.pairId === cell.pairId;
    onStep(cell.itemId, matched);

    if (matched) {
      const next = [...joined, cell.pairId];
      setJoined(next);
      setPicked(null);
      if (next.length === left.length) window.setTimeout(onDone, 450);
      return;
    }

    setWrong(cell.pairId + side);
    window.setTimeout(() => { setWrong(null); setPicked(null); }, 520);
  };

  const cellClass = (cell: MatchCell, side: 'l' | 'r') => {
    const done = joined.includes(cell.pairId);
    const active = picked === cell;
    return `${CARD} min-h-[84px] w-full p-2 ${
      done ? 'opacity-40' : ''
    } ${active ? 'ring-4 ring-[#2eb8a6]' : ''} ${
      wrong === cell.pairId + side ? 'kids-wobble' : ''
    }`;
  };

  return (
    <div className="grid w-full grid-cols-2 gap-4">
      <div className="flex flex-col gap-3">
        {left.map((cell) => (
          <button
            key={cell.pairId}
            type="button"
            onClick={() => choose(cell, 'l')}
            aria-label={cell.image ?? cell.label}
            className={cellClass(cell, 'l')}
          >
            {cell.image
              ? <Art name={cell.image} size={58} />
              : (
                <span className="font-bengali text-3xl font-bold text-[#2b3440]">
                  {cell.label}
                </span>
              )}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {right.map((cell) => (
          <button
            key={cell.pairId}
            type="button"
            onClick={() => choose(cell, 'r')}
            aria-label={cell.label ?? cell.image}
            className={cellClass(cell, 'r')}
          >
            {cell.image
              ? <Art name={cell.image} size={58} />
              : (
                <span className="font-bengali text-4xl font-bold text-[#2b3440]">
                  {cell.label}
                </span>
              )}
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* শ্রেণিকরণ — sorting                                                        */
/* -------------------------------------------------------------------------- */

export function SortGame({ round, onStep, onDone }: GameProps) {
  const buckets: SortBucket[] = round.sort?.buckets ?? [];
  const tokens: SortToken[] = round.sort?.tokens ?? [];

  const [picked, setPicked] = useState<SortToken | null>(null);
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [wrong, setWrong] = useState<string | null>(null);

  const remaining = tokens.filter((t) => !placed[t.id]);

  const drop = (bucket: SortBucket) => {
    if (!picked) return;
    const correct = picked.bucket === bucket.id;
    onStep(picked.itemId, correct);

    if (!correct) {
      setWrong(bucket.id);
      window.setTimeout(() => { setWrong(null); setPicked(null); }, 520);
      return;
    }

    const next = { ...placed, [picked.id]: bucket.id };
    setPlaced(next);
    setPicked(null);
    if (Object.keys(next).length === tokens.length) window.setTimeout(onDone, 450);
  };

  return (
    <div className="flex w-full flex-col gap-4">
      {/* The tray. Tap a card, then tap the box it belongs in. */}
      <div className="flex min-h-[86px] flex-wrap justify-center gap-2">
        {remaining.map((token) => (
          <button
            key={token.id}
            type="button"
            onClick={() => setPicked(token)}
            aria-label={token.label}
            className={`${CARD} min-h-[78px] px-3 ${
              picked?.id === token.id ? 'ring-4 ring-[#2eb8a6]' : ''
            }`}
          >
            {token.image
              ? <Art name={token.image} size={48} />
              : (
                <span className="font-bengali text-2xl font-bold text-[#2b3440]">
                  {token.label}
                </span>
              )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {buckets.map((bucket) => (
          <button
            key={bucket.id}
            type="button"
            onClick={() => drop(bucket)}
            className={`flex min-h-[130px] flex-col items-center gap-2 rounded-3xl border-4 border-dashed border-[#c9d2dc] bg-white/60 p-3 ${
              wrong === bucket.id ? 'kids-wobble' : ''
            }`}
          >
            <span className="font-bengali text-xl font-bold text-[#2b3440]">
              {bucket.label}
            </span>
            <span className="flex flex-wrap justify-center gap-1">
              {tokens
                .filter((t) => placed[t.id] === bucket.id)
                .map((t) => (
                  <span
                    key={t.id}
                    className="rounded-lg bg-[#d8f3ef] px-2 py-1 font-bengali text-base font-semibold"
                  >
                    {t.label}
                  </span>
                ))}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* অমিল খুঁজি — spot the difference                                           */
/* -------------------------------------------------------------------------- */

export function SpotDifferenceGame({
  round, onStep, onDone,
}: GameProps) {
  const a = round.panels?.a ?? [];
  const b = round.panels?.b ?? [];
  const [wrong, setWrong] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const tap = (index: number) => {
    if (done) return;
    const correct = index === round.answer;
    onStep(round.options[index]?.itemId ?? round.itemId, correct);

    if (!correct) {
      setWrong(index);
      window.setTimeout(() => setWrong(null), 520);
      return;
    }
    setDone(true);
    window.setTimeout(onDone, 600);
  };

  return (
    <div className="flex w-full flex-col gap-4">
      {/* The reference row. Not tappable — it is what the child compares to. */}
      <div className="flex justify-center gap-2 rounded-3xl bg-white/70 p-3">
        {a.map((name, i) => (
          <Art key={`${name}-${i}`} name={name} size={58} />
        ))}
      </div>

      <p className="text-center font-bengali text-lg text-[#5a6675]">↓</p>

      <div className="flex justify-center gap-2">
        {b.map((name, i) => (
          <button
            key={`${name}-${i}`}
            type="button"
            onClick={() => tap(i)}
            aria-label={name}
            className={`${CARD} min-h-[84px] p-2 ${
              wrong === i ? 'kids-wobble opacity-40' : ''
            } ${done && i === round.answer ? 'ring-4 ring-[#2eb8a6]' : ''}`}
          >
            <Art name={name} size={58} />
          </button>
        ))}
      </div>
    </div>
  );
}
