<#
.SYNOPSIS
    Pull, build, restart and verify pickixo.com's web app.

.DESCRIPTION
    The deploy is four steps that must happen in order, and every one of them
    has bitten us:

      * `npm run build` from the repo root fails with ENOENT, because the
        package.json is in apps\web, not at the root;
      * a build that was never preceded by `git pull` silently ships the old
        code, and the only symptom is a page that "does not show";
      * `Restart-Service` after a FAILED build restarts the previous build and
        looks like it worked;
      * skipping the restart after a successful one leaves `next start`
        handing out HTML that names chunk files which no longer exist — the
        page loads but is not interactive (see docs\DEPLOYMENT.md).

    So this script does them in order, checks the result of each, and refuses
    to continue when one fails. It resolves the repo from its own location, so
    it does not matter which directory you run it from.

    It also prints the routes it built and confirms the app answers on
    loopback, because "it built" and "it serves the new page" are different
    claims and only the second one is what you actually wanted.

.PARAMETER SkipMigrations
    Do not run pending database migrations. The build and restart still run.

.PARAMETER StashWip
    Stash uncommitted work (including untracked files) before building, and
    restore it afterwards. Without this, uncommitted changes in the working
    tree are built and deployed too — `next build` reads the working tree, not
    git. Use it when you have half-finished work on the server that should not
    go live yet.

.PARAMETER PsqlPath
    Path to psql.exe. Only used when migrations run.

.NOTES
    Run from an elevated PowerShell — Restart-Service needs it.
    Migrations prompt for the pickixo_admin password; that role is not in
    .env on purpose (.env carries the app role, which has no DDL rights).
#>

[CmdletBinding()]
param(
    [switch]$SkipMigrations,
    [switch]$StashWip,
    [string]$PsqlPath = 'C:\Pickixo\pgsql\bin\psql.exe',
    [string]$ServiceName = 'Pickixo-Web'
)

$ErrorActionPreference = 'Stop'

# The repo is the parent of the directory holding this script, so the script
# works from any working directory — which is the mistake it exists to stop.
$RepoRoot = Split-Path -Parent $PSScriptRoot
$WebRoot  = Join-Path $RepoRoot 'apps\web'

function Step($n, $text) { Write-Host "`n[$n] $text" -ForegroundColor Cyan }
function Ok($text)       { Write-Host "    OK  $text" -ForegroundColor Green }
function Warn($text)     { Write-Host "    !   $text" -ForegroundColor Yellow }

Write-Host "Pickixo web deploy" -ForegroundColor White
Write-Host "  repo: $RepoRoot"

if (-not (Test-Path (Join-Path $WebRoot 'package.json'))) {
    throw "No package.json at $WebRoot — is $RepoRoot really the repo?"
}

