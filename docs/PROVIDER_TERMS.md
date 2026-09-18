# Provider terms and real limits

**Verified September 2026 against official documentation. Re-check before launch —
free tiers change without notice, and nothing here is a promise about the future.**

This document exists because the brief asked for something specific: do not assume
an API is free, do not invent limits, and check whether public SaaS use is actually
permitted. Two of the findings below are inconvenient. They are reported anyway.

---

## Summary

| Provider | Role | Ships enabled? | Verdict |
|---|---|---|---|
| Groq | Text (primary) | **Yes** | Usable. Limits are org-wide, not per user — this shapes your quotas. |
| Google Gemini | Text (fallback) | **No** | See the warning below. Do not enable for public users without reading it. |
| Pollinations | Text + image | **No** | Needs an API key you must obtain. Verify its terms yourself. |
| Meta Graph API | Reels publishing | **No** | Requires an approved Meta app and App Review. |

Nothing is enabled by default without a key present. A tool with no working
provider reports "not configured" in the UI rather than failing mysteriously.

---

## 1. Google Gemini — read this before enabling

Google's Gemini API Additional Terms state, for the **unpaid tier**:

- Google **uses content you submit and the responses generated** to "provide,
  improve, and develop Google products", including its machine learning models.
- **Human reviewers may read, annotate and process** API input and output.
- The terms describe the service as being for developers building "for
  professional or business purposes, **not for consumer use**".
- They warn: "**Do not submit sensitive, confidential, or personal information
  to the Unpaid Services.**"

### What this means for Pickixo

Your users would be typing prompts into a box. On the free tier, those prompts
and the generated results may be retained by Google, used for training, and read
by human reviewers. Your users would not know this unless you tell them.

That is a privacy problem and, on a plain reading of the "not for consumer use"
clause, a terms problem — for a product with public sign-ups.

### Your options, honestly

1. **Leave it disabled** (current default). Groq alone serves text. Simplest and
   safest.
2. **Move Gemini to Google's paid tier**, where the data terms are materially
   different. This breaks the "no paid dependency" rule in your brief, so it is
   your call, not a default.
3. **Enable it and disclose it prominently** — in your privacy policy and next to
   the generation box, in both English and Bengali. If you choose this, the
   disclosure is not optional; it is the thing that makes it defensible.

Set `GEMINI_ENABLED=true` only after deciding which of these you are doing.
Development and testing with your own prompts is unaffected.

---

## 2. Groq — usable, but the limits are not per user

Free-tier limits, from `console.groq.com/docs/rate-limits`:

| Model | Req/min | Req/day | Tokens/min | Tokens/day |
|---|---|---|---|---|
| `openai/gpt-oss-120b` | 30 | 1,000 | 8,000 | 200,000 |
| `openai/gpt-oss-20b` | 30 | 1,000 | 8,000 | 200,000 |
| `groq/compound` | 30 | 250 | 70,000 | — |
| `whisper-large-v3` | 20 | 2,000 | — | — |

> "Rate limits apply at the **organization level**, not individual users."

### Why this is the single most important number in the project

**1,000 requests per day is your entire application's ceiling**, shared by every
user who signs up. Not 1,000 each — 1,000 total.

The shipped default of `LIMIT_TEXT_PER_DAY=25` therefore supports roughly
**40 fully-active users per day** before the shared pool is gone. The 30 req/min
ceiling also means about **30 people can generate in the same minute**, after
which requests queue or fail over.

This is not a flaw to engineer around — it is the honest capacity of a free tier,
and the reason the brief was right to forbid advertising "unlimited". Plan for it:

- Lower `LIMIT_TEXT_PER_DAY` as sign-ups grow. It is admin-editable at runtime.
- Watch **Admin → Providers** for `rate_limited` errors; that is the early signal.
- If real demand exceeds this, a paid tier is a business decision, not a bug fix.

---

## 3. Pollinations — key required, terms need your own check

Pollinations now issues API keys at `enter.pollinations.ai/keys`, with `pk_`
(client-side, budgeted) and `sk_` (server-side) key types. Use an **`sk_` key**;
it belongs in `POLLINATIONS_API_KEY` and must never reach the browser.

The GitHub repository is MIT licensed, but **the code licence is not the service
terms.** Before enabling this in production, confirm for yourself:

- current published rate limits for your key tier,
- whether serving generated images to third-party end users is permitted,
- whether attribution is required,
- whether you may store generated output on your own server.

Enable with `POLLINATIONS_IMAGE_ENABLED=true` once you have checked. Until then,
the image tool honestly reports itself as unavailable.

**Image generation currently has no second provider.** If Pollinations is down,
image generation is down — the fallback chain has nothing to fall back to. Adding
a second image provider is the highest-value robustness work remaining.

---

