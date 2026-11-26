# Sets up an Android emulator with Firefox for Android, for playback tests (#1104).
# Safe to run again: every step skips what is already there.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$avd = if ($env:EH_AVD) { $env:EH_AVD } else { 'eh-firefox' }
$image = 'system-images;android-35;google_apis;x86_64'
$cache = Join-Path $PSScriptRoot '.cache'
New-Item -ItemType Directory -Force $sdk, $cache | Out-Null

function Step($text) { Write-Host "== $text" }

# 1. Command-line tools
$tools = "$sdk\cmdline-tools\latest"
if (-not (Test-Path "$tools\bin\sdkmanager.bat")) {
  Step 'download the command-line tools'
  $zip = "$cache\cmdline-tools.zip"
  Invoke-WebRequest 'https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip' -OutFile $zip
  $tmp = "$sdk\cmdline-tools\tmp"
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  Expand-Archive $zip $tmp
  Move-Item "$tmp\cmdline-tools" $tools
  Remove-Item -Recurse -Force $tmp
}
$sm = "$tools\bin\sdkmanager.bat"
$avdm = "$tools\bin\avdmanager.bat"

# 2. Licenses and packages
Step 'accept the SDK licenses'
(('y' + [Environment]::NewLine) * 30) | & $sm --sdk_root=$sdk --licenses | Out-Null
Step 'install platform-tools, the emulator and the system image'
& $sm --sdk_root=$sdk 'platform-tools' 'emulator' $image | Select-String -NotMatch '^\[' | Out-Host

Step 'check the hardware acceleration'
& "$sdk\emulator\emulator.exe" -accel-check | Out-Host

# 3. The virtual device
$have = & "$sdk\emulator\emulator.exe" -list-avds
if ($have -notcontains $avd) {
  Step "create the virtual device $avd"
  'no' | & $avdm create avd -n $avd -k $image -d pixel_7 | Out-Host
  $ini = "$env:USERPROFILE\.android\avd\$avd.avd\config.ini"
  Add-Content $ini "hw.keyboard=yes`nhw.ramSize=4096`ndisk.dataPartition.size=8G`nhw.audioOutput=yes"
}

# 4. Firefox for Android, the current release for x86_64
$ver = (Invoke-RestMethod 'https://product-details.mozilla.org/1.0/mobile_versions.json').version
$apk = "$cache\fenix-$ver.apk"
if (-not (Test-Path $apk)) {
  Step "download Firefox for Android $ver"
  Invoke-WebRequest "https://archive.mozilla.org/pub/fenix/releases/$ver/android/fenix-$ver-android-x86_64/fenix-$ver.multi.android-x86_64.apk" -OutFile $apk
}
Write-Host "Firefox APK: $apk"
Write-Host "Done. Start the device with: dev/android/start.ps1"
