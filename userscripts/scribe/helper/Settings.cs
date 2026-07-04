using System.Text.Json;

namespace Scribe;

// Persisted settings (the editor command) as JSON in …/Scribe/settings.json — next to the log,
// cross-platform. On Windows it migrates the old registry value (HKCU\Software\Scribe\Editor) once.
internal static class Settings
{
    static string FilePath => Path.Combine(Log.Dir, "settings.json");
    public static volatile string? Editor;   // read by LaunchEditor on each open; set from --editor or the tray

    sealed class Data { public string? Editor { get; set; } }

    public static void Load()
    {
        try
        {
            if (File.Exists(FilePath))
            {
                var d = JsonSerializer.Deserialize<Data>(File.ReadAllText(FilePath));
                Editor = string.IsNullOrWhiteSpace(d?.Editor) ? null : d!.Editor!.Trim();
                return;
            }
        }
        catch (Exception ex) { Log.Write("load settings failed: " + ex.Message); }

        // one-time migration from the old Windows registry location
        if (OperatingSystem.IsWindows())
        {
            try
            {
                using var k = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Scribe");
                if (k?.GetValue("Editor") is string v && !string.IsNullOrWhiteSpace(v)) { SaveEditor(v); Log.Write("migrated editor from registry"); }
            }
            catch { }
        }
    }

    public static void SaveEditor(string? v)
    {
        Editor = string.IsNullOrWhiteSpace(v) ? null : v.Trim();
        try { File.WriteAllText(FilePath, JsonSerializer.Serialize(new Data { Editor = Editor })); }
        catch (Exception ex) { Log.Write("save settings failed: " + ex.Message); }
    }
}
