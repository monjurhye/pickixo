# Pickixo

**AI, Apps, Tools, Games, Jobs & Education — All in One Place.**

Live at **https://pickixo.com** — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Status — read this first

This is a **foundation**, not a finished platform. What follows is what is
actually built and tested, and what is not. A checklist that overstates itself
is worse than no checklist.

### Built and verified

| Area | State | Evidence |
|---|---|---|
| PostgreSQL 17.7, local, loopback-only | Running | Cluster initialised, app role is not a superuser |
| Schema: 16 tables, 8 functions | Applied | 21 assertions pass against the live database |
| Quota, atomic under concurrency | Verified | 20 parallel connections, limit 5, exactly 5 granted |
| Own auth: email + password (argon2id) | Working | Sign-up, sign-in, rotation, revocation tested |
| Refresh-token rotation + reuse detection | Working | Replay kills the whole session family |
| Product registry + My Apps | Working | Add, pin, reorder, remove, cross-user isolation |
| Global search across verticals | Working | Postgres full-text, grouped by vertical |
| AI router: priority, cooldown, failover | Ported, tested | 47 tests pass (23 fallback + 24 adapter) |
| API: 39 routes | Running | 23 integration tests pass |
| Frontend: Next.js 14, SSR | Building & running | 20 pages, ~100 kB first load |
| HTTPS on the web tier | Working | TLS 1.3; cookies HttpOnly + SameSite + Secure |
| Live on pickixo.com | Serving | Cloudflare → nginx → Next/FastAPI, Let's Encrypt on the origin |
| Runs as Windows services | Survives crashes | Dependency chain and auto-restart both tested |
| SEO: canonical, sitemap, robots, JSON-LD | Verified | Self-referencing canonicals; every sitemap URL 200 |
| IndexNow | Working | Key file live; one URL accepted, dedup verified |
| Dark mode, mobile nav, keyboard reorder | Working | Checked in a browser at 375px and desktop |

### Not built yet

Google sign-in **credentials** (the flow is built and reports "not configured"
until an OAuth client is supplied — it is not faked), every vertical beyond its
registry entries, i18n string extraction, login rate limiting, row-level
security, Google Drive backup, IndexNow, and the admin UI.

**16 of 17 products in the catalogue are `planned`** and say so on their own
pages. They are listed so the shape of the platform is visible and so navigation,
search and the sitemap have something real to be tested against — they are
excluded from the sitemap and carry `noindex`.

### Honest about AI

**No AI provider is configured**, so `ai_providers_ready` is `0` and
`/api/ai/status` reports `available: false`. That is correct, not broken: paste a
provider key into `.env`, set its `_ENABLED` flag, and the router picks it up.
Nothing in this repository fakes an AI response.

Pickixo does not claim "unlimited free AI". Free-tier limits are real, per
organisation on some providers, and can change without notice.

---

## Architecture

```
apps/web/        Next.js frontend          (service Pickixo-Web,  :3010)
apps/api/        FastAPI backend           (service Pickixo-API,  :8010)
config/nginx/    nginx site config         (service nginx, :80/:443)
scripts/         cert generation, isolated test runner
database/schema/ SQL migrations, applied in numeric order
tests/db/        database assertions
docs/            architecture, security, deployment, SEO
```

**Decisions worth knowing about:**

- **Local PostgreSQL, no managed database.** Runs on this machine, listening on
  loopback only, with the application connecting as a role that cannot alter the
  schema.
- **Own authentication.** Argon2id password hashes, short-lived access JWTs, and
  opaque refresh tokens stored only as SHA-256 digests. One account can hold
  several sign-in methods, so email and Google resolve to the same user.
- **The product registry is one table.** Navigation, search, My Apps, the
  sitemap and the admin panel all read it, so a product's name and route have
  exactly one home.
- **Quota is enforced in the database**, consumed atomically, and refunded when
  every provider fails.
- **No Docker, no Redis.** On a 4 GB box both cost more than they return.

---

## Running it

It is already running. Everything is a Windows service, starts at boot, and
restarts itself if it dies:

```powershell
Get-Service Pickixo-*, nginx
```

| Service | Port |
|---|---|
| `nginx` | 80, 443 — the only thing exposed |
| `Pickixo-Postgres` | 5432, loopback |
| `Pickixo-API` | 8010, loopback |
| `Pickixo-Web` | 3010, loopback |
| `Pickixo-Ollama` | 11434, loopback |

`Pickixo-Web` depends on `Pickixo-API`, which depends on `Pickixo-Postgres`, so
Windows starts them in the right order and stops them in the reverse one.

Open **https://pickixo.com**. To work on it locally, stop the service you are
replacing and run it by hand — [docs/RUNNING.md](docs/RUNNING.md) covers that,
plus how to turn AI and Google sign-in on.

hye.bd was removed from this server on 2026-09-12 — services, nginx config,
certificate, renewal and all 716 MB of files. Pickixo stays on 3010/8010 simply
because moving is a restart for no functional gain.

## Tests

```bash
cd apps/api
.venv/Scripts/python.exe -m tests.test_provider_manager   # 23 — AI failover
.venv/Scripts/python.exe -m tests.test_openai_compatible  # 24 — adapter
.venv/Scripts/python.exe -m tests.test_api_flows          # 23 — API (see below)

# database — needs psql on PATH or the full binary path
psql -d pickixo -v ON_ERROR_STOP=1 -f tests/db/01_foundation_test.sql   # 21
```

The API suite creates accounts, so it needs a database of its own —
`bash scripts/test-api.sh` builds one, runs against it, and tears it down.
Running it directly refuses to start while `APP_ENV=production`.

## Licence

Private. All rights reserved.
