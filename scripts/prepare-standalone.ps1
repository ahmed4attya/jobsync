$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
$standalone = Join-Path $root ".next\standalone"

Write-Host "Preparing Next.js standalone package..." -ForegroundColor Cyan

$nextStatic = Join-Path $root ".next\static"
$standaloneNext = Join-Path $standalone ".next"
$standaloneStatic = Join-Path $standaloneNext "static"

if (-not (Test-Path $nextStatic)) {
    throw ".next/static was not found. Run npm run build first."
}

New-Item -ItemType Directory -Force $standaloneNext | Out-Null

if (Test-Path $standaloneStatic) {
    Remove-Item $standaloneStatic -Recurse -Force
}

Copy-Item $nextStatic $standaloneStatic -Recurse -Force

Write-Host "Copied .next/static" -ForegroundColor Green

$public = Join-Path $root "public"
$standalonePublic = Join-Path $standalone "public"

if (Test-Path $public) {
    if (Test-Path $standalonePublic) {
        Remove-Item $standalonePublic -Recurse -Force
    }

    Copy-Item $public $standalonePublic -Recurse -Force

    Write-Host "Copied public" -ForegroundColor Green
}
else {
    Write-Host "No public directory found. Skipping public." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Standalone package is ready." -ForegroundColor Green
