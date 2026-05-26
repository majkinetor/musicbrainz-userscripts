# Register a Windows Task Scheduler entry that runs
# `check-gh-notifications.ps1` every 10 minutes between 12:00 and 23:50
# local time. Polling is essentially free (no Anthropic tokens consumed
# unless an event actually reaches Claude), so the cadence is generous.
#
# Adjust `$startMinutes` and `$hourRange` below to change.
#
# Run once, from any PowerShell prompt:
#   powershell -ExecutionPolicy Bypass -File dev/install-notification-task.ps1
#
# Uninstall:
#   schtasks /Delete /TN "MB-Userscripts notif poller" /F

$ErrorActionPreference = 'Stop'

$here       = Split-Path -Parent $MyInvocation.MyCommand.Path
$pollerPath = (Resolve-Path (Join-Path $here 'check-gh-notifications.ps1')).Path
$taskName   = 'MB-Userscripts notif poller'

# Default: every 10 minutes from 12:00 to 23:50 local = 72 polls/day.
$startMinutes = @(2, 12, 22, 32, 42, 52)
$hourRange    = 12..23
$startTimes   = foreach ($h in $hourRange) {
    foreach ($m in $startMinutes) {
        (Get-Date -Hour $h -Minute $m -Second 0).ToString('HH:mm')
    }
}

$triggers = foreach ($t in $startTimes) {
    New-ScheduledTaskTrigger -Daily -At $t
}

$action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$pollerPath`""

$principal = New-ScheduledTaskPrincipal `
    -UserId  ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

Register-ScheduledTask `
    -TaskName    $taskName `
    -Description 'Polls GitHub for new mb-userscripts notifications and POSTs actionable threads to the local notif-channel MCP server.' `
    -Trigger     $triggers `
    -Action      $action `
    -Principal   $principal `
    -Settings    $settings | Out-Null

Write-Host "Registered task '$taskName' -- $($startTimes.Count) fires/day starting at $($startTimes[0]) local."
Write-Host "Inspect: schtasks /Query /TN `"$taskName`" /V /FO LIST"
Write-Host "Disable: schtasks /Change /TN `"$taskName`" /DISABLE"
Write-Host "Remove:  schtasks /Delete /TN `"$taskName`" /F"
