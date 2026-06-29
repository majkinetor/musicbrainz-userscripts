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

const string Version = "0.1.1";

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
    var content = doc.TryGetProperty("content", out var cv) ? cv.GetString() ?? "" : "";
    var ext = doc.TryGetProperty("ext", out var ev) ? (ev.GetString() ?? "txt") : "txt";
    ext = new string(ext.Where(char.IsLetterOrDigit).ToArray());
    if (ext.Length == 0) ext = "txt";

    var file = Path.Combine(tmpDir, $"extedit-{id}.{ext}");
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
    if (!sessions.TryGetValue(id, out var s)) { await Json(res, 404, new { error = "unknown id" }); return; }

    // long-poll: hold up to ~25s, return as soon as the file is saved (mtime advances)
    var deadline = DateTime.UtcNow.AddSeconds(25);
    while (DateTime.UtcNow < deadline)
    {
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
    res.StatusCode = 204;   // no change yet — client re-polls
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

record Session(string File, DateTime BaseMtime);
