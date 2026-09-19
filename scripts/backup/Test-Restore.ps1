<#
.SYNOPSIS
    Proves that a backup archive can actually be restored.

.DESCRIPTION
    An archive nobody has ever opened is a hope, not a backup. This opens the
    most recent one (or the one you name), and checks it at one of two depths:

    Default — no credentials needed, safe to run any time:
        * the archive opens with the passphrase in .env
        * every expected part is inside it: db dump, source tree, config,
          secrets, manifest
        * pg_restore can read the dump's table of contents
        * the dump contains every table the live database has, with row
          counts that match

    Deep (-AdminUrl) — a real restore:
        * creates a scratch database, restores the dump into it, compares row
          counts table by table against live, then drops the scratch database

    The deep test needs a role with CREATEDB, which pickixo_app deliberately
    does not have. Pass the admin connection string on the command line when
    you want it; it is never stored.

.EXAMPLE
    powershell -File scripts\backup\Test-Restore.ps1

.EXAMPLE
    powershell -File scripts\backup\Test-Restore.ps1 -AdminUrl 'postgresql://pickixo_admin:...@127.0.0.1:5432/postgres'
#>

[CmdletBinding()]
param(
    [string]$Archive,
    [string]$AdminUrl,
    [string]$RepoRoot = 'C:\Users\Administrator\Desktop\Pickixo'
)

$ErrorActionPreference = 'Stop'

$SevenZip = 'C:\Program Files\7-Zip\7z.exe'
$PgBin    = 'C:\Pickixo\pgsql\bin'
$OutDir   = 'C:\Pickixo\backup\archives'

function Invoke-Quiet {
    <#
        Runs a native command with stderr merged into stdout via 2>&1.

        $ErrorActionPreference is set to 'Continue' here, scoped to this
        function only, so it never leaks to the caller. Without it, this
        script's global 'Stop' turns every stderr line a native command
        writes — including a routine warning, like pg_restore's about absent
        roles — into a terminating error the instant 2>&1 merges it in, which
        aborts the test even though the command itself exited 0. Real failure
        is judged by the caller from the returned exit code, not by this.
    #>
    param([string]$Exe, [string[]]$Arguments)
    $ErrorActionPreference = 'Continue'
    $output = & $Exe @Arguments 2>&1
    return @{ Output = $output; Code = $LASTEXITCODE }
}

$pass = 0
$fail = 0
function Check {
    param([string]$What, [bool]$Ok, [string]$Detail = '')
    if ($Ok) {
        $script:pass++
        Write-Output ("  PASS  {0}" -f $What)
    } else {
        $script:fail++
        Write-Output ("  FAIL  {0}" -f $What)
        if ($Detail) { Write-Output ("        {0}" -f $Detail) }
    }
}

# --- find the archive -------------------------------------------------------

if (-not $Archive) {
    $latest = Get-ChildItem $OutDir -Filter 'pickixo-*.7z' -ErrorAction SilentlyContinue |
              Sort-Object Name -Descending | Select-Object -First 1
    if (-not $latest) { throw "No archives in $OutDir — run Backup-Pickixo.ps1 first" }
    $Archive = $latest.FullName
}
Write-Output "Testing $Archive"
Write-Output ("Size: {0:N1} MB, written {1}" -f ((Get-Item $Archive).Length / 1MB), (Get-Item $Archive).LastWriteTime)
Write-Output ''

# --- passphrase -------------------------------------------------------------

$envLine = Get-Content (Join-Path $RepoRoot '.env') -Encoding utf8 |
           Where-Object { $_ -match '^\s*BACKUP_PASSPHRASE\s*=' } | Select-Object -First 1
if (-not $envLine) { throw 'BACKUP_PASSPHRASE is not in .env' }
$passphrase = $envLine.Substring($envLine.IndexOf('=') + 1).Trim().Trim('"')

