# Scribe <img src="./scribe.svg" align="left" width="40" height="40">

Edit MusicBrainz text fields, or a whole release as Markdown, in your own editor (VS Code, Vim, Notepad…).

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/scribe/scribe.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/scribe/scribe.user.js)
- The helper: **[Windows](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/scribe/helper/dist/scribe.exe)** · **[macOS arm64](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/scribe/helper/dist/scribe-osx-arm64)** · **[macOS x64](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/scribe/helper/dist/scribe-osx-x64)** · **[Linux x64](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/scribe/helper/dist/scribe-linux-x64)** (needs the [.NET 9 runtime](https://dotnet.microsoft.com/download/dotnet/9.0)), or [build it](./helper/BUILD.md)
- [Changelog](./CHANGELOG.md)

https://github.com/user-attachments/assets/3fb448db-a46c-487a-9d5d-5f3dce997cbf

## Features

- **[Edit a field](#edit-a-field)** in your editor; saving updates the field.
- **[Edit a whole release](#edit-a-whole-release)** as one Markdown document.

Both need the [helper](#the-helper) running.

## Edit a field

Focus a text field and press **Ctrl+Alt+E**: its text opens in your editor as a `.md` file. Each save updates the field. You can have several fields open at once; **Esc** in a field disconnects it.

## Edit a whole release

On a release's **Edit** page, Scribe's icon appears bottom-right, with the other scripts' icons, while the helper runs, grey, and in colour while you're editing. Click it, or press **Ctrl+Alt+R**, to open the release as one Markdown document ([format](./RELEASE_MD_SPEC.md)). Each save applies the changes to the release editor; you review and submit as usual.

A window beside the icons lists what changed this session. A value that can't be applied (an invalid status, say) is flagged there with a ⌖ button to its field, and counted in the header. **✕** stops editing.

|             |                                                                                     |
| ----------- | ----------------------------------------------------------------------------------- |
| **Applied** | release info and events, labels, catalogue numbers, titles, lengths, artist credits |
| **Not yet** | external links; adding, removing or reordering tracks (use the native editor)       |

Titles are the track and medium titles; release info is the title, disambiguation, status, packaging, language, script, barcode and annotation.

Existing artists and labels are referenced by an MBID link at the bottom of the document; a `[Name]` without one creates a new entity.

Once Scribe has set a field, it adds a summary to the edit note (`Edited via Markdown — set 5 fields: release title, barcode · 2 track fields…`). Your own text in the note is kept, and a later save updates the summary rather than adding another.

## The helper

A small local program that opens files in your editor and hands the saved text back. It listens on your computer only (127.0.0.1), and every request must carry its token.

```powershell
.\scribe.exe --editor "code -r"              # Windows: a tray app
.\scribe.exe --startup --editor "code -r"    # …and start with Windows from now on
```

```sh
chmod +x scribe && ./scribe --editor "code -r"   # macOS / Linux: runs headless
./scribe --startup on                            # start at login (off to undo)
```

| Option             | Default            |                                                                                |
| ------------------ | ------------------ | ------------------------------------------------------------------------------ |
| `--port`           | 17999              | listen port                                                                    |
| `--token`          | extedit            | shared secret; set the same one in the userscript (manager menu → *Set token*) |
| `--editor "<cmd>"` | the OS default app | `"code -r"`, `subl`, `vim`…; `none` only writes the file; remembered           |
| `--startup`        |                    | run at startup (`on`/`off` on macOS and Linux)                                 |

On Windows, the tray menu has *Set editor…*, *Open log*, *Run at startup* and *Exit*. A path with spaces goes in inner quotes: `--editor "'C:\Program Files\Microsoft VS Code\Code.exe' -r"`.

|         | Log and settings                        | Run at startup                       |
| ------- | --------------------------------------- | ------------------------------------ |
| Windows | `%LOCALAPPDATA%\Scribe\`                | `HKCU\…\Run`                         |
| macOS   | `~/Library/Application Support/Scribe/` | `~/Library/LaunchAgents/…plist`      |
| Linux   | `~/.local/share/Scribe/`                | `~/.config/autostart/scribe.desktop` |

How the userscript and the helper talk is in [DEVELOP.md](DEVELOP.md).

## Shortcuts

| Key        | Where                 |                                         |
| ---------- | --------------------- | --------------------------------------- |
| Ctrl+Alt+E | any text field        | edit it in your editor                  |
| Ctrl+Alt+R | a release's Edit page | start or stop editing the whole release |
