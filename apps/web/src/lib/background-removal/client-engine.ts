/**
 * The background removal engine that runs in the visitor's own browser.
 *
 * This is the implementation behind the promise on the page: the image is
 * drawn to a canvas, turned into a tensor, and handed to a worker. There is no
 * request carrying it anywhere. `uploadsImage` is false and that is a fact
 * about this file, not a setting.
 *
 * Canvas work lives here rather than in the worker because OffscreenCanvas is
 * still not something to depend on across the phones this has to serve. The
 * worker gets pixels and returns a matte.
 */
import {
  MODEL_SIDE, planLetterbox, type LetterboxPlan,
} from './geometry';
import { MODEL_BYTES, MODEL_CACHE, MODEL_URL } from './model';
import {
  RemovalError, type BackgroundRemovalEngine, type EngineCapabilities,
  type Progress, type RemovalRequest, type RemovalResult,
} from './types';

/** Neutral grey padding. Measured as the most reliable of the fitting
 *  strategies; see docs/MODELS.md. */
const PAD = 'rgb(128,128,128)';

const WORKER_URL = '/workers/background-remover.js';

const WORKER_CONFIG = {
  modelUrl: MODEL_URL,
  modelBytes: MODEL_BYTES,
  cacheName: MODEL_CACHE,
  /** Where sync-ort-assets.mjs puts the runtime. Trailing slash required. */
  ortBase: '/ort/',
} as const;

interface Pending {
  resolve: (value: { mask: Float32Array; inferenceMs: number; backend: string }) => void;
  reject: (error: unknown) => void;
  onProgress?: (progress: Progress) => void;
}

export class ClientSideOrmbgEngine implements BackgroundRemovalEngine {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private prepared: Promise<void> | null = null;
  private caps: EngineCapabilities = {
    kind: 'client', uploadsImage: false, backend: null, tier: MODEL_SIDE,
  };

  get capabilities(): EngineCapabilities {
    return { ...this.caps };
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    if (typeof Worker === 'undefined') {
      throw new RemovalError('unsupported-browser', 'Web Workers are unavailable');
    }
    // A plain script from public/, deliberately not bundled — see the header
    // of that file for why bundling onnxruntime-web into a worker cannot work
    // under Next 14.
    const worker = new Worker(WORKER_URL);
    worker.addEventListener('message', (event) => this.onMessage(event));
    worker.addEventListener('error', (event) => {
      const error = new RemovalError('inference-failed', event.message || 'worker failed');
      for (const [, entry] of this.pending) entry.reject(error);
      this.pending.clear();
    });
    this.worker = worker;
    return worker;
  }

  private onMessage(event: MessageEvent) {
    const message = event.data;
    const entry = this.pending.get(message.id);
    if (!entry) return;

    switch (message.type) {
      case 'progress':
        entry.onProgress?.({
          phase: message.phase, ratio: message.ratio,
          receivedBytes: message.receivedBytes, totalBytes: message.totalBytes,
        });
        break;
      case 'ready':
        this.caps.backend = message.backend;
        this.pending.delete(message.id);
        entry.resolve({ mask: new Float32Array(0), inferenceMs: 0, backend: message.backend });
        break;
      case 'result':
        this.caps.backend = message.backend;
        this.pending.delete(message.id);
        entry.resolve({ mask: message.mask, inferenceMs: message.inferenceMs,
                        backend: message.backend });
        break;
      case 'error':
        this.pending.delete(message.id);
        entry.reject(new RemovalError(message.code, message.message));
        break;
      default:
        break;
    }
  }

  private send(
    payload: Record<string, unknown>,
    transfer: Transferable[],
    onProgress?: (progress: Progress) => void,
  ) {
    const worker = this.ensureWorker();
    const id = this.nextId++;
    const promise = new Promise<{ mask: Float32Array; inferenceMs: number; backend: string }>(
      (resolve, reject) => this.pending.set(id, { resolve, reject, onProgress }),
    );
    // The worker is not type-checked, so it is told where the model lives
    // rather than holding its own copy of these constants — one source of
    // truth, in model.ts, instead of two that drift.
    worker.postMessage({ id, config: WORKER_CONFIG, ...payload }, transfer);
    return promise;
  }

