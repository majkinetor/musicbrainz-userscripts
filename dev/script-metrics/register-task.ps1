<#
.SYNOPSIS
  Register (or re-register) the Windows scheduled task that runs the metrics
  pipeline twice a week.

.DESCRIPTION
  The task itself lives in Windows Task Scheduler, not in the repo, so this file
  is the record of how it is meant to be defined. Run it to recreate the task on
  a new machine, or after changing the schedule.

  .\register-task.ps1
  .\register-task.ps1 -RunNow      # register, then start it once to prove it works

.NOTES
  ⚠ -Execute MUST be an absolute path.

  The first version of this task used 'powershell.exe' bare. Task Scheduler
  launched it and got 2147942401 (0x80070002, "the system cannot find the file
  specified") — CreateProcess could not resolve it in the task's context. Both
  scheduled firings failed that way, and because the process never started, the
  script's own logging could not record anything: the failure was visible only
  in the Task Scheduler event log, as a task that "successfully completed" with
  a non-zero return code.

  The lesson is about what was tested. scheduled-run.ps1 had been run directly
  and worked; the TASK had never been started. Registering a task and not
  running it is not a test of the task.
#>
[CmdletBinding()]
param([switch] $RunNow)

$ErrorActionPreference = 'Stop'

$script = Join-Path $PSScriptRoot 'scheduled-run.ps1'
if (-not (Test-Path $script)) { throw "not found: $script" }

# absolute, for the reason in .NOTES — pwsh if present, else Windows PowerShell
$exe = if (Test-Path 'C:\Program Files\PowerShell\7\pwsh.exe') { 'C:\Program Files\PowerShell\7\pwsh.exe' }
       else { 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' }

$action = New-ScheduledTaskAction -Execute $exe `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`"" `
    -WorkingDirectory $PSScriptRoot

# Wednesday and Saturday, 23:30 local. MusicBrainz's fullexport runs 00:21-04:50
# UTC (02:21-06:50 local) on those mornings, so by 23:30 the dump is ~17 hours
# old and complete. See scheduled-run.ps1's .NOTES for the measurements.
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Wednesday, Saturday -At 11:30PM

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 8) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName 'mb-script-metrics' -Action $action -Trigger $trigger -Settings $settings `
    -Description 'Rebuild the MusicBrainz script-metrics dashboard from the latest fullexport. Wed/Sat 23:30 local. Needs Docker running. Logs: dev\script-metrics\logs\' `
    -Force | Out-Null

$t = Get-ScheduledTask -TaskName 'mb-script-metrics'
Write-Host "registered: $($t.TaskName) [$($t.State)]" -ForegroundColor Green
Write-Host "  exec : $($t.Actions[0].Execute)"
Write-Host "  next : $((Get-ScheduledTaskInfo -TaskName 'mb-script-metrics').NextRunTime)"

if ($RunNow) {
    Write-Host 'starting it once — a registered task that has never run is not a tested task' -ForegroundColor Yellow
    Start-ScheduledTask -TaskName 'mb-script-metrics'
    Start-Sleep -Seconds 10
    $info = Get-ScheduledTaskInfo -TaskName 'mb-script-metrics'
    # 267009 = 0x41301, "task is currently running" — the expected result here
    Write-Host "  lastResult: $($info.LastTaskResult)$(if ($info.LastTaskResult -eq 267009) { '  (running)' })"
    Write-Host "  check dev\script-metrics\logs\ for this run's log"
}