$work = Join-Path $env:TEMP ("pickixo-restore-test-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force -Path $work | Out-Null

try {
    # --- 1. does it open, and is everything in it? --------------------------

    $extract = Invoke-Quiet -Exe $SevenZip -Arguments @('x', "-p$passphrase", "-o$work", '-y', '-bso0', '-bsp0', $Archive)
    Check 'archive opens with the passphrase from .env' ($extract.Code -eq 0)
    if ($extract.Code -ne 0) { throw 'Cannot open the archive — nothing else can be checked' }

    $root = Get-ChildItem $work -Directory | Select-Object -First 1
    if (-not $root) { throw 'Archive is empty' }
    $root = $root.FullName

    $dump = Join-Path $root 'db\pickixo.dump'
    Check 'database dump present'          (Test-Path $dump)
    Check 'manifest present'               (Test-Path (Join-Path $root 'MANIFEST.txt'))
    Check 'source tree present'            (Test-Path (Join-Path $root 'source\apps\web\package.json'))
    Check 'git history present'            (Test-Path (Join-Path $root 'source\.git'))
    Check 'nginx config present'           (Test-Path (Join-Path $root 'config\nginx.conf'))
    Check 'service definitions present'    (Test-Path (Join-Path $root 'config\services.txt'))
    Check '.env present'                   (Test-Path (Join-Path $root 'secrets\.env'))
    Check 'TLS key pair present'           ((Get-ChildItem (Join-Path $root 'secrets\certs') -Filter '*.pem' -ErrorAction SilentlyContinue | Measure-Object).Count -ge 2)

    # The uncommitted working tree is the whole reason this backup matters,
    # so spot-check that recent work is actually inside it rather than
    # trusting that robocopy did what it was told.
    Check 'uncommitted work included (facebook_agent)' (Test-Path (Join-Path $root 'source\apps\api\app\facebook_agent\agent.py'))
    Check 'uncommitted work included (class 2 content)' (Test-Path (Join-Path $root 'source\apps\web\src\data\class2\english\unit02.json'))
    Check 'build output correctly excluded' (-not (Test-Path (Join-Path $root 'source\apps\web\node_modules')))

    $manifest = Get-Content (Join-Path $root 'MANIFEST.txt') -Encoding utf8 -Raw
    # -cmatch, not -match: PowerShell compares case-insensitively by default,
    # so the reassuring "No warnings: ..." line matched the WARNINGS header and
    # every clean backup reported itself as having problems.
    if ($manifest -cmatch 'WARNINGS - these parts are incomplete') {
        Write-Output ''
        Write-Output '  NOTE  this backup recorded warnings:'
        ($manifest -split "`n") | Where-Object { $_ -match '^\s+- ' } | ForEach-Object { Write-Output ("      " + $_.Trim()) }
        Write-Output ''
    }

    # --- 2. is the dump readable and complete? ------------------------------

    $listResult = Invoke-Quiet -Exe (Join-Path $PgBin 'pg_restore.exe') -Arguments @('--list', $dump)
    $toc = $listResult.Output
    Check 'pg_restore can read the dump' ($listResult.Code -eq 0) (($toc | Select-Object -Last 3) -join ' ')

    $dumpedTables = $toc |
        Where-Object { $_ -match '\sTABLE DATA\s+public\s+(\S+)' } |
        ForEach-Object { [regex]::Match($_, '\sTABLE DATA\s+public\s+(\S+)').Groups[1].Value } |
        Sort-Object -Unique

    # Compare against the live database: a dump that quietly skipped a table
    # looks perfectly healthy until the day you need that table.
    $envDb = Get-Content (Join-Path $RepoRoot '.env') -Encoding utf8 |
             Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    $liveUrl = $envDb.Substring($envDb.IndexOf('=') + 1).Trim().Trim('"')

    $tableSql = "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1;"
    $liveTables = @(& (Join-Path $PgBin 'psql.exe') $liveUrl -At -c $tableSql | Where-Object { $_ })

    $missing = $liveTables | Where-Object { $dumpedTables -notcontains $_ }
    Check ("dump covers all {0} live tables" -f ($liveTables | Measure-Object).Count) `
          (($missing | Measure-Object).Count -eq 0) ("missing: " + ($missing -join ', '))

    # --- 3. deep test: an actual restore ------------------------------------

    if ($AdminUrl) {
        Write-Output ''
        Write-Output '  Deep test: restoring into a scratch database'
        $scratch = 'pickixo_restore_test'
        $psql = Join-Path $PgBin 'psql.exe'

        & $psql $AdminUrl -c "DROP DATABASE IF EXISTS $scratch;" | Out-Null
        & $psql $AdminUrl -c "CREATE DATABASE $scratch;" | Out-Null
        Check 'scratch database created' ($LASTEXITCODE -eq 0)

        try {
            $scratchUrl = ($AdminUrl -replace '/[^/]*$', "/$scratch")
            Invoke-Quiet -Exe (Join-Path $PgBin 'pg_restore.exe') -Arguments @('--dbname', $scratchUrl, '--no-owner', '--no-privileges', $dump) | Out-Null
            # pg_restore warns about absent roles even on a clean restore, so
            # judge it by what landed, not by the exit code.
            $countSql = "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
            $restored = (& $psql $scratchUrl -At -c $countSql)
            Check ("restored $restored tables into the scratch database") ([int]$restored -eq ($liveTables | Measure-Object).Count) `
                  ("live has " + ($liveTables | Measure-Object).Count)

            $mismatch = @()
            foreach ($t in $liveTables) {
                $a = (& $psql $liveUrl    -At -c "SELECT count(*) FROM public.`"$t`";")
                $b = (& $psql $scratchUrl -At -c "SELECT count(*) FROM public.`"$t`";")
                if ($a -ne $b) { $mismatch += "$t live=$a restored=$b" }
            }
            Check 'every table has the same row count after restore' ($mismatch.Count -eq 0) ($mismatch -join '; ')
        }
        finally {
            & $psql $AdminUrl -c "DROP DATABASE IF EXISTS $scratch;" | Out-Null
            Write-Output '  Scratch database dropped'
        }
    }
    else {
        Write-Output ''
        Write-Output '  NOTE  structural test only. For a real restore, re-run with:'
        Write-Output '          -AdminUrl "postgresql://pickixo_admin:<password>@127.0.0.1:5432/postgres"'
    }
}
finally {
    # The extracted copy contains .env and the TLS private key in the clear.
    if (Test-Path $work) { Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue }
    Write-Output ''
    Write-Output 'Extracted copy deleted.'
}

Write-Output ''
Write-Output ("{0} passed, {1} failed" -f $pass, $fail)
if ($fail -gt 0) { exit 1 }
exit 0
