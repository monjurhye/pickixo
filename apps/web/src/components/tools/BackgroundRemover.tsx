'use client';

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/States';
import { ClientSideOrmbgEngine } from '@/lib/background-removal/client-engine';
import {
  ACCEPTED_TYPES, MAX_FILE_BYTES, applyAlpha, canvasToBlob, decodeImageFile,
  flattenOnto, isAcceptedType, outputFilename, toCanvas, uncertainty,
} from '@/lib/background-removal/compose';
import { formatBytes } from '@/lib/background-removal/geometry';
import { MODEL_BYTES } from '@/lib/background-removal/model';
import { RemovalError, type Progress } from '@/lib/background-removal/types';

/**
 * The AI Background Remover.
 *
 * The image never leaves the device: it is decoded to a canvas, run through a
 * model in a worker, and composited back, all locally. Nothing here posts the
 * image anywhere, and the privacy note on the page is a description of that
 * rather than a policy.
 */

const MESSAGES: Record<string, string> = {
  'unsupported-browser':
    'This browser cannot run the background remover. Chrome, Edge, Firefox and '
    + 'Safari 17 or newer all work.',
  'model-download-failed':
    'The model could not be downloaded. Check your connection and try again.',
  'out-of-memory':
    'This device ran out of memory on an image that size. Try a smaller image, '
    + 'or close some other tabs and try again.',
  'inference-failed': 'Something went wrong while removing the background. Please try again.',
  'image-too-large': `That file is larger than ${formatBytes(MAX_FILE_BYTES)}.`,
  'image-decode-failed': 'That file could not be read as an image.',
  cancelled: 'Cancelled.',
};
const GENERIC = 'Something went wrong. Please try again.';

type Backdrop = 'transparent' | 'white' | 'black';

interface Ready {
  url: string;
  originalUrl: string;
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  filename: string;
  inferenceMs: number;
  backend: string;
  tier: number;
  soft: number;
  downscaled: boolean;
}

