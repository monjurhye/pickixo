# CLAUDE.md — project memory

This file is Claude's persistent memory for the Pickixo repo. Keep entries
short, sourced, and honest about what's verified vs. planned — see
`README.md` "Status" and `docs/CLASS2_ENGLISH_PLAN.md` for the standard this
repo holds itself to (never fill a gap with a plausible guess).

## Project snapshot

Pickixo (https://pickixo.com) — AI, Apps, Tools, Games, Jobs & Education in
one place. Next.js 14 frontend (`apps/web`) + FastAPI backend (`apps/api`),
local PostgreSQL, own auth (argon2id + refresh rotation), product registry
drives nav/search/My Apps. 16 of 17 catalogue products are `planned` —
listed for navigation/search/sitemap shape, not live features. No AI
provider is configured by default. Full detail: `README.md`, `docs/ARCHITECTURE.md`.

## Kids vertical — not yet built, no code in this repo

There is no "Kids" code, route, or product-registry entry anywhere in this
repo yet (checked 2026-09-18). A prior chat session referenced a "Pickixo
Kids" spec (Bangla alphabet: স্বরবর্ণ/ব্যঞ্জনবর্ণ charts, NCTB-sourced
curriculum) and an intended source textbook PDF ("বইটা") that never
uploaded successfully — so that spec lives only in chat history, not here.
If it resurfaces, treat `docs/CLASS2_ENGLISH_PLAN.md` as the template: read
the actual NCTB PDF page-by-page, don't infer content.

### Competitor feature research (2026-09-18, WebSearch — pickixo.com itself unreachable from this env)

Looked at: Khan Academy Kids, Duolingo ABC, Endless Alphabet, ABCmouse,
SplashLearn, Lingokids, and two Bangla alphabet apps ("বর্ণমালা: পড়ি লিখি
শিখি", "Bangla Alphabet"). Candidate features for a future Pickixo Kids
vertical, ranked by what's missing from all/most competitors:

1. **NCTB-sourced curriculum mapping** — no competitor traceably maps to the
   actual textbook; would be Pickixo's clearest differentiator (parent trust).
2. **Multi-picture/multi-context per letter** (from the Bangla apps) — 2–3
   different word/image contexts per letter so recognition isn't
   rote-memorized to one picture.
3. **Animated "talking letter" puzzle style** (Endless Alphabet) — letters
   move/animate into place when building words (e.g. ক+ল=কল).
4. **No score/no fail/no timer for the youngest tier** (Endless Alphabet) —
   matches "আবার চেষ্টা করি" tone; keep score/timers out of a 4+ explore level.
5. **Real-time parent dashboard with skill-gap flagging** (SplashLearn/ABCmouse)
   — not just progress %, but flagging which specific letter/skill a child
   is stuck on.
6. **Optional (never mandatory) speech-recognition check** (Duolingo ABC).
7. **Word-highlight-synced-to-narration** in story/rhyme mode (Khan Academy Kids).
8. **No ads, no IAP inside the learning flow** — industry norm among the
   credible competitors (Khan Kids, Duolingo ABC); matches this project's
   general safety posture.

Not yet actioned in code — this is a feature-idea backlog only.
