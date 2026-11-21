/**
 * Which model file ships, and what it costs to fetch.
 *
 * The filename contains a hash of the contents, so publishing a new model is
 * publishing a new URL: caches never have to be invalidated and can hold this
 * forever. Changing the model means changing this constant and deploying the
 * file to C:/Pickixo/models — see docs/MODELS.md for the build chain and the
 * acceptance gate an artifact has to pass first.
 *
 * NEXT_PUBLIC_MODEL_URL overrides where the same file is fetched from. The
 * static site needs it: at 88 MB the model is over the per-file limit of the
 * hosts that serve the rest of the site, so it has to live somewhere else. The
 * host must send CORS headers, and the file must be this exact one —
 * MODEL_BYTES below is checked against what arrives.
 */
export const MODEL_URL =
  process.env.NEXT_PUBLIC_MODEL_URL || '/models/ormbg-fp16-43cfb436.onnx';

/**
 * Exact size of that file. Used to show a real percentage before the first
 * byte arrives, and to notice a truncated download instead of handing ORT a
 * half a model and reporting whatever it says about it.
 */
export const MODEL_BYTES = 88_171_951;

/** Bumping this name abandons every previously cached model in one go. */
export const MODEL_CACHE = 'pickixo-models-v1';

export const MODEL_NAME = 'ormbg';
export const MODEL_LICENCE = 'Apache-2.0';
export const MODEL_SOURCE = 'https://huggingface.co/schirrmacher/ormbg';
