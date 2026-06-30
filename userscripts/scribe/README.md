# Scribe <img src="./scribe.svg" align="left" width="40" height="40">

**Scribe** edits MusicBrainz release in your *real* editor (VS Code, Vim, Notepad…).

---

**NOTE: Experimental**

---


- Install: [`scribe.user.js`](./scribe.user.js)
- Download helper: [`scribe.exe`](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/scribe/helper/dist/scribe.exe)

## Feature


- **Edit field** (Ctrl+Alt+E):<br> 
With cursor in any text box, press it, the text opens in your editor; **save** and the field updates.
- **Edit release** (Ctrl+Alt+R)<br>
Edit a whole release as one Markdown document** (see [the release editor](#edit-a-whole-release)).


## Running the helper

**Quick install (Windows, prebuilt):** grab the tiny prebuilt exe and run it — needs the
[.NET 9 runtime](https://dotnet.microsoft.com/download/dotnet/9.0) installed:

```powershell
# one-time: install the .NET 9 runtime (the helper needs only the base runtime)
winget install --id Microsoft.DotNet.Runtime.9 -e
# run it — sits in the system tray, no console window:
.\scribe.exe --port 17999 --editor "code -r"
# …or run it AND start it with Windows from now on:
.\scribe.exe --startup --editor "code -r"
```

It runs as a **background tray app** (no console). Right-click the tray icon for **Set editor…** ·
**Open log** · **Run at startup** (toggle) · **Exit**. The editor you set is **remembered** (so
`--editor` is optional after the first time). Output goes to `%LOCALAPPDATA%\Scribe\scribe.log`.

<details><summary>How to build (cross-platform)</summary>

Requires the [.NET SDK](https://dotnet.microsoft.com/download) (9.0+):

```sh
cd userscripts/scribe/helper
dotnet run -- --port 17999 --token <your-secret>
# smallest exe (needs the .NET runtime, ~190 KB — this is what dist/ ships):
dotnet publish -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -p:DebugType=none -o ./dist
# fully standalone (no runtime needed, but large):
dotnet publish -c Release -r <win-x64|linux-x64|osx-arm64|…> --self-contained -o ./dist
```

</details>


Options:
- `--port` — listen port (default `17999`).
- `--token` — shared secret; **set the same value** in the userscript (Tampermonkey menu → *Set token*). Default `extedit`.
- `--editor "<cmd>"` — command to open the file (e.g. `--editor "code -r"`, `--editor "subl"`, `--editor vim`). Omit to use the OS default app for the file type. `--editor none` = don't auto-open (open the temp file yourself).
- `--startup` / `--startup off` — register / unregister "run with Windows" (also toggleable from the tray menu).


```
.\scribe.exe --editor "'C:\Program Files\Microsoft VS Code\Code.exe' -r"
```

Keep it running in the background while you edit. Loopback-only; every request must carry the token.

## Usage

1. Start the helper (`scribe.exe …`).
2. In the userscript-manager menu, set **helper port** / **token** to match (and optionally rebind the field hotkey).
3. **Edit one field** — focus a text field, press **Ctrl+Alt+E** → it opens in your editor (edit notes / annotations as `.md`); **save** to update it (trailing newline trimmed). **Esc** disconnects it. Link several at once and bounce between them.
4. **Edit a whole release** — on a release **Edit** page, click the bottom-left **✎** button (appears when the helper is running) or press **Ctrl+Alt+R**; see [the release editor](#scribe--edit-a-whole-release-as-markdown).

## Edit a whole release

**Scribe** (`scribe.user.js`) edits **most of a release in one Markdown document** instead of
field-by-field (see [the format spec](./RELEASE_MD_SPEC.md)). On a release **Edit** page a small
**✎ button appears bottom-left whenever the helper is running** (Scribe pings it, like Picard's
button) — click it (or press **Ctrl+Alt+R**) to export the release into your editor; **save** and the
changes apply back to the editor (review and submit yourself). A bottom-right window lists the
fields you've changed this session — values that can't be applied are flagged (each with a ⌖
go-to-field button) and counted in a header badge; **✕ stops editing**.

- **Applies**: release info (title / disambiguation / status / packaging / language / script /
  barcode / annotation); release dates & countries; labels & catalogue numbers; per-track title &
  length; medium titles; and artist credits (credited-as / join / reorder / add / swap / drop / new).
  Existing artists & labels are referenced by an MBID footer link; a `[Name]` with no footer creates
  a new one. A value that can't be applied (e.g. an invalid status) shows in the **not-applied**
  table rather than being silently skipped.
- **Not applied yet** (round-trips losslessly — use the native editor): external links, and
  add / remove / reorder of tracks. (Phase 2.)
- Needs the same helper running; shares the field-editor's port/token.

## Shortcuts

| Shortcut | Where | Action |
| --- | --- | --- |
| **Ctrl+Alt+E** | any MusicBrainz text field | edit the focused field in your editor |
| **Ctrl+Alt+R** | a release **Edit** page | start / stop editing the whole release as Markdown (Scribe) |

## How it works

The page is `https://`, the helper is `http://localhost` — a normal page `fetch`/`WebSocket` there is blocked by **mixed content** and **CORS**. The userscript instead uses **`GM_xmlhttpRequest`**, which the userscript manager performs from its own context, exempt from both walls (just `@connect 127.0.0.1`). The "send the saved file back" step is a **long-poll**: the userscript holds a `GM_xmlhttpRequest` open and the helper completes it the moment the file's modified-time advances (watch → respond). Works the same on Chrome / Firefox / Edge with Tampermonkey / Violentmonkey.

```
hotkey ─POST /open {id,content}→ scribe.exe ─writes file, opens your editor
       ←──────── 200 ──────────
       ─GET /result?id (long-poll)→ scribe.exe ─watches file mtime…
                                              ↑ you save in your editor
       ←──── 200 {content} ───────  writes the text back into the field
```

