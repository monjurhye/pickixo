# Connecting a Facebook Page

Everything the agent needs before it can touch **The World Frame**, in order.

Roughly fifteen minutes. Most of it is Meta's dashboard, not Pickixo.

---

## Before you start: the secret rule

Two of these values are credentials — `META_APP_SECRET` and
`FACEBOOK_TOKEN_KEY`. They go **directly into `.env` on the server** and
nowhere else.

Not into a chat window. Not into a screenshot. Not into a git commit. Not into
an AI prompt, including this project's own assistant — a secret pasted into a
conversation is a secret in a transcript, and it should be treated as burned.

`.env` is gitignored (`.gitignore` line 2). `.env.example` holds the variable
*names* only, and is committed.

---

## 1. Create the Meta app

1. Go to **developers.facebook.com** → *My Apps* → **Create App**.
2. When asked what you are building, choose the option for managing
   **Business** assets — a Page falls under this. (Meta renames these
   periodically; the one to avoid is the consumer/games type, which cannot
   hold Page permissions.)
3. Give it a name. This name is shown to you on the consent screen, so
   something like *Pickixo — The World Frame* is easier to recognise later than
   *My App 3*.

## 2. Add Facebook Login

In the app dashboard, add the **Facebook Login** product (the "for Business"
variant if offered).

Then under **Facebook Login → Settings**, set:

| Setting | Value |
|---|---|
| Valid OAuth Redirect URIs | `https://pickixo.com/api/facebook/callback` |
| Client OAuth Login | On |
| Web OAuth Login | On |

That redirect URI must match **exactly** — scheme, host, path, no trailing
slash. Meta compares it as a string, and a mismatch fails at the last step of
the flow with a message that does not say which character is wrong.

## 3. Permissions

The app requests five permissions, and the OAuth screen asks for all of them
at once. They are already defined in the code
(`app/services/facebook/capabilities.py`), so there is nothing to type here —
this is just what you are agreeing to when the consent screen appears:

| Permission | Why |
|---|---|
| `pages_show_list` | find which Pages you manage |
| `pages_read_engagement` | read the Page and its posts |
| `pages_read_user_content` | **read comments other people wrote** |
| `pages_manage_posts` | publish posts and stories |
| `pages_manage_engagement` | **reply to comments** |
| `read_insights` | reach and impressions, for learning |

The two in bold are the ones commonly missed. Reading a comment somebody else
wrote is a different permission from reading the Page, and replying is a
different one again from posting.

**App Review is not expected to be needed.** Per Meta's permissions reference,
these do not require Advanced Access, and Standard Access covers a Page you own
while you are an admin of the app. App Review is for managing *other people's*
Pages. If Meta's dashboard tells you otherwise for your app, believe the
dashboard over this document and say so.

## 4. Copy the App ID and secret

**Settings → Basic**:

* **App ID** — not secret, it appears in the OAuth URL.
* **App Secret** — press *Show*. This is a credential. Copy it straight into
  `.env`; do not paste it anywhere else on the way.

## 5. Generate the token encryption key

This encrypts the stored Page token so a database dump does not hand anyone a
credential that can post to your Page.

```bash
cd C:\Users\Administrator\Desktop\Pickixo\apps\api
.venv\Scripts\python.exe -c "from app.services.crypto import generate_key; print(generate_key())"
```

Copy the output into `FACEBOOK_TOKEN_KEY`. Keep a copy somewhere safe:
rotating it makes every stored token unreadable, and the Page has to be
reconnected.

## 6. Fill in `.env`

Open `C:\Users\Administrator\Desktop\Pickixo\.env` and add:

```
META_APP_ID=<your app id>
META_APP_SECRET=<your app secret>
META_REDIRECT_URI=https://pickixo.com/api/facebook/callback
META_GRAPH_VERSION=v25.0

FACEBOOK_TOKEN_KEY=<the generated key>

FACEBOOK_AGENT_ENABLED=true
FACEBOOK_AGENT_TICK_SECONDS=300
```

Leave `META_GRAPH_VERSION` alone. v25.0 is current — Meta announced it in
February 2026 — and moving it without reading the changelog silently loses
fields or drops an endpoint the code depends on.

## 7. Enable an AI provider

**The agent cannot think without one.** Every provider currently ships
disabled, which is why the agent records *"no AI text provider is enabled and
configured"* and does nothing.

The free option, running on this machine already:

```bash
ollama pull qwen3:1.7b
```

