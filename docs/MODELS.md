# Models

Machine-learning models Pickixo ships to the browser, why each one was chosen,
and what was measured rather than assumed.

A model is not just a file: it carries a licence, a training-data licence, a
required input format, and failure modes. All four are recorded here, because
all four have already caused a wrong decision somewhere in this project's
history if left implicit.

---

## Background remover — `ormbg`

**Shipped artifact:** `ormbg-1024-fp16.onnx`, 88.2 MB
**Runs:** entirely in the visitor's browser. No image is uploaded to Pickixo.

### Licence, and why it is not IS-Net

The brief asked for IS-Net. The IS-Net *architecture* is what ships — but the
usual IS-Net *weights* could not be used, and the distinction matters:

| Model | Code licence | Training data | Commercial use |
|---|---|---|---|
| IS-Net (`isnet-general-use`) | Apache-2.0 | DIS5K | **No** |
| U²-Net | Apache-2.0 | DUTS | Unclear |
| **`ormbg` (shipped)** | **Apache-2.0** | **synthetic** | **Yes** |

DIS5K's Terms of Use, verbatim:

> The Dataset is available for non-commercial use in research or educational
> purpose. […] Without permission from the original authors, commercial use of
> this dataset is prohibited even after copying, editing, processing or any
> operations of this database.

Apache-2.0 code trained on a non-commercial dataset does not yield
commercially usable weights. U²-Net's DUTS is "all rights reserved by the
original authors", which is not a grant, so it was rejected as unclear rather
than assumed permissive.

