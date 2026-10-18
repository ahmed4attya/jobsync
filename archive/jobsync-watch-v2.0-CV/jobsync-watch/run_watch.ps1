# JobSync-Watch v1.1 - daily runner (Windows) - anti-loop hardened
# SAFETY SYSTEMS:
#   [1] Lock file: prevents concurrent/duplicate runs (TTL 20 min) -> kills any "run storm"
#   [2] Kill switch: create file state\disabled.flag -> this script exits silently
#   [3] Python verification: rejects the fake Windows Store python stub (no dialog loops)
#   [4] Browser reopen guard: report opens at most once per 10 minutes
#   [5] Hard bound: every network call has a timeout; no unbounded waiting
# Run BY HAND in a NORMAL PowerShell window (DEC-011) or by the 7AM scheduled task.
$ErrorActionPreference = "Continue"
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$state = Join-Path $dir "state"
New-Item -ItemType Directory -Force -Path $state | Out-Null

# [2] kill switch
if (Test-Path (Join-Path $state "disabled.flag")) {
    Write-Host "[JobSync-Watch] DISABLED via state\disabled.flag - delete that file to re-enable." -ForegroundColor Yellow
    exit 0
}

# [1] single-run lock (TTL 20 minutes)
$lock = Join-Path $state "watch.lock"
if (Test-Path $lock) {
    $age = (Get-Date) - (Get-Item $lock).LastWriteTime
    if ($age.TotalMinutes -lt 20) {
        Write-Host ("[JobSync-Watch] a run started {0:n0} min ago is considered active - exiting (anti-loop lock)." -f $age.TotalMinutes) -ForegroundColor Yellow
        exit 0
    }
    Remove-Item $lock -Force
}
"started $(Get-Date -Format o)" | Out-File $lock -Encoding utf8

try {
    # [3] real python verification (rejects WindowsApps stub)
    $py = $null
    foreach ($cand in @("py", "python")) {
        $cmd = Get-Command $cand -ErrorAction SilentlyContinue
        if (-not $cmd) { continue }
        if ($cmd.Source -like "*WindowsApps*") {
            Write-Host "[JobSync-Watch] '$cand' is the Microsoft Store STUB (no real Python). Skipping it." -ForegroundColor Yellow
            continue
        }
        $v = & $cand --version 2>$null
        if ("$v" -match "^Python 3") { $py = $cand; break }
    }
    if (-not $py) {
        Write-Host "[JobSync-Watch] NO working Python 3 found. Install from https://www.python.org (tick 'Add to PATH'), then run again." -ForegroundColor Red
        exit 2
    }

    Write-Host "[JobSync-Watch] running agent with $py (bounded run: 9 sources, hard timeouts)..." -ForegroundColor Cyan
    & $py (Join-Path $dir "agent.py")
    $code = $LASTEXITCODE

    # [4] open the freshest report at most once per 10 minutes
    $reportsDir = Join-Path $dir "reports"
    $today = Get-Date -Format "yyyy-MM-dd"
    $report = Join-Path $reportsDir ("report_{0}.html" -f $today)
    if (-not (Test-Path $report)) {
        $latest = Get-ChildItem $reportsDir -Filter "report_*.html" -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($latest) { $report = $latest.FullName }
    }
    if (Test-Path $report) {
        $stamp = Join-Path $state "last_open.txt"
        $ok = $true
        if (Test-Path $stamp) {
            $age = (Get-Date) - (Get-Item $stamp).LastWriteTime
            if ($age.TotalMinutes -lt 10) { $ok = $false }
        }
        if ($ok) {
            "opened $(Get-Date -Format o)" | Out-File $stamp -Encoding utf8
            Write-Host "[JobSync-Watch] opening report (once per 10 min max): $report" -ForegroundColor Green
            Start-Process $report
        } else {
            Write-Host "[JobSync-Watch] report exists but was opened <10 min ago - not reopening (anti-storm guard)." -ForegroundColor DarkGray
        }
    }
    if ($code -ne 0) {
        Write-Host "[JobSync-Watch] agent exit code: $code (report may still be usable - rule 8)." -ForegroundColor Yellow
        exit $code
    }
}
finally {
    Remove-Item $lock -Force -ErrorAction SilentlyContinue
}
