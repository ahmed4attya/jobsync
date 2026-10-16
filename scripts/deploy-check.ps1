# deploy-check.ps1 - mandatory pre-push quality gate for JobSync
# Sequence: byte-level encoding check -> tsc -> full build -> git hygiene -> schema reminder
# ASCII-only on purpose (PowerShell 5.1 safe: no &&, no ternary, no backslash-quote).
# Exit 0 = GREEN (push allowed). Exit 1 = RED (NO PUSH).

$ErrorActionPreference = "Continue"
$failures = New-Object System.Collections.Generic.List[string]
$repo = Split-Path $PSScriptRoot -Parent
Set-Location $repo

Write-Host "=============================================="
Write-Host " GATE 1/5: byte-level encoding check (changed text files)"
Write-Host "=============================================="

$committed = @(git diff --name-only main...HEAD 2>$null)
$dirty     = @(git diff --name-only 2>$null)
$untracked = @(git ls-files --others --exclude-standard 2>$null)
$changed = @($committed) + @($dirty) + @($untracked) |
    Where-Object { $_ -match '\.(ts|tsx|mjs|js|css|json|md|ps1|prisma|ya?ml|sh)$' } |
    Sort-Object -Unique

if ($changed.Count -eq 0) {
    Write-Host "PASS-G1: no changed text files to scan"
} else {
    Write-Host ("scanning " + $changed.Count + " changed text file(s)...")
    # mojibake needles as characters (double-encoded Arabic artifacts)
    $needleAr = [string][char]0x0637 + [string][char]0x00A7   # U+0637 U+00A7  ("ta"+"section sign")
    $needleLa = [string][char]0x00D8 + [string][char]0x00A7   # U+00D8 U+00A7  ("O-stroke"+"section sign")
    $bomAllowed = '\.(ps1|md)$'
    foreach ($f in $changed) {
        $full = Join-Path $repo $f
        if (-not (Test-Path -LiteralPath $full)) { continue }
        $b = [System.IO.File]::ReadAllBytes($full)
        if ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF) {
            if ($f -notmatch $bomAllowed) { $failures.Add("G1 BOM in source file: $f") ; Write-Host "FAIL-G1: BOM found in $f" }
        }
        $text = [System.Text.Encoding]::UTF8.GetString($b)
        if ($text.Contains($needleAr)) { $failures.Add("G1 mojibake in: $f") ; Write-Host "FAIL-G1: mojibake pattern found in $f" }
        if ($text.Contains($needleLa)) { $failures.Add("G1 mojibake in: $f") ; Write-Host "FAIL-G1: mojibake pattern found in $f" }
    }
    if ($failures.Count -eq 0) { Write-Host "PASS-G1: encoding clean (no BOM in code files, no mojibake)" }
}

Write-Host "=============================================="
Write-Host " GATE 2/5: npx tsc --noEmit"
Write-Host "=============================================="
$tscOut = npx tsc --noEmit 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    $failures.Add("G2 tsc failed")
    Write-Host "FAIL-G2: tsc errors:"
    Write-Host ($tscOut.TrimEnd())
} else {
    Write-Host "PASS-G2: tsc clean"
}

Write-Host "=============================================="
Write-Host " GATE 3/5: npm run build (full build)"
Write-Host "=============================================="
$buildOut = npm run build 2>&1 | Out-String
$buildTail = ($buildOut -split "`n") | Select-Object -Last 25
if ($LASTEXITCODE -ne 0) {
    $failures.Add("G3 build failed")
    Write-Host "FAIL-G3: build failed. Last output lines:"
    $buildTail | ForEach-Object { Write-Host $_ }
} else {
    Write-Host "PASS-G3: build succeeded. Last output lines:"
    $buildTail | ForEach-Object { Write-Host $_ }
}

Write-Host "=============================================="
Write-Host " GATE 4/5: git hygiene"
Write-Host "=============================================="
$porcelain = (git status --porcelain) -join "`n"
$branch = (git branch --show-current)
if ($branch -eq "main") {
    $failures.Add("G4 on main branch")
    Write-Host "FAIL-G4: currently on main - refuse push from main"
}
if ($porcelain.Trim().Length -gt 0) {
    $failures.Add("G4 dirty worktree")
    Write-Host "FAIL-G4: git status not clean (uncommitted or untracked files):"
    Write-Host $porcelain
} else {
    Write-Host "PASS-G4: worktree clean, branch='$branch'"
}

Write-Host "=============================================="
Write-Host " GATE 5/5: schema sync reminder"
Write-Host "=============================================="
$schemaTs  = git log -1 --format=%ct -- prisma/schema.prisma 2>$null
$migrTs    = git log -1 --format=%ct -- prisma/migrations/ 2>$null
if ($schemaTs -and $migrTs -and ([long]$schemaTs -gt [long]$migrTs)) {
    Write-Host "REMINDER-G5: prisma/schema.prisma changed AFTER last migration commit."
    Write-Host "  -> If models changed, apply locally + sync via documented migration flow (backup first)."
} else {
    Write-Host "PASS-G5: no schema-after-migration drift detected"
}

Write-Host "=============================================="
if ($failures.Count -eq 0) {
    Write-Host "GREEN: deploy-check PASSED (encoding + tsc + build + git hygiene). Push allowed."
    exit 0
} else {
    Write-Host "RED: deploy-check FAILED - NO PUSH. Failures:"
    $failures | ForEach-Object { Write-Host (" - " + $_) }
    exit 1
}
