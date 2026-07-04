// Scribe helper — a tiny cross-platform system-tray localhost bridge (Windows / macOS / Linux).
//
// A browser userscript POSTs the text of the field you're editing here (on a hotkey); this tool
// writes it to a temp file and opens it in your editor. When you save, the change is handed back to
// the waiting browser tab via a long-poll. The round trip rides on GM_xmlhttpRequest, so there's no
// CORS / mixed-content wall (see README).
//
// Runs windowless in the system tray (Set editor · Open log · Run at startup · Exit); logs go to a
// file (…/Scribe/scribe.log). The editor + settings are persisted to settings.json next to the log.
//
//   scribe --port 17999 --token <shared-secret> [--editor "code -r"] [--startup [on|off]]
//
// Endpoints (127.0.0.1 only, token-gated): POST /open · GET /result · GET/POST /close · GET /ping.

using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

namespace Scribe;

internal static class Program
{
    public const string Version = "0.3.0";
    public static int Port = 17999;
    public static string Token = "extedit";
    public static string RunCmd = "";

    [STAThread]
    public static int Main(string[] args)
    {
        string? editor = null, startup = null;
        for (int i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--port": if (i + 1 < args.Length) int.TryParse(args[++i], out Port); break;
                case "--token": if (i + 1 < args.Length) Token = args[++i]; break;
                case "--editor": if (i + 1 < args.Length) editor = args[++i]; break;
                case "--startup": startup = (i + 1 < args.Length && args[i + 1] == "off") ? "off" : "on"; if (i + 1 < args.Length && (args[i + 1] == "on" || args[i + 1] == "off")) i++; break;
                case "--no-startup": startup = "off"; break;
            }
        }

        Log.Init();
        Settings.Load();
        if (editor != null) Settings.SaveEditor(editor);   // --editor overrides + persists the saved editor
        RunCmd = BuildRunCommand(Port, Token);
        Log.Write($"Scribe helper v{Version} starting — port {Port}, editor {Settings.Editor ?? "(OS default)"}, os {RuntimeInformation.OSDescription}");

        if (startup != null) { try { Startup.Set(startup == "on", RunCmd); Log.Write("Run at startup: " + startup); } catch (Exception ex) { Log.Write("startup set failed: " + ex.Message); } }

        if (!Server.Bind(Port)) return 1;
        Server.Start();   // background HTTP accept loop

#if WINDOWS
        // Windows: run the WinForms system tray on this (STA) thread — Application.Run blocks until Exit.
        try { WinTray.Run(); }
        catch (Exception ex) { Log.Write("tray failed (" + ex.Message + ") — running headless"); Thread.Sleep(Timeout.Infinite); }
        return 0;
#else
        // macOS/Linux: no tray — run headless. Configure via --editor / --startup; output goes to the log.
        Log.Write("running headless (no tray on this OS) — set the editor with --editor, autostart with --startup; log: " + Log.Path);
        Thread.Sleep(Timeout.Infinite);
        return 0;
#endif
    }

    // the command registered to "run with the OS" — this exe with its port/token (the editor is
    // persisted separately via Settings, so it's picked up on the next start automatically).
    static string BuildRunCommand(int port, string token)
    {
        var exe = Environment.ProcessPath ?? "scribe";
        return $"\"{exe}\" --port {port} --token \"{token}\"";
    }
}

record Session(string File, DateTime BaseMtime);

// ── the localhost bridge (fully cross-platform: HttpListener + OS-aware file open) ──────────────
internal static class Server
{
    static readonly ConcurrentDictionary<string, Session> sessions = new();
    static readonly string tmpDir = Path.Combine(Path.GetTempPath(), "extedit");
    static HttpListener? listener;