Push-Location $RepoRoot
$stashed = $false
try {
    # --- 1. bring the code in -------------------------------------------
    Step 1 'Updating the working tree'

    $branch = (git rev-parse --abbrev-ref HEAD).Trim()
    if ($branch -ne 'main') {
        Warn "on branch '$branch', not main — deploying that branch"
    }

    # Uncommitted work is built and shipped, because next build reads the
    # working tree. Say so rather than letting it surprise anyone.
    $dirty = @(git status --porcelain --untracked-files=normal)
    if ($dirty.Count -gt 0) {
        if ($StashWip) {
            git stash push --include-untracked --message "Deploy-Web $(Get-Date -Format s)" | Out-Null
            $stashed = $true
            Ok 'stashed uncommitted work; it will be restored at the end'
        } else {
            Warn "$($dirty.Count) uncommitted change(s) — these WILL be built and deployed:"
            $dirty | ForEach-Object { Write-Host "          $_" -ForegroundColor DarkYellow }
            Warn 're-run with -StashWip to build only committed code'
        }
    }

    $before = (git rev-parse --short HEAD).Trim()
    git pull --ff-only
    if ($LASTEXITCODE -ne 0) {
        throw 'git pull failed. Resolve it and re-run; nothing has been built or restarted.'
    }
    $after = (git rev-parse --short HEAD).Trim()

    if ($before -eq $after) { Ok "already at $after" }
    else                    { Ok "$before -> $after" }

    # --- 2. migrations ----------------------------------------------------
    # Before the build, so that when the service comes back the registry rows
    # the pages read are already there.
    if ($SkipMigrations) {
        Step 2 'Migrations — skipped (-SkipMigrations)'
    } else {
        Step 2 'Applying database migrations'
        if (-not (Test-Path $PsqlPath)) {
            Warn "psql not found at $PsqlPath — skipping migrations"
            Warn 'the pages will work, but will not be listed in Education or search'
        } else {
            # Every file in numeric order, as RUNNING.md requires. There is no
            # migrations table, and there does not need to be: every file here
            # is written to be re-runnable — CREATE TABLE and CREATE INDEX are
            # all IF NOT EXISTS, seeds are ON CONFLICT, and the registry rows
            # guard their own UPDATE so updated_at only moves when something
            # really changed (sitemap.xml publishes it as lastmod). Applying
            # all of them is therefore how the database is made to match the
            # repo, not a risk. A future file that is not idempotent would
            # break this, which is a reason to keep writing them this way.
            # psql on Windows takes client_encoding from the console codepage,
            # which is WIN1252 here, and every migration is UTF-8 with Bangla
            # in it. Left alone the server decodes those bytes as WIN1252:
            # 017 aborts on a byte WIN1252 has no mapping for, and the files
            # whose bytes it *can* map would insert mojibake without a word.
            # The newer files also set this themselves; this covers the rest.
            $env:PGCLIENTENCODING = 'UTF8'

            $applied = 0
            Get-ChildItem (Join-Path $RepoRoot 'database\schema\*.sql') |
                Sort-Object Name |
                ForEach-Object {
                    & $PsqlPath -h 127.0.0.1 -U pickixo_admin -d pickixo `
                                -v ON_ERROR_STOP=1 -q -f $_.FullName
                    if ($LASTEXITCODE -ne 0) {
                        throw "Migration failed: $($_.Name). Nothing has been built or restarted."
                    }
                    $applied++
                }
            Ok "$applied migration file(s) applied"
        }
    }

    # --- 3. build ---------------------------------------------------------
    Step 3 "Building (in $WebRoot)"
    Push-Location $WebRoot
    try {
        # ErrorActionPreference is Stop for this script, and with `2>&1` that
        # turns npm's ordinary stderr chatter ("npm warn deprecated ...") into
        # terminating errors — the build would "fail" on a deprecation notice.
        # Exit code is the only thing that actually says whether it built.
        $prevEap = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $buildLog = & npm run build 2>&1
        $buildOk  = ($LASTEXITCODE -eq 0)
        $ErrorActionPreference = $prevEap
        $buildLog | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    } finally {
        Pop-Location
    }

    if (-not $buildOk) {
        throw 'Build failed. The service was NOT restarted, so the previous build is still serving.'
    }

    # A build that succeeds but does not contain the page you are deploying is
    # the failure mode that looks most like success — it is exactly what a
    # missed `git pull` produces. So compare what the source tree has against
    # what the build emitted, rather than checking for a hardcoded route that
    # would go stale the next time a subject is added.
    $expected = Get-ChildItem (Join-Path $WebRoot 'src\app\education\class-2') -Directory -ErrorAction SilentlyContinue |
                ForEach-Object { "/education/class-2/$($_.Name)" }
    $built = $buildLog | Select-String -Pattern '/education/class-2/\S+' -AllMatches |
             ForEach-Object { $_.Matches.Value } | Sort-Object -Unique

    $missing = $expected | Where-Object { $_ -notin $built }
    if ($expected -and -not $missing) {
        Ok "all $($expected.Count) class-2 route(s) built: $($built -join ', ')"
    } elseif ($missing) {
        Warn "these pages exist in the source but are NOT in the build: $($missing -join ', ')"
        Warn 'that usually means the build ran against a stale tree'
    } else {
        Warn 'no education/class-2 pages found in the source tree'
    }

    # --- 4. restart -------------------------------------------------------
    Step 4 "Restarting $ServiceName"
    Restart-Service $ServiceName
    Ok 'restarted'

    # --- 5. verify --------------------------------------------------------
    Step 5 'Verifying on loopback'
    Start-Sleep -Seconds 3
    foreach ($path in '/', '/education/class-2/bangla', '/education/class-2/math') {
        try {
            $code = (Invoke-WebRequest -Uri "http://127.0.0.1:3010$path" `
                        -UseBasicParsing -TimeoutSec 20).StatusCode
        } catch {
            $code = $_.Exception.Response.StatusCode.value__
        }
        if ($code -eq 200) { Ok  "$path -> $code" }
        else               { Warn "$path -> $code" }
    }

    Write-Host "`nDone." -ForegroundColor Green
    Write-Host 'If anything that produced a redirect changed, purge the Cloudflare cache — it can serve a fixed bug for hours (docs\DEPLOYMENT.md).'
}
finally {
    Pop-Location
    if ($stashed) {
        Write-Host "`nRestoring stashed work..." -ForegroundColor Cyan
        git -C $RepoRoot stash pop
    }
}
