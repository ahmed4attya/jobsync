# scripts/watch/run_ingest.ps1
# DEC-011: Runs the snapshot ingestion into JobSync SQLite Job table
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)

Set-Location $ProjectRoot

# TTL Lock guard
$LockFile = Join-Path $ProjectRoot "state\ingest.lock"
if (Test-Path $LockFile) {
    $age = (Get-Date) - (Get-Item $LockFile).LastWriteTime
    if ($age.TotalMinutes -lt 15) {
        Write-Host "[Watch-Ingest] Skipped: lock file active ($([math]::Round($age.TotalMinutes, 1))m ago)"
        exit 0
    }
}

Set-Content -Path $LockFile -Value (Get-Date).ToString("o")

try {
    node "$ProjectRoot\scripts\ingest-watch.js"
} finally {
    if (Test-Path $LockFile) {
        Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
    }
}
