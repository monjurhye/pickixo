# Pickixo architecture

The map of what exists, why it is shaped this way, and where the seams are.

---

## Shape

```
                        pickixo.com
                             │
                    ┌────────┴────────┐
                    │   Next.js 14    │  apps/web   https://localhost:3010
                    │  App Router SSR │  TLS terminates here in dev,
                    └────────┬────────┘  at nginx in production
                             │ same-origin /api/*  (rewrite in dev, nginx in prod)
                    ┌────────┴────────┐
                    │    FastAPI      │  apps/api    (port 8010 in dev)
                    └────────┬────────┘
                ┌────────────┼────────────┐
                │            │            │
         PostgreSQL 17    AI Router    Local disk
         (loopback)          │         (storage/)
                    ┌────────┴─────────┐
              Groq · Cerebras · OpenRouter · Mistral
              NVIDIA NIM · Gemini · Pollinations · Ollama
                        Cloudflare (image)
```

A modular monolith, not microservices (§87). Two processes, because the frontend
and backend genuinely are different runtimes — not because splitting them buys
anything operationally at this size.

---

## Why these choices

**Local PostgreSQL rather than a managed database.** It runs on this machine,
bound to loopback only, so nothing about the data path depends on a third party
being up or on a bill being paid. The application connects as `pickixo_app`,
which is not a superuser and holds no DDL rights: a SQL injection that got past
parameterised queries still could not drop a table.

**Own authentication rather than an auth provider.** Argon2id hashes, short-lived
access JWTs and opaque refresh tokens. It is more code to own, but it removes the
entire class of "our auth vendor changed their pricing/terms/availability", and
it is the only way one account can span email and Google identities exactly the
way §12 describes.

**psycopg3, no ORM.** Every query here is either a small lookup or a deliberate
join, and the ones that matter — quota, My Apps ordering — are database functions
because they have to be atomic. An ORM would sit between us and the SQL we
actually care about without removing the need to understand it.

**One registry table, not one per vertical.** Navigation, search, My Apps,
recommendations, the sitemap and the admin panel all need "every product". Seven
tables would mean a seven-way UNION in every one of those places, and seven
places to forget to update.

**No Docker, no Redis.** On a 3.9 GB box the container runtime and a queue daemon
cost more memory than they return. The job queue, when it is needed, is
`SELECT ... FOR UPDATE SKIP LOCKED`, which Postgres already does correctly.

---

## Request path for an AI call

```
Browser
  → Next.js (same-origin /api/ai/text)
  → FastAPI
      → optional_user          resolve session from cookie or bearer
      → quota.consume          ATOMIC: take one unit or refuse
      → ProviderManager.execute
            for each provider in priority order:
                skip if disabled / unkeyed / cooling down   (no network call)
                try  → success → return
                fail → classify:
                        BAD_REQUEST / CONTENT_BLOCKED → stop, do not fail over
                        TIMEOUT / 5xx                 → retry once, then next
                        429 / quota                   → cooldown, then next
            all exhausted → SERVICE_BUSY
      → every attempt written to ai_usage under one request_id
      → on total failure: quota.refund  (our outage, not the user's mistake)
  → normalised response
```

The user sees "Pickixo AI". Which vendor answered appears in the response for
debugging and in the admin panel — never as a choice they have to make (§158).

---

## The seams

These are the places designed to be extended, and the only places that should
need touching for the corresponding change:

| To add… | Touch |
|---|---|
| an AI provider | one adapter in `app/providers/`, one line in `registry.py`, one env key |
| a product | one row in `apps`; navigation, search, sitemap and My Apps follow |
| a vertical | `VERTICALS` in `lib/verticals.ts` + the schema CHECK constraint |
| a capability | a method on the provider interface + a router endpoint |

The registry is the important one. Adding a tool is a database row, not a code
change, because everything that lists products reads that one table.

---

## What is deliberately not here yet

Named so nobody looks for them:

- **Row-level security.** Ownership is enforced in the query layer — every
  user-scoped statement carries its own `user_id` predicate, and the API has no
  route that takes a user id from the client. RLS would be defence in depth on
  top of that. It is not in place, and this document does not claim it is.
- **The job queue.** `SKIP LOCKED` is the plan; there is no worker yet because
  there is no long-running work yet.
- **i18n.** The schema carries `name_bn` and the fonts are loaded, but the UI
  strings are English literals in components. Extracting them is a real piece of
  work, not a find-and-replace.
- **Rate limiting beyond daily quota.** Per-IP request throttling and login
  lockout are configured in settings but not enforced in middleware.
- **Google Drive backup, IndexNow, the admin UI.** The API endpoints the admin UI
  would call exist; the UI does not.

---

## Ports

| Service | Port | Exposure |
|---|---|---|
| nginx | 80, 443 | public, behind Cloudflare |
| Pickixo web | 3010 | loopback only |
| Pickixo API | 8010 | loopback only |
| PostgreSQL | 5432 | loopback only |
| Ollama | 11434 | loopback only |

3010/8010 were chosen while hye.bd still held 3000/8000. hye.bd was removed on
2026-09-12 and those ports are now free, so the move is available whenever it is
worth the restart — it touches `.env`, `apps/web/package.json`,
`apps/web/.env.local` and the nginx upstreams.

Only nginx is reachable from the network. Everything behind it is bound to
loopback, which is what makes plain HTTP between the tiers the right choice
rather than a shortcut.