then set `OLLAMA_ENABLED=true` in `.env`. Image posts additionally need an
image provider (`POLLINATIONS_IMAGE_ENABLED` or `CLOUDFLARE_IMAGE_ENABLED`);
without one the agent can still publish text posts and handle comments, and
will simply not choose image posts.

## 7b. Reels

Reels are how the Page reaches people who do not follow it yet, so they are
the agent's main format: up to **2 a day** by default, with their own budget
separate from photo posts. Photo posts are written as quizzes.

A reel is made on this server: an AI-written script (hook, 3–5 facts, a
closing question), one AI still per scene with a slow zoom or pan, English
narration by Piper, and burned-in captions — all stitched by ffmpeg into a
720x1280 video of 20–40 seconds. Rendering takes one to three minutes of CPU.
The caption always ends with *"🎨 Visuals are AI-generated."*

**Three things to do, once:**

1. Apply the migration (as the owner). Until it is applied the agent simply
   never offers a reel:

   ```powershell
   C:\Pickixo\pgsql\bin\psql.exe -h 127.0.0.1 -U pickixo_admin -d pickixo `
     -v ON_ERROR_STOP=1 -f database\schema\020_facebook_reels.sql
   ```

2. Install Piper and the narrator voice (free, offline, ~120 MB):

   ```bash
   cd C:\Users\Administrator\Desktop\Pickixo\apps\api
   .venv\Scripts\python.exe -m pip install -r requirements.txt
   .venv\Scripts\python.exe -m piper.download_voices en_US-ryan-high --download-dir storage\voices
   ```

3. ffmpeg must be on the PATH of the account the worker runs as (it is
   installed system-wide via Chocolatey on this server).

Without an image provider (step 7) a reel cannot be rendered; the agent
records why and does nothing.

### Optional: a moving opening (the only paid step)

The first seconds decide whether anyone watches, so the opening can be a real
five-second video clip made by **Wan 2.6 Flash** on fal.ai, animated from the
first still. Everything after it stays free.

Cost: silent 720p is about **$0.025 per second**, so about **$0.13 per reel**,
or roughly **$8 a month** at two reels a day. Check the price on
fal.ai/models/wan/v2.6/image-to-video/flash before relying on that.

1. Create a key at fal.ai → *Dashboard → Keys*, and add credit.
2. In `.env` — never anywhere else:

   ```
   FAL_KEY=<your key>
   REEL_HOOK_ENABLED=true
   ```

If the clip fails for any reason — no credit, a timeout, fal being down — the
reel opens on a moving still instead and is published anyway. The run record
says which opening each reel got. A job abandoned after
`REEL_HOOK_TIMEOUT_SECONDS` may still be billed by fal.

## 8. Restart

```bash
powershell -Command "Restart-Service Pickixo-API -Force"
```

Check it took:

```bash
curl -s https://pickixo.com/api/health
```

## 9. Connect the Page

1. Sign in to Pickixo and open **/dashboard/facebook/agent**.
2. Press **Connect with Facebook**.
3. Authorise on Facebook's own screen, and **make sure The World Frame is
   ticked**. People routinely untick a Page or a permission here, and the
   result is a connection that looks fine until the first action fails.
4. You return to the dashboard, and the **What this connection can do** panel
   lists what Meta actually granted — not what was asked for. Anything missing
   names the exact permission it needs.

Pickixo never asks for your Facebook password and never receives one. The
exchange happens entirely on Facebook's consent screen; this server receives a
short-lived code, swaps it for a long-lived token, and encrypts it.

## 10. Start the agent worker

The API serves the dashboard. The **worker** is what makes the agent
autonomous, and it is a separate process so that you can close the browser,
deploy the website, or restart the API without interrupting it.

```bash
cd C:\Users\Administrator\Desktop\Pickixo\apps\api
.venv\Scripts\python.exe worker.py
```

It refuses to start, loudly, if `FACEBOOK_AGENT_ENABLED` is false, if Meta is
not configured, or if no AI provider is available — rather than running and
appearing healthy while never acting.

### As a Windows service

To survive reboots, alongside the existing `Pickixo-API` and `Pickixo-Web`:

**Already installed on this server** as `Pickixo-Agent` (auto-start, depends on
`Pickixo-Postgres`, logs to `C:\Pickixo\logs\agent.out.log`). Once steps 1–7b
are done, just:

```powershell
Start-Service Pickixo-Agent
```

Until then it starts, logs why it cannot run, and stops — it does not loop.
That is deliberate: a configuration refusal exits with status **78**
(`EX_CONFIG`) and the service is set to stay stopped on 78, while any other
exit, i.e. a crash, is restarted after the usual 10 s throttle. After a reboot
it tries again on its own, so fixing `.env` needs only the one command above.

To recreate it elsewhere:

```powershell
nssm install Pickixo-Agent "C:\Users\Administrator\Desktop\Pickixo\apps\api\.venv\Scripts\python.exe" worker.py
nssm set Pickixo-Agent AppDirectory "C:\Users\Administrator\Desktop\Pickixo\apps\api"
nssm set Pickixo-Agent Start SERVICE_AUTO_START
nssm set Pickixo-Agent DependOnService Pickixo-Postgres
nssm set Pickixo-Agent AppStdout C:\Pickixo\logs\agent.out.log
nssm set Pickixo-Agent AppStderr C:\Pickixo\logs\agent.err.log
nssm set Pickixo-Agent AppRotateFiles 1
nssm set Pickixo-Agent AppRotateBytes 16777216
nssm set Pickixo-Agent AppExit Default Restart
nssm set Pickixo-Agent AppExit 78 Exit
# Ctrl+C, then up to 100 s for the current cycle to finish — a reel mid-upload
# should complete rather than be killed.
nssm set Pickixo-Agent AppStopMethodConsole 100000
```

---

## Turning it on

Start in **APPROVAL_REQUIRED**, which is the default. The agent observes,
decides, and writes the post — then stops and waits for you. You get to read
several real decisions before anything reaches your audience.

When you are satisfied, switch the dashboard to **FULL_AUTO**.

Sensible first settings:

| Setting | Start with | Why |
|---|---|---|
| Feed posts per day | 2 | A Page posting twice a day looks run by a person |
| Minutes between posts | 180 | Stops it burying its own posts |
| Replies per hour | 10 | Enough to be responsive, not enough to look automated |
| Reply confidence | 0.75 | Below this it stays quiet rather than guessing |
| Avoid repeating for | 14 days | How far back the duplicate check looks |

These are ceilings, not targets. The agent is expected to do less than they
allow most of the time.

## Stopping it

**STOP AGENT** on the dashboard. No new post, story or reply will begin. Work
already in flight is allowed to finish recording what it did — losing the
record of a post that went out is worse than a few seconds' delay.

It is deliberately separate from the enabled switch and the mode, so that
changing an unrelated setting cannot clear it by accident.

---

## What to expect

**Mostly nothing.** That is the system working. The agent wakes every five
minutes and almost always concludes there is nothing worth doing — the daily
limit is spent, the last post is still collecting engagement, no comment needs
an answer. Those wakes cost no AI call and no Graph call.

The activity feed lists every wake, including the quiet ones, with a specific
reason:

```
20:01  ·  Did nothing — the last post is 34 minutes old and still
          collecting engagement (18); another post now would bury it