## 4. Meta Graph API — Reels publishing

From `developers.facebook.com/docs/video-api/guides/reels-publishing/`:

**Permissions:** `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
plus a Page access token with the `CREATE_CONTENT` capability.

**Three-phase upload:**
1. `POST /{page_id}/video_reels` with `upload_phase=start` → returns `video_id` + `upload_url`
2. `POST https://rupload.facebook.com/video-upload/{version}/{video_id}` with the file
3. `POST /{page_id}/video_reels` with `upload_phase=finish`, `video_state=PUBLISHED`

**Video requirements — the FFmpeg pipeline must target these exactly:**

| Property | Requirement |
|---|---|
| Aspect ratio | 9:16 |
| Resolution | 1080×1920 recommended, 540×960 minimum |
| Duration | 3–90 seconds |
| Frame rate | 24–60 fps |
| Video codec | H.264 or H.265 |
| Audio | stereo AAC, ≥128 kbps, 48 kHz |
| Container | MP4 |

**Scheduling:** `video_state=SCHEDULED` with `scheduled_publish_time`. Must be
more than 10 minutes ahead and within 29 days.

**Rate limit:** 30 API-published Reels per Page per 24 hours.

### What this requires from you

- A Meta app with these permissions granted through **App Review**. Until Meta
  approves it, only users with a role on your app can connect a Page.
- Pages only. Personal profiles are not supported by this endpoint — the brief
  was right to say not to claim otherwise.
- Users authorise through Facebook's own screen. The app never asks for a
  Facebook password, and page tokens are stored AES-256-GCM encrypted
  (`facebook_tokens`), with the table unreadable by any browser-facing role.

---

## 5. The free-tier fallback bench

Added 2026-09. Groq alone is a single point of failure: when its daily
organisation cap is reached, text generation stops for everyone until 00:00
UTC. These providers sit behind it in `TEXT_PROVIDER_PRIORITY`, and the
manager moves to the next one automatically on a 429, a quota error, or a
run of upstream failures.

All of them speak OpenAI's chat-completions format, so all of them are served
by one adapter — `providers/text/openai_compatible.py`. Adding another is a
config change, not new code.

**Every one ships disabled with an empty key.** An untouched install behaves
exactly as it did before this bench existed. A provider without a key is
skipped silently and shown as "Not configured" in the admin panel — never
faked.

| Provider | Where to get a key | Free position (checked 2026-09) | Card? |
|---|---|---|---|
| Groq | console.groq.com/keys | ~30 req/min; org-wide daily cap | No |
| Cerebras | cloud.cerebras.ai | Free credits on signup | No |
| OpenRouter | openrouter.ai/keys | ~20 req/min, ~50 req/day on `:free` models | No |
| Mistral | console.mistral.ai | Free "Experiment" tier | No, phone |
| NVIDIA NIM | build.nvidia.com | Free credits on signup | No |

### Things worth knowing before you rely on these

**Groq is not Grok.** Groq (`console.groq.com`) runs open models on its own
chips and has a free tier. Grok (`x.ai`) is a different company's paid
product. This project has never used Grok. The names differ by one letter and
the confusion is common.

**"Free credits" is not the same as "free forever."** Cerebras and NVIDIA
both grant a credit balance at signup rather than a perpetual allowance. When
it runs out that provider starts refusing, the manager fails past it, and it
sits there doing nothing until you top it up. That is a safe failure, but do
not plan capacity around it.

**OpenRouter's free ceiling is low.** Roughly 50 requests a day without
purchased credits. It is a genuine backstop, not a second Groq.

**Check the terms yourself before a provider carries real user traffic.**
Some free tiers pay for themselves with your users' data — that is exactly
why Gemini is disabled by default in section 1. Free tiers change without
notice; the figures above are a snapshot, not a guarantee.

**GitHub Models was retired on 30 July 2026** and is deliberately not
supported. Any guide recommending it is out of date.

---

## Rules this project follows

1. **No quota evasion.** No rotating accounts, no multiple keys to dodge limits,
   no proxy tricks. When a free tier is exhausted, users are told to come back
   later.
2. **No invented capabilities.** A tool without a working provider says so.
3. **No fake success.** A generation is recorded only after it actually returned.
4. **Failures cost the user nothing.** Quota is refunded when generation fails.
5. **Providers are never named to end users** — but they are fully visible to you
   in the admin panel, which is where that information is actually useful.

---

## Sources

- Gemini rate limits — https://ai.google.dev/gemini-api/docs/rate-limits
- Gemini API Additional Terms — https://ai.google.dev/gemini-api/terms
- Groq rate limits — https://console.groq.com/docs/rate-limits
- Pollinations — https://github.com/pollinations/pollinations
- Meta Reels publishing — https://developers.facebook.com/docs/video-api/guides/reels-publishing/
