// External Editor — a tiny cross-platform localhost bridge.
//
// A browser userscript POSTs the text of the field you're editing here (on a
// hotkey); this tool writes it to a temp file and opens it in your editor. When
// you save the file, the change is handed back to the waiting browser tab via a
// long-poll. The whole round trip rides on the userscript manager's
// GM_xmlhttpRequest, so there's no CORS / mixed-content wall (see README).
//
//   dotnet run -- --port 17999 --token <shared-secret> [--editor "code -w"]
//
// Endpoints (all on 127.0.0.1 only):
//   POST /open            { id, content, ext? }  -> writes file, opens editor
//   GET  /result?token=…&id=…                   -> long-poll; 200 body on save, 204 on timeout
//   GET  /ping                                   -> { ok, version } liveness check
//
// Security: loopback-only, and every request must carry the shared token
// (X-ExtEdit-Token header or ?token=). Pick a token and set the same one in
// the userscript's settings.

using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

const string Version = "0.2.2";

// ── args ──────────────────────────────────────────────────────────────────
int port = 17999;
string token = "extedit";
string? editor = null;
for (int i = 0; i < args.Length - 1; i++)
{
    switch (args[i])
    {
        case "--port": int.TryParse(args[i + 1], out port); break;
        case "--token": token = args[i + 1]; break;
        case "--editor": editor = args[i + 1]; break;
    }
}

// token → the file we're watching for this edit session
var sessions = new ConcurrentDictionary<string, Session>();
var tmpDir = Path.Combine(Path.GetTempPath(), "extedit");
Directory.CreateDirectory(tmpDir);

var listener = new HttpListener();
foreach (var host in new[] { "127.0.0.1", "localhost" })
    listener.Prefixes.Add($"http://{host}:{port}/");
try { listener.Start(); }
catch (HttpListenerException ex)
{
    Console.Error.WriteLine($"Could not bind http://127.0.0.1:{port}/ — {ex.Message}");
    Console.Error.WriteLine("Try another --port, or free the one in use.");
    return 1;
}

Console.WriteLine($"External Editor v{Version} listening on http://127.0.0.1:{port}/");
Console.WriteLine($"  token: {(token == "extedit" ? "extedit (default — set --token for a real secret)" : "(set)")}");
Console.WriteLine($"  editor: {editor ?? "OS default for the file type"}");
Console.WriteLine("Ctrl+C to stop.");

while (true)
{
    HttpListenerContext ctx;
    try { ctx = await listener.GetContextAsync(); }
    catch { break; }
    _ = Task.Run(() => Handle(ctx));   // each request on its own task (long-polls mustn't block others)
}
return 0;

// ── request handling ────────────────────────────────────────────────────────
async Task Handle(HttpListenerContext ctx)
{
    var req = ctx.Request;
    var res = ctx.Response;
    // GM_xmlhttpRequest doesn't need CORS, but allow it so a plain page fetch works too.
    res.AddHeader("Access-Control-Allow-Origin", req.Headers["Origin"] ?? "*");
    res.AddHeader("Access-Control-Allow-Headers", "Content-Type, X-ExtEdit-Token");
    res.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    try
    {
        if (req.HttpMethod == "OPTIONS") { res.StatusCode = 204; return; }

        var path = req.Url?.AbsolutePath ?? "/";
        if (path == "/ping") { await Json(res, 200, new { ok = true, version = Version }); return; }

        // auth (header or query) — constant work, loopback-only anyway
        var given = req.Headers["X-ExtEdit-Token"] ?? req.QueryString["token"] ?? "";
        if (!FixedEquals(given, token)) { await Json(res, 401, new { error = "bad token" }); return; }

        if (path == "/open" && req.HttpMethod == "POST") { await Open(req, res); return; }
        if (path == "/result" && req.HttpMethod == "GET") { await Result(req, res); return; }
        if (path == "/close") { Close(req, res); return; }   // GET/POST/DELETE — a no-body POST trips http.sys 411, so GET is allowed

        await Json(res, 404, new { error = "not found" });
    }
    catch (Exception ex)
    {
        try { await Json(res, 500, new { error = ex.Message }); } catch { /* client gone */ }
    }
    finally { try { res.Close(); } catch { } }
}

