/**
 * Geometry for the background remover.
 *
 * Deliberately free of DOM types so it can be tested in Node. Everything here
 * is arithmetic that decides what the model sees, and every rule encoded below
 * was measured against the real model rather than assumed — see docs/MODELS.md.
 */

/**
 * The model runs at exactly 1024x1024 in the browser. Nothing else.
 *
 * This is narrower than the model file allows, and the difference cost a
 * working feature, so it is worth stating precisely.
 *
 * The ONNX graph accepts any dimension that is a multiple of 64 — measured
 * directly, and under Python's CPU provider 512 really does run 5x faster at
 * IoU 0.997 against 1024. None of that survives in the browser. ONNX Runtime
 * Web's WASM provider resolves the decoder's Resize sizes differently, so a
 * skip connection disagrees with its own branch and the run dies inside the
 * network:
 *
 *     Concat node '/stage1/Concat_2': Non concat axis dimensions must match:
 *     Axis 2 has mismatched dimensions of 16 and 32
 *
 * A sweep of 320, 384, 448, 512, 576, 640, 704, 768, 832, 896 and 960 in a
 * real browser failed at every single one. 1024 is the only size that runs.
 *
 * So there is no resolution tier and no "faster" mode: the honest options were
 * 1024 or nothing. Measuring this on the CPU provider and shipping the tiers
 * would have produced a quality selector that crashed for everyone who touched
 * it — and, worse, a small image would have crashed on its own, because the
 * previous version of this file sized the canvas to the image.
 */
export const MODEL_SIDE = 1024;

/** Retained because the constraint is real and an input must still satisfy it;
 *  MODEL_SIDE is a multiple of 64 by construction. */
export const SIZE_MULTIPLE = 64;

/** Round to the nearest valid multiple, never returning zero. */
export function snapTo64(value: number): number {
  const snapped = Math.round(value / SIZE_MULTIPLE) * SIZE_MULTIPLE;
  return Math.max(SIZE_MULTIPLE, snapped);
}

export interface LetterboxPlan {
  /** Side of the square canvas handed to the model. Always a multiple of 64. */
  side: number;
  /** Size the source is drawn at inside that canvas, aspect preserved. */
  drawWidth: number;
  drawHeight: number;
  /** Where it is drawn. The rest of the canvas is neutral padding. */
  offsetX: number;
  offsetY: number;
}

/**
 * Fit an image into a square canvas without distorting it.
 *
 * Squashing to a square is what the training pipeline did, and it is the
 * obvious thing to copy — but it is measurably worse on unusual aspect
 * ratios. On a 6:1 crop the three candidate strategies disagreed sharply, and
 * the fraction of pixels left in the uncertain middle of the range (lower is a
 * more confident matte) was:
 *
 *     squash to square        21.5%
 *     keep aspect, no pad     20.7%
 *     letterbox (this)         6.0%
 *
 * On ordinary photographs all three agree to IoU 0.999, so this costs nothing
 * in the common case and prevents a collapse in the uncommon one.
 *
 * A small image is scaled up into the canvas rather than run at its own size.
 * That buys no extra detail and is slightly wasteful, but 1024 is the only
 * size the browser runtime will run at all — see MODEL_SIDE.
 */
export function planLetterbox(
  sourceWidth: number,
  sourceHeight: number,
): LetterboxPlan {
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) {
    throw new Error('image has no dimensions');
  }

  const side = MODEL_SIDE;
  const scale = Math.min(side / sourceWidth, side / sourceHeight);
  const drawWidth = Math.max(1, Math.min(side, Math.round(sourceWidth * scale)));
  const drawHeight = Math.max(1, Math.min(side, Math.round(sourceHeight * scale)));

  return {
    side,
    drawWidth,
    drawHeight,
    offsetX: Math.floor((side - drawWidth) / 2),
    offsetY: Math.floor((side - drawHeight) / 2),
  };
}

/**
 * Cap the pixels we hand to a canvas.
 *
 * A modern phone camera produces images a mobile browser cannot allocate a
 * canvas for, and the failure is an opaque "tainted or oversized" error rather
 * than anything actionable. The output is still written at the original
 * resolution; this only limits the intermediate buffer.
 */
export const MAX_SOURCE_PIXELS = 40_000_000;

export function fitWithin(
  width: number,
  height: number,
  maxPixels: number = MAX_SOURCE_PIXELS,
): { width: number; height: number; scaled: boolean } {
  const pixels = width * height;
  if (pixels <= maxPixels) return { width, height, scaled: false };
  const scale = Math.sqrt(maxPixels / pixels);
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    scaled: true,
  };
}

/** Human-readable byte size for the download progress copy. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
