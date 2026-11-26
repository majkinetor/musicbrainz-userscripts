# Starts the emulator from setup.ps1, waits until Android has booted, and installs Firefox when it is missing.
# -Window shows the emulator's window, -Wipe starts from a clean device, -Sound plays through the PC's speakers,
# -Restart stops a running emulator first.
param([switch]$Window, [switch]$Wipe, [switch]$Sound, [switch]$Restart)
$ErrorActionPreference = 'Stop'

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$avd = if ($env:EH_AVD) { $env:EH_AVD } else { 'eh-firefox' }
$adb = "$sdk\platform-tools\adb.exe"
$cache = Join-Path $PSScriptRoot '.cache'

$running = (& $adb devices) -match '^emulator-\d+\s+device'
if ($running -and $Restart) {
  Write-Host 'stop the running emulator'
  & $adb emu kill | Out-Null
  while ((& $adb devices) -match '^emulator-\d+') { Start-Sleep 1 }
  $running = $false
}
if (-not $running) {
  # no host sound device by default: on a PC without one (a remote session) the emulator floods its log with
  # DirectSound errors and stalls Android's audio and screen capture. -Sound plays through the PC's speakers.
  $opt = @('-avd', $avd, '-gpu', 'swiftshader_indirect', '-no-boot-anim', '-audio', $(if ($Sound) { 'default' } else { 'none' }))
  if (-not $Window) { $opt += '-no-window' }
  if ($Wipe) { $opt += '-wipe-data' }
  Start-Process "$sdk\emulator\emulator.exe" -ArgumentList $opt -WindowStyle Hidden `
    -RedirectStandardOutput "$cache\emulator.log" -RedirectStandardError "$cache\emulator.err"
  Write-Host 'waiting for the device'
  & $adb wait-for-device
  while ((& $adb shell getprop sys.boot_completed 2>$null) -ne '1') { Start-Sleep 2 }
}
Write-Host 'booted'
# the screen stays on while the device charges (the emulator always does), so only a test turns it off
& $adb shell svc power stayon true

if (-not ((& $adb shell pm list packages org.mozilla.firefox) -match 'org.mozilla.firefox$')) {
  $apk = Get-ChildItem "$cache\fenix-*.apk" | Sort-Object LastWriteTime | Select-Object -Last 1
  if (-not $apk) { throw 'no Firefox APK: run dev/android/setup.ps1 first' }
  Write-Host "install $($apk.Name)"
  & $adb install -r $apk.FullName
}
Write-Host 'ready'