    public static bool Bind(int port)
    {
        Directory.CreateDirectory(tmpDir);
        listener = new HttpListener();
        foreach (var host in new[] { "127.0.0.1", "localhost" }) listener.Prefixes.Add($"http://{host}:{port}/");
        try { listener.Start(); }
        catch (HttpListenerException ex) { Log.Write($"Could not bind http://127.0.0.1:{port}/ — {ex.Message}. Try another --port, or free the port in use."); return false; }
        Log.Write($"Listening on http://127.0.0.1:{port}/  (token {(Program.Token == "extedit" ? "default — set --token for a real secret" : "set")})");
        return true;
    }

    public static void Start() => _ = Task.Run(AcceptLoop);

    static async Task AcceptLoop()
    {
        while (true)
        {
            HttpListenerContext ctx;
            try { ctx = await listener!.GetContextAsync(); }
            catch { break; }
            _ = Task.Run(() => Handle(ctx));   // each request on its own task (long-polls mustn't block others)
        }
    }

    static async Task Handle(HttpListenerContext ctx)
    {
        var req = ctx.Request;
        var res = ctx.Response;
        res.AddHeader("Access-Control-Allow-Origin", req.Headers["Origin"] ?? "*");
        res.AddHeader("Access-Control-Allow-Headers", "Content-Type, X-ExtEdit-Token");
        res.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        try
        {
            if (req.HttpMethod == "OPTIONS") { res.StatusCode = 204; return; }

            var path = req.Url?.AbsolutePath ?? "/";
            if (path == "/ping") { await Json(res, 200, new { ok = true, version = Program.Version }); return; }

            var given = req.Headers["X-ExtEdit-Token"] ?? req.QueryString["token"] ?? "";
            if (!FixedEquals(given, Program.Token)) { await Json(res, 401, new { error = "bad token" }); return; }

            if (path == "/open" && req.HttpMethod == "POST") { await Open(req, res); return; }
            if (path == "/result" && req.HttpMethod == "GET") { await Result(req, res); return; }
            if (path == "/close") { Close(req, res); return; }

            await Json(res, 404, new { error = "not found" });
        }
        catch (Exception ex)
        {
            try { await Json(res, 500, new { error = ex.Message }); } catch { /* client gone */ }
        }
        finally { try { res.Close(); } catch { } }
    }

    static async Task Open(HttpListenerRequest req, HttpListenerResponse res)
    {
        using var sr = new StreamReader(req.InputStream, req.ContentEncoding ?? Encoding.UTF8);
        var body = await sr.ReadToEndAsync();
        var doc = JsonDocument.Parse(body).RootElement;
        var id = doc.TryGetProperty("id", out var idv) ? idv.GetString() ?? Guid.NewGuid().ToString("N") : Guid.NewGuid().ToString("N");

        if (sessions.TryGetValue(id, out var existing))
        {
            LaunchEditor(existing.File);
            Log.Write($"[reopen] id={id} -> {existing.File}");
            await Json(res, 200, new { ok = true, id, file = existing.File, reopened = true });
            return;
        }

        var content = doc.TryGetProperty("content", out var cv) ? cv.GetString() ?? "" : "";
        var ext = doc.TryGetProperty("ext", out var ev) ? (ev.GetString() ?? "txt") : "txt";
        ext = new string(ext.Where(char.IsLetterOrDigit).ToArray());
        if (ext.Length == 0) ext = "txt";

        var name = doc.TryGetProperty("name", out var nv) ? (nv.GetString() ?? "") : "";
        var slug = Slug(name);
        var file = Path.Combine(tmpDir, $"{(slug.Length > 0 ? slug + "_" : "")}extedit-{id}.{ext}");
        await File.WriteAllTextAsync(file, content, new UTF8Encoding(false));
        var baseMtime = File.GetLastWriteTimeUtc(file);
        sessions[id] = new Session(file, baseMtime);

        LaunchEditor(file);
        Log.Write($"[open] id={id} -> {file}");
        await Json(res, 200, new { ok = true, id, file });
    }