20:06  ·  Did nothing — daily post limit reached (2/2) and no comments
          need a reply
```

A dashboard that only showed activity would teach you that a quiet agent is a
broken one, and the next thing you would do is raise the limits.

## When something is wrong

| Symptom | Cause |
|---|---|
| *"Facebook is not configured on this server"* | One of the four `META_*`/`FACEBOOK_TOKEN_KEY` values is missing. Restart the API after adding them. |
| *"no AI text provider is enabled and configured"* | Step 7. |
| *"worker not running"* on the dashboard | Step 10. |
| Connection shows **token_invalid** | The token was revoked, or `FACEBOOK_TOKEN_KEY` changed. Reconnect the Page. |
| *"FACEBOOK_TOKEN_KEY is not set"* | The key is missing, not wrong. The stored token is fine — add the key and restart. Do **not** reconnect. |
| A capability is false | The panel names the exact permission. Re-run Connect and tick everything. |
| Redirect URI error on connecting | Step 2 — it must match character for character. |

## Known limitations

* **Stories cannot reuse media.** Meta requires story media not to have been
  used in a previously published post, so the agent generates a fresh image for
  every story rather than reposting a feed image.
* **Video stories are capped at 60 seconds** by Meta. Not relevant yet — the
  agent only publishes photo stories.
* **Reels are not part of this phase.** The existing Reel work is untouched and
  the agent cannot choose a Reel; `publish_reel` is not a valid decision and is
  rejected if a model suggests one.
* **One Page.** The schema is keyed for more, but the connect flow takes the
  first Page you manage.
* **Insights need `read_insights`.** Without it, learning still works from
  reactions, comments and shares — reach simply stays unknown.
