# JobSync-Watch v1.1 - install scheduled task: daily at 07:00 (machine local time)
# DEC-011: run this BY HAND in a NORMAL PowerShell window (owner's finger).
#   The local coding agent's sandbox must NOT run this file (proven to hang/loop there).
# SAFETY: verifies a REAL Python first (rejects Microsoft Store stub), replaces any
#   existing task cleanly (idempotent - no duplicate tasks, no re-trigger storms).
$ErrorActionPreference = "Stop"
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

# ---- verify real python BEFORE registering anything
$py = $null
foreach ($cand in @("py", "python")) {
    $cmd = Get-Command $cand -ErrorAction SilentlyContinue
    if (-not $cmd) { continue }
    if ($cmd.Source -like "*WindowsApps*") { Write-Host "skip stub: $cand" -ForegroundColor Yellow; continue }
    $v = & $cand --version 2>$null
    if ("$v" -match "^Python 3") { $py = $cand; break }
}
if (-not $py) {
    Write-Host "NO working Python 3 found. Install from https://www.python.org (tick 'Add to PATH') and run this again." -ForegroundColor Red
    exit 2
}
Write-Host "Python OK: $py -> $(& $py --version)"

# ---- pick host PowerShell
$ps = $null
foreach ($cand in @("pwsh", "powershell")) {
    if (Get-Command $cand -ErrorAction SilentlyContinue) { $ps = (Get-Command $cand).Source; break }
}

# ---- idempotent task registration (replace, never duplicate)
$existing = Get-ScheduledTask -TaskName "JobSync-Watch 7AM" -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Existing task found - replacing it (no duplicates)." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName "JobSync-Watch 7AM" -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute $ps `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$dir\run_watch.ps1`"" `
    -WorkingDirectory $dir
$trigger = New-ScheduledTaskTrigger -Daily -At 07:00
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 15) `
    -MultipleInstances IgnoreNew   # <-- hard guard: never run two copies at once

Register-ScheduledTask -TaskName "JobSync-Watch 7AM" `
    -Action $action -Trigger $trigger -Settings $settings `
    -Description "Daily Saudi Arabia jobs report (read-only whitelist sources; no auto-apply)" -Force | Out-Null

# ---- live verification (rule 7: no success before live proof)
$t = Get-ScheduledTask -TaskName "JobSync-Watch 7AM"
$info = $t | Get-ScheduledTaskInfo
Write-Host ""
Write-Host "Task registered:  '$($t.TaskName)'  State: $($t.State)" -ForegroundColor Green
Write-Host ("Next run:         {0} (07:00 machine local time)" -f $info.NextRunTime)
Write-Host "NOTE: removed -StartWhenAvailable on purpose; MultipleInstances=IgnoreNew + lock file = no loops."
Write-Host "Test now by hand:  powershell -ExecutionPolicy Bypass -File .\run_watch.ps1"
Write-Host "Emergency stop:    powershell -ExecutionPolicy Bypass -File .\STOP-LOOP.ps1"
