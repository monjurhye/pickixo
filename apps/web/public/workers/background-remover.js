/**
 * Background removal worker.
 *
 * Everything expensive happens here: an 88 MB download, a WebAssembly module,
 * and an inference that takes seconds. On the main thread that would freeze the
 * page — no scrolling, no cancel button, and on a phone the browser would offer
 * to kill the tab.
 *
 * ---------------------------------------------------------------------------
 * Why this file is plain JavaScript in public/ rather than TypeScript in src/
 * ---------------------------------------------------------------------------
 * Because it cannot be bundled. `new Worker(new URL('./worker.ts', ...))` makes
 * webpack emit a *classic* worker chunk, onnxruntime-web's ESM build is then
 * parsed as a script, and the build dies with "'import.meta' cannot be used
 * outside of module code". Passing `{ type: 'module' }` does not help: emitting
 * ES module workers needs webpack's `experiments.outputModule`, which Next 14
 * does not expose.
 *
 * So ORT is loaded the way it is designed to be loaded in a classic worker —
 * importScripts() of the build that defines a global `ort`. The cost is that
 * this file is not type-checked, which is why it takes its configuration from
 * the main thread instead of duplicating constants that would silently drift
 * from model.ts.
 *
 * The worker deals only in tensors. Canvas work stays on the main thread, where
 * it is universally supported; see client-engine.ts.
 */

/* eslint-disable */

let ortReady = false;
let session = null;
let backend = null;
let preparing = null;
let config = null;

function post(message, transfer) {
  self.postMessage(message, transfer || []);
}

function WorkerFailure(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/* -------------------------------------------------------------------------- */
/* model download                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Fetch the model, reporting real progress, and keep it for next time.
 *
 * Progress is not decoration here. 88 MB on a phone connection is long enough
 * that an unlabelled spinner reads as "hung", and the usual reaction to that is
 * to reload — which starts the 88 MB again.
 */
async function fetchModel(onProgress) {
  // `caches` is absent in some private-browsing modes. That is a reason to
  // download every time, not a reason to fail.
  let cache = null;
  try {
    cache = typeof caches !== 'undefined' ? await caches.open(config.cacheName) : null;
  } catch (e) {
    cache = null;
  }

  if (cache) {
    try {
      const hit = await cache.match(config.modelUrl);
      if (hit) {
        const buffer = await hit.arrayBuffer();
        // An entry truncated by an eviction mid-write would otherwise surface
        // as an unintelligible ORT parse error on every later visit, and would
        // never repair itself.
        if (buffer.byteLength === config.modelBytes) {
          onProgress(config.modelBytes, config.modelBytes);
          return buffer;
        }
        await cache.delete(config.modelUrl);
      }
    } catch (e) {
      /* fall through to the network */
    }
  }

  const response = await fetch(config.modelUrl, { cache: 'force-cache' });
  if (!response.ok) {
    throw WorkerFailure('model-download-failed',
      'model request failed with ' + response.status);
  }

  const declared = Number(response.headers.get('Content-Length')) || config.modelBytes;
  let buffer;

  if (!response.body) {
    // No streaming available: still correct, just without a progress number.
    buffer = await response.arrayBuffer();
    onProgress(buffer.byteLength, buffer.byteLength);
  } else {
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const step = await reader.read();
      if (step.done) break;
      chunks.push(step.value);
      received += step.value.byteLength;
      onProgress(received, declared);
    }
    const merged = new Uint8Array(received);
    let offset = 0;
    for (let i = 0; i < chunks.length; i++) {
      merged.set(chunks[i], offset);
      offset += chunks[i].byteLength;
    }
    buffer = merged.buffer;
  }

  if (buffer.byteLength !== config.modelBytes) {
    throw WorkerFailure('model-download-failed',
      'model is ' + buffer.byteLength + ' bytes, expected ' + config.modelBytes);
  }

  if (cache) {
    try {
      await cache.put(config.modelUrl, new Response(buffer.slice(0), {
        headers: { 'Content-Type': 'application/octet-stream' },
      }));
    } catch (e) {
      // Over quota, most likely. The model still works for this session.
    }
  }
  return buffer;
}

/* -------------------------------------------------------------------------- */
/* session                                                                    */
/* -------------------------------------------------------------------------- */

async function hasWebGPU() {
  if (!self.navigator || !self.navigator.gpu) return false;
  try {
    // Presence of navigator.gpu is not the same as a usable adapter: it is
    // present and adapterless on plenty of machines with blocklisted drivers.
    const adapter = await self.navigator.gpu.requestAdapter();
    return adapter != null;
  } catch (e) {
    return false;
  }
}

/** Try each execution provider in order and keep the first that works. */
async function createSession(model, order) {
  let lastError = null;
  for (let i = 0; i < order.length; i++) {
    try {
      session = await ort.InferenceSession.create(model, {
        executionProviders: [order[i]],
        graphOptimizationLevel: 'all',
      });
      backend = order[i];
      return;
    } catch (error) {
      // A WebGPU adapter can exist and still fail to compile the shaders, on
      // older drivers in particular. Falling back is the whole point of
      // having an order; failing here would strand those devices.
      lastError = error;
      session = null;
    }
  }
  throw WorkerFailure('unsupported-browser',
    'no execution provider worked: ' + String(lastError).slice(0, 200));
}

