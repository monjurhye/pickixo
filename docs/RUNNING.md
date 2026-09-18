# Running Pickixo

Everything below is what is actually installed on this machine right now.

---

## What is already set up

| Thing | Where |
|---|---|
| PostgreSQL 17.7 binaries | `C:\Pickixo\pgsql` |
| Database cluster | `C:\Pickixo\pgdata` (loopback only, port 5432) |
| Database | `pickixo`, owned by `pickixo_admin` |
| Application role | `pickixo_app` (not a superuser) |
| API virtualenv | `apps\api\.venv` |
| Web dependencies | `apps\web\node_modules` |
| Secrets | `.env` at the repo root — **gitignored, never commit or back up** |

---

## It is already running

Everything is a Windows service and starts at boot. Normally there is nothing to
start by hand:

```powershell
Get-Service Pickixo-*, nginx
```

| Service | Port |
|---|---|
| `nginx` | 80, 443 |
| `Pickixo-Postgres` | 5432 |
| `Pickixo-API` | 8010 |
| `Pickixo-Web` | 3010 |
| `Pickixo-Ollama` | 11434 |

`Pickixo-Web` depends on `Pickixo-API`, which depends on `Pickixo-Postgres`, so
starting one pulls up what it needs and stopping Postgres takes the rest down.

### Running one by hand

Stop its service first, or the port is already taken:

```powershell
Stop-Service Pickixo-API
cd C:\Users\Administrator\Desktop\Pickixo\apps\api
.venv\Scripts\python.exe run.py
```

```powershell
Stop-Service Pickixo-Web
cd C:\Users\Administrator\Desktop\Pickixo\apps\web
npm start          # plain HTTP on loopback, the way nginx expects it
npm run dev        # standalone with its own TLS at https://localhost:3010
```

`npm start` does **not** serve TLS — nginx already did.

### The certificate

The web tier serves HTTPS using a self-signed certificate in `apps/web/certs/`,
generated once by `bash scripts/make-dev-cert.sh` (or `npm run cert`). It covers
`localhost`, `127.0.0.1` and `::1`, and is valid for 825 days.

**The browser will warn the first time.** Nothing vouches for a self-signed
certificate, so that warning is correct rather than a defect — click through it
once (Chrome/Edge: *Advanced -> Proceed*). Removing the warning entirely means
adding the certificate to the Windows *Trusted Root Certification Authorities*
store, which changes the machine's trust settings and is therefore your call to
make, not something set up on your behalf.

`apps/web/certs/` is gitignored, along with `*.key` and `*.crt`. The private key
must never be committed or included in a backup.

The API stays on **plain HTTP over loopback** on purpose. That traffic never
reaches a network, and in production nginx holds the real certificate and proxies
plaintext to both processes — so giving the API its own certificate would buy
nothing and add one more thing to keep valid.

Check it is alive:

```bash
curl http://127.0.0.1:8010/api/health        # the API directly
curl -k https://localhost:3010/api/health   # through the web tier, as a browser does
```

A healthy fresh install answers:

```json
{"status":"ok","database":true,"version":"0.1.0","ai_providers_ready":0}
```

`ai_providers_ready: 0` is **correct**, not broken — no provider key is
configured yet. AI endpoints report themselves unavailable rather than failing
mid-request.

### Always use `run.py`, not `uvicorn` directly

Windows defaults to ProactorEventLoop, which does not implement
`loop.add_reader()`. psycopg's async driver needs it, so on the default loop
every connection hangs and the pool dies with
`pool initialization incomplete after 10 sec`. `run.py` selects the selector loop
*before* uvicorn creates its loop — setting it inside `app/main.py` is too late,
because uvicorn imports the app from inside `asyncio.run()`.

---

## Turning AI on

Nothing fakes a response, so until a provider is configured AI is genuinely off.

1. Get a key from a provider (start with Groq — it has the most usable free tier;
   read `PROVIDER_TERMS.md` first, especially the Gemini warning).
