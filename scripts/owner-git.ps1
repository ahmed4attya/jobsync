<#
.SYNOPSIS
  Owner Git Workflow Script (DEC-010).
  Must be executed by the Owner in a native host terminal (outside the harness).
.PARAMETER Message
  The mandatory commit message.
.PARAMETER Files
  Optional array of file paths to stage explicitly by name.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Message,

  [Parameter(Mandatory = $false)]
  [string[]]$Files
)

$ErrorActionPreference = "Stop"

# Forbidden patterns check
$forbidden = @("_private", "jobsyncdb", "MEMORY.md", "doc")

if ($Files -and $Files.Count -gt 0) {
  foreach ($f in $Files) {
    foreach ($bad in $forbidden) {
      if ($f -match [regex]::Escape($bad)) {
        throw "BLOCKED: Path '$f' contains forbidden pattern '$bad'. Do not commit private/internal files."
      }
    }
  }
}

Write-Host "=== Step 1: Pre-commit git status ===" -ForegroundColor Cyan
git status --short

if ($Files -and $Files.Count -gt 0) {
  Write-Host "=== Step 2: Staging explicit files ===" -ForegroundColor Cyan
  foreach ($f in $Files) {
    Write-Host "Adding: $f"
    git add -- $f
  }
} else {
  Write-Host "No explicit files passed. Committing already staged changes if any." -ForegroundColor Yellow
}

Write-Host "=== Step 3: Git Commit ===" -ForegroundColor Cyan
git commit -m $Message

Write-Host "=== Step 4: Push to origin feat/local-saudi-career-upgrade ===" -ForegroundColor Cyan
git push origin feat/local-saudi-career-upgrade

Write-Host "=== Step 5: Fetch and verify tracking ref ===" -ForegroundColor Cyan
git fetch origin
git branch -vv

Write-Host "=== Step 6: Recent commits ===" -ForegroundColor Cyan
git log --oneline -3

Write-Host "SUCCESS: Owner git workflow complete." -ForegroundColor Green
