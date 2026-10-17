# scripts/watch/install_schedule_ingest.ps1
# DEC-011: Registers JobSync-Watch-Ingest to run daily at 07:10 AM
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)

$TaskName = "JobSync-Watch-Ingest"
$Runner = Join-Path $ScriptDir "run_ingest.ps1"

Write-Host "Registering Scheduled Task: $TaskName..."

$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Runner`""
$Trigger = New-ScheduledTaskTrigger -Daily -At "07:10AM"
$Settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

try {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Ingests daily JobSync-Watch jobs into database at 7:10 AM" | Out-Null
    Write-Host "[OK] Task '$TaskName' registered successfully for 07:10 AM."
} catch {
    Write-Error "Failed to register task: $_"
}