2. In `.env`:
   ```
   GROQ_API_KEY=your-key-here
   GROQ_ENABLED=true
   ```
3. Restart the API. `ai_providers_ready` becomes 1 and `/api/ai/status` reports
   `available: true`.

Add more providers the same way. The router uses the first one that is enabled,
keyed and not cooling down, and falls through the rest on failure — which is
exactly the behaviour the 23 provider tests cover.

---

## Turning Google sign-in on

The flow is built; it reports "not configured" until you supply an OAuth client.

1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth client
   ID** → Web application.
2. Add this to **Authorised redirect URIs**, exactly:
   ```
   https://pickixo.com/api/auth/google/callback
   ```
   Add `https://localhost:3010/api/auth/google/callback` as a second entry if you
   want Google sign-in to work in standalone local development too.

   It must point at the **web** origin, not the API. Google redirects the
   *browser* there, and the session cookie is set for whatever host the browser
   contacted. Send it to the API host and the user comes back from Google
   holding a cookie for `127.0.0.1` while the app is served from `localhost` —
   that is to say, still signed out.
3. In `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=https://pickixo.com/api/auth/google/callback
   ```
4. Restart. The Google button appears on sign-in by itself — the page asks the
   server what it supports rather than assuming.

---

## Tests

```bash
cd apps/api

.venv/Scripts/python.exe -m tests.test_provider_manager    # 23  AI failover
.venv/Scripts/python.exe -m tests.test_openai_compatible   # 24  adapter
.venv/Scripts/python.exe -m tests.test_api_flows           # 23  API
```

### The API suite needs its own database

It creates accounts, and accounts are rows in whatever database the API is
attached to. There is one API and one database on this machine, so running it
"locally" writes into the live table — which it did, twice, a few hundred rows,
before that was obvious. Pointing the tests at localhost was never the fix.

```bash
$env:PGPASSWORD="<pickixo_admin password>"
bash scripts/test-api.sh
```

That rebuilds `pickixo_test` from `database/schema/`, starts a second API on
8011 against it, runs the suite, and stops it again. The live API and database
are untouched.

Running `python -m tests.test_api_flows` directly **refuses to start** while
`APP_ENV=production`, and says what to do instead. `PICKIXO_API=<url>` is treated
as a deliberate choice and is allowed.

```powershell
# 21 database assertions; runs in a transaction and rolls back, safe to re-run
$env:PGPASSWORD="<pickixo_admin password>"
C:\Pickixo\pgsql\bin\psql.exe -h 127.0.0.1 -U pickixo_admin -d pickixo `
  -v ON_ERROR_STOP=1 -f tests\db\01_foundation_test.sql
```

```bash
cd apps/web
npx tsc --noEmit      # typecheck
npm run build         # the real check
```

---

## Applying schema changes

Migrations are plain SQL applied in numeric order as the **owner**, not as the
application role (which has no DDL rights on purpose).

```powershell
C:\Pickixo\pgsql\bin\psql.exe -h 127.0.0.1 -U pickixo_admin -d pickixo `
  -v ON_ERROR_STOP=1 -f database\schema\008_whatever.sql
```

Never edit an already-applied file — add a new numbered one.

---

## Ports

| Service | Port |
|---|---|
| nginx | 80, 443 (public) |
| Pickixo web | 3010 (loopback) |
| Pickixo API | 8010 (loopback) |
| PostgreSQL | 5432 (loopback) |
| Ollama | 11434 (loopback) |

3010/8010 date from when hye.bd held 3000/8000. **hye.bd was removed on
2026-09-12** and those ports are free now; moving is optional and means editing
`BACKEND_PORT` in `.env`, the `-p` flags in `apps/web/package.json`,
`INTERNAL_API_URL` in `apps/web/.env.local`, and the nginx upstreams.

---

## Stopping

```powershell
C:\Pickixo\pgsql\bin\pg_ctl.exe -D C:\Pickixo\pgdata stop
```

The API and web processes stop with Ctrl-C, or by stopping the `python.exe` /
`node.exe` holding 8010 / 3010.
