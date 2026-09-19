'use client';

import {
  useCallback, useEffect, useReducer, useRef, useState,
} from 'react';
import { Button } from '@/components/ui/Button';
import { BackgroundResult } from '@/components/tools/BackgroundResult';
import { ClientSideOrmbgEngine } from '@/lib/background-removal/client-engine';
import {
  ACCEPTED_LABEL, ACCEPT_ATTRIBUTE, MAX_FILE_BYTES, composeCutout, decodeImageFile,
  exportCutout, isAcceptedFile, releaseCanvas, saveBlob, uncertainty, uniqueName,
  type BackdropChoice, type ExportSettings,
} from '@/lib/background-removal/compose';
import { formatBytes } from '@/lib/background-removal/geometry';
import { MODEL_BYTES } from '@/lib/background-removal/model';
import { RemovalError, type Progress, type RemovalItem } from '@/lib/background-removal/types';
import { createZip } from '@/lib/background-removal/zip';

/**
 * The AI Background Remover.
 *
 * The image never leaves the device: it is decoded to a canvas, run through a
 * model in a worker, and composited back, all locally. Nothing here posts the
 * image anywhere, and the privacy note on the page is a description of that
 * rather than a policy.
 *
 * This component owns the queue: any number of images can be added by picking,
 * dropping or pasting, and they are processed one at a time because the model
 * runs on one worker. The image open for inspection is BackgroundResult.
 */

/** A batch is bounded by memory, not by policy: each finished image keeps a
 *  full-size matte in memory until it is removed. */
const MAX_BATCH = 20;

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
  'heic-unsupported':
    'This browser cannot open HEIC photos (Safari can). Convert it to JPG first, or on an '
    + 'iPhone choose Settings › Camera › Formats › Most Compatible.',
  cancelled: 'Cancelled.',
};
const GENERIC = 'Something went wrong. Please try again.';
const DOWNLOAD_FAILED =
  'The download could not be prepared. Try again, or use fewer or smaller images.';

const DEFAULT_SETTINGS: ExportSettings = {
  format: 'png',
  backdrop: { kind: 'transparent' },
  crop: false,
};

function disposeBackdrop(backdrop: BackdropChoice) {
  if (backdrop.kind !== 'image') return;
  URL.revokeObjectURL(backdrop.url);
  backdrop.bitmap.close();
}

