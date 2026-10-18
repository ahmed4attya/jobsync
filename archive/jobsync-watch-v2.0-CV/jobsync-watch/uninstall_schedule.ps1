# JobSync-Watch - remove scheduled task. ASCII-only.
Unregister-ScheduledTask -TaskName "JobSync-Watch 7AM" -Confirm:$false
Write-Host "[JobSync-Watch] scheduled task removed." -ForegroundColor Green
