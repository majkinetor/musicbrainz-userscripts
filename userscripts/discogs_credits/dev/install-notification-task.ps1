# Register a Windows Task Scheduler entry that runs
# `check-gh-notifications.ps1` every 10 minutes between 09:00 and 23:50
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

# Default: every 10 minutes from 09:00 to 23:50 local = 90 polls/day.
# Implemented as ONE daily trigger with a repetition pattern (not 90
# individual CalendarTrigger nodes — Task Scheduler XML rejects that many
# with "too many nodes of the same type").
$startTime   = '09:00'
$repeatEvery = New-TimeSpan -Minutes 10
$repeatFor   = New-TimeSpan -Hours 14 -Minutes 50   # 09:00 .. 23:50

# Build the daily trigger, then borrow the Repetition object from a
# transient -Once trigger (PowerShell's `New-ScheduledTaskTrigger -Daily`
# doesn't accept `-RepetitionInterval` directly).
$dailyTrigger  = New-ScheduledTaskTrigger -Daily -At $startTime
$repeatPattern = (New-ScheduledTaskTrigger -Once -At $startTime `
                    -RepetitionInterval $repeatEvery `
                    -RepetitionDuration $repeatFor).Repetition
$dailyTrigger.Repetition = $repeatPattern
$triggers = @($dailyTrigger)

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

Write-Host "Registered task '$taskName' -- 90 fires/day starting at $startTime local (every 10 min, ends 23:50)."
Write-Host "Inspect: schtasks /Query /TN `"$taskName`" /V /FO LIST"
Write-Host "Disable: schtasks /Change /TN `"$taskName`" /DISABLE"
Write-Host "Remove:  schtasks /Delete /TN `"$taskName`" /F"
