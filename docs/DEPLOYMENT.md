# pickixo.com — how it is served

Live at **https://pickixo.com**.

```
browser
  ⇅  HTTPS  (Cloudflare's certificate — this is what visitors see)
Cloudflare  165.99.63.228 → proxied, orange cloud
  ⇅  HTTPS  (Let's Encrypt certificate on our origin)
nginx  :80 / :443        C:\tools\nginx-1.31.5   (NSSM service "nginx")
  ⇅  HTTP over loopback — never touches a network
Next.js :3010            FastAPI :8010
                              ⇅
                         PostgreSQL :5432 (loopback)
```

Two hops, two certificates. Cloudflare holds one for the public; we hold one for
the Cloudflare→origin hop. That second one exists so Cloudflare can be set to
**Full (strict)** and actually verify who it is talking to.

---

## Cloudflare encryption mode

**SSL/TLS → Overview → _Full (strict)_. Set on 2026-09-12; verified.**

Cloudflare now connects to the origin over HTTPS on :443 and verifies the
Let's Encrypt certificate. Confirmed by watching which nginx server block
receives the traffic.

Getting here took two goes, and the second failure is the instructive one.

The zone started on **Flexible**, which means Cloudflare fetches from the origin
over plain HTTP.
Combined with a normal "redirect HTTP to HTTPS" rule on the origin, that produces
an infinite loop:

```
browser → Cloudflare (https) → origin :80 (http)
origin: "301, go to https://pickixo.com/"
Cloudflare passes the 301 back → browser asks again → forever
```

Which is exactly what `ERR_TOO_MANY_REDIRECTS` is.

The nginx config refuses to create that loop regardless of the mode — it reads
Cloudflare's `CF-Visitor` header, and when that says the visitor is already on
HTTPS it serves the request instead of redirecting. On Full (strict) that path is
no longer exercised, but it stays as a safety net.

**The guard was not enough on its own**, which is the part worth remembering.
While the zone was still Flexible, Cloudflare fetched `/robots.txt` at a moment
that produced a 301 and **cached it for four hours**. The origin was serving 200
by then; Cloudflare replayed the stale redirect to every crawler, pointing at the
URL it was already on — an infinite loop, on the one file every crawler reads
first. Only `/robots.txt` was affected, because everything else is `DYNAMIC` and
not cached.

Two lessons: a CDN can keep serving a bug long after the origin stopped having
it, so **purge the cache after fixing anything that produced a redirect**; and
Full (strict) removes the CF-Visitor guesswork entirely rather than working
around it.

| Mode | Cloudflare → origin | Verdict |
|---|---|---|
| Off | plaintext, no HTTPS at all | never |
| Flexible | **plaintext** | site works, session cookies exposed |
| Full | encrypted, certificate not checked | acceptable |
| **Full (strict)** | encrypted, certificate verified | **use this** |

---

## Certificate

Let's Encrypt, covering `pickixo.com` and `www.pickixo.com`, issued by the
win-acme already installed on this machine:

```
C:\ProgramData\win-acme\certs\pickixo.com-chain.pem
C:\ProgramData\win-acme\certs\pickixo.com-key.pem
```

Renewal is automatic — win-acme registered a scheduled task and the next renewal
is due about 60 days before expiry. Validation is HTTP-01 through
`/.well-known/acme-challenge/`, which Cloudflare passes through without
redirecting; the nginx `:80` block serves that path before any redirect logic,
and it must stay that way or renewal will fail silently.

To reissue by hand:

```powershell
C:\win-acme\wacs.exe --source manual --host pickixo.com,www.pickixo.com `
  --validation filesystem --webroot C:\tools\nginx-1.31.5\html `
  --store pemfiles --pemfilespath C:\ProgramData\win-acme\certs `
  --friendlyname pickixo.com --accepttos
