/**
 * The contract between the background remover's UI and whatever actually does
 * the work.
 *
 * There is one implementation today — the model running in the visitor's own
 * browser — and the UI is written against this interface rather than against
 * it. The point is not speculative generality: it is that "the image never
 * leaves your device" is a promise made on the page, and a promise like that
 * is easy to break by accident later by reaching for a server call in a hurry.
 * Routing every implementation through one interface means a second engine has
 * to declare `uploadsImage: true`, and the UI shows a different privacy notice
 * because of it.
 */

export type EngineKind = 'client' | 'remote';

/** Where the work ran. Surfaced to the user, so it must be honest. */
export interface EngineCapabilities {
  kind: EngineKind;
  /** True when the image is sent off the device. Drives the privacy notice. */
  uploadsImage: boolean;
  /** e.g. 'webgpu' | 'wasm'. Null until the engine has started. */
  backend: string | null;
  /** Working resolution actually used. Fixed at 1024 for the client engine —
   *  see MODEL_SIDE — but kept on the interface because a remote engine would
   *  not have that constraint. */
  tier: number;
}

export type Phase =
  | 'idle'
  | 'downloading-model'
  | 'starting'
  | 'processing'
  | 'done'
  | 'error';

export interface Progress {
  phase: Phase;
  /** 0..1 for the model download; null when not meaningful. */
  ratio: number | null;
  receivedBytes?: number;
  totalBytes?: number;
  message?: string;
}

/** What the engine returns. Alpha is at the original image resolution. */
export interface RemovalResult {
  /** Single-channel alpha, `width * height` bytes, 0..255. */
  alpha: Uint8ClampedArray;
  width: number;
  height: number;
  /** Milliseconds spent in inference alone, excluding download and decode. */
  inferenceMs: number;
  backend: string;
  tier: number;
}

export interface RemovalRequest {
  /** Straight RGBA pixels from the decoded image, at its own resolution. */
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface BackgroundRemovalEngine {
  readonly capabilities: EngineCapabilities;
  /** Load whatever is needed. Safe to call repeatedly; work happens once. */
  prepare(onProgress?: (progress: Progress) => void): Promise<void>;
  remove(
    request: RemovalRequest,
    onProgress?: (progress: Progress) => void,
  ): Promise<RemovalResult>;
  dispose(): void;
}

/** Stable codes so the UI can phrase its own message rather than echo an
 *  exception, which may contain paths or vendor names. */
export type RemovalErrorCode =
  | 'unsupported-browser'
  | 'model-download-failed'
  | 'out-of-memory'
  | 'inference-failed'
  | 'image-too-large'
  | 'image-decode-failed'
  | 'heic-unsupported'
  | 'cancelled';

/**
 * One image in the queue.
 *
 * Deliberately holds the matte and the source *file*, not decoded pixels: a
 * batch of twenty full-size photos decoded at once would not fit in a phone's
 * memory. The pixels are decoded again for whichever image is open in the
 * editor, or being exported, and dropped straight after.
 */
export interface RemovalItem {
  id: number;
  file: File;
  /** The original file name, used to name downloads. */
  name: string;
  /** Object URL of the source file, for the list thumbnail. */
  thumbUrl: string;
  status: 'queued' | 'processing' | 'done' | 'error';
  error?: string;
  width: number;
  height: number;
  /** The matte. Edited in place by the brush. Null until processed. */
  alpha: Uint8ClampedArray | null;
  /** The matte exactly as the model produced it, set on the first brush stroke
   *  so "Reset" can put it back. */
  modelAlpha: Uint8ClampedArray | null;
  edited: boolean;
  inferenceMs: number;
  backend: string;
  tier: number;
  /** Fraction of the matte that is neither clearly subject nor background. */
  soft: number;
  downscaled: boolean;
}

export class RemovalError extends Error {
  readonly code: RemovalErrorCode;
  constructor(code: RemovalErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'RemovalError';
    this.code = code;
  }
}
