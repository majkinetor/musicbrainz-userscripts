# Building the Scribe helper

The helper is a small .NET 9 app that **multi-targets** two frameworks from one codebase:

| Target | OS | UI |
| --- | --- | --- |
| `net9.0-windows` | Windows | WinForms **system tray** (ships in the Windows Desktop runtime — no third-party deps) |
| `net9.0` | macOS / Linux | **headless** daemon (no tray; driven by `--editor` / `--startup` + the log) |

Everything Windows-specific — the WinForms tray, the `HKCU\…\Run` registry, and the user32 editor-window
focus — is behind the `WINDOWS` compile symbol (which .NET defines automatically for the `-windows` target).
The HTTP bridge, file open (`ShellExecute` / `open` / `xdg-open`), logging, JSON settings, and the per-OS
"run at startup" (registry / LaunchAgent plist / XDG autostart) are all cross-platform.

Needs the [.NET SDK 9.0+](https://dotnet.microsoft.com/download). Build/run on **any** OS:

```sh
cd userscripts/scribe/helper

# run from source
dotnet run -f net9.0-windows -- --port 17999 --token <secret>   # Windows: tray
dotnet run -f net9.0 --         --port 17999 --token <secret>   # macOS/Linux: headless
```

## Producing the shipped binaries (`dist/`)

`dist/` ships **framework-dependent single-file** binaries (~110–200 KB each; they need the
[.NET 9 runtime](https://dotnet.microsoft.com/download/dotnet/9.0) installed — Desktop runtime on Windows,
base runtime on macOS/Linux). These can be **cross-published from any OS**:

```sh
# Windows  → dist/scribe.exe
dotnet publish -c Release -f net9.0-windows -r win-x64 --self-contained false -p:PublishSingleFile=true -p:DebugType=none -o dist

# macOS / Linux → dist/scribe-<rid>  (published to a temp dir, then the single `scribe` file is copied in)
for RID in linux-x64 osx-x64 osx-arm64; do
  dotnet publish -c Release -f net9.0 -r $RID --self-contained false -p:PublishSingleFile=true -p:DebugType=none -o "/tmp/pub-$RID"
  cp "/tmp/pub-$RID/scribe" "dist/scribe-$RID"
done
```

Prefer **no runtime dependency**? Add `--self-contained` (drop `false`) for a standalone binary that bundles
the runtime (~15–20 MB each) — not what `dist/` ships, but handy for a portable drop-in.

`bin/`, `obj/` are git-ignored; `dist/` is committed.
