# JobSync-Watch v1.1 - EMERGENCY STOP (one shot, safe to run anytime)
# 1) disables the 7AM scheduled task   2) creates the kill-switch flag   3) ends any running agent.py
# ASCII-only. Run BY HAND in a normal PowerShell window.
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$state = Join-Path $dir "state"
New-Item -ItemType Directory -Force -Path $state | Out-Null

$task = Get-ScheduledTask -TaskName "JobSync-Watch 7AM" -ErrorAction SilentlyContinue
if ($task) {
    Disable-ScheduledTask -TaskName "JobSync-Watch 7AM" | Out-Null
    Write-Host "[STOP] scheduled task DISABLED (not deleted - re-enable via Task Scheduler GUI or reinstall)." -ForegroundColor Green
} else {
    Write-Host "[STOP] no scheduled task found." -ForegroundColor DarkGray
}

"disabled $(Get-Date -Format o)" | Out-File (Join-Path $state "disabled.flag") -Encoding utf8
Write-Host "[STOP] kill switch created: state\disabled.flag" -ForegroundColor Green

Get-CimInstance Win32_Process -Filter "Name='python.exe' or Name='py.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*agent.py*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host "[STOP] ended agent.py process $($_.ProcessId)" -ForegroundColor Green }

Remove-Item (Join-Path $state "watch.lock") -Force -ErrorAction SilentlyContinue
Write-Host "[STOP] lock cleared. Everything is now quiet."
Write-Host "To re-enable later: delete state\disabled.flag, then Enable-ScheduledTask -TaskName 'JobSync-Watch 7AM'"
