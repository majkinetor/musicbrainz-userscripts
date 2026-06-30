# External Editor 

Edit the **focused text field** of a MusicBrainz page in your *real* editor (VS Code, Vim, Notepad…). Put the cursor in any text box, press the hotkey, the field's text opens in your editor; **save the file** and the field updates — no copy-paste.

It's two pieces — the **userscript** (the hotkey + writes the result back) and **helper executable tool** (a tiny **cross-platform .NET CLI** that runs on `127.0.0.1`, writes the text to a temp file, opens your editor, and hands the saved file back).

- Install userscript: [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/external_editor/external_editor.user.js)
- Download helper tool: [`extedit.exe`](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/feat/external-editor-poc/userscripts/external_editor/helper/dist/extedit.exe)

## How it works

The page is `https://`, the helper is `http://localhost` — a normal page `fetch`/`WebSocket` there is blocked by **mixed content** and **CORS**. The userscript instead uses **`GM_xmlhttpRequest`**, which the userscript manager performs from its own context, exempt from both walls (just `@connect 127.0.0.1`). The "send the saved file back" step is a **long-poll**: the userscript holds a `GM_xmlhttpRequest` open and the helper completes it the moment the file's modified-time advances (watch → respond). Works the same on Chrome / Firefox / Edge with Tampermonkey / Violentmonkey.

```
hotkey ─POST /open {id,content}→ extedit ─writes file, opens your editor
       ←──────── 200 ──────────
       ─GET /result?id (long-poll)→ extedit ─watches file mtime…
                                              ↑ you save in your editor
       ←──── 200 {content} ───────  writes the text back into the field
```

## Running the helper

**Quick install (Windows, prebuilt):** grab the tiny prebuilt exe and run it — needs the
[.NET 9 runtime](https://dotnet.microsoft.com/download/dotnet/9.0) installed:

```powershell
# one-time: install the .NET 9 runtime (the helper needs only the base runtime)
winget install --id Microsoft.DotNet.Runtime.9 -e
# then run the helper:
.\extedit.exe --port 17999 --token <your-secret> --editor "code -r"
```

**Build it yourself** (any OS) — requires the [.NET SDK](https://dotnet.microsoft.com/download) (9.0+):

```sh
cd userscripts/external_editor/helper
dotnet run -- --port 17999 --token <your-secret>
# smallest exe (needs the .NET runtime, ~190 KB — this is what dist/ ships):
dotnet publish -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -p:DebugType=none -o ./dist
# fully standalone (no runtime needed, but large):
dotnet publish -c Release -r <win-x64|linux-x64|osx-arm64|…> --self-contained -o ./dist
```

Options:
- `--port` — listen port (default `17999`).
- `--token` — shared secret; **set the same value** in the userscript (Tampermonkey menu → *Set token*). Default `extedit`.
- `--editor "<cmd>"` — command to open the file (e.g. `--editor "code -r"`, `--editor "subl"`, `--editor vim`). Omit to use the OS default app for the file type. `--editor none` = don't auto-open (open the temp file yourself).
  - **Don't use a wait flag** (`code -w` / `subl -w`): extedit detects saves by watching the file's mtime, so it isn't needed — and with VS Code, `-w` stops the file's tab from being re-revealed when you re-open a still-linked field. Use `-r` (reuse window + reveal the tab) instead.

Keep it running in the background while you edit. Loopback-only; every request must carry the token.

## Using it

1. Start the helper.
2. In the userscript manager menu, set **port** / **token** to match, and optionally rebind the **hotkey** (default **Ctrl+Alt+E**).
3. Focus a text field on a MusicBrainz page, press the hotkey → it opens in your editor (edit notes / annotations open as `.md`).
4. Edit, **save**. The field updates (a trailing newline your editor adds is trimmed). **Esc** cancels a pending edit.

## Notes / limits

- One edit at a time per tab.
- Works on `<textarea>`, text-like `<input>`, and `contenteditable`.
- The helper is a localhost service: any site could POST to it, so it requires the shared token — pick a non-default one.
- This is a standalone utility; it has no dependency on Apollo Editor or any other script.
