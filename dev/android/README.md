# Android emulator

An Android emulator with Firefox for Android, for tests of how Event Horizon plays music on a phone ([#1104](https://github.com/majkinetor/musicbrainz-userscripts/issues/1104)). Playwright's phone emulation changes only the screen size and the user agent. It does not copy how Android treats a browser in the background, so these tests need a real Android system.

The scripts run on Windows, in PowerShell or Node. The SDK goes to `%LOCALAPPDATA%\Android\Sdk`, or to `ANDROID_HOME` when it is set. Downloads and logs go to `dev/android/.cache/`, which git ignores.

## Setup

1. Run `dev/android/setup.ps1` once. It downloads about 10 GB from Google and Mozilla, and it accepts the Android SDK licenses for you.
2. Run `dev/android/start.ps1` to start the emulator. It waits until Android booted, then installs Firefox when it is missing.

You can run both scripts again: each step skips what is already there.

| Script | What it does |
| --- | --- |
| `setup.ps1` | installs the command-line tools, `platform-tools` (adb), the emulator, an Android 15 image, a Pixel 7 device named `eh-firefox`, and downloads the current Firefox release |
| `start.ps1` | starts the device without a window and installs Firefox. `-Window` shows the emulator, `-Wipe` starts from a clean device |
| `server.mjs` | serves `control/` on `http://localhost:8777/` and keeps the state that the page reports |
| `control/index.html` | a page with no EH code that plays like EH: a YouTube embed or an `<audio>` element |

The device uses the plain Google APIs image, not the Play Store image, because it allows root access. The setup gets Firefox from `archive.mozilla.org`. The version is the current release from Mozilla's product details.

`EH_AVD` changes the device name in both scripts.

## The control page

The control page tells whether a platform limit stops playback, without EH. If the control page also stops in the background, no change in EH can fix that source.

1. Start the server: `node dev/android/server.mjs`.
2. Let the emulator reach it: `adb reverse tcp:8777 tcp:8777`. The emulator then opens the server as its own `localhost`.
3. Open `http://localhost:8777/?kind=youtube` in Firefox in the emulator, and tap Play.

These parameters change the page:

| Parameter | What it does |
| --- | --- |
| `kind=youtube` or `kind=audio` | play YouTube embeds, or audio files in an `<audio>` element |
| `yt=<id>,<id>` | the YouTube video IDs, played in turn |
| `audio=<url>,<url>` | the audio files, played in turn |
| `wake=1` | also play the near-silent loop that EH plays next to the source |

The page sends its state to the server every second: the source, the track number, the player state, the position, the number of tracks that ended, and whether the page is visible. `GET /state` returns the last state.