async Task Open(HttpListenerRequest req, HttpListenerResponse res)
{
    using var sr = new StreamReader(req.InputStream, req.ContentEncoding ?? Encoding.UTF8);
    var body = await sr.ReadToEndAsync();
    var doc = JsonDocument.Parse(body).RootElement;
    var id = doc.TryGetProperty("id", out var idv) ? idv.GetString() ?? Guid.NewGuid().ToString("N") : Guid.NewGuid().ToString("N");

    // Re-open: a field that's already linked re-opens the SAME temp file so the editor
    // just refocuses it — don't recreate the file or reset the saved-state baseline.
    if (sessions.TryGetValue(id, out var existing))
    {
        LaunchEditor(existing.File);
        Console.WriteLine($"[reopen] id={id} -> {existing.File}");
        await Json(res, 200, new { ok = true, id, file = existing.File, reopened = true });
        return;
    }

    var content = doc.TryGetProperty("content", out var cv) ? cv.GetString() ?? "" : "";
    var ext = doc.TryGetProperty("ext", out var ev) ? (ev.GetString() ?? "txt") : "txt";
    ext = new string(ext.Where(char.IsLetterOrDigit).ToArray());
    if (ext.Length == 0) ext = "txt";

    // Name the temp file after the field (e.g. "Annotation") so the editor tab is
    // recognizable when several fields are open at once. The label leads (so the editor
    // sorts/shows it first in the tab) followed by the unique id: e.g. "Barcode_extedit-<id>".
    var name = doc.TryGetProperty("name", out var nv) ? (nv.GetString() ?? "") : "";
    var slug = Slug(name);
    var file = Path.Combine(tmpDir, $"{(slug.Length > 0 ? slug + "_" : "")}extedit-{id}.{ext}");
    await File.WriteAllTextAsync(file, content, new UTF8Encoding(false));
    var baseMtime = File.GetLastWriteTimeUtc(file);
    sessions[id] = new Session(file, baseMtime);

    LaunchEditor(file);
    Console.WriteLine($"[open] id={id} -> {file}");
    await Json(res, 200, new { ok = true, id, file });
}

async Task Result(HttpListenerRequest req, HttpListenerResponse res)
{
    var id = req.QueryString["id"] ?? "";
    if (!sessions.ContainsKey(id)) { await Json(res, 410, new { error = "unknown id" }); return; }

    // Long-poll. No 25s cap — a session stays linked for as long as you keep editing
    // (a field is "connected" until /close or page unload). The file can be saved many
    // times; each save is reported and the baseline re-armed for the next one. A 10-min
    // backstop just yields a 204 (the client immediately re-polls) so an abandoned poll
    // can't hold a response forever.
    var backstop = DateTime.UtcNow.AddMinutes(10);
    while (DateTime.UtcNow < backstop)
    {
        if (!sessions.TryGetValue(id, out var s)) { await Json(res, 410, new { error = "closed" }); return; }   // /close fired
        var mtime = File.GetLastWriteTimeUtc(s.File);
        if (mtime > s.BaseMtime)
        {
            // settle: editors often write in two bursts — wait for it to go quiet
            await Task.Delay(150);
            var content = await ReadStable(s.File);
            sessions[id] = s with { BaseMtime = File.GetLastWriteTimeUtc(s.File) };   // arm for the next save
            Console.WriteLine($"[result] id={id} changed -> {content.Length} chars");
            await Json(res, 200, new { ok = true, id, content });
            return;
        }
        await Task.Delay(250);
    }
    res.StatusCode = 204;   // still editing — client re-polls
}

// Disconnect a field: drop the session and delete its temp file. Any held /result
// for this id then returns 410 on its next loop, so the userscript stops polling.
void Close(HttpListenerRequest req, HttpListenerResponse res)
{
    var id = req.QueryString["id"] ?? "";
    if (sessions.TryRemove(id, out var s))
    {
        try { File.Delete(s.File); } catch { }
        Console.WriteLine($"[close] id={id}");
    }
    res.StatusCode = 200;
    res.ContentType = "application/json";
    var bytes = Encoding.UTF8.GetBytes("{\"ok\":true}");
    res.ContentLength64 = bytes.Length;
    res.OutputStream.Write(bytes);
}

// read a file whose size has stopped changing (avoids catching a half-written save)
async Task<string> ReadStable(string file)
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

