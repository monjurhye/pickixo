# Backup and restore

Every Friday at 02:00 this machine packs the whole of pickixo.com into one
encrypted archive and uploads it to Google Drive (`monjurhye@gmail.com`).

Since 18 September 2026 the source has a git remote —
https://github.com/monjurhye/pickixo — so the working tree on this machine is
no longer the only copy of the code. That changes what this backup is for
without making it any less necessary: **the remote carries source, and nothing
else.** The database, `.env`, the TLS private key and the service definitions
exist in exactly two places — this machine, and these archives.

The remote is public. Nothing secret may be committed to it; `.gitignore`
keeps `.env` out, and that is the only thing standing between the repository
and every credential the platform holds. Secrets travel in the encrypted
archive described below, never in a commit.

---

## What is in the archive

```
pickixo-YYYY-MM-DD.7z          AES-256, encrypted headers
├── MANIFEST.txt               what was taken, and anything that failed
├── db/
│   ├── pickixo.dump           pg_dump --format=custom --compress=9
│   └── globals.sql            role definitions, without passwords
├── source/                    the working tree, including .git
├── config/
│   ├── nginx.conf
│   └── services.txt           service names, start modes, command lines
└── secrets/
    ├── .env
    ├── .env.local
    └── certs/                 the TLS certificate and private key
```

Roughly 1 MB a week, because everything a build can regenerate is left out:
`node_modules`, `.next`, `.venv`, `apps/web/public/ort`, `__pycache__`.

The 84 MB ONNX model is handled separately. It never changes, so it is synced
to `Pickixo-Backups/assets/models/` rather than packed into every archive —
it uploads once and is skipped every Friday after that.

**Retention:** 8 archives in Drive (two months), 3 on local disk.

---

## The passphrase

The archive contains `.env` — the Meta app secret, the database password,
`FACEBOOK_TOKEN_KEY` — and the TLS private key. Google Drive is not a safe
place for those in the clear, so the archive is encrypted with AES-256 and
encrypted headers, which means a stolen copy does not even reveal its own file
names.

The passphrase is `BACKUP_PASSPHRASE` in `.env`. It was generated once, at
setup, and **it exists nowhere else.**

> If this machine dies and you do not have that passphrase written down
> somewhere else, every archive in Drive is permanently unopenable. The backup
> would be complete, uploaded, verified — and useless.

Open `.env`, copy the value, and put it in a password manager. Do it before the
first Friday.

Changing the passphrase later does not re-encrypt the archives already in
Drive; those stay on the old one. If you rotate it, keep the old value until
the last archive encrypted with it has aged out.

### The one place the passphrase is exposed

7-Zip accepts a passphrase only as a command-line argument. For the few seconds
an archive is being written, it is therefore visible in a process listing —
which on this machine means visible to an administrator, who can read `.env`
directly anyway. It never reaches the log, the manifest or Drive. If that
tradeoff ever stops being acceptable, the fix is to switch to an `rclone crypt`
remote, at the cost of needing rclone and its config to restore.

---

## Setting it up

Steps 1–3 are done. Step 4 is yours, because it signs you into Google.

1. ~~Install rclone and 7-Zip~~ — done (`rclone v1.75.1`, `7-Zip 26.03`)
2. ~~Create `C:\Pickixo\backup`, restricted to SYSTEM and Administrators~~ — done
3. ~~Register the scheduled task~~ — done, `Pickixo Weekly Backup`, Fridays 02:00, runs as SYSTEM
4. **Connect Google Drive** — below

### 4. Connect Google Drive

In an **elevated** PowerShell:

```powershell
$env:RCLONE_CONFIG = "C:\Pickixo\backup\rclone.conf"; rclone config
```

Then, in rclone's prompts:

| Prompt | Answer |
|---|---|
| `n/s/q` | `n` (new remote) |
| `name` | `gdrive` — exactly this, the script looks for it |
| `Storage` | `drive` (Google Drive) |
| `client_id` | leave blank |
| `client_secret` | leave blank |
| `scope` | `1` (full access) |
| `service_account_file` | leave blank |
| `Edit advanced config?` | `n` |
| `Use web browser to automatically authenticate?` | `y` |

A browser opens — sign in as **monjurhye@gmail.com** and allow access. Then
`q` to quit.

Check it, and run the first backup by hand:

```powershell
$env:RCLONE_CONFIG = "C:\Pickixo\backup\rclone.conf"; rclone lsd gdrive:
```

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\Administrator\Desktop\Pickixo\scripts\backup\Backup-Pickixo.ps1"
```

The last line of the log tells you which of two things happened, and they are
not the same claim:

```
OK — pickixo-….7z (1.0 MB) uploaded and verified in Drive, in 00:34
LOCAL ONLY — pickixo-….7z (1.0 MB) built and opened successfully, but NOT uploaded
```

"Verified in Drive" is printed only after the uploaded bytes have been read
back and compared by hash. Nothing else earns that wording.

---

## Checking on it

```powershell
# Did last Friday run, and what happened?
Get-Content (Get-ChildItem C:\Pickixo\logs\backup-*.log | Sort-Object Name -Desc | Select -First 1)

