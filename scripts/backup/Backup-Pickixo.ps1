<#
.SYNOPSIS
    Nightly off-machine backup of pickixo.com to Google Drive.

.DESCRIPTION
    Everything that would have to exist again after this machine is gone:

      db/       a pg_dump of the pickixo database, plus the role definitions
      source/   the working tree, including .git and every uncommitted change
      config/   nginx.conf and the service definitions that wire it together
      secrets/  .env, .env.local and the TLS key pair

    The whole thing is packed into one .7z encrypted with AES-256 and encrypted
    headers, so a stolen copy reveals not even the file names, and then copied
    to Google Drive. The 84 MB ONNX model is handled separately: it never
    changes, so it is synced rather than re-archived, and uploads exactly once.

    Two rules this script keeps, because a backup that lies is worse than none:

      * Nothing is reported as uploaded until it has been read back from Drive
        and checked against the local file by hash.
      * A step that fails but does not stop the run is written into the
        manifest inside the archive, so the restore knows what is missing
        rather than discovering it during an emergency.

    Secrets are read from the repository .env and are never written to the log,
    never passed on a command line, and never echoed. The one exception is
    documented in docs/BACKUP.md: 7-Zip has no way to take a passphrase other
    than as an argument, so for the seconds the archive is being written the
    passphrase is visible to a process listing — which on this machine means
    visible to an administrator, who could read .env directly anyway.

.PARAMETER WhatIfUpload
    Do everything, including building and verifying the archive locally, but
    do not touch Google Drive. Use it to test changes to this script.

.NOTES
    Runs as SYSTEM under the scheduled task, so it must not depend on anything
    in a user profile — hence the explicit RCLONE_CONFIG below.
#>

[CmdletBinding()]
param(
    [switch]$WhatIfUpload
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

# --- where everything lives -------------------------------------------------

$RepoRoot   = 'C:\Users\Administrator\Desktop\Pickixo'
$WorkRoot   = 'C:\Pickixo\backup'
$LogDir     = 'C:\Pickixo\logs'
$ModelDir   = 'C:\Pickixo\models'
$NginxConf  = 'C:\tools\nginx-1.31.5\conf\nginx.conf'
$CertDir    = 'C:\ProgramData\win-acme\certs'
$PgBin      = 'C:\Pickixo\pgsql\bin'
$SevenZip   = 'C:\Program Files\7-Zip\7z.exe'
$Rclone     = 'C:\ProgramData\chocolatey\bin\rclone.exe'

$Remote          = 'gdrive:Pickixo-Backups'

# The whole retention policy. On a nightly schedule 60 archives is about 60 MB
# in Drive, and buys back the same two-month window the weekly schedule had:
# long enough that corruption noticed late can still be restored from before it
# happened. Shorten these and that window shortens with them; nothing else in
# this script depends on the numbers.
$KeepLocal       = 7     # archives kept on this disk — a week
$KeepRemote      = 60    # archives kept in Drive — two months of nights
$env:RCLONE_CONFIG = Join-Path $WorkRoot 'rclone.conf'

$Stamp      = Get-Date -Format 'yyyy-MM-dd'
$StageDir   = Join-Path $WorkRoot "staging\pickixo-$Stamp"
$OutDir     = Join-Path $WorkRoot 'archives'
$ArchiveName= "pickixo-$Stamp.7z"
$ArchivePath= Join-Path $OutDir $ArchiveName
$LogPath    = Join-Path $LogDir "backup-$Stamp.log"

# Collected as the run goes, written into the archive, and repeated at the end
# of the log. This is the list a restore has to be told about.
$script:Warnings = New-Object System.Collections.ArrayList

# --- logging ----------------------------------------------------------------

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $line = '{0} [{1}] {2}' -f (Get-Date -Format 'HH:mm:ss'), $Level, $Message
    Write-Output $line
    Add-Content -Path $LogPath -Value $line -Encoding utf8
}

function Add-Warning {
    param([string]$Message)
    [void]$script:Warnings.Add($Message)
    Write-Log $Message 'WARN'
}

