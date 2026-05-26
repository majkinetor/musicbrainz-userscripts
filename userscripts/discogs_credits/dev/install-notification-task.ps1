# Register a Windows Task Scheduler entry that runs
# `check-gh-notifications.ps1` once per hour at minute 7, from 12:00 to
# 23:00 local time — 12 polls per day inside the maintainer's working
# window (matches the cadence originally asked for the Claude-side cron,
# now moved out of Claude). External polling is essentially free, so
# you can crank this higher (every 30 / 15 / 5 min) by editing the
# `$startMinutes` list below.
#
# Run once, from an *elevated* PowerShell prompt:
#   powershell -ExecutionPolicy Bypass -File dev/install-notification-task.ps1
#
# Uninstall:
#   schtasks /Delete /TN "MB-Userscripts notif poller" /F

$ErrorActionPreference = 'Stop'

$here       = Split-Path -Parent $MyInvocation.MyCommand.Path
$pollerPath = (Resolve-Path (Join-Path $here 'check-gh-notifications.ps1')).Path
$taskName   = 'MB-Userscripts notif poller'

# Triggers: fire at the listed minutes of each hour from 12:00 to 23:00.
# Default is minute 7 only → 12 polls/day. Crank by adding minutes,
# e.g. @(7, 22, 37, 52) → 4×/hour × 12h = 48 polls/day.
$startMinutes = @(7)
$hourRange    = 12..23
$startTimes   = foreach ($h in $hourRange) {
    foreach ($m in $startMinutes) {
        (Get-Date -Hour $h -Minute $m -Second 0).ToString('HH:mm')
    }
}

# Register-ScheduledTask only takes ONE start time per trigger but accepts
# multiple triggers. Build one DailyTrigger per start time.
$triggers = foreach ($t in $startTimes) {
    New-ScheduledTaskTrigger -Daily -At $t
}

# Action: run the poller in hidden PowerShell.
$action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$pollerPath`""

# Run as the current user, regardless of logon state. No elevation needed
# (we don't touch protected system state).
$principal = New-ScheduledTaskPrincipal `
    -UserId  ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited

# Settings: don't run if the laptop's on battery saver, allow start when
# missed (so a quick lid-close-open doesn't lose polls), kill after 5 min
# (the poller is ~2 s normally — 5 min is a generous ceiling).
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

# Replace any prior registration.
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

Register-ScheduledTask `
    -TaskName    $taskName `
    -Description 'Polls GitHub for new mb-userscripts notifications and shows a Windows toast.' `
    -Trigger     $triggers `
    -Action      $action `
    -Principal   $principal `
    -Settings    $settings | Out-Null

Write-Host "Registered task '$taskName' — $($startTimes.Count) fires/day starting at $($startTimes[0]) local."
Write-Host "Inspect: schtasks /Query /TN `"$taskName`" /V /FO LIST"
Write-Host "Disable: schtasks /Change /TN `"$taskName`" /DISABLE"
Write-Host "Remove:  schtasks /Delete /TN `"$taskName`" /F"