export function BackgroundRemover() {
  const engineRef = useRef<ClientSideOrmbgEngine | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const [progress, setProgress] = useState<Progress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Ready | null>(null);
  const [backdrop, setBackdrop] = useState<Backdrop>('transparent');
  const [split, setSplit] = useState(50);
  const [dragging, setDragging] = useState(false);

  const engine = () => {
    if (!engineRef.current) engineRef.current = new ClientSideOrmbgEngine();
    return engineRef.current;
  };

  // Free the object URLs and tear the worker down, or a few images in a row
  // leaves an 88 MB session and several decoded bitmaps alive.
  useEffect(() => () => {
    engineRef.current?.dispose();
    engineRef.current = null;
  }, []);
  useEffect(() => () => {
    if (result) { URL.revokeObjectURL(result.url); URL.revokeObjectURL(result.originalUrl); }
  }, [result]);

  /** Start the download the moment there is any intent, not after the file
   *  dialog closes — on a first visit that overlap is most of the wait. */
  const warmUp = useCallback(() => {
    engine().prepare(setProgress).catch(() => { /* reported when it is needed */ });
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!isAcceptedType(file.type)) {
      setError('That file type is not supported. Use a PNG, JPG or WebP image.');
      return;
    }
    setError(null);
    setBusy(true);
    setResult((previous) => {
      if (previous) { URL.revokeObjectURL(previous.url); URL.revokeObjectURL(previous.originalUrl); }
      return null;
    });

    try {
      const decoded = await decodeImageFile(file);
      const removal = await engine().remove(
        { pixels: decoded.pixels, width: decoded.width, height: decoded.height },
        setProgress,
      );

      const rgba = applyAlpha(decoded.pixels, removal.alpha);
      const cutout = await canvasToBlob(toCanvas(rgba, decoded.width, decoded.height));
      const original = await canvasToBlob(
        toCanvas(decoded.pixels, decoded.width, decoded.height),
      );

      setResult({
        url: URL.createObjectURL(cutout),
        originalUrl: URL.createObjectURL(original),
        rgba,
        width: decoded.width,
        height: decoded.height,
        filename: outputFilename(file.name),
        inferenceMs: removal.inferenceMs,
        backend: removal.backend,
        tier: removal.tier,
        soft: uncertainty(removal.alpha),
        downscaled: decoded.downscaled,
      });
      setSplit(50);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (err) {
      setError(err instanceof RemovalError ? (MESSAGES[err.code] ?? GENERIC) : GENERIC);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, []);

  const download = useCallback(async () => {
    if (!result) return;
    const canvas = backdrop === 'transparent'
      ? toCanvas(result.rgba, result.width, result.height)
      : flattenOnto(result.rgba, result.width, result.height,
                    backdrop === 'white' ? '#ffffff' : '#000000');
    const blob = await canvasToBlob(canvas);
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  }, [result, backdrop]);

  const downloadPercent = useMemo(() => {
    if (!progress || progress.phase !== 'downloading-model' || progress.ratio == null) return null;
    return Math.round(progress.ratio * 100);
  }, [progress]);

  const backdropStyle = backdrop === 'transparent'
    ? { backgroundImage:
          'linear-gradient(45deg,#d7d3cd 25%,transparent 25%,transparent 75%,#d7d3cd 75%),'
        + 'linear-gradient(45deg,#d7d3cd 25%,transparent 25%,transparent 75%,#d7d3cd 75%)',
        backgroundSize: '18px 18px',
        backgroundPosition: '0 0, 9px 9px',
        backgroundColor: '#f3f1ee' }
    : { backgroundColor: backdrop === 'white' ? '#ffffff' : '#000000' };

  return (
    <div>
      {/* --- picker --------------------------------------------------------- */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) { warmUp(); void handleFile(file); }
        }}
        className={`rounded-card border-2 border-dashed px-6 py-10 text-center
                    transition-colors ${dragging
                      ? 'border-accent bg-accent-soft'
                      : 'border-border-strong bg-surface-sunken'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            // Reset so choosing the same file twice still fires a change.
            e.target.value = '';
          }}
        />

        <p className="text-subheading text-ink">Drop an image here</p>
        <p className="mt-1 text-small text-ink-muted">
          PNG, JPG or WebP · up to {formatBytes(MAX_FILE_BYTES)}
        </p>

        <Button
          size="lg"
          className="mt-5"
          loading={busy}
          loadingLabel="Removing the background"
          onClick={() => { warmUp(); inputRef.current?.click(); }}
        >
          {busy ? 'Working…' : 'Choose image'}
        </Button>

        {/* Progress, with a real number. An unlabelled spinner during an 88 MB
            download reads as a hang, and the usual response is to reload —
            which starts the 88 MB again. */}
        {progress ? (
          <div className="mx-auto mt-6 max-w-sm" role="status" aria-live="polite">
            {progress.phase === 'downloading-model' ? (
              <>
                <div className="flex justify-between text-micro text-ink-muted">
                  <span>Downloading the model — one time only</span>
                  <span className="tabular-nums">
                    {downloadPercent != null ? `${downloadPercent}%` : ''}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-200"
                    style={{ width: `${downloadPercent ?? 0}%` }}
                  />
                </div>
                <p className="mt-1.5 text-micro text-ink-subtle">
                  {formatBytes(progress.receivedBytes ?? 0)} of{' '}
                  {formatBytes(progress.totalBytes ?? MODEL_BYTES)} — it is kept
                  for next time, so this only happens once.
                </p>
              </>
            ) : (
              <p className="text-micro text-ink-muted">
                {progress.phase === 'starting' ? 'Starting the model…' : 'Removing the background…'}
              </p>
            )}
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-control border border-danger/30
                                   bg-danger/5 px-4 py-3 text-small text-danger">
          {error}
        </p>
      ) : null}

      {/* --- result -------------------------------------------------------- */}
      {result ? (
        <section
          ref={resultRef}
          tabIndex={-1}
          aria-label="Result"
          className="mt-8 rounded-card border border-border bg-surface outline-none"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b
                          border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success">Done</Badge>
              <Badge>{result.width} × {result.height}</Badge>
              <Badge>{result.backend === 'webgpu' ? 'GPU' : 'CPU'}</Badge>
              <span className="text-micro text-ink-subtle tabular-nums">
                {(result.inferenceMs / 1000).toFixed(1)}s at {result.tier}px
              </span>
            </div>
            <div className="flex items-center gap-2">
              {(['transparent', 'white', 'black'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setBackdrop(option)}
                  aria-pressed={backdrop === option}
                  className={`rounded-control border px-2.5 py-1 text-micro capitalize
                              transition-colors ${backdrop === option
                                ? 'border-accent bg-accent-soft text-accent-ink'
                                : 'border-border text-ink-muted hover:bg-surface-sunken'}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Before/after. A slider rather than two images side by side: the
              question is always "did it cut the edge correctly", and that is
              only answerable by putting the two edges in the same place. */}
          <div className="p-4">
            <div
              className="relative select-none overflow-hidden rounded-control border border-border"
              style={backdropStyle}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.url}
                alt="Your image with the background removed"
                className="block h-auto w-full"
                style={{ maxHeight: '32rem', objectFit: 'contain' }}
              />
              <div
                className="pointer-events-none absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.originalUrl}
                  alt=""
                  aria-hidden="true"
                  className="block h-auto w-full"
                  style={{ maxHeight: '32rem', objectFit: 'contain' }}
                />
              </div>
              <div
                className="pointer-events-none absolute inset-y-0 w-px bg-white/90 shadow"
                style={{ left: `${split}%` }}
              />
            </div>

            <label className="mt-3 block">
              <span className="sr-only">Compare original with the result</span>
              <input
                type="range"
                min={0}
                max={100}
                value={split}
                onChange={(e) => setSplit(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </label>
            <div className="flex justify-between text-micro text-ink-subtle">
              <span>Original</span>
              <span>Background removed</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => void download()}>
                Download PNG
              </Button>
              <Button variant="secondary" onClick={() => { warmUp(); inputRef.current?.click(); }}>
                Try another image
              </Button>
            </div>

            {/* Honest notes. The model is trained on people; saying so when the
                matte came out uncertain is more useful than letting someone
                conclude the tool is broken. */}
            {result.soft > 0.25 ? (
              <p className="mt-4 rounded-control border border-warning/30 bg-warning/5
                            px-4 py-3 text-small text-ink-muted">
                This one came out uncertain. The model looks for a single clear
                subject and works best on people — busy scenes without an
                obvious subject are the case it handles worst.
              </p>
            ) : null}
            {result.downscaled ? (
              <p className="mt-3 text-micro text-ink-subtle">
                This image was very large, so it was scaled down to fit in your
                browser&apos;s memory.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