```

`scripts/make-origin-cert.sh` generates a self-signed interim certificate. It was
used to bring the site up before Let's Encrypt succeeded and is not in use now.
It only ever suits "Full", never "Full (strict)".

---

## nginx

The Pickixo config lives in the repository, not in the nginx directory:

```
config/nginx/pickixo.com.conf
```

`C:\tools\nginx-1.31.5\conf\nginx.conf` includes it, and an explicit
`default_server` block answers `444` (close without replying) to any request
whose `Host` matches nothing. That block exists because hye.bd used to be the
first listen block and therefore nginx's implicit default; when hye.bd was
removed the role would otherwise have fallen to Pickixo by accident, leaving the
site answering to the bare origin IP and to any hostname pointed at it.

nginx runs as an NSSM service under `NT AUTHORITY\SYSTEM`, which means
`nginx -s reload` fails with *Access is denied* even from an elevated shell.
Restart the service instead:

```powershell
nginx -t                       # ALWAYS validate first
Restart-Service nginx -Force
```

### Restoring the real visitor IP

Behind a proxy, every request otherwise appears to come from Cloudflare. Here
that is not cosmetic: the guest AI allowance is keyed on a hash of the client IP,
so without this **every signed-out visitor on earth would share one daily bucket**
and the first few would exhaust it for everyone.

`set_real_ip_from` lists Cloudflare's ranges (fetched 2026-09-12 from
`cloudflare.com/ips-v4` and `/ips-v6`) and `real_ip_header CF-Connecting-IP`
restores the true address. `CF-Connecting-IP` is set by Cloudflare on every
request and cannot be forged by a client; `X-Forwarded-For` can be, which is why
it is not used for this.

Cloudflare adds ranges occasionally. If guest rate limiting starts behaving
strangely, refresh that list first.

---

## Services

Everything runs as a Windows service and starts automatically at boot.

| Service | What | Runs as |
|---|---|---|
| `nginx` | TLS + reverse proxy, :80 and :443 | NSSM, LocalSystem |
| `Pickixo-Postgres` | PostgreSQL 17.7, :5432 loopback | `pg_ctl register`, LocalSystem |
| `Pickixo-API` | FastAPI, :8010 loopback | NSSM, LocalSystem |
| `Pickixo-Web` | Next.js, :3010 loopback | NSSM, LocalSystem |
| `Pickixo-Ollama` | local model server, :11434 loopback | NSSM, LocalSystem |
| `Pickixo-Agent` | Facebook agent worker, no port | NSSM, LocalSystem — stays stopped (exit 78) until configured; see FACEBOOK_SETUP.md §10 |

```powershell
Get-Service Pickixo-*, nginx
Restart-Service Pickixo-API        # stops dependents, restarts them after
```

**Start order is enforced by dependencies**, not by luck:
`Pickixo-Web` → `Pickixo-API` → `Pickixo-Postgres`. Starting the web service
alone pulls the whole chain up in order; stopping Postgres takes the other two
down with it. Verified both directions.

**Crash recovery**: NSSM restarts a dead process after 5 s, with a 10 s throttle
so a crash-loop cannot spin the CPU. Verified by killing each process and
watching it come back under a new PID.

nginx deliberately does **not** depend on the others. If the app failed to start,
a running nginx returning 502 is a better outcome than no listener at all.

Logs go to `C:\Pickixo\logs\`, rotating at 16 MB so they cannot fill the disk.

### Deploying a web change

```powershell
cd C:\Users\Administrator\Desktop\Pickixo\apps\web
npm run build                      # prebuild also syncs public/ort/<version>/
Restart-Service Pickixo-Web        # NOT optional
```

**Always restart straight after a build.** `next start` keeps the previous
build's chunk manifest in memory. Rebuilding underneath it leaves the running
server handing out HTML that names chunk files which no longer exist: the page
loads but is not interactive, the stylesheet and `webpack-*.js` come back as
400 with an HTML body, and routes it had not served yet (`/sitemap.xml` was the
first casualty) fail with `TypeError: e[o] is not a function` in
`C:\Pickixo\logs\web.err.log`. Cloudflare's cache can hide this for a while,
which makes it worse. Check `/tools/background-remover` and `/sitemap.xml`
after every deploy.

**Never run `next dev` in `apps/web` while the service is up.** It writes to the
same `.next` directory and does the same damage. Test in a copy of the app
instead.

The background remover's runtime files are cached for a year and are safe to be,
because their URLs change when their content does: `/ort/<onnxruntime-web
version>/...` and `/workers/background-remover.js?v=<content hash>`, both set by
`next.config.mjs`. A new ORT release or an edited worker therefore needs only the
build above; there is nothing to purge.

### Running by hand instead

```powershell
Stop-Service Pickixo-API
cd C:\Users\Administrator\Desktop\Pickixo\apps\api
.venv\Scripts\python.exe run.py
```

`npm start` in `apps/web` is **`next start`**, not the TLS server. Behind nginx,
Node must not terminate TLS — nginx already did. `npm run dev` and
`npm run start:tls` are the standalone-with-TLS modes for working without nginx.

---

## Environment

`.env` is now production:

```
APP_ENV=production
SITE_URL=https://pickixo.com
APP_BASE_URL=https://pickixo.com
CORS_ALLOWED_ORIGINS=https://pickixo.com
GOOGLE_REDIRECT_URI=https://pickixo.com/api/auth/google/callback
SESSION_COOKIE_SECURE=true
```

`APP_ENV=production` also turns off `/docs`, enables the trusted-host check, and
makes the API refuse to start on a misconfiguration rather than run insecurely.

---

## Still to do

- **Cloudflare mode → Full (strict).** The certificate is ready; the switch is
  in the dashboard.
- **Verify a real reboot.** Dependency ordering and crash recovery are both
  tested, and every service is Automatic, but only an actual restart proves the
  boot path end to end.
- **Login rate limiting in the application.** nginx limits `/api/auth/*` to
  10 requests/minute per IP, which is currently the only thing in front of a
  password-guessing run.
- **Move to ports 3000/8000.** hye.bd was removed on 2026-09-12 and freed them;
  Pickixo is still on 3010/8010 because moving means a restart for no functional
  gain. Optional.
