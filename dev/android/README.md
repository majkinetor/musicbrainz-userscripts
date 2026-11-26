# Android emulator

An Android emulator with Firefox for Android, for tests of how Event Horizon plays music on a phone ([#1104](https://github.com/majkinetor/musicbrainz-userscripts/issues/1104)). Playwright's phone emulation changes only the screen size and the user agent. It does not copy how Android treats a browser in the background, so these tests need a real Android system.

The scripts run on Windows, in PowerShell or Node. The SDK goes to `%LOCALAPPDATA%\Android\Sdk`, or to `ANDROID_HOME` when it is set. Downloads and logs go to `dev/android/.cache/`, which git ignores.

## Setup

1. Run `dev/android/setup.ps1` once. It downloads about 10 GB from Google and Mozilla, and it accepts the Android SDK licenses for you.
2. Run `dev/android/start.ps1` to start the emulator. It waits until Android booted, then installs Firefox when it is missing.
3. Install Violentmonkey in the emulator's Firefox, from addons.mozilla.org.

You can run both scripts again: each step skips what is already there.

| Script | What it does |
| --- | --- |
| `setup.ps1` | installs the command-line tools, `platform-tools` (adb), the emulator, an Android 15 image, a Pixel 7 device named `eh-firefox`, and downloads the current Firefox release |
| `start.ps1` | starts the device without a window and installs Firefox. `-Window` shows the emulator, `-Wipe` starts from a clean device, `-Sound` plays the emulator's sound on the computer, `-Restart` stops a running emulator first |
| `server.mjs` | serves `control/` and the test copy of EH on `http://localhost:8777/`, keeps the state that a page reports, and prints the log lines that pages send |
| `adb.mjs` | the adb helpers that the other scripts use, and a command line for them |
| `bg-check.mjs` | plays a page, sends Firefox to the background, and reports every few seconds what plays |
| `eh-test.js` | the test add-on that the server puts into its copy of EH |
| `control/index.html` | a page with no EH code that plays like EH: a YouTube embed or an `<audio>` element |
| `control/yt-visible.user.js` | a test userscript for the YouTube embed: it hides the page's visibility from embeds that EH did not make, and logs every embed's address, video events, errors and first messages from the page |

The device uses the plain Google APIs image, not the Play Store image, because it allows root access. The setup gets Firefox from `archive.mozilla.org`. The version is the current release from Mozilla's product details.

`EH_AVD` changes the device name in both PowerShell scripts.

The emulator starts with `-audio none` and the `swiftshader_indirect` GPU. With the computer's sound on, the emulator's log filled with DirectSound errors and `screencap` stopped. Android still plays and counts audio with no sound device, so the tests see playback.

## The server

1. Start the server: `node dev/android/server.mjs > dev/android/.cache/server.log`.
2. Let the emulator reach it: `adb reverse tcp:8777 tcp:8777`. The emulator then opens the server as its own `localhost`.

| Address | What it does |
| --- | --- |
| `/` | the control page |
| `/eh.user.js` | EH from this checkout, with `eh-test.js` added after the player's log |
| `POST /state`, `GET /state` | a page reports its state, and a test reads the last one |
| `POST /log` | a page sends one log line, which the server prints with the time |

## adb.mjs

The commands run from `dev/android`, for example `node adb.mjs install http://localhost:8777/eh.user.js`.

| Command | What it does |
| --- | --- |
| `install <url>` | opens a userscript in a fresh Firefox and taps Violentmonkey's install button |
| `open <url>` | opens an address in Firefox |
| `ui` | prints the controls on the screen, with their text and place. Web pages show here too |
| `tap <text>` | taps the control with that text |
| `shot <file>` | saves a screenshot |
| `reboot` | restarts Android, waits for the boot, and links port 8777 again |
| `media` | prints Android's media sessions: the state, the position and the title |
| `audio` | prints the audio players that Android counts |
| `key <keycode>` | sends a key, for example `KEYCODE_HOME` |
| `sh <command>` | runs a shell command on the device |

## bg-check.mjs

```
node bg-check.mjs <url> [--play <text>] [--fg 15] [--bg 60] [--every 5] [--off] [--keys]
```

The script stops Firefox, opens the page, closes a Firefox tip when one shows, and taps the control named by `--play`. It takes samples for `--fg` seconds in the foreground, presses Home, then takes samples for `--bg` seconds. With `--off`, it also turns the screen off, as on a locked phone. With `--keys`, it sends pause, play, next and previous in the background.

The script sends the keys with `cmd media_session dispatch`, as a headset button does. Android gives them to the session that holds the media button. A key from `input keyevent` does not arrive while the screen is off.

Each sample shows whether Android counts audio, Android's media state, position and title, and the page's own report. The last line is PLAYED when Android said PLAYING in every background sample.

## The test copy of EH

The server's `/eh.user.js` is EH with `eh-test.js` added. The add-on forwards EH's log lines to the server and reads its hash parameters:

| Parameter | What it does |
| --- | --- |
| `#ehyt=<id>@<second>,…` | shows an "EH test start" button that plays these YouTube videos as one queue. A start second lets a long video end soon |
| `#ehbc=<url>@<seconds>,…` | shows the "EH test start" button that plays these Bandcamp track pages as one queue. The length in seconds lets `#ehnear` find each end. Use it when no release links its recordings to Bandcamp tracks, because EH plays a source only from a recording's own links |
| `#ehrel=1` | on a release page, shows the "EH test start" button, which presses the release's Play. Use it when the Play button is too far down the page for `--play` |
| `#ehnear=<seconds>` | each track jumps to that many seconds before its end, after it played 5 s. Automatic advances then come soon |
| `#ehsrc=<source>` | the source that a track plays from when it has it, for example `ytmusic`. The platform order in the settings decides the source otherwise |

With a hash parameter, the page also sends EH's player state to the server every second.

```
node bg-check.mjs "https://musicbrainz.org/doc/About#ehyt=jNQXAC9IVRw,dQw4w9WgXcQ@195" --play "EH test start" --bg 60 --off
node bg-check.mjs "https://musicbrainz.org/doc/About#ehbc=https://tycho.bandcamp.com/track/a-walk@316,https://tycho.bandcamp.com/track/hours@344&ehnear=20" --play "EH test start" --bg 150 --off
node bg-check.mjs "https://musicbrainz.org/release/a1704bdf-50cb-4cd4-bc03-343ca6f32ef4#ehsrc=ytmusic" --play "Play all" --bg 420 --every 30 --off
```

## The control page

The control page tells whether a platform limit stops playback, without EH. If the control page also stops in the background, no change in EH can fix that source. Open `http://localhost:8777/?kind=youtube` in the emulator and tap Play.

| Parameter | What it does |
| --- | --- |
| `kind=youtube` or `kind=audio` | play YouTube embeds, or audio files in an `<audio>` element |
| `yt=<id>@<second>,…` | the YouTube video IDs, played in turn, each from that second |
| `audio=<url>,<url>` | the audio files, played in turn |
| `adv=frame` or `adv=load` | the next video plays in a new frame, or the same frame loads it with `loadVideoById` |
| `wake=1` | also play the near-silent loop that EH plays next to the source |
| `art=<url>` | with `kind=audio`, set the page's media session with a title and this cover |

The page sends its state to the server every second: the source, the track number, the player state, the position, the number of tracks that ended, and whether the page is visible.

## Findings

These results are from Firefox 161 in the emulator.

- A YouTube embed pauses about 3 s after the page goes to the background, with no EH code. The embed reads the page's visibility. If the embed sees a visible page, it plays on with the screen off.
- A hidden page cannot start a new YouTube frame. If the same frame loads the next video with `loadVideoById` and the near-silent loop plays, playback goes on from track to track.
- Firefox gives the phone's controls to the media session of the frame that plays sound. YouTube's own session has the video's title, pause and seek only. EH blocks it in its widget and sets its own track there, with previous and next.
- YouTube's player script reads `navigator.mediaSession.metadata` back. EH lets it read the track that it wrote, and the phone shows EH's track.
- A YouTube embed that gets a command, for example `unMute`, before its API is ready can stop answering the page. Its log then shows `TypeError: this.api.isExternalMethodAvailable is not a function`. EH sends `listening` every 500 ms until the embed answers, and holds its commands until then.
- The phone's card shows no cover, from EH or from the control page with `art=`. The emulator's card shows the title and the artist only. Android's description of the session ends in `null` even when the page sets an album. Both come from Firefox or the emulator, not from EH.
- After some test runs, Violentmonkey stops opening its install page until Android restarts. `install` then restarts the emulator and tries once more. `node adb.mjs reboot` does the restart alone.