function Invoke-Step {
    <#
        Runs a native command and fails loudly. The argument list is logged
        only when it is known to be free of secrets, which is why $Quiet
        exists: the 7-Zip call passes a passphrase and must never be echoed.

        $ErrorActionPreference is set to 'Continue' for the duration of the
        call, and only inside this function's own scope, so it never leaks to
        the caller. Without it, a script running under 'Stop' (as this one
        does) turns every line a native command writes to stderr into a
        terminating error the moment 2>&1 merges it into the output stream —
        so a merely informational line (rclone's shared client_id NOTICE, a
        pg_restore warning, ...) aborts the run even though the command itself
        exited 0. Real failure is judged below by $LASTEXITCODE, which this
        does not affect.
    #>
    param(
        [string]$What,
        [string]$Exe,
        [string[]]$Arguments,
        [switch]$Quiet,
        [switch]$AllowFailure
    )
    if ($Quiet) { Write-Log "$What ..." } else { Write-Log "$What ... ($Exe $($Arguments -join ' '))" }

    $ErrorActionPreference = 'Continue'
    $output = & $Exe @Arguments 2>&1
    $code = $LASTEXITCODE

    if ($code -ne 0) {
        $detail = ($output | Select-Object -Last 8) -join ' | '
        if ($AllowFailure) {
            Add-Warning "$What failed (exit $code): $detail"
            return $false
        }
        throw "$What failed (exit $code): $detail"
    }
    return $true
}

function Get-GitFact {
    <#
        Reads one fact out of git for the manifest, and never fails the run.

        This exists because it already cost a backup. Under the scheduled task
        the script runs as SYSTEM, and git refuses a repository owned by
        another user with "detected dubious ownership" — which, with
        $ErrorActionPreference = 'Stop', threw and aborted a backup whose
        database dump and source tree were already sitting complete on disk.
        A decoration in a manifest must never be able to do that.
    #>
    param([scriptblock]$Fact)
    try {
        $old = $ErrorActionPreference
        $ErrorActionPreference = 'SilentlyContinue'
        $value = & $Fact 2>$null
        $ErrorActionPreference = $old
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace("$value")) { return 'unavailable' }
        return ("$value").Trim()
    }
    catch { return 'unavailable' }
}

# --- secrets ----------------------------------------------------------------

function Get-EnvValue {
    <#
        Reads one KEY=value out of the repository .env.

        Returns the value and never logs it. A missing key is an error the
        caller decides about, because some are fatal (the passphrase) and some
        are not.
    #>
    param([string]$Key)
    $path = Join-Path $RepoRoot '.env'
    if (-not (Test-Path $path)) { throw "No .env at $path" }
    $line = Get-Content $path -Encoding utf8 | Where-Object { $_ -match "^\s*$([regex]::Escape($Key))\s*=" } | Select-Object -First 1
    if (-not $line) { return $null }
    $value = $line.Substring($line.IndexOf('=') + 1).Trim()
    if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    return $value
}

# --- the run ----------------------------------------------------------------

$started = Get-Date
New-Item -ItemType Directory -Force -Path $LogDir, $OutDir | Out-Null

Write-Log "=== pickixo backup $Stamp ==="