  /**
   * Download the model and start a session.
   *
   * Separated from `remove` so the page can begin the 88 MB download while the
   * visitor is still choosing a file, which is most of the wait on a first
   * visit. Repeat calls join the first rather than starting a second download.
   */
  prepare(onProgress?: (progress: Progress) => void): Promise<void> {
    if (!this.prepared) {
      this.prepared = this.send({ type: 'prepare' }, [], onProgress)
        .then(() => undefined)
        .catch((error) => {
          // Do not memoise a failure: a download that died on a flaky
          // connection must be retryable without reloading the page.
          this.prepared = null;
          throw error;
        });
    }
    return this.prepared;
  }

  async remove(
    request: RemovalRequest,
    onProgress?: (progress: Progress) => void,
  ): Promise<RemovalResult> {
    const { pixels, width, height } = request;
    const plan = planLetterbox(width, height);
    this.caps.tier = plan.side;

    const letterboxed = this.letterbox(pixels, width, height, plan);

    const { mask, inferenceMs, backend } = await this.send(
      { type: 'run', pixels: letterboxed, side: plan.side },
      [letterboxed.buffer],
      onProgress,
    );

    const alpha = this.maskToAlpha(mask, plan, width, height);
    return { alpha, width, height, inferenceMs, backend, tier: plan.side };
  }

  /** Draw the source into a square canvas, centred, padded with neutral grey. */
  private letterbox(
    pixels: Uint8ClampedArray, width: number, height: number, plan: LetterboxPlan,
  ): Uint8ClampedArray {
    const source = createCanvas(width, height);
    const sourceCtx = context2d(source);
    // See toCanvas() in compose.ts for why this goes through createImageData.
    const sourceImage = sourceCtx.createImageData(width, height);
    sourceImage.data.set(pixels);
    sourceCtx.putImageData(sourceImage, 0, 0);

    const square = createCanvas(plan.side, plan.side);
    const ctx = context2d(square);
    ctx.fillStyle = PAD;
    ctx.fillRect(0, 0, plan.side, plan.side);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, width, height,
                  plan.offsetX, plan.offsetY, plan.drawWidth, plan.drawHeight);

    return ctx.getImageData(0, 0, plan.side, plan.side).data;
  }

  /**
   * Crop the matte back out of the padded square and scale it to the original
   * image, so the exported PNG is full resolution rather than 1024px.
   */
  private maskToAlpha(
    mask: Float32Array, plan: LetterboxPlan, width: number, height: number,
  ): Uint8ClampedArray {
    const { side, drawWidth, drawHeight, offsetX, offsetY } = plan;

    const small = createCanvas(drawWidth, drawHeight);
    const smallCtx = context2d(small);
    const cropped = smallCtx.createImageData(drawWidth, drawHeight);
    for (let y = 0; y < drawHeight; y++) {
      const from = (y + offsetY) * side + offsetX;
      const to = y * drawWidth * 4;
      for (let x = 0; x < drawWidth; x++) {
        const value = Math.round(Math.min(1, Math.max(0, mask[from + x]!)) * 255);
        const p = to + x * 4;
        cropped.data[p] = value;
        cropped.data[p + 1] = value;
        cropped.data[p + 2] = value;
        cropped.data[p + 3] = 255;
      }
    }

    smallCtx.putImageData(cropped, 0, 0);

    // drawImage does the resampling, which is both faster and smoother than
    // doing it by hand in JavaScript over several million pixels.
    const full = createCanvas(width, height);
    const ctx = context2d(full);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, drawWidth, drawHeight, 0, 0, width, height);

    const scaled = ctx.getImageData(0, 0, width, height).data;
    const alpha = new Uint8ClampedArray(width * height);
    for (let i = 0, p = 0; i < alpha.length; i++, p += 4) alpha[i] = scaled[p]!;
    return alpha;
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.prepared = null;
    this.pending.clear();
    this.caps = { kind: 'client', uploadsImage: false, backend: null, tier: MODEL_SIDE };
  }
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  // `willReadFrequently` matters: without it every getImageData on a
  // GPU-backed canvas stalls the pipeline, and this reads back three times.
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new RemovalError('unsupported-browser', 'canvas 2d is unavailable');
  return ctx;
}
