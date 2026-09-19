/**
 * Turning a chosen file into pixels, and a matte back into something to
 * download. Browser-only.
 */
import { alphaBounds, fitWithin, type Rect } from './geometry';
import { RemovalError } from './types';

/** Label shown for each accepted type. HEIC and HEIF are one thing to a user. */
const TYPE_LABELS: Record<string, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF',
  'image/bmp': 'BMP',
  'image/heic': 'HEIC',
  'image/heif': 'HEIC',
};

export const ACCEPTED_TYPES = Object.keys(TYPE_LABELS);

/** For the picker's `accept`. The extensions matter: Windows reports no MIME
 *  type at all for a .heic, and the picker would grey the file out. */
export const ACCEPT_ATTRIBUTE = `${ACCEPTED_TYPES.join(',')},.heic,.heif`;

/** "PNG, JPG, WebP, AVIF, BMP or HEIC", built from the list above so the copy
 *  cannot drift from what is actually accepted. */
export const ACCEPTED_LABEL = (() => {
  const labels = Array.from(new Set(Object.values(TYPE_LABELS)));
  return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`;
})();

/** Refused before decoding, so an enormous file fails instantly and clearly. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export interface DecodedImage {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  /** True when the source was larger than we are willing to hold in a canvas. */
  downscaled: boolean;
}

export function isAcceptedType(type: string): boolean {
  return ACCEPTED_TYPES.includes(type);
}

const EXTENSION = /\.(png|jpe?g|webp|avif|bmp|heic|heif)$/i;
const HEIC = /\.(heic|heif)$/i;

/**
 * Whether to try this file at all.
 *
 * The MIME type is not enough: Windows and some drag sources give an empty
 * type, or a generic octet-stream, for HEIC and sometimes for others. Those are
 * let through on their extension and left to the decoder to judge, which fails
 * with a clear error if the file is not an image after all.
 */
export function isAcceptedFile(file: File): boolean {
  if (isAcceptedType(file.type)) return true;
  const untyped = file.type === '' || file.type === 'application/octet-stream';
  return untyped && EXTENSION.test(file.name);
}

function isHeic(file: File): boolean {
  return file.type === 'image/heic' || file.type === 'image/heif' || HEIC.test(file.name);
}

/**
 * Decode a file to raw pixels.
 *
 * `imageOrientation: 'from-image'` is the part that matters on phones. A photo
 * taken in portrait is very often stored landscape with an EXIF rotation flag;
 * without this the subject arrives on its side, the model mattes it on its
 * side, and the download is a sideways cutout.
 *
 * HEIC is decoded by the browser or not at all. Safari can; Chrome, Edge and
 * Firefox generally cannot, and shipping a decoder for them is a licensing and
 * download-size decision rather than a bug fix. When it fails the error says
 * what to do about it instead of a generic "could not be read".
 */
export async function decodeImageFile(file: File): Promise<DecodedImage> {
  if (file.size > MAX_FILE_BYTES) {
    throw new RemovalError('image-too-large',
      `file is ${file.size} bytes, limit is ${MAX_FILE_BYTES}`);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw isHeic(file)
      ? new RemovalError('heic-unsupported', 'this browser cannot decode HEIC')
      : new RemovalError('image-decode-failed', 'the browser could not read this image');
  }

  try {
    const fitted = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = fitted.width;
    canvas.height = fitted.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new RemovalError('unsupported-browser', 'canvas 2d is unavailable');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, fitted.width, fitted.height);
    const { data } = ctx.getImageData(0, 0, fitted.width, fitted.height);
    releaseCanvas(canvas);
    return {
      pixels: data, width: fitted.width, height: fitted.height,
      downscaled: fitted.scaled,
    };
  } finally {
    // Without this the decoded bitmap is held until GC gets round to it, and
    // several large photos in a row is exactly when memory is tightest.
    bitmap.close();
  }
}

/** Apply the matte as the alpha channel, leaving colour untouched. */
export function applyAlpha(
  pixels: Uint8ClampedArray, alpha: Uint8ClampedArray,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length);
  out.set(pixels);
  // `!` throughout the pixel loops: the indices are bounded by .length, so a
  // per-pixel undefined check would be dead weight over millions of pixels.
  for (let i = 0, p = 3; i < alpha.length; i++, p += 4) out[p] = alpha[i]!;
  return out;
}

export function toCanvas(
  rgba: Uint8ClampedArray, width: number, height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new RemovalError('unsupported-browser', 'canvas 2d is unavailable');
  // Built through the context rather than `new ImageData(rgba, ...)`: the
  // constructor's type demands a plain ArrayBuffer, which a Uint8ClampedArray
  // arriving from elsewhere is not guaranteed to be backed by.
  const image = ctx.createImageData(width, height);
  image.data.set(rgba);
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** Give a canvas's pixel memory back now instead of whenever GC gets to it. */
export function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

/** The subject with the matte applied, as a canvas. */
export function composeCutout(
  pixels: Uint8ClampedArray, alpha: Uint8ClampedArray, width: number, height: number,
): HTMLCanvasElement {
  return toCanvas(applyAlpha(pixels, alpha), width, height);
}

/**
 * What the refine editor works on: the untouched photo, the cutout, and the
 * cutout's ImageData, kept so a brush stroke can rewrite just the alpha bytes
 * of the pixels it touched and repaint only that rectangle.
 */
export interface EditableCutout {
  original: HTMLCanvasElement;
  cutout: HTMLCanvasElement;
  image: ImageData;
  width: number;
  height: number;
}

export function buildEditableCutout(
  pixels: Uint8ClampedArray, alpha: Uint8ClampedArray, width: number, height: number,
): EditableCutout {
  const original = document.createElement('canvas');
  original.width = width;
  original.height = height;
  const originalCtx = original.getContext('2d');
  if (!originalCtx) throw new RemovalError('unsupported-browser', 'canvas 2d is unavailable');
  const image = originalCtx.createImageData(width, height);
  image.data.set(pixels);
  originalCtx.putImageData(image, 0, 0);

  // The same buffer becomes the cutout: colour is shared, only alpha differs.
  for (let i = 0, p = 3; i < alpha.length; i++, p += 4) image.data[p] = alpha[i]!;

  const cutout = document.createElement('canvas');
  cutout.width = width;
  cutout.height = height;
  const cutoutCtx = cutout.getContext('2d');
  if (!cutoutCtx) throw new RemovalError('unsupported-browser', 'canvas 2d is unavailable');
  cutoutCtx.putImageData(image, 0, 0);

  return { original, cutout, image, width, height };
}

export function releaseEditableCutout(session: EditableCutout) {
  releaseCanvas(session.original);
  releaseCanvas(session.cutout);
}

export function canvasToBlob(
  canvas: HTMLCanvasElement, type = 'image/png', quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new RemovalError('inference-failed',
        'the browser could not encode the image'))),
      type, quality,
    );
  });
}

/* -------------------------------------------------------------------------- */
/* export                                                                     */
/* -------------------------------------------------------------------------- */

export type ExportFormat = 'png' | 'jpg' | 'webp';

export const FORMATS: Record<ExportFormat, { mime: string; ext: string; label: string; quality?: number }> = {
  png: { mime: 'image/png', ext: 'png', label: 'PNG' },
  jpg: { mime: 'image/jpeg', ext: 'jpg', label: 'JPG', quality: 0.92 },
  webp: { mime: 'image/webp', ext: 'webp', label: 'WebP', quality: 0.92 },
};

/** What sits behind the cutout in the exported file. */
export type BackdropChoice =
  | { kind: 'transparent' }
  | { kind: 'color'; color: string }
  | { kind: 'image'; bitmap: ImageBitmap; url: string };

export interface ExportSettings {
  format: ExportFormat;
  backdrop: BackdropChoice;
  /** Trim the file to the subject's bounding box. */
  crop: boolean;
}

/**
 * A JPEG has no alpha, so a "transparent" JPG would come out with a black
 * background, which looks like a bug rather than a format limitation. It gets
 * white instead, and the file name says so.
 */
export function effectiveBackdrop(format: ExportFormat, backdrop: BackdropChoice): BackdropChoice {
  return format === 'jpg' && backdrop.kind === 'transparent'
    ? { kind: 'color', color: '#ffffff' }
    : backdrop;
}

/** The part of the file name that says what is behind the subject. */
export function backdropSuffix(backdrop: BackdropChoice): string {
  if (backdrop.kind === 'transparent') return 'no-bg';
  if (backdrop.kind === 'image') return 'custom-bg';
  const color = backdrop.color.toLowerCase();
  if (color === '#ffffff') return 'white-bg';
  if (color === '#000000') return 'black-bg';
  return `bg-${color.replace('#', '')}`;
}

/** The subject's box for cropping. One place so the preview and the file agree. */
export function subjectBounds(
  alpha: Uint8ClampedArray, width: number, height: number,
): Rect | null {
  return alphaBounds(alpha, width, height);
}

function drawCover(
  ctx: CanvasRenderingContext2D, bitmap: ImageBitmap, width: number, height: number,
) {
  // Same rule as CSS `background-size: cover; background-position: center`, so
  // the preview shows what the file will contain.
  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

/** Compose backdrop and cutout, crop if asked, and encode. */
export async function renderExport(
  source: HTMLCanvasElement,
  options: { format: ExportFormat; backdrop: BackdropChoice; crop: Rect | null },
): Promise<Blob> {
  const rect = options.crop ?? { x: 0, y: 0, w: source.width, h: source.height };
  const canvas = document.createElement('canvas');
  canvas.width = rect.w;
  canvas.height = rect.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new RemovalError('unsupported-browser', 'canvas 2d is unavailable');

  const backdrop = effectiveBackdrop(options.format, options.backdrop);
  if (backdrop.kind === 'color') {
    ctx.fillStyle = backdrop.color;
    ctx.fillRect(0, 0, rect.w, rect.h);
  } else if (backdrop.kind === 'image') {
    drawCover(ctx, backdrop.bitmap, rect.w, rect.h);
  }
  ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);

  const format = FORMATS[options.format];
  try {
    return await canvasToBlob(canvas, format.mime, format.quality);
  } finally {
    releaseCanvas(canvas);
  }
}

/**
 * Export one image with the current settings: the file and the name to save it
 * as. Shared by the single download and by "download all" so they cannot differ.
 */
export async function exportCutout(
  cutout: HTMLCanvasElement,
  alpha: Uint8ClampedArray,
  originalName: string,
  settings: ExportSettings,
): Promise<{ blob: Blob; filename: string }> {
  const crop = settings.crop ? subjectBounds(alpha, cutout.width, cutout.height) : null;
  const blob = await renderExport(cutout, {
    format: settings.format, backdrop: settings.backdrop, crop,
  });
  // Safari cannot encode WebP and silently hands back a PNG instead. Naming
  // that file .webp would produce a file that lies about what it is.
  const actual = Object.values(FORMATS).find((format) => format.mime === blob.type);
  const extension = actual?.ext ?? FORMATS[settings.format].ext;
  const filename = outputFilename(
    originalName, extension, backdropSuffix(effectiveBackdrop(settings.format, settings.backdrop)),
  );
  return { blob, filename };
}

/** Hand a blob to the browser as a download. */
export function saveBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Not immediately: revoking in the same tick as click() cancels the
  // download in Safari and some Firefox versions.
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

/** `beach-photo.jpg` -> `beach-photo-no-bg.png` */
export function outputFilename(original: string, extension = 'png', suffix = 'no-bg'): string {
  const base = original.replace(/\.[^.]+$/, '').replace(/[^\w\s-]/g, '').trim();
  const safe = base.replace(/\s+/g, '-').slice(0, 60) || 'image';
  return `${safe}-${suffix}.${extension}`;
}

/** Make a name unique within one archive: `a.png`, `a-2.png`, `a-3.png`. */
export function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) { used.add(name); return name; }
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let n = 2; ; n++) {
    const candidate = `${stem}-${n}${ext}`;
    if (!used.has(candidate)) { used.add(candidate); return candidate; }
  }
}

/**
 * How much of the matte is neither clearly foreground nor clearly background.
 *
 * A high value means the model did not find a subject it was sure about. That
 * is worth telling the user, because the honest answer to "why does this look
 * wrong" is often "this image has no single clear subject" — and they can act
 * on that, where they cannot act on a bad cutout appearing with no comment.
 */
export function uncertainty(alpha: Uint8ClampedArray): number {
  let soft = 0;
  for (let i = 0; i < alpha.length; i++) {
    const value = alpha[i]!;
    if (value > 26 && value < 230) soft++;
  }
  return soft / alpha.length;
}