try {
    # -- preflight ----------------------------------------------------------
    #
    # Checked before anything is dumped, so a missing tool costs nothing but a
    # log line rather than leaving half an archive behind.

    $needed = @($SevenZip, (Join-Path $PgBin 'pg_dump.exe'))
    if (-not $WhatIfUpload) { $needed += $Rclone }
    foreach ($tool in $needed) {
        if (-not (Test-Path $tool)) { throw "Missing required tool: $tool" }
    }
    # Only required when we are actually going to Drive, so that the whole
    # pipeline can be tested with -WhatIfUpload before the account is connected.
    if (-not $WhatIfUpload -and -not (Test-Path $env:RCLONE_CONFIG)) {
        throw "No rclone config at $env:RCLONE_CONFIG — connect Drive as described in docs/BACKUP.md, then run again"
    }

    $passphrase = Get-EnvValue 'BACKUP_PASSPHRASE'
    if ([string]::IsNullOrWhiteSpace($passphrase)) {
        throw 'BACKUP_PASSPHRASE is not set in .env — refusing to write an unencrypted archive containing secrets'
    }

    $databaseUrl = Get-EnvValue 'DATABASE_URL'
    if ([string]::IsNullOrWhiteSpace($databaseUrl)) { throw 'DATABASE_URL is not set in .env' }

    $free = (Get-PSDrive -Name C).Free
    if ($free -lt 3GB) { throw ("Only {0:N1} GB free on C: — need at least 3 GB to stage a backup" -f ($free / 1GB)) }

    # -- staging ------------------------------------------------------------

    if (Test-Path $StageDir) { Remove-Item $StageDir -Recurse -Force }
    New-Item -ItemType Directory -Force -Path `
        (Join-Path $StageDir 'db'), (Join-Path $StageDir 'source'),
        (Join-Path $StageDir 'config'), (Join-Path $StageDir 'secrets') | Out-Null

    # -- 1. database --------------------------------------------------------
    #
    # Custom format (-Fc): compressed, and pg_restore can pull a single table
    # out of it without replaying the whole dump.

    $uri  = [uri]$databaseUrl
    $info = $uri.UserInfo -split ':', 2
    $pgUser = [uri]::UnescapeDataString($info[0])
    $pgPort = $uri.Port
    if ($pgPort -le 0) { $pgPort = 5432 }
    $pgDb = $uri.AbsolutePath.TrimStart('/')

    # Set in the process environment rather than on the command line, so the
    # password never appears in a process listing.
    $env:PGPASSWORD = [uri]::UnescapeDataString($info[1])
    try {
        Invoke-Step -What 'Dumping database' -Exe (Join-Path $PgBin 'pg_dump.exe') -Arguments @(
            '-h', $uri.Host, '-p', "$pgPort", '-U', $pgUser, '-d', $pgDb,
            '--format=custom', '--compress=9', '--no-owner',
            '--file', (Join-Path $StageDir 'db\pickixo.dump')
        ) | Out-Null

        # Role names and their grants. Needs superuser, which the application
        # role deliberately is not — so this is expected to fail here and the
        # restore doc explains how to recreate the roles by hand instead.
        Invoke-Step -What 'Dumping roles' -Exe (Join-Path $PgBin 'pg_dumpall.exe') -Arguments @(
            '-h', $uri.Host, '-p', "$pgPort", '-U', $pgUser,
            '--globals-only', '--no-role-passwords',
            '--file', (Join-Path $StageDir 'db\globals.sql')
        ) -AllowFailure | Out-Null
    }
    finally {
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }

    $dumpSize = (Get-Item (Join-Path $StageDir 'db\pickixo.dump')).Length
    if ($dumpSize -lt 10KB) { throw "Database dump is only $dumpSize bytes — that is not a real dump" }
    Write-Log ("Database dump: {0:N1} MB" -f ($dumpSize / 1MB))

    # -- 2. source tree -----------------------------------------------------
    #
    # .git is kept: it is half a megabyte and carries the history. What is
    # excluded is everything a build regenerates. The source has a git remote
    # now, but it only holds what was pushed — uncommitted work in this tree is
    # still unique to this machine, which is why the whole tree is archived.

    $excludeDirs = @('node_modules', '.next', '.venv', 'venv', '__pycache__',
                     '.tmp-test', 'out', 'dist', 'build', '.pytest_cache',
                     '.mypy_cache', '.ruff_cache', 'ort')
    $robocopyArgs = @(
        $RepoRoot, (Join-Path $StageDir 'source'), '/E', '/NFL', '/NDL', '/NJH', '/NJS',
        '/R:1', '/W:1', '/XD'
    ) + $excludeDirs
    & robocopy @robocopyArgs | Out-Null
    # robocopy uses exit codes as a bit field: < 8 means files were copied
    # and/or skipped, which is success. Only 8 and above are real failures.
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed copying the source tree (exit $LASTEXITCODE)" }

    $srcSize = (Get-ChildItem (Join-Path $StageDir 'source') -Recurse -File | Measure-Object Length -Sum).Sum
    Write-Log ("Source tree: {0:N1} MB" -f ($srcSize / 1MB))

    # -- 3. config ----------------------------------------------------------

    if (Test-Path $NginxConf) {
        Copy-Item $NginxConf (Join-Path $StageDir 'config\nginx.conf') -Force
    } else {
        Add-Warning "nginx.conf not found at $NginxConf"
    }

    # How the services are wired. Enough to rebuild them on a new machine.
    $svcLines = foreach ($name in @('Pickixo-Web', 'Pickixo-API', 'Pickixo-Postgres', 'Pickixo-Ollama', 'nginx')) {
        $svc = Get-CimInstance Win32_Service -Filter "Name='$name'" -ErrorAction SilentlyContinue
        if ($svc) { "{0}`t{1}`t{2}" -f $svc.Name, $svc.StartMode, $svc.PathName }
    }
    $svcLines | Set-Content (Join-Path $StageDir 'config\services.txt') -Encoding utf8

    # -- 4. secrets ---------------------------------------------------------
    #
    # Included at the operator's explicit instruction, and the only reason that
    # is defensible is the AES-256 step below. If encryption is ever removed,
    # this block must go with it.

    foreach ($secret in @(
        @{ From = (Join-Path $RepoRoot '.env');                To = 'secrets\.env' },
        @{ From = (Join-Path $RepoRoot 'apps\web\.env.local'); To = 'secrets\.env.local' }
    )) {
        if (Test-Path $secret.From) {
            Copy-Item $secret.From (Join-Path $StageDir $secret.To) -Force
        } else {
            Add-Warning ("secret file missing: {0}" -f $secret.From)
        }
    }

    if (Test-Path $CertDir) {
        $certTarget = Join-Path $StageDir 'secrets\certs'
        New-Item -ItemType Directory -Force -Path $certTarget | Out-Null
        Copy-Item (Join-Path $CertDir '*') $certTarget -Recurse -Force
    } else {
        Add-Warning "TLS certificate directory not found at $CertDir"
    }

    # The staged copy of .env is about to be encrypted, but it exists in the
    # clear on disk until then. Lock it down while it is there.
    $acl = Get-Acl $StageDir
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($who in @('SYSTEM', 'Administrators')) {
        $acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(
            $who, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
    }
    Set-Acl $StageDir $acl

    # -- 5. manifest --------------------------------------------------------

    $manifest = @(
        "pickixo.com backup",
        "taken          : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')",
        "host           : $env:COMPUTERNAME",
        "database       : $pgDb at $($uri.Host):$pgPort",
        "db dump bytes  : $dumpSize",
        "source bytes   : $srcSize",
        "postgres       : $((& (Join-Path $PgBin 'pg_dump.exe') --version) -join '')",
        "git HEAD       : $(Get-GitFact { & git -C $RepoRoot rev-parse --short HEAD })",
        "git dirty files: $(Get-GitFact { (& git -C $RepoRoot status --porcelain | Measure-Object).Count })",
        "",
        "contents",
        "  db/pickixo.dump   pg_restore --format=custom",
        "  db/globals.sql    role definitions, no passwords",
        "  source/           working tree incl. .git; no node_modules/.next/.venv/ort",
        "  config/           nginx.conf, service definitions",
        "  secrets/          .env, .env.local, TLS key pair",
        "",
        "NOT in this archive (rebuildable, and kept out to save space):",
        "  node_modules      npm ci",
        "  apps/web/.next    npm run build",
        "  apps/web/public/ort  npm run sync:ort",
        "  apps/api/.venv    pip install -r requirements.txt",
        "  models/*.onnx     synced separately to $Remote/assets/models",
        ""
    )
    if ($script:Warnings.Count -gt 0) {
        $manifest += 'WARNINGS - these parts are incomplete:'
        $manifest += ($script:Warnings | ForEach-Object { "  - $_" })
    } else {
        $manifest += 'No warnings: every part of this backup was written.'
    }
    $manifest | Set-Content (Join-Path $StageDir 'MANIFEST.txt') -Encoding utf8

    # -- 6. encrypt ---------------------------------------------------------
    #
    # -mhe=on encrypts the header too, so the archive does not leak its own
    # file listing. -p is the only way 7-Zip accepts a passphrase; see the
    # note at the top of this file.

    if (Test-Path $ArchivePath) { Remove-Item $ArchivePath -Force }
    Invoke-Step -What 'Encrypting archive' -Quiet -Exe $SevenZip -Arguments @(
        'a', '-t7z', '-mx=7', '-mhe=on', "-p$passphrase", '-bso0', '-bsp0',
        $ArchivePath, $StageDir
    ) | Out-Null

    $archiveSize = (Get-Item $ArchivePath).Length
    Write-Log ("Archive: {0} ({1:N1} MB)" -f $ArchiveName, ($archiveSize / 1MB))

    # Prove the archive can be read back with the passphrase we hold, before
    # the plaintext staging directory is deleted. An archive nobody has opened
    # is a guess, not a backup.
    Invoke-Step -What 'Verifying archive opens' -Quiet -Exe $SevenZip -Arguments @(
        't', "-p$passphrase", '-bso0', '-bsp0', $ArchivePath
    ) | Out-Null
    Write-Log 'Archive opens with the stored passphrase and passes its own integrity check'

    Remove-Item $StageDir -Recurse -Force
    Write-Log 'Plaintext staging directory removed'

    # -- 7. upload ----------------------------------------------------------

    $uploaded = $false
    if ($WhatIfUpload) {
        Write-Log 'WhatIfUpload: skipping Google Drive — this archive exists only on this machine' 'WARN'
    }
    else {
        Invoke-Step -What 'Uploading archive' -Exe $Rclone -Arguments @(
            'copy', $ArchivePath, "$Remote/archives", '--transfers', '1', '--retries', '3', '--stats-log-level', 'NOTICE'
        ) | Out-Null

        # Read it back and compare hashes. rclone check exits non-zero on any
        # difference, so this is the line that entitles the log to say the
        # backup is in Drive.
        Invoke-Step -What 'Verifying upload against Drive' -Exe $Rclone -Arguments @(
            'check', $OutDir, "$Remote/archives", '--include', $ArchiveName, '--one-way'
        ) | Out-Null
        Write-Log 'Upload verified: Drive holds a byte-identical copy'

        # The model never changes, so sync skips it after the first run.
        if (Test-Path $ModelDir) {
            Invoke-Step -What 'Syncing model assets' -Exe $Rclone -Arguments @(
                'sync', $ModelDir, "$Remote/assets/models", '--transfers', '1', '--retries', '3'
            ) | Out-Null
            Invoke-Step -What 'Verifying model assets' -Exe $Rclone -Arguments @(
                'check', $ModelDir, "$Remote/assets/models"
            ) | Out-Null
        }

        # -- 8. prune remote -------------------------------------------------
        $remoteFiles = & $Rclone lsjson "$Remote/archives" --files-only | ConvertFrom-Json
        $stale = $remoteFiles |
            Where-Object { $_.Name -like 'pickixo-*.7z' } |
            Sort-Object Name -Descending |
            Select-Object -Skip $KeepRemote
        foreach ($old in $stale) {
            Invoke-Step -What "Pruning remote $($old.Name)" -Exe $Rclone `
                -Arguments @('deletefile', "$Remote/archives/$($old.Name)") -AllowFailure | Out-Null
        }
        if (-not $stale) { Write-Log "Remote holds $(($remoteFiles | Measure-Object).Count) archives; nothing to prune" }
        $uploaded = $true
    }

    # -- 9. prune local -----------------------------------------------------

    Get-ChildItem $OutDir -Filter 'pickixo-*.7z' |
        Sort-Object Name -Descending |
        Select-Object -Skip $KeepLocal |
        ForEach-Object {
            Write-Log "Pruning local $($_.Name)"
            Remove-Item $_.FullName -Force
        }

    # -- done ---------------------------------------------------------------

    $elapsed = (Get-Date) - $started
    if ($script:Warnings.Count -gt 0) {
        Write-Log ("FINISHED WITH {0} WARNING(S) in {1:mm\:ss} — see MANIFEST.txt inside the archive" -f $script:Warnings.Count, $elapsed) 'WARN'
        foreach ($w in $script:Warnings) { Write-Log "  - $w" 'WARN' }
        exit 2
    }

    # Say what actually happened. "Verified in Drive" is only true when the
    # bytes were read back from Drive and matched, and a run that skipped the
    # upload has produced a local file and nothing more.
    if ($uploaded) {
        Write-Log ("OK — {0} ({1:N1} MB) uploaded and verified in Drive, in {2:mm\:ss}" -f $ArchiveName, ($archiveSize / 1MB), $elapsed)
    } else {
        Write-Log ("LOCAL ONLY — {0} ({1:N1} MB) built and opened successfully in {2:mm\:ss}, but NOT uploaded" -f $ArchiveName, ($archiveSize / 1MB), $elapsed) 'WARN'
    }
    exit 0
}
catch {
    Write-Log "FAILED: $($_.Exception.Message)" 'ERROR'
    Write-Log "at $($_.InvocationInfo.ScriptLineNumber): $($_.InvocationInfo.Line.Trim())" 'ERROR'
    # Never leave a readable copy of .env lying in staging after a failure.
    if (Test-Path $StageDir) {
        Remove-Item $StageDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Log 'Staging directory removed after failure'
    }
    exit 1
}
