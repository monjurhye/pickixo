/**
 * Turning a chosen file into pixels, and a matte back into something to
 * download. Browser-only.
 */
import { fitWithin } from './geometry';
import { RemovalError } from './types';

export const ACCEPTED_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/avif',
] as const;

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
  return (ACCEPTED_TYPES as readonly string[]).includes(type);
}

/**
 * Decode a file to raw pixels.
 *
 * `imageOrientation: 'from-image'` is the part that matters on phones. A photo
 * taken in portrait is very often stored landscape with an EXIF rotation flag;
 * without this the subject arrives on its side, the model mattes it on its
 * side, and the download is a sideways cutout.
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
    throw new RemovalError('image-decode-failed', 'the browser could not read this image');
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

/**
 * Flatten onto a solid colour.
 *
 * Used for the white/black preview, and for the JPG download — a JPEG has no
 * alpha, so without this the transparent area would come out black, which
 * looks like a bug rather than a format limitation.
 */
export function flattenOnto(
  rgba: Uint8ClampedArray, width: number, height: number, colour: string,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new RemovalError('unsupported-browser', 'canvas 2d is unavailable');
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(toCanvas(rgba, width, height), 0, 0);
  return canvas;
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

/** `beach-photo.jpg` -> `beach-photo-no-bg.png` */
export function outputFilename(original: string, extension = 'png'): string {
  const base = original.replace(/\.[^.]+$/, '').replace(/[^\w\s-]/g, '').trim();
  const safe = base.replace(/\s+/g, '-').slice(0, 60) || 'image';
  return `${safe}-no-bg.${extension}`;
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