/**
 * Rebuild the session on the CPU provider after WebGPU failed mid-run.
 *
 * The GPU device can be lost after a session was created successfully (driver
 * reset, tab backgrounded on a laptop, another tab hogging the GPU). The
 * session is then dead for good, so without this every later image fails until
 * the page is reloaded. The model comes from the Cache API, so this is not a
 * second download in the normal case.
 */
async function recoverOnWasm() {
  const dead = session;
  session = null;
  try { if (dead && dead.release) await dead.release(); } catch (e) { /* already gone */ }
  const model = await fetchModel(function () {});
  await createSession(model, ['wasm']);
}

async function prepare(id) {
  if (session) return;
  if (preparing) return preparing;

  preparing = (async () => {
    const webgpu = await hasWebGPU();

    if (!ortReady) {
      // Two different builds. The WebGPU-capable WebAssembly is 27.8 MB against
      // 14.0 MB for the plain one, so a device that cannot use WebGPU must not
      // be made to download it.
      importScripts(config.ortBase + (webgpu ? 'ort.webgpu.min.js' : 'ort.wasm.min.js'));
      ortReady = true;
    }

    ort.env.wasm.wasmPaths = config.ortBase;
    // Threads need cross-origin isolation. Where it is absent ORT would
    // otherwise try to spawn workers it cannot, and fail late and obscurely.
    ort.env.wasm.numThreads = self.crossOriginIsolated
      ? Math.min(4, self.navigator.hardwareConcurrency || 1)
      : 1;
    ort.env.logLevel = 'error';

    post({ id: id, type: 'progress', phase: 'downloading-model', ratio: 0,
           receivedBytes: 0, totalBytes: config.modelBytes });

    const model = await fetchModel(function (received, total) {
      post({ id: id, type: 'progress', phase: 'downloading-model',
             ratio: total ? received / total : null,
             receivedBytes: received, totalBytes: total });
    });

    post({ id: id, type: 'progress', phase: 'starting', ratio: null });

    await createSession(model, webgpu ? ['webgpu', 'wasm'] : ['wasm']);
  })();

  try {
    await preparing;
  } finally {
    preparing = null;
  }
}

/* -------------------------------------------------------------------------- */
/* inference                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * RGBA bytes in, planar float tensor out.
 *
 * The normalisation is `pixel / 255` and nothing else. That was established by
 * running five candidates and looking at the output: the widely-copied IS-Net
 * `(x/255 - 0.5)` leaves this model's matte a grey smear on some subjects. A
 * wrong choice here does not throw — it just makes the tool quietly bad.
 */
function toTensor(pixels, side) {
  const plane = side * side;
  const data = new Float32Array(3 * plane);
  for (let i = 0, p = 0; i < plane; i++, p += 4) {
    data[i] = pixels[p] / 255;
    data[plane + i] = pixels[p + 1] / 255;
    data[2 * plane + i] = pixels[p + 2] / 255;
  }
  return data;
}

async function run(id, pixels, side) {
  if (!session) throw WorkerFailure('inference-failed', 'session is not ready');

  const feeds = {};
  feeds[session.inputNames[0]] = new ort.Tensor(
    'float32', toTensor(pixels, side), [1, 3, side, side]);

  const started = (self.performance || Date).now();
  const isMemory = function (text) { return /memory|allocat|OOM/i.test(text); };

  let output;
  try {
    output = await session.run(feeds);
  } catch (error) {
    let text = String(error);
    // Anything other than running out of memory on the GPU is treated as a lost
    // or broken device and retried once on the CPU. An out-of-memory error
    // would only repeat there, so it is reported as it is.
    if (backend === 'webgpu' && !isMemory(text)) {
      try {
        await recoverOnWasm();
        output = await session.run(feeds);
      } catch (retryError) {
        text = String(retryError);
        output = null;
      }
    }
    if (!output) {
      // A failed allocation on a phone is the common case, and it is worth
      // distinguishing: the answer to it is "try a smaller image", which is not
      // the answer to anything else.
      const code = isMemory(text) ? 'out-of-memory' : 'inference-failed';
      throw WorkerFailure(code, text.slice(0, 200));
    }
  }
  const inferenceMs = (self.performance || Date).now() - started;

  const raw = output[session.outputNames[0]].data;
  // Copy out: the tensor's buffer belongs to the session and is not ours to
  // transfer away.
  const mask = new Float32Array(raw.length);
  mask.set(raw);

  post({ id: id, type: 'result', mask: mask, inferenceMs: inferenceMs,
         backend: backend || 'wasm' }, [mask.buffer]);
}

/* -------------------------------------------------------------------------- */

self.addEventListener('message', async function (event) {
  const message = event.data;
  try {
    if (message.config) config = message.config;
    if (!config) throw WorkerFailure('inference-failed', 'worker was not configured');

    if (message.type === 'prepare') {
      await prepare(message.id);
      post({ id: message.id, type: 'ready', backend: backend || 'wasm' });
    } else if (message.type === 'run') {
      await prepare(message.id);
      post({ id: message.id, type: 'progress', phase: 'processing', ratio: null });
      await run(message.id, message.pixels, message.side);
    }
  } catch (error) {
    post({
      id: message.id,
      type: 'error',
      code: (error && error.code) || 'inference-failed',
      message: (error && error.message) || String(error),
    });
  }
});