    static async Task Result(HttpListenerRequest req, HttpListenerResponse res)
    {
        var id = req.QueryString["id"] ?? "";
        if (!sessions.ContainsKey(id)) { await Json(res, 410, new { error = "unknown id" }); return; }

        var backstop = DateTime.UtcNow.AddMinutes(10);
        while (DateTime.UtcNow < backstop)
        {
            if (!sessions.TryGetValue(id, out var s)) { await Json(res, 410, new { error = "closed" }); return; }
            var mtime = File.GetLastWriteTimeUtc(s.File);
            if (mtime > s.BaseMtime)
            {
                await Task.Delay(150);   // settle: editors often write in two bursts
                var content = await ReadStable(s.File);
                sessions[id] = s with { BaseMtime = File.GetLastWriteTimeUtc(s.File) };
                Log.Write($"[result] id={id} changed -> {content.Length} chars");
                await Json(res, 200, new { ok = true, id, content });
                return;
            }
            await Task.Delay(250);
        }
        res.StatusCode = 204;   // still editing — client re-polls
    }

    static void Close(HttpListenerRequest req, HttpListenerResponse res)
    {
        var id = req.QueryString["id"] ?? "";
        if (sessions.TryRemove(id, out var s))
        {
            try { File.Delete(s.File); } catch { }
            Log.Write($"[close] id={id}");
        }
        res.StatusCode = 200;
        res.ContentType = "application/json";
        var bytes = Encoding.UTF8.GetBytes("{\"ok\":true}");
        res.ContentLength64 = bytes.Length;
        res.OutputStream.Write(bytes);
    }

    static async Task<string> ReadStable(string file)
    {
        long last = -1;
        for (int i = 0; i < 20; i++)
        {
            long len = new FileInfo(file).Length;
            if (len == last) break;
            last = len;
            await Task.Delay(80);
        }
        return await File.ReadAllTextAsync(file);
    }

    static void LaunchEditor(string file)
    {
        try
        {
            var editor = Settings.Editor;
            if (editor == "none") return;
            if (editor is { Length: > 0 })
            {
                var toks = Tokenize(editor);
                if (toks.Count > 0)
                {
                    var psi = new ProcessStartInfo(toks[0]) { UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true };
                    for (int i = 1; i < toks.Count; i++) psi.ArgumentList.Add(toks[i]);
                    psi.ArgumentList.Add(file);
                    var p = Process.Start(psi);
                    if (p != null) { p.OutputDataReceived += (_, __) => { }; p.ErrorDataReceived += (_, __) => { }; try { p.BeginOutputReadLine(); p.BeginErrorReadLine(); } catch { } }
                    if (OperatingSystem.IsWindows()) FocusAfterLaunch(toks[0]);   // Windows blocks a bg app from raising a window; do it explicitly
                    return;
                }
            }
            // OS default handler for the file type
            if (OperatingSystem.IsWindows()) Process.Start(new ProcessStartInfo(file) { UseShellExecute = true });
            else if (OperatingSystem.IsMacOS()) Process.Start("open", new[] { file });
            else Process.Start("xdg-open", new[] { file });
        }
        catch (Exception ex) { Log.Write($"[editor] launch failed: {ex.Message} (file: {file})"); }
    }

