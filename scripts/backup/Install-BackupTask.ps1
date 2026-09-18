<#
.SYNOPSIS
    One-time setup for the weekly pickixo.com backup.

.DESCRIPTION
    Creates the working directory, locks it to SYSTEM and Administrators,
    generates the archive passphrase if there is not one already, and registers
    the scheduled task for 02:00 every Friday.

    It deliberately does NOT connect Google Drive. That step signs you into a
    Google account, so it is yours to do — this script prints the exact command
    at the end.

    Safe to run again: an existing passphrase is never replaced (doing so would
    orphan every archive already in Drive), and the task is updated in place.

.NOTES
    Run from an elevated PowerShell.
#>

[CmdletBinding()]
param(
    [string]$RepoRoot = 'C:\Users\Administrator\Desktop\Pickixo',
    [string]$WorkRoot = 'C:\Pickixo\backup',
    [string]$RunAt    = '02:00'
)

$ErrorActionPreference = 'Stop'

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
        ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this from an elevated PowerShell — it registers a scheduled task and sets directory permissions.'
}

$script = Join-Path $RepoRoot 'scripts\backup\Backup-Pickixo.ps1'
if (-not (Test-Path $script)) { throw "Backup script not found at $script" }

# --- 1. working directory, locked down --------------------------------------
#
# The staging area briefly holds a plaintext copy of .env and the TLS private
# key, and rclone.conf holds the Drive refresh token. Neither should be
# readable by anything but SYSTEM and an administrator.

New-Item -ItemType Directory -Force -Path $WorkRoot, (Join-Path $WorkRoot 'archives'), 'C:\Pickixo\logs' | Out-Null

$acl = Get-Acl $WorkRoot
$acl.SetAccessRuleProtection($true, $false)   # stop inheriting Users
foreach ($rule in @($acl.Access)) { [void]$acl.RemoveAccessRule($rule) }
foreach ($who in @('NT AUTHORITY\SYSTEM', 'BUILTIN\Administrators')) {
    $acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(
        $who, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
}
Set-Acl $WorkRoot $acl
Write-Output "Working directory ready and restricted: $WorkRoot"

# --- 2. passphrase ----------------------------------------------------------
#
# 32 random bytes, base64. Written straight into .env and never printed: the
# only place it exists is that file, which is exactly why it has to be copied
# into a password manager by hand.

$envPath = Join-Path $RepoRoot '.env'
if (-not (Test-Path $envPath)) { throw "No .env at $envPath" }

$existing = Get-Content $envPath -Encoding utf8 | Where-Object { $_ -match '^\s*BACKUP_PASSPHRASE\s*=\s*\S' }
if ($existing) {
    Write-Output 'BACKUP_PASSPHRASE already set in .env — left untouched.'
    Write-Output '  (Changing it would make every archive already in Drive unopenable.)'
}
else {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $generated = [Convert]::ToBase64String($bytes)

    $block = @(
        '',
        '# --- backup ----------------------------------------------------------------',
        '# Encrypts the weekly Google Drive archive (7-Zip, AES-256, encrypted headers).',
        '# The archive contains this .env and the TLS private key, so this passphrase is',
        '# the only thing standing between a copied archive and every secret here.',
        '#',
        '# Store it in a password manager NOW. It exists nowhere else: if this machine',
        '# dies and you do not have it, every backup in Drive is permanently unopenable.',
        '# Changing it does not re-encrypt old archives — they stay on the old one.',
        ("BACKUP_PASSPHRASE=$generated")
    )
    Add-Content -Path $envPath -Value $block -Encoding utf8
    Remove-Variable generated, bytes

    Write-Output 'BACKUP_PASSPHRASE generated and written to .env.'
    Write-Output '  >> Open .env, copy the value into your password manager, and do it before Friday. <<'
}

# --- 3. scheduled task ------------------------------------------------------
#
# Runs as SYSTEM: a task that runs whether or not anyone is logged in would
# otherwise need a stored account password, and SYSTEM needs none. That is also
# why the backup script points RCLONE_CONFIG at C:\Pickixo\backup rather than
# using the per-user default under AppData.

$taskName = 'Pickixo Weekly Backup'

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument (
    '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}"' -f $script)

$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Friday -At $RunAt

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -MultipleInstances IgnoreNew `
    -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 30)

$principal = New-ScheduledTaskPrincipal -UserId 'NT AUTHORITY\SYSTEM' -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal -Force `
    -Description 'Dumps the pickixo database, source tree, config and secrets into one AES-256 archive and uploads it to Google Drive. See docs/BACKUP.md.' | Out-Null

$next = (Get-ScheduledTask -TaskName $taskName | Get-ScheduledTaskInfo).NextRunTime
Write-Output "Scheduled task registered: '$taskName'"
Write-Output "  Next run: $next"

# --- 4. what is left for a human --------------------------------------------

$rcloneConf = Join-Path $WorkRoot 'rclone.conf'
if (Test-Path $rcloneConf) {
    Write-Output ''
    Write-Output 'Google Drive is already connected. Setup is complete.'
}
else {
    Write-Output ''
    Write-Output '--------------------------------------------------------------------'
    Write-Output 'One step left, and it has to be you: signing in to Google.'
    Write-Output ''
    Write-Output 'Run this in an elevated PowerShell, choose "n" for new remote, name'
    Write-Output 'it exactly  gdrive , pick Google Drive, accept the blank client id'
    Write-Output 'and secret, choose scope 1 (full access), then let it open a browser'
    Write-Output 'and sign in as monjurhye@gmail.com:'
    Write-Output ''
    Write-Output '    $env:RCLONE_CONFIG = "' + $rcloneConf + '"; rclone config'
    Write-Output ''
    Write-Output 'Then check it and run the first backup by hand:'
    Write-Output ''
    Write-Output '    $env:RCLONE_CONFIG = "' + $rcloneConf + '"; rclone lsd gdrive:'
    Write-Output '    powershell -ExecutionPolicy Bypass -File "' + $script + '"'
    Write-Output '--------------------------------------------------------------------'
}
