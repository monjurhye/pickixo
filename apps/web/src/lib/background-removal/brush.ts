/**
 * The refine brush, as arithmetic on the matte.
 *
 * Free of DOM types so it can be tested in Node, like geometry.ts. The editor
 * owns the canvas and the pointer events; this owns what a stroke does to the
 * alpha channel.
 */
import type { Rect } from './geometry';

/** `erase` removes leftover background; `restore` brings back subject the
 *  model cut away. */
export type BrushMode = 'erase' | 'restore';

/** Fraction of the radius that is fully strong. Beyond it the effect fades to
 *  nothing at the rim, so a stroke leaves a soft edge instead of a hard one. */
const HARDNESS = 0.55;

/**
 * Apply one circular dab and return the rectangle it touched, or null when it
 * fell entirely outside the image.
 *
 * Erase multiplies alpha towards 0, restore moves it towards 255, both scaled
 * by how deep inside the brush the pixel is. Overlapping dabs therefore build
 * up, which is what painting feels like.
 */
export function paintDab(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  mode: BrushMode,
): Rect | null {
  if (!(radius > 0)) return null;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius));
  if (x1 < x0 || y1 < y0) return null;

  const inner = radius * HARDNESS;
  const span = Math.max(1e-6, radius - inner);

  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    const row = y * width;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance >= radius) continue;
      const strength = distance <= inner ? 1 : (radius - distance) / span;
      const at = row + x;
      const value = alpha[at]!;
      // A Uint8ClampedArray rounds on assignment, so no manual rounding here.
      alpha[at] = mode === 'erase'
        ? value * (1 - strength)
        : value + (255 - value) * strength;
    }
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function unionRect(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b;
  if (!b) return a;
  const x0 = Math.min(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const x1 = Math.max(a.x + a.w, b.x + b.w);
  const y1 = Math.max(a.y + a.h, b.y + b.h);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Paint from the last pointer position to this one.
 *
 * Pointer events arrive at the display's rate, and a fast flick can move
 * several radii between two of them; dabbing only at the events would leave a
 * dotted line. Dabs are spaced a quarter of a radius apart along the segment.
 */
export function paintStroke(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  from: { x: number; y: number } | null,
  to: { x: number; y: number },
  radius: number,
  mode: BrushMode,
): Rect | null {
  if (!from) return paintDab(alpha, width, height, to.x, to.y, radius, mode);

  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const step = Math.max(1, radius * 0.25);
  const count = Math.max(1, Math.ceil(distance / step));
  let dirty: Rect | null = null;
  for (let i = 1; i <= count; i++) {
    const t = i / count;
    dirty = unionRect(dirty, paintDab(
      alpha, width, height,
      from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t,
      radius, mode,
    ));
  }
  return dirty;
}

/** Copy a rectangle of the matte out, for undo. */
export function copyRegion(
  alpha: Uint8ClampedArray, width: number, rect: Rect,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rect.w * rect.h);
  for (let y = 0; y < rect.h; y++) {
    const from = (rect.y + y) * width + rect.x;
    out.set(alpha.subarray(from, from + rect.w), y * rect.w);
  }
  return out;
}

/** Put a rectangle saved by `copyRegion` back. */
export function writeRegion(
  alpha: Uint8ClampedArray, width: number, rect: Rect, region: Uint8ClampedArray,
): void {
  for (let y = 0; y < rect.h; y++) {
    alpha.set(region.subarray(y * rect.w, (y + 1) * rect.w), (rect.y + y) * width + rect.x);
  }
}

/** Mirror a rectangle of the matte into the alpha bytes of an RGBA buffer. */
export function writeAlphaToRgba(
  rgba: Uint8ClampedArray, alpha: Uint8ClampedArray, width: number, rect: Rect,
): void {
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    const row = y * width;
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      rgba[(row + x) * 4 + 3] = alpha[row + x]!;
    }
  }
}
