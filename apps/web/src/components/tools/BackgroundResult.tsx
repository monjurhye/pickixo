'use client';

import {
  useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent,
} from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/States';
import {
  FORMATS, buildEditableCutout, decodeImageFile, exportCutout, releaseEditableCutout,
  saveBlob, subjectBounds, type EditableCutout, type ExportFormat, type ExportSettings,
} from '@/lib/background-removal/compose';
import {
  copyRegion, paintStroke, unionRect, writeAlphaToRgba, writeRegion, type BrushMode,
} from '@/lib/background-removal/brush';
import type { Rect } from '@/lib/background-removal/geometry';
import { RemovalError, type RemovalItem } from '@/lib/background-removal/types';

/**
 * One finished image: compare it, refine the edges, choose what goes behind it,
 * and download it.
 *
 * The page keeps only the matte for each image. This component decodes the
 * photo again for the image that is open, builds two canvases from it, and
 * throws them away when a different image is opened — so twenty images in the
 * list cost twenty mattes, not twenty full-size canvases.
 */

const UNDO_LIMIT = 30;
const DEFAULT_COLOUR = '#4f8cff';

interface Props {
  item: RemovalItem;
  settings: ExportSettings;
  webpSupported: boolean;
  onSettings: (patch: Partial<ExportSettings>) => void;
  onPickBackdropImage: (file: File) => void;
  /** Called when a stroke, undo or reset changes the matte. */
  onEdited: () => void;
  onAddMore: () => void;
}

interface UndoEntry {
  rect: Rect;
  before: Uint8ClampedArray;
}

interface Stroke {
  backup: Uint8ClampedArray;
  last: { x: number; y: number } | null;
  dirty: Rect | null;
  pointerId: number;
}

/** Checkerboard, the universal picture of "nothing here". */
const CHECKER: CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg,#d7d3cd 25%,transparent 25%,transparent 75%,#d7d3cd 75%),'
    + 'linear-gradient(45deg,#d7d3cd 25%,transparent 25%,transparent 75%,#d7d3cd 75%)',
  backgroundSize: '18px 18px',
  backgroundPosition: '0 0, 9px 9px',
  backgroundColor: '#f3f1ee',
};

/** Place a full-size canvas so that `view` — the part of the image to show —
 *  fills the stage exactly. Percentages, so it survives any display size. */
function layerStyle(view: Rect, width: number, height: number): CSSProperties {
  return {
    position: 'absolute',
    left: `${-(view.x / view.w) * 100}%`,
    top: `${-(view.y / view.h) * 100}%`,
    width: `${(width / view.w) * 100}%`,
    height: `${(height / view.h) * 100}%`,
  };
}

/** React cannot render a canvas element it did not create, so mount it by hand. */
function CanvasLayer({ canvas, style }: { canvas: HTMLCanvasElement; style: CSSProperties }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return undefined;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    element.appendChild(canvas);
    return () => { if (canvas.parentNode === element) element.removeChild(canvas); };
  }, [canvas]);
  return <div ref={host} style={style} />;
}

/**
 * Touch targets. A fingertip needs about 44px; a mouse does not, and controls
 * that tall look oversized on a desktop, so these apply only where the primary
 * pointer is coarse. Written out in full rather than composed, because Tailwind
 * only generates classes it can find as whole strings in the source.
 */
const TAP = '[@media(pointer:coarse)]:min-h-[44px]';
const TAP_BUTTON = '[@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:px-4';
const TAP_CHECKBOX = '[@media(pointer:coarse)]:h-5 [@media(pointer:coarse)]:w-5';
const TAP_RANGE = '[@media(pointer:coarse)]:h-9';

function pill(active: boolean) {
  return `inline-flex items-center justify-center ${TAP} rounded-control border px-2.5 py-1
          text-micro [@media(pointer:coarse)]:px-3.5 transition-colors ${active
    ? 'border-accent bg-accent-soft text-accent-ink'
    : 'border-border text-ink-muted hover:bg-surface-sunken'}`;
}