[`schirrmacher/ormbg`](https://huggingface.co/schirrmacher/ormbg) is Apache-2.0
and trained on **synthetic** data generated with LayerDiffuse/IC-Light, so
there is no third-party dataset licence riding along. It uses the IS-Net
architecture, so the brief's architectural requirement is met with clean
weights.

Source weights: `ormbg.onnx`, 176,182,050 bytes,
SHA-256 `89b47dd4fa46a76e91b06affeb5ec7881894a27792e41f7dfaf69987653f31d3`.

### What the model actually expects

Verified against the file, not copied from a tutorial. The commonly-posted
IS-Net preprocessing is **wrong for this model** and fails silently.

| | Value |
|---|---|
| Input | `input`, float32 `[1, 3, H, W]`, RGB |
| Normalisation | **`pixel / 255` only** — no mean subtraction |
| Output | `output`, float32 `[1, 1, H, W]`, already sigmoid'd, in `[0,1]` |
| Opset | 11 |

Five normalisations were run and the output inspected. Only `/255` produced a
bimodal matte on both a portrait and an animal; the standard IS-Net
`(x/255 - 0.5)` left the animal a 56%-grey smear, and feeding raw 0–255
returned an empty mask. None of these throw — a wrong choice here ships as
"the tool is just bad".

### Input size constraint: multiples of 64

**Every input dimension must be divisible by 64.** The encoder halves six
times; when a dimension does not divide cleanly the skip-connection shapes
disagree and inference dies with:

```
Shape mismatch attempting to re-use buffer. {1,32,21,32} != {1,32,22,32}
```

A step-32 sweep from 64 to 1088 confirms the rule exactly: 64 ✓, 96 ✗, 128 ✓,
160 ✗, … This is enforced in `snapTo64()`. Without it, ordinary aspect ratios
crash in public — 1024×672 is a plain 3:2 photo, and it fails.

### Preprocessing: letterbox, don't squash

The source is letterboxed into a square canvas on neutral grey, not resized to
a square. Measured on a 6:1 crop, where the three strategies disagree most:

| Strategy | soft-band (lower = more confident) |
|---|---|
| Squash to square | 21.5% |
| Keep aspect, no padding | 20.7% |
| **Letterbox (shipped)** | **6.0%** |

On ordinary photographs all three agree (portrait IoU 0.999), so this costs
nothing in the common case and prevents a collapse in the uncommon one.

### Size: fp16, and why not int8

176 MB is not a thing to send to a phone. Four variants were built and
measured against fp32 on seven images, scoring the **soft edge band**
separately — full-image error flatters a matte badly, because most pixels are
flat background that every variant gets right, while the edge is the entire
product.

| Variant | Size | Transfer (br) | edge MAE | mean IoU | worst IoU |
|---|---|---|---|---|---|
| fp32 | 176.2 MB | 163.4 MB | — | — | — |
| **fp16 (shipped)** | **88.2 MB** | **81.3 MB** | **0.0003** | **0.9997** | **0.9982** |
| int8 dynamic | 44.4 MB | 29.9 MB | 0.0295 | 0.9643 | 0.8041 |
| int8 static | 44.6 MB | 38.6 MB | 0.0957 | 0.9300 | 0.6965 |

fp16 is free: worst-case IoU 0.9982 and an edge error of 0.0003 is not
visible. int8 halves the download again but visibly dilates hair (max edge
error 0.294 — a halo), and int8-dynamic was also *58% slower* than fp32,
because dynamic `ConvInteger` is a pessimisation on a conv-heavy graph.

Weights barely compress (brotli 1.08× on float data), so the transferred size
is essentially the file size. The model is cached after first download, so
this is a one-time cost per visitor.

### Graph surgery

Two changes, both verified not to alter the output:

1. **Pruned 11 of 12 outputs.** The export exposed six side-supervision maps
   *and* six raw encoder feature maps. Only `output` is read. `input.1232`
   alone is `[1,64,512,512]` — 67 MB copied out of the graph and discarded on
   every single run. 721 → 661 nodes.
2. **Made H and W dynamic.** The export hard-coded `1024×1024`.

### Resolution: 1024 only, and the measurement that misled me

The graph accepts any dimension that is a multiple of 64, and under **Python's
CPU provider** the smaller sizes are a large, cheap win:

| Size | Relative time | IoU vs 1024 |
|---|---|---|
| 1024 | 1.0x | — |
| 768 | 0.54x | 0.9983 |
| 512 | **0.20x** | 0.9974 |
| 320 | 0.08x | 0.9962 |

None of it survives in the browser. **ONNX Runtime Web's WASM provider runs
this model at 1024x1024 and at no other size.** A sweep in a real browser of
320, 384, 448, 512, 576, 640, 704, 768, 832, 896 and 960 failed at every single
one, on all three graph-optimisation levels, with:

```
Concat node '/stage1/Concat_2': Non concat axis dimensions must match:
Axis 2 has mismatched dimensions of 16 and 32
```

16 against 32 is the tell: at 512 one branch scales with the input while its
skip connection stays at the size the 1024 export implied. ORT Web resolves the
decoder's `Resize` sizes differently from the native CPU provider, so the graph
is only self-consistent at its native resolution.

This is the most useful thing measured on this task, because everything about
it looked fine until it was run in the place it actually had to work:

* The dynamic-shape edit was real and correct — the model file genuinely does
  accept those sizes.
* The speed and quality numbers were real, and taken from the actual model.
* A "Best / Faster" quality selector was built on them.
* All of it was validated on the **wrong runtime**. Every one of those numbers
  came from `onnxruntime` on the server; not one came from `onnxruntime-web` in
  a browser.

Shipped as measured, the quality selector would have failed for everyone who
touched it. Worse, the bug was not confined to the opt-in feature: the geometry
sized the canvas to the image, so a small photograph produced a smaller canvas
on its own, and **a 200x150 thumbnail would have crashed with no way for the
user to avoid it**.

So the tiers are gone and `MODEL_SIDE` is a constant. The dynamic-shape model
still ships — it works at 1024 and costs nothing — and if a future ORT Web
fixes this, the tiers become available again without re-exporting anything.

### Known limits — state these honestly on the page

`ormbg` is trained on, and optimised for, **images of people**. It is not a
general-purpose segmenter, and the page must not claim it is.

Measured on the test set: portraits are excellent, with individual hair
strands resolved. A product shot and a car came out clean. An animal photo
containing two animals segmented one confidently and left the second at ~0.5
grey. A cluttered nature scene with no distinct subject produced a 75%
soft-band smear — i.e. no usable mask at all.

The model needs **one clear foreground subject**. Busy scenes without an
obvious subject fail, and the UI should let the user see that immediately
rather than discovering it after a download.

### Reproducing

Scripts live outside the repo (they need a 176 MB download and a throwaway
venv). The chain is:

```
ormbg.onnx (176 MB, from Hugging Face)
  → prune to the single `output`        → 661 nodes
  → make H/W dynamic                    → [1,3,height,width]
  → convert weights to fp16             → 88.2 MB
  → ormbg-1024-fp16.onnx
```

Acceptance gate, all of which must pass before an artifact ships:

- matches fp32 on every test image (worst IoU > 0.995)
- runs at 1024 / 768 / 512 / 320
- output already in `[0,1]` — no extra activation
- loads and runs on ORT Web's **WASM** backend, not only WebGPU
- runs **in a real browser**, at every size the application can ask for

The last two are not formalities. The fallback path is the one that matters:
WebGPU is unavailable on plenty of phones, and a model that runs only on
WebGPU is a tool that silently fails for those users. `keep_io_types=True`
keeps the graph's boundary float32 so callers never handle fp16 tensors, and
the WASM backend was confirmed to load and run the fp16 artifact.

### Not yet measured

Real-device performance. This server has 2 vCPUs, where a single 1024×1024
WASM run takes ~23 s and adding threads changes nothing — that says more about
the box than about a phone. WebGPU could not be benchmarked here at all.
Per-device timings must come from an actual browser on actual hardware before
any speed claim appears on the page.