void LaunchEditor(string file)
{
    try
    {
        if (editor == "none") return;   // don't auto-open (let the user open the file themselves / for testing)
        if (editor is { Length: > 0 })
        {
            // "--editor" is a command line; tokenize it honoring quotes so an exe path
            // WITH SPACES survives, e.g.  --editor "'C:\Program Files\Microsoft VS Code\Code.exe' -w"
            // or  --editor "\"C:\Program Files\...\Code.exe\" -w".  First token = exe,
            // the rest = its args, the file is appended last.
            var toks = Tokenize(editor);
            if (toks.Count > 0)
            {
                var psi = new ProcessStartInfo(toks[0]) { UseShellExecute = false };
                for (int i = 1; i < toks.Count; i++) psi.ArgumentList.Add(toks[i]);
                psi.ArgumentList.Add(file);
                Process.Start(psi);
                FocusAfterLaunch(toks[0]);   // bring the editor window to the front (Windows blocks a bg console from doing it implicitly)
                return;
            }
        }
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            Process.Start(new ProcessStartInfo(file) { UseShellExecute = true });
        else if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            Process.Start("open", new[] { file });
        else
            Process.Start("xdg-open", new[] { file });
    }
    catch (Exception ex) { Console.Error.WriteLine($"[editor] launch failed: {ex.Message} (file: {file})"); }
}

static async Task Json(HttpListenerResponse res, int code, object body)
{
    res.StatusCode = code;
    res.ContentType = "application/json";
    var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(body));
    res.ContentLength64 = bytes.Length;
    await res.OutputStream.WriteAsync(bytes);
}

// Split a command line into tokens, honoring single OR double quotes around a
// segment (so a quoted exe path with spaces stays one token). Quotes are stripped.
static List<string> Tokenize(string s)
{
    var toks = new List<string>();
    var sb = new StringBuilder();
    char quote = '\0';
    bool has = false;
    foreach (var ch in s)
    {
        if (quote != '\0')
        {
            if (ch == quote) quote = '\0';
            else sb.Append(ch);
        }
        else if (ch == '"' || ch == '\'') { quote = ch; has = true; }
        else if (char.IsWhiteSpace(ch))
        {
            if (has) { toks.Add(sb.ToString()); sb.Clear(); has = false; }
        }
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

// Filename-safe slug of a field label: keep letters/digits, collapse the rest to single
// dashes, cap the length. "Annotation" → "Annotation"; "edit-note.0.text" → "edit-note-0-text".
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

// Bring the editor window to the foreground after launching it. Windows' focus-stealing
// prevention stops a background console (us) from raising another app's window, so do it
// explicitly. No-op on non-Windows (the OS usually focuses there). Best-effort + async so
// it never blocks the /open response. Matches the editor by its exe base name (VS Code's
// "code"/"Code.exe" → process "Code"; notepad → "notepad"; etc.).
static void FocusAfterLaunch(string editorToken)
{
    if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return;
    var name = Path.GetFileNameWithoutExtension(editorToken);
    if (string.IsNullOrWhiteSpace(name)) return;
    System.Threading.Tasks.Task.Run(() => { try { Native.BringToFront(name); } catch { } });
}

record Session(string File, DateTime BaseMtime);

static class Native
{
    const int SW_RESTORE = 9;
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();

    // The editor window may not exist yet on a cold start — poll briefly for it.
    public static void BringToFront(string procName)
    {
        for (int i = 0; i < 30; i++)
        {
            var h = FindWindow(procName);
            if (h != IntPtr.Zero) { ForceForeground(h); return; }
            System.Threading.Thread.Sleep(120);
        }
    }

    static IntPtr FindWindow(string procName)
    {
        foreach (var p in System.Diagnostics.Process.GetProcessesByName(procName))
        {
            try { var h = p.MainWindowHandle; if (h != IntPtr.Zero && IsWindowVisible(h)) return h; }
            catch { }
        }
        return IntPtr.Zero;
    }

    static void ForceForeground(IntPtr hWnd)
    {
        ShowWindow(hWnd, SW_RESTORE);   // un-minimize if needed
        var fg = GetForegroundWindow();
        uint fgThread = GetWindowThreadProcessId(fg, out _);
        uint cur = GetCurrentThreadId();
        // attach to the current foreground thread's input queue to bypass focus-stealing prevention
        bool attached = fgThread != 0 && fgThread != cur && AttachThreadInput(fgThread, cur, true);
        SetForegroundWindow(hWnd);
        if (attached) AttachThreadInput(fgThread, cur, false);
    }
}