# When does it next run, and how did it exit last time?
Get-ScheduledTask -TaskName 'Pickixo Weekly Backup' | Get-ScheduledTaskInfo

# What is actually in Drive?
$env:RCLONE_CONFIG = "C:\Pickixo\backup\rclone.conf"; rclone ls gdrive:Pickixo-Backups/weekly
```

Exit codes: `0` fine · `2` finished, but parts were missing — see `MANIFEST.txt`
inside the archive · `1` failed.

### Prove the backup still restores

Do this occasionally. A backup you have never opened is a hope.

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\Administrator\Desktop\Pickixo\scripts\backup\Test-Restore.ps1"
```

That opens the newest archive, checks every part is present, and confirms the
dump contains every table the live database has. For a real restore into a
scratch database — created, restored, row counts compared against live, then
dropped — add admin credentials:

```powershell
powershell -ExecutionPolicy Bypass -File "…\Test-Restore.ps1" -AdminUrl "postgresql://pickixo_admin:<password>@127.0.0.1:5432/postgres"
```

`pickixo_app` has no `CREATEDB` on purpose, which is why the deep test needs
`pickixo_admin` and why the credentials are passed in rather than stored.

---

## Restoring onto a new machine

Assumes a fresh Windows box with PostgreSQL 17, Node, Python and nginx
installed.

**1. Unpack** — 7-Zip, or any tool that reads `.7z`, with the passphrase:

```powershell
& "C:\Program Files\7-Zip\7z.exe" x pickixo-2026-09-19.7z -o"C:\restore"
```

**2. Read `MANIFEST.txt` first.** If the backup recorded warnings, they are
listed there, and they tell you what is *not* in the archive before you start
depending on it.

**3. Source and secrets**

```powershell
Copy-Item C:\restore\pickixo-*\source\* C:\Users\Administrator\Desktop\Pickixo\ -Recurse
Copy-Item C:\restore\pickixo-*\secrets\.env       C:\Users\Administrator\Desktop\Pickixo\.env
Copy-Item C:\restore\pickixo-*\secrets\.env.local C:\Users\Administrator\Desktop\Pickixo\apps\web\.env.local
Copy-Item C:\restore\pickixo-*\secrets\certs\*    C:\ProgramData\win-acme\certs\
```

**4. Database.** The roles come first — `globals.sql` carries their names but
not their passwords, so set those by hand:

```powershell
psql -U postgres -f C:\restore\pickixo-*\db\globals.sql
psql -U postgres -c "\password pickixo_admin"
psql -U postgres -c "\password pickixo_app"
psql -U postgres -c "CREATE DATABASE pickixo OWNER pickixo_admin;"
pg_restore -U pickixo_admin -d pickixo --no-owner C:\restore\pickixo-*\db\pickixo.dump
```

Then put the new `pickixo_app` password into `DATABASE_URL` in `.env`.

**5. Rebuild what was deliberately left out**

```powershell
cd C:\Users\Administrator\Desktop\Pickixo\apps\web; npm ci; npm run build
```

```powershell
cd C:\Users\Administrator\Desktop\Pickixo\apps\api; python -m venv .venv; .\.venv\Scripts\pip install -r requirements.txt
```

**6. The model**

```powershell
$env:RCLONE_CONFIG = "C:\Pickixo\backup\rclone.conf"; rclone copy gdrive:Pickixo-Backups/assets/models C:\Pickixo\models
```

**7. Services.** `config/services.txt` has each service's name, start mode and
full command line — enough to recreate them with NSSM. Copy `config/nginx.conf`
back into the nginx `conf` directory.

---

## What this does not protect against

Worth being clear about, because a backup that is believed to cover more than
it does is its own kind of risk.

- **Deletion you do not notice.** Archives age out after 8 weeks. If the
  database is corrupted today and nobody looks until December, every archive in
  Drive holds the corrupted version.
- **Losing the Google account.** The backup and the account that holds it fail
  together. A second copy somewhere else — an external disk, another cloud —
  removes that shared fate.
- **Anything the git remote does not carry.** The remote holds source, and only
  as far as the last push. The database, the secrets and the service
  definitions are in these archives alone — and the archives are weekly. A
  commit pushed on Monday is safe within seconds; a row written on Monday is
  not safe until Friday.
- **Anything between Fridays.** Up to seven days of work is at risk at any
  moment. If that becomes too much, the trigger in
  `scripts/backup/Install-BackupTask.ps1` takes a daily schedule with a
  one-line change.