export function BackgroundRemover() {
  const engineRef = useRef<ClientSideOrmbgEngine | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** The queue lives in a ref and is mutated in place: matte arrays are large
   *  and are edited by the brush, so they must not be copied through state. */
  const itemsRef = useRef<RemovalItem[]>([]);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const nextId = useRef(1);
  const pumping = useRef(false);
  /** Bumped on cancel so a run still awaiting knows it was abandoned. */
  const runRef = useRef(0);

  const settingsRef = useRef<ExportSettings>(DEFAULT_SETTINGS);
  const [settings, setSettings] = useState<ExportSettings>(DEFAULT_SETTINGS);

  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [zipping, setZipping] = useState(false);
  const [webpSupported, setWebpSupported] = useState(true);
  // Whether the main pointer is a finger. Starts false so the server-rendered
  // markup and the first client render agree, then corrects after mount.
  const [touch, setTouch] = useState(false);

  const engine = () => {
    if (!engineRef.current) engineRef.current = new ClientSideOrmbgEngine();
    return engineRef.current;
  };

  // "Drop images here" and "Ctrl+V" mean nothing on a phone, and a hint that
  // describes controls the visitor does not have reads as a broken page.
  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    setTouch(query.matches);
    const onChange = (event: MediaQueryListEvent) => setTouch(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Safari cannot encode WebP. Offering it would hand people a PNG with the
  // wrong extension, so the option is only shown where it really works.
  useEffect(() => {
    try {
      const probe = document.createElement('canvas');
      probe.width = 1;
      probe.height = 1;
      setWebpSupported(probe.toDataURL('image/webp').startsWith('data:image/webp'));
    } catch {
      setWebpSupported(false);
    }
  }, []);

  // Free the object URLs and tear the worker down, or a few images in a row
  // leaves an 88 MB session and several decoded bitmaps alive.
  useEffect(() => () => {
    runRef.current++;
    engineRef.current?.dispose();
    engineRef.current = null;
    for (const item of itemsRef.current) URL.revokeObjectURL(item.thumbUrl);
    disposeBackdrop(settingsRef.current.backdrop);
  }, []);

  /* --------------------------------- settings ------------------------------ */

  const changeSettings = useCallback((patch: Partial<ExportSettings>) => {
    const previous = settingsRef.current;
    const next = { ...previous, ...patch };
    if (patch.backdrop && patch.backdrop !== previous.backdrop) {
      disposeBackdrop(previous.backdrop);
    }
    settingsRef.current = next;
    setSettings(next);
  }, []);

  const pickBackdropImage = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setError(`That background image is larger than ${formatBytes(MAX_FILE_BYTES)}.`);
      return;
    }
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      changeSettings({ backdrop: { kind: 'image', bitmap, url: URL.createObjectURL(file) } });
    } catch {
      setError('That background image could not be read.');
    }
  }, [changeSettings]);

  /* --------------------------------- queue --------------------------------- */

  /** Start the download the moment there is any intent, not after the file
   *  dialog closes — on a first visit that overlap is most of the wait. */
  const warmUp = useCallback(() => {
    // Clear the progress note once warm-up ends, or "Starting the model…" stays
    // on screen for good when the file dialog is cancelled. Not while a run is
    // in progress: that owns the progress line.
    const settle = () => { if (!pumping.current) setProgress(null); };
    engine().prepare(setProgress).then(settle, settle);
  }, []);

  const removeItem = useCallback((item: RemovalItem) => {
    URL.revokeObjectURL(item.thumbUrl);
    itemsRef.current = itemsRef.current.filter((other) => other !== item);
    setSelectedId((current) => (current === item.id ? null : current));
    rerender();
  }, []);

  const processItem = useCallback(async (item: RemovalItem) => {
    const run = runRef.current;
    const abandoned = () => run !== runRef.current;
    item.status = 'processing';
    rerender();

    try {
      const decoded = await decodeImageFile(item.file);
      if (abandoned()) return;
      const removal = await engine().remove(
        { pixels: decoded.pixels, width: decoded.width, height: decoded.height },
        setProgress,
      );
      if (abandoned()) return;

      item.width = decoded.width;
      item.height = decoded.height;
      item.alpha = removal.alpha;
      item.inferenceMs = removal.inferenceMs;
      item.backend = removal.backend;
      item.tier = removal.tier;
      item.soft = uncertainty(removal.alpha);
      item.downscaled = decoded.downscaled;
      item.status = 'done';

      const first = !itemsRef.current.some((other) => other !== item && other.status === 'done');
      rerender();
      if (first) requestAnimationFrame(() => document.getElementById('bg-result')?.focus());
    } catch (err) {
      if (abandoned()) return;
      const message = err instanceof RemovalError ? (MESSAGES[err.code] ?? GENERIC) : GENERIC;
      if (itemsRef.current.length === 1) {
        // A lone image that failed is not worth a list row: say why, up top.
        removeItem(item);
        setError(message);
      } else {
        item.status = 'error';
        item.error = message;
        rerender();
      }
    }
  }, [removeItem]);

  /** Work through the queue, one image at a time. Safe to call repeatedly: a
   *  second call while one is running just lets the running loop find the new
   *  items. */
  const pump = useCallback(async () => {
    if (pumping.current) return;
    pumping.current = true;
    try {
      for (;;) {
        const next = itemsRef.current.find((item) => item.status === 'queued');
        if (!next) break;
        await processItem(next);
      }
    } finally {
      pumping.current = false;
      setProgress(null);
    }
  }, [processItem]);

  const addFiles = useCallback((files: File[]) => {
    if (!files.length) return;
    const accepted = files.filter(isAcceptedFile);
    const skipped = files.length - accepted.length;
    const room = Math.max(0, MAX_BATCH - itemsRef.current.length);
    const taken = accepted.slice(0, room);

    const notes: string[] = [];
    if (skipped) {
      notes.push(`${skipped} ${skipped === 1 ? 'file was' : 'files were'} skipped. `
        + `Use ${ACCEPTED_LABEL}.`);
    }
    if (accepted.length > taken.length) {
      notes.push(`Up to ${MAX_BATCH} images at a time. Remove some to add more.`);
    }
    setError(notes.length ? notes.join(' ') : null);
    if (!taken.length) return;

    for (const file of taken) {
      itemsRef.current.push({
        id: nextId.current++,
        file,
        name: file.name,
        thumbUrl: URL.createObjectURL(file),
        status: 'queued',
        width: 0,
        height: 0,
        alpha: null,
        modelAlpha: null,
        edited: false,
        inferenceMs: 0,
        backend: '',
        tier: 0,
        soft: 0,
        downscaled: false,
      });
    }
    rerender();
    void pump();
  }, [pump]);

  /** Abandon whatever is queued or running. Finished images are kept. */
  const cancel = useCallback(() => {
    runRef.current++;
    engineRef.current?.cancel();
    const kept: RemovalItem[] = [];
    for (const item of itemsRef.current) {
      if (item.status === 'done' || item.status === 'error') kept.push(item);
      else URL.revokeObjectURL(item.thumbUrl);
    }
    itemsRef.current = kept;
    setProgress(null);
    rerender();
  }, []);

  const openPicker = useCallback(() => {
    warmUp();
    inputRef.current?.click();
  }, [warmUp]);

  // Ctrl+V, or the paste menu on a phone. Screenshots are the common case, and
  // the alternative is saving one to a file just to choose it again.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? [])
        .filter((file) => file.type.startsWith('image/'));
      if (!files.length) return;
      event.preventDefault();
      warmUp();
      addFiles(files);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [addFiles, warmUp]);

  /* --------------------------------- export -------------------------------- */

  const downloadAll = useCallback(async () => {
    const finished = itemsRef.current.filter((item) => item.status === 'done' && item.alpha);
    if (!finished.length) return;
    setZipping(true);
    setError(null);
    try {
      const entries: { name: string; data: Blob }[] = [];
      const used = new Set<string>();
      // One at a time: each needs its photo decoded again, and doing them all at
      // once is exactly the memory spike the queue exists to avoid.
      for (const item of finished) {
        const decoded = await decodeImageFile(item.file);
        if (decoded.width !== item.width || decoded.height !== item.height) {
          throw new RemovalError('image-decode-failed', 'image changed since it was processed');
        }
        const cutout = composeCutout(decoded.pixels, item.alpha!, item.width, item.height);
        try {
          const { blob, filename } = await exportCutout(
            cutout, item.alpha!, item.name, settingsRef.current);
          entries.push({ name: uniqueName(filename, used), data: blob });
        } finally {
          releaseCanvas(cutout);
        }
      }
      saveBlob(await createZip(entries), 'pickixo-backgrounds-removed.zip');
    } catch {
      setError(DOWNLOAD_FAILED);
    } finally {
      setZipping(false);
    }
  }, []);

  /* --------------------------------- render -------------------------------- */

  const items = itemsRef.current;
  const busy = items.some((item) => item.status === 'queued' || item.status === 'processing');
  const pending = items.filter(
    (item) => item.status === 'queued' || item.status === 'processing').length;
  const doneCount = items.filter((item) => item.status === 'done').length;
  const selected = items.find((item) => item.id === selectedId && item.status === 'done')
    ?? items.find((item) => item.status === 'done');

  const downloadPercent = progress?.phase === 'downloading-model' && progress.ratio != null
    ? Math.round(progress.ratio * 100)
    : null;

  return (
    <div>
      {/* --- picker --------------------------------------------------------- */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const files = Array.from(e.dataTransfer.files ?? []);
          if (files.length) { warmUp(); addFiles(files); }
        }}
        className={`rounded-card border-2 border-dashed px-6 py-10 text-center
                    transition-colors ${dragging
                      ? 'border-accent bg-accent-soft'
                      : 'border-border-strong bg-surface-sunken'}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) addFiles(files);
            // Reset so choosing the same file twice still fires a change.
            e.target.value = '';
          }}
        />

        <p className="text-subheading text-ink">
          {touch ? 'Choose photos to remove the background from' : 'Drop images here, or paste with Ctrl+V'}
        </p>
        <p className="mt-1 text-small text-ink-muted">
          {ACCEPTED_LABEL} · up to {formatBytes(MAX_FILE_BYTES)} each · up to {MAX_BATCH} at a time
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button
            size="lg"
            loading={busy}
            loadingLabel="Removing the background"
            onClick={openPicker}
          >
            {busy ? 'Working…' : 'Choose images'}
          </Button>
          {busy ? (
            <Button size="lg" variant="secondary" onClick={cancel}>
              Cancel
            </Button>
          ) : null}
        </div>

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
                {progress.phase === 'starting'
                  ? 'Starting the model…'
                  : `Removing the background…${pending > 1 ? ` (${pending} left)` : ''}`}
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

      {/* --- the queue, once there is more than one image ------------------- */}
      {items.length > 1 ? (
        <section aria-label="Images" className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-subheading text-ink">{items.length} images</h2>
            {doneCount > 1 ? (
              <Button size="sm" onClick={() => void downloadAll()} loading={zipping}
                      className="[@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:px-4"
                      loadingLabel="Preparing the zip">
                Download all (.zip)
              </Button>
            ) : null}
          </div>
          <ul className="mt-3 divide-y divide-border rounded-card border border-border">
            {items.map((item) => {
              const isSelected = selected?.id === item.id;
              return (
                <li key={item.id}
                    className={`flex items-center gap-2 p-2 ${isSelected ? 'bg-accent-soft' : ''}`}>
                  <button
                    type="button"
                    disabled={item.status !== 'done'}
                    aria-current={isSelected || undefined}
                    onClick={() => setSelectedId(item.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-control p-1
                               text-left disabled:cursor-default"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.thumbUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-control bg-surface-sunken object-cover"
                      onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-small text-ink">{item.name}</span>
                      <span className={`block text-micro ${item.status === 'error'
                        ? 'text-danger' : 'text-ink-subtle'}`}>
                        {item.status === 'queued' ? 'Waiting'
                          : item.status === 'processing' ? 'Removing the background…'
                            : item.status === 'error' ? item.error
                              : `${item.width} × ${item.height}${item.edited ? ' · edited' : ''}`}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={item.status === 'processing'}
                    onClick={() => removeItem(item)}
                    aria-label={`Remove ${item.name}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control
                               [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11
                               text-ink-subtle hover:bg-surface-sunken hover:text-ink
                               disabled:opacity-40"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* --- result -------------------------------------------------------- */}
      {selected ? (
        <BackgroundResult
          item={selected}
          settings={settings}
          webpSupported={webpSupported}
          onSettings={changeSettings}
          onPickBackdropImage={(file) => void pickBackdropImage(file)}
          onEdited={rerender}
          onAddMore={openPicker}
        />
      ) : null}
    </div>
  );
}
