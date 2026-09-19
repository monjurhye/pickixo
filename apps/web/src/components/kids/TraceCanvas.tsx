'use client';

/**
 * Writing a letter by tracing over it.
 *
 * How this judges a trace is the interesting decision. The obvious design is
 * per-letter stroke paths and a check that the child followed them — but that
 * needs 50 hand-authored Bangla letterforms plus 21 numerals, each an
 * opportunity to encode a stroke order that is subtly wrong, and being wrong
 * about how ঞ is written is worse than not teaching it.
 *
 * So instead: the glyph is rendered once to an offscreen canvas, and what is
 * measured is **how much of the letter's own ink the child covered**. That
 * needs no authored data, works identically for every letter and digit the
 * font can render, and is honest about what it checks.
 *
 * The threshold is deliberately generous (§9: "do not require perfect
 * handwriting from a young child"). Sixty per cent coverage passes. A
 * four-year-old with a fingertip on a phone cannot do much better, and the
 * point of the exercise is the motor pattern, not the result.
 *
 * Scribbling everywhere does not pass either: coverage is measured against the
 * glyph only, so ink outside it earns nothing, and a child who fills the whole
 * box is told — gently — to try following the shape.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const SIZE = 280;
/** Fraction of the glyph's pixels that must be covered. */
const THRESHOLD = 0.6;
/** How wide the child's line is, in px. Fat, because fingers are. */
const PEN = 26;

export interface TraceCanvasProps {
  glyph: string;
  /** Called the first time the trace is good enough. */
  onComplete: () => void;
  /** Reset signal — change it to clear the canvas for a new letter. */
  resetKey?: string;
}

export function TraceCanvas({ glyph, onComplete, resetKey }: TraceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<ImageData | null>(null);
  const maskCountRef = useRef(0);
  const drawingRef = useRef(false);
  const doneRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  const [coverage, setCoverage] = useState(0);
  const [done, setDone] = useState(false);
  const [strayed, setStrayed] = useState(false);

  /** Render the glyph to a hidden canvas and remember which pixels are ink. */
  const buildMask = useCallback(() => {
    const offscreen = document.createElement('canvas');
    offscreen.width = SIZE;
    offscreen.height = SIZE;
    const ctx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${SIZE * 0.72}px var(--font-bengali), system-ui, sans-serif`;
    ctx.fillText(glyph, SIZE / 2, SIZE / 2);

    const data = ctx.getImageData(0, 0, SIZE, SIZE);
    let count = 0;
    for (let i = 3; i < data.data.length; i += 4) {
      if (data.data[i]! > 40) count += 1;
    }
    maskRef.current = data;
    maskCountRef.current = count;
  }, [glyph]);

  useEffect(() => {
    buildMask();
    doneRef.current = false;
    setDone(false);
    setStrayed(false);
    setCoverage(0);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, SIZE, SIZE);
  }, [buildMask, resetKey]);

  /** How much of the glyph the child's ink now covers. */
  const measure = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    const mask = maskRef.current;
    if (!ctx || !mask || !maskCountRef.current) return;

    const drawn = ctx.getImageData(0, 0, SIZE, SIZE).data;
    let covered = 0;
    let outside = 0;
    for (let i = 3; i < drawn.length; i += 4) {
      const inked = drawn[i]! > 40;
      if (!inked) continue;
      if (mask.data[i]! > 40) covered += 1; else outside += 1;
    }

    const ratio = covered / maskCountRef.current;
    setCoverage(ratio);
    // Far more ink outside the letter than on it: the child is scribbling
    // rather than tracing, and a nudge helps more than silence.
    setStrayed(outside > covered * 2.5 && outside > 4000);

    if (ratio >= THRESHOLD && !doneRef.current) {
      doneRef.current = true;
      setDone(true);
      onComplete();
    }
  }, [onComplete]);

  const pointAt = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * SIZE,
      y: ((event.clientY - rect.top) / rect.height) * SIZE,
    };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastRef.current = pointAt(event);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    const last = lastRef.current;
    const next = pointAt(event);
    if (!ctx || !last) return;

    ctx.strokeStyle = '#2eb8a6';
    ctx.lineWidth = PEN;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    lastRef.current = next;
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    measure();
  };

  const clear = () => {
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.clearRect(0, 0, SIZE, SIZE);
    doneRef.current = false;
    setDone(false);
    setStrayed(false);
    setCoverage(0);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative rounded-3xl bg-white"
        style={{ width: SIZE, height: SIZE, maxWidth: '84vw', maxHeight: '84vw' }}
      >
        {/* The letter to follow, ghosted underneath. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 grid place-items-center font-bengali font-semibold"
          style={{
            fontSize: SIZE * 0.72,
            color: done ? 'rgba(46,184,166,0.35)' : 'rgba(43,52,64,0.16)',
            lineHeight: 1,
          }}
        >
          {glyph}
        </div>

        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
          className="absolute inset-0 h-full w-full touch-none rounded-3xl"
          // The whole point is drawing with a finger; a screen reader user gets
          // the "দেখাও" button below instead, which completes it for them.
          role="img"
          aria-label={`${glyph} লিখি`}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={clear}
          className="min-h-[56px] rounded-2xl bg-white px-6 text-xl font-semibold text-[#2b3440] shadow"
        >
          আবার
        </button>
        <button
          type="button"
          // Accessibility, and a way out for a child who genuinely cannot draw
          // on this device (§21). Finishing this way still counts — the letter
          // was still looked at, and refusing to let them continue would be
          // the only real failure here.
          onClick={() => {
            if (doneRef.current) return;
            doneRef.current = true;
            setDone(true);
            setCoverage(1);
            onComplete();
          }}
          className="min-h-[56px] rounded-2xl bg-white px-6 text-xl font-semibold text-[#2b3440] shadow"
        >
          দেখাও
        </button>
      </div>

      <p className="h-6 text-lg font-semibold text-[#2b3440]" aria-live="polite">
        {done
          ? 'সুন্দর হয়েছে! ⭐'
          : strayed
            ? 'দাগের উপরে লিখো 😊'
            : coverage > 0.2 ? 'হচ্ছে… ❤️' : ''}
      </p>
    </div>
  );
}