export function BackgroundResult({
  item, settings, webpSupported, onSettings, onPickBackdropImage, onEdited, onAddMore,
}: Props) {
  const [session, setSession] = useState<EditableCutout | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'refine'>('view');
  const [split, setSplit] = useState(50);
  const [revision, setRevision] = useState(0);
  const [tool, setTool] = useState<BrushMode>('erase');
  const [brushSize, setBrushSize] = useState(56);
  const [ghost, setGhost] = useState(true);
  const [undoDepth, setUndoDepth] = useState(0);
  const [customColour, setCustomColour] = useState(DEFAULT_COLOUR);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const stroke = useRef<Stroke | null>(null);
  const undo = useRef<UndoEntry[]>([]);
  /** Fingers currently on the picture, and — once a second one lands — where
   *  their midpoint was last seen. Together they turn a two-finger drag into a
   *  page scroll; see onPointerDown. */
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const panning = useRef<{ x: number; y: number } | null>(null);
  /** The sub-pixel part of a scroll the browser rounded away, carried to the
   *  next move so the page keeps pace with the fingers instead of drifting. */
  const panCarry = useRef({ x: 0, y: 0 });

  const { width, height } = item;

  // Build the working canvases for whichever image is open, and free them when
  // another one is chosen.
  useEffect(() => {
    let cancelled = false;
    let built: EditableCutout | null = null;
    setSession(null);
    setSessionError(null);
    setMode('view');
    setSplit(50);
    setUndoDepth(0);
    undo.current = [];
    stroke.current = null;
    touches.current.clear();
    panning.current = null;
    panCarry.current = { x: 0, y: 0 };

    (async () => {
      try {
        const decoded = await decodeImageFile(item.file);
        if (cancelled) return;
        if (!item.alpha || decoded.width !== item.width || decoded.height !== item.height) {
          throw new RemovalError('image-decode-failed', 'image changed since it was processed');
        }
        built = buildEditableCutout(decoded.pixels, item.alpha, item.width, item.height);
        setSession(built);
      } catch (err) {
        if (!cancelled) {
          setSessionError('This image could not be opened again for editing. '
            + 'Remove it from the list and add it once more.');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (built) releaseEditableCutout(built);
    };
  }, [item]);

  /* --------------------------------- view ---------------------------------- */

  // The crop box follows the matte, so it is recomputed after every edit.
  const crop = useMemo(() => {
    // `revision` is a dependency on purpose: the matte is edited in place, so
    // its identity never changes and this would otherwise never recompute.
    void revision;
    return settings.crop && item.alpha ? subjectBounds(item.alpha, width, height) : null;
  }, [settings.crop, item, width, height, revision]);

  const refining = mode === 'refine';
  const view: Rect = !refining && crop ? crop : { x: 0, y: 0, w: width, h: height };
  const aspect = view.w / view.h;

  const backdrop = settings.backdrop;
  const stageBackdrop: CSSProperties = refining || backdrop.kind === 'transparent'
    ? CHECKER
    : backdrop.kind === 'color'
      ? { backgroundColor: backdrop.color }
      : {
        backgroundImage: `url(${backdrop.url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };

  /* -------------------------------- download ------------------------------- */

  const download = useCallback(async () => {
    if (!session || !item.alpha) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const { blob, filename } = await exportCutout(
        session.cutout, item.alpha, item.name, settings);
      saveBlob(blob, filename);
    } catch {
      // Encoding a very large canvas can fail, especially on phones. Saying so
      // beats a button that does nothing.
      setDownloadError('The image could not be prepared for download. '
        + 'Try again, or use a smaller image.');
    } finally {
      setDownloading(false);
    }
  }, [session, item, settings]);

  /* --------------------------------- brush --------------------------------- */

  /** Pointer position in image pixels, and how many screen pixels one image
   *  pixel takes up. Measured from the canvas itself so it stays right however
   *  the stage is sized or cropped. */
  const locate = (event: PointerEvent<HTMLDivElement>) => {
    const box = session!.cutout.getBoundingClientRect();
    const scale = box.width / width;
    return {
      x: (event.clientX - box.left) / scale,
      y: (event.clientY - box.top) / scale,
      scale,
    };
  };

  const paintAt = (point: { x: number; y: number; scale: number }) => {
    const active = stroke.current;
    if (!active || !session || !item.alpha) return;
    // Brush size is in screen pixels so it feels the same on any image size.
    const radius = brushSize / 2 / point.scale;
    const dirty = paintStroke(
      item.alpha, width, height, active.last, point, radius, tool);
    active.last = { x: point.x, y: point.y };
    if (!dirty) return;
    writeAlphaToRgba(session.image.data, item.alpha, width, dirty);
    session.cutout.getContext('2d')
      ?.putImageData(session.image, 0, 0, dirty.x, dirty.y, dirty.w, dirty.h);
    active.dirty = unionRect(active.dirty, dirty);
  };

  const moveCursor = (event: PointerEvent<HTMLDivElement>) => {
    const cursor = cursorRef.current;
    const stage = stageRef.current;
    if (!cursor || !stage) return;
    const box = stage.getBoundingClientRect();
    cursor.style.display = 'block';
    cursor.style.left = `${event.clientX - box.left}px`;
    cursor.style.top = `${event.clientY - box.top}px`;
  };

  /** Undo a stroke that is still in progress, as if it never happened. */
  const cancelStroke = () => {
    const active = stroke.current;
    stroke.current = null;
    if (!active?.dirty || !session || !item.alpha) return;
    writeRegion(item.alpha, width, active.dirty, copyRegion(active.backup, width, active.dirty));
    writeAlphaToRgba(session.image.data, item.alpha, width, active.dirty);
    session.cutout.getContext('2d')?.putImageData(
      session.image, 0, 0, active.dirty.x, active.dirty.y, active.dirty.w, active.dirty.h);
  };

  const resetPointers = () => {
    stroke.current = null;
    touches.current.clear();
    panning.current = null;
    panCarry.current = { x: 0, y: 0 };
  };

  const touchCentre = () => {
    let x = 0;
    let y = 0;
    for (const point of touches.current.values()) { x += point.x; y += point.y; }
    const count = touches.current.size;
    return { x: x / count, y: y / count };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!refining || !session || !item.alpha) return;

    // The picture takes nearly the full width of a phone and `touch-action` is
    // off so a finger can paint, which would leave no way to scroll the page.
    // One finger paints; put a second one down and the two scroll instead. The
    // stroke the first finger had started is undone, so landing two fingers a
    // beat apart leaves no stray mark.
    if (event.pointerType === 'touch') {
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.current.size >= 2) {
        cancelStroke();
        panning.current = touchCentre();
        panCarry.current = { x: 0, y: 0 };
        return;
      }
      // A finger still down from a scroll must not start painting.
      if (panning.current) return;
    }

    if (stroke.current) return;
    event.preventDefault();
    try {
      // So a stroke that drifts outside the picture still ends properly. Not
      // worth failing the stroke over if the browser refuses.
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch { /* stroke continues without capture */ }
    // A copy of the matte as it was, for undo. The first one ever taken is also
    // the model's own output, which is what "Reset" restores.
    const backup = new Uint8ClampedArray(item.alpha);
    if (!item.modelAlpha) item.modelAlpha = backup;
    stroke.current = { backup, last: null, dirty: null, pointerId: event.pointerId };
    moveCursor(event);
    paintAt(locate(event));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!refining || !session) return;

    if (event.pointerType === 'touch' && touches.current.has(event.pointerId)) {
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (panning.current) {
        // Content follows the fingers: drag down, page moves down.
        const centre = touchCentre();
        const wantX = panning.current.x - centre.x + panCarry.current.x;
        const wantY = panning.current.y - centre.y + panCarry.current.y;
        const fromX = window.scrollX;
        const fromY = window.scrollY;
        window.scrollBy(wantX, wantY);
        // Carry at most a pixel: at the top or bottom of the page nothing
        // moves, and an unbounded carry would jump back when the fingers turn.
        const clamp = (value: number) => Math.max(-1, Math.min(1, value));
        panCarry.current = {
          x: clamp(wantX - (window.scrollX - fromX)),
          y: clamp(wantY - (window.scrollY - fromY)),
        };
        panning.current = centre;
        return;
      }
    }

    moveCursor(event);
    if (stroke.current?.pointerId === event.pointerId) paintAt(locate(event));
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      touches.current.delete(event.pointerId);
      // Scrolling continues on the remaining finger, so lifting one does not
      // suddenly turn the other into a brush. It ends when all are up.
      if (touches.current.size === 0) panning.current = null;
      else if (panning.current) panning.current = touchCentre();
    }
    // Only the finger that is painting can end the stroke; a second finger
    // lifting must not cut it short.
    if (stroke.current?.pointerId === event.pointerId) endStroke();
  };

  const endStroke = () => {
    const finished = stroke.current;
    stroke.current = null;
    if (!finished?.dirty) return;
    undo.current.push({
      rect: finished.dirty, before: copyRegion(finished.backup, width, finished.dirty),
    });
    if (undo.current.length > UNDO_LIMIT) undo.current.shift();
    item.edited = true;
    setUndoDepth(undo.current.length);
    setRevision((n) => n + 1);
    onEdited();
  };

  const undoLast = () => {
    const entry = undo.current.pop();
    if (!entry || !session || !item.alpha) return;
    writeRegion(item.alpha, width, entry.rect, entry.before);
    writeAlphaToRgba(session.image.data, item.alpha, width, entry.rect);
    session.cutout.getContext('2d')?.putImageData(
      session.image, 0, 0, entry.rect.x, entry.rect.y, entry.rect.w, entry.rect.h);
    setUndoDepth(undo.current.length);
    setRevision((n) => n + 1);
    onEdited();
  };

  const resetEdits = () => {
    if (!session || !item.alpha || !item.modelAlpha) return;
    item.alpha.set(item.modelAlpha);
    const whole = { x: 0, y: 0, w: width, h: height };
    writeAlphaToRgba(session.image.data, item.alpha, width, whole);
    session.cutout.getContext('2d')?.putImageData(session.image, 0, 0);
    undo.current = [];
    item.edited = false;
    setUndoDepth(0);
    setRevision((n) => n + 1);
    onEdited();
  };

  /* --------------------------------- render -------------------------------- */

  const stageStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    // Capped by width rather than by height: the layers are placed in
    // percentages, which only stay undistorted if the stage keeps its ratio.
    maxWidth: `calc(32rem * ${aspect})`,
    margin: '0 auto',
    aspectRatio: `${view.w} / ${view.h}`,
    ...stageBackdrop,
  };

  const jpgFlattens = settings.format === 'jpg' && backdrop.kind === 'transparent';
  const colourValue = backdrop.kind === 'color' ? backdrop.color : customColour;
  const isWhite = backdrop.kind === 'color' && backdrop.color === '#ffffff';
  const isBlack = backdrop.kind === 'color' && backdrop.color === '#000000';
  const isCustomColour = backdrop.kind === 'color' && !isWhite && !isBlack;

  return (
    <section
      id="bg-result"
      tabIndex={-1}
      aria-label="Result"
      className="mt-8 rounded-card border border-border bg-surface outline-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b
                      border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success">Done</Badge>
          <Badge>{refining ? width : view.w} × {refining ? height : view.h}</Badge>
          <Badge>{item.backend === 'webgpu' ? 'GPU' : 'CPU'}</Badge>
          <span className="text-micro text-ink-subtle tabular-nums">
            {(item.inferenceMs / 1000).toFixed(1)}s at {item.tier}px
          </span>
          {item.edited ? <Badge>Edited</Badge> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {refining ? (
            <Button size="sm" className={TAP_BUTTON}
                    onClick={() => { resetPointers(); setMode('view'); }}>
              Done editing
            </Button>
          ) : (
            <Button size="sm" variant="secondary" className={TAP_BUTTON}
                    onClick={() => setMode('refine')} disabled={!session}>
              Refine edges
            </Button>
          )}
        </div>
      </div>

      <div className="p-4">
        {sessionError ? (
          <p role="alert" className="rounded-control border border-danger/30 bg-danger/5
                                     px-4 py-3 text-small text-danger">
            {sessionError}
          </p>
        ) : !session ? (
          <div className="flex h-48 items-center justify-center text-small text-ink-subtle"
               role="status">
            Opening the image…
          </div>
        ) : (
          <>
            {refining ? (
              <div className="mb-3 space-y-3">
                <p className="text-small text-ink-muted">
                  Paint on the picture. <strong className="font-medium text-ink">Erase</strong>{' '}
                  removes background that was left behind;{' '}
                  <strong className="font-medium text-ink">Restore</strong> brings back
                  parts of the subject that were cut away.
                </p>
                <p className="hidden text-small text-ink-muted [@media(pointer:coarse)]:block">
                  One finger paints. Use two fingers to scroll the page.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setTool('erase')}
                          aria-pressed={tool === 'erase'} className={pill(tool === 'erase')}>
                    Erase
                  </button>
                  <button type="button" onClick={() => setTool('restore')}
                          aria-pressed={tool === 'restore'} className={pill(tool === 'restore')}>
                    Restore
                  </button>
                  <label className={`ml-1 flex items-center gap-2 text-micro text-ink-muted ${TAP}`}>
                    Brush size
                    <input type="range" min={8} max={200} value={brushSize}
                           onChange={(e) => setBrushSize(Number(e.target.value))}
                           className={`w-28 accent-accent ${TAP_RANGE}`} />
                  </label>
                  <label className={`flex items-center gap-1.5 text-micro text-ink-muted ${TAP}`}>
                    <input type="checkbox" checked={ghost}
                           onChange={(e) => setGhost(e.target.checked)}
                           className={`accent-accent ${TAP_CHECKBOX}`} />
                    Show removed areas
                  </label>
                  <span className="ml-auto flex gap-2">
                    <Button size="sm" variant="secondary" className={TAP_BUTTON}
                            onClick={undoLast} disabled={undoDepth === 0}>
                      Undo
                    </Button>
                    <Button size="sm" variant="secondary" className={TAP_BUTTON}
                            onClick={resetEdits} disabled={!item.edited}>
                      Reset
                    </Button>
                  </span>
                </div>
              </div>
            ) : null}

            {/* Before/after. A slider rather than two images side by side: the
                question is always "did it cut the edge correctly", and that is
                only answerable by putting the two edges in the same place. */}
            <div
              ref={stageRef}
              className="select-none rounded-control border border-border"
              style={{
                ...stageStyle,
                touchAction: refining ? 'none' : 'auto',
                cursor: refining ? 'none' : 'auto',
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              onPointerLeave={() => {
                if (cursorRef.current) cursorRef.current.style.display = 'none';
              }}
            >
              {refining && ghost ? (
                <div className="pointer-events-none absolute inset-0" style={{ opacity: 0.35 }}>
                  <CanvasLayer canvas={session.original} style={layerStyle(view, width, height)} />
                </div>
              ) : null}

              <CanvasLayer canvas={session.cutout} style={layerStyle(view, width, height)} />

              {!refining ? (
                <>
                  <div
                    className="pointer-events-none absolute inset-0 overflow-hidden"
                    style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
                    aria-hidden="true"
                  >
                    <CanvasLayer canvas={session.original}
                                 style={layerStyle(view, width, height)} />
                  </div>
                  <div
                    className="pointer-events-none absolute inset-y-0 w-px bg-white/90 shadow"
                    style={{ left: `${split}%` }}
                  />
                </>
              ) : (
                <div
                  ref={cursorRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute hidden rounded-full"
                  style={{
                    width: brushSize,
                    height: brushSize,
                    transform: 'translate(-50%, -50%)',
                    border: '1.5px solid #fff',
                    boxShadow: '0 0 0 1px rgba(0,0,0,.65)',
                  }}
                />
              )}
            </div>

            {!refining ? (
              <>
                <label className="mt-3 block">
                  <span className="sr-only">Compare original with the result</span>
                  <input
                    type="range" min={0} max={100} value={split}
                    onChange={(e) => setSplit(Number(e.target.value))}
                    className={`w-full accent-accent ${TAP_RANGE}`}
                  />
                </label>
                <div className="flex justify-between text-micro text-ink-subtle">
                  <span>Original</span>
                  <span>Background removed</span>
                </div>

                {/* --- what goes behind, and how it is saved ---------------- */}
                <div className="mt-5 space-y-4 border-t border-border pt-4">
                  <div>
                    <p className="text-small font-medium text-ink">Background</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button type="button" aria-pressed={backdrop.kind === 'transparent'}
                              className={pill(backdrop.kind === 'transparent')}
                              onClick={() => onSettings({ backdrop: { kind: 'transparent' } })}>
                        Transparent
                      </button>
                      <button type="button" aria-pressed={isWhite} className={pill(isWhite)}
                              onClick={() => onSettings({ backdrop: { kind: 'color', color: '#ffffff' } })}>
                        White
                      </button>
                      <button type="button" aria-pressed={isBlack} className={pill(isBlack)}
                              onClick={() => onSettings({ backdrop: { kind: 'color', color: '#000000' } })}>
                        Black
                      </button>
                      <label className={`${pill(isCustomColour)} flex cursor-pointer items-center gap-1.5`}>
                        Colour
                        <input
                          type="color" value={colourValue}
                          onChange={(e) => {
                            setCustomColour(e.target.value);
                            onSettings({ backdrop: { kind: 'color', color: e.target.value } });
                          }}
                          className="h-4 w-5 cursor-pointer border-0 bg-transparent p-0"
                          aria-label="Pick a background colour"
                        />
                      </label>
                      <button type="button" aria-pressed={backdrop.kind === 'image'}
                              className={pill(backdrop.kind === 'image')}
                              onClick={() => imageInputRef.current?.click()}>
                        Image…
                      </button>
                      <input
                        ref={imageInputRef} type="file" accept="image/*" className="sr-only"
                        tabIndex={-1}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) onPickBackdropImage(file);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                    <label className={`flex items-center gap-1.5 text-small text-ink-muted ${TAP}`}>
                      <input type="checkbox" checked={settings.crop}
                             onChange={(e) => onSettings({ crop: e.target.checked })}
                             className={`accent-accent ${TAP_CHECKBOX}`} />
                      Crop to subject
                    </label>
                    <label className={`flex items-center gap-2 text-small text-ink-muted ${TAP}`}>
                      Save as
                      <select
                        value={settings.format}
                        onChange={(e) => onSettings({ format: e.target.value as ExportFormat })}
                        className={`rounded-control border border-border bg-surface px-2 py-1
                                    text-small text-ink ${TAP}`}
                      >
                        <option value="png">PNG</option>
                        <option value="jpg">JPG</option>
                        {webpSupported ? <option value="webp">WebP</option> : null}
                      </select>
                    </label>
                  </div>
                  {jpgFlattens ? (
                    <p className="text-micro text-ink-subtle">
                      JPG cannot be transparent, so white is used behind the subject.
                      Choose PNG or WebP to keep it transparent.
                    </p>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => void download()} loading={downloading}
                          className={TAP} loadingLabel="Preparing the download">
                    Download {FORMATS[settings.format].label}
                  </Button>
                  <Button variant="secondary" className={TAP} onClick={onAddMore}>
                    Add another image
                  </Button>
                </div>
                {downloadError ? (
                  <p role="alert" className="mt-3 text-small text-danger">{downloadError}</p>
                ) : null}

                {/* Honest notes. The model is trained on people; saying so when
                    the matte came out uncertain is more useful than letting
                    someone conclude the tool is broken. */}
                {item.soft > 0.25 ? (
                  <p className="mt-4 rounded-control border border-warning/30 bg-warning/5
                                px-4 py-3 text-small text-ink-muted">
                    This one came out uncertain. The model looks for a single clear
                    subject and works best on people — busy scenes without an
                    obvious subject are the case it handles worst. You can fix
                    stray edges with Refine edges.
                  </p>
                ) : null}
                {item.downscaled ? (
                  <p className="mt-3 text-micro text-ink-subtle">
                    This image was very large, so it was scaled down to about 16
                    megapixels to fit in your browser&apos;s memory.
                  </p>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