    static async Task Json(HttpListenerResponse res, int code, object body)
    {
        res.StatusCode = code;
        res.ContentType = "application/json";
        var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(body));
        res.ContentLength64 = bytes.Length;
        await res.OutputStream.WriteAsync(bytes);
    }

    // Split a command line into tokens, honoring single OR double quotes (so a quoted exe path with
    // spaces stays one token). Quotes are stripped.
    static List<string> Tokenize(string s)
    {
        var toks = new List<string>();
        var sb = new StringBuilder();
        char quote = '\0';
        bool has = false;
        foreach (var ch in s)
        {
            if (quote != '\0') { if (ch == quote) quote = '\0'; else sb.Append(ch); }
            else if (ch == '"' || ch == '\'') { quote = ch; has = true; }
            else if (char.IsWhiteSpace(ch)) { if (has) { toks.Add(sb.ToString()); sb.Clear(); has = false; } }
            else { sb.Append(ch); has = true; }
        }
        if (has) toks.Add(sb.ToString());
        return toks;
    }

    static bool FixedEquals(string a, string b)
    {
        if (a.Length != b.Length) return false;
        int diff = 0;
        for (int i = 0; i < a.Length; i++) diff |= a[i] ^ b[i];
        return diff == 0;
    }

    static string Slug(string s)
    {
        var sb = new StringBuilder();
        foreach (var ch in s ?? "")
        {
            if (char.IsLetterOrDigit(ch)) sb.Append(ch);
            else if (sb.Length > 0 && sb[^1] != '-') sb.Append('-');
        }
        var r = sb.ToString().Trim('-');
        return r.Length > 40 ? r.Substring(0, 40).TrimEnd('-') : r;
    }

    static void FocusAfterLaunch(string editorToken)
    {
        var name = Path.GetFileNameWithoutExtension(editorToken);
        if (string.IsNullOrWhiteSpace(name)) return;
        Task.Run(() => { try { Native.BringToFront(name); } catch { } });
    }
}

// ── file logging ──────────────────────────────────────────────────────────
internal static class Log
{
    static string _path = "";
    static readonly object _lock = new();
    public static string Path => _path;
    public static string Dir => System.IO.Path.GetDirectoryName(_path) ?? System.IO.Path.GetTempPath();
    public static void Init()
    {
        try
        {
            var dir = System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Scribe");
            Directory.CreateDirectory(dir);
            _path = System.IO.Path.Combine(dir, "scribe.log");
        }
        catch { _path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "scribe.log"); }
    }
    public static void Write(string msg)
    {
        var line = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "  " + msg;
        try { lock (_lock) File.AppendAllText(_path, line + Environment.NewLine); } catch { }
    }
    public static void OpenInViewer()
    {
        try
        {
            if (OperatingSystem.IsWindows()) Process.Start(new ProcessStartInfo(_path) { UseShellExecute = true });
            else if (OperatingSystem.IsMacOS()) Process.Start("open", new[] { _path });
            else Process.Start("xdg-open", new[] { _path });
        }
        catch (Exception ex) { Write("open log failed: " + ex.Message); }
    }
}

// ── Windows-only: bring the launched editor window to the foreground (no-op elsewhere) ──────────
internal static class Native
{
    const int SW_RESTORE = 9;
    const byte VK_MENU = 0x12; const uint KEYEVENTF_KEYUP = 0x2;
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll")] static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();

    public static void BringToFront(string procName)
    {
        if (!OperatingSystem.IsWindows()) return;
        for (int i = 0; i < 30; i++)
        {
            var h = FindWindow(procName);
            if (h != IntPtr.Zero) { ForceForeground(h); return; }
            Thread.Sleep(120);
        }
    }

    static IntPtr FindWindow(string procName)
    {
        foreach (var p in Process.GetProcessesByName(procName))
        {
            try { var h = p.MainWindowHandle; if (h != IntPtr.Zero && IsWindowVisible(h)) return h; }
            catch { }
        }
        return IntPtr.Zero;
    }

    static void ForceForeground(IntPtr hWnd)
    {
        if (IsIconic(hWnd)) ShowWindow(hWnd, SW_RESTORE);
        var fg = GetForegroundWindow();
        uint fgThread = GetWindowThreadProcessId(fg, out _);
        uint cur = GetCurrentThreadId();
        bool attached = fgThread != 0 && fgThread != cur && AttachThreadInput(fgThread, cur, true);
        keybd_event(VK_MENU, 0, 0, UIntPtr.Zero);
        keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        BringWindowToTop(hWnd);
        SetForegroundWindow(hWnd);
        if (attached) AttachThreadInput(fgThread, cur, false);
    }
}
