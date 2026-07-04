namespace Scribe;

// "Run with the OS" — per platform:
//   Windows: HKCU\…\Run registry value
//   macOS:   ~/Library/LaunchAgents/org.musicbrainz.scribe.plist  (RunAtLoad)
//   Linux:   ~/.config/autostart/scribe.desktop  (XDG autostart)
internal static class Startup
{
    public static bool IsEnabled()
    {
        try
        {
            if (OperatingSystem.IsWindows()) return WinGet() != null;
            if (OperatingSystem.IsMacOS()) return File.Exists(MacPlist);
            return File.Exists(LinuxDesktop);
        }
        catch { return false; }
    }

    // `command` is the Windows Run-key command line (from BuildRunCommand); mac/Linux build their
    // own argument list from Program.Port/Token so the same exe path + flags are used.
    public static void Set(bool on, string command)
    {
        if (OperatingSystem.IsWindows()) { WinSet(on, command); return; }
        if (OperatingSystem.IsMacOS()) { MacSet(on); return; }
        LinuxSet(on);
    }

    static string[] ArgList()
    {
        var exe = Environment.ProcessPath ?? "scribe";
        return new[] { exe, "--port", Program.Port.ToString(), "--token", Program.Token };
    }

    // ── Windows ──
    const string WinKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    const string WinValue = "Scribe";
    static string? WinGet()
    {
        using var k = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(WinKey);
        return k?.GetValue(WinValue) as string;
    }
    static void WinSet(bool on, string command)
    {
        using var k = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(WinKey, true) ?? Microsoft.Win32.Registry.CurrentUser.CreateSubKey(WinKey);
        if (on) k!.SetValue(WinValue, command);
        else k!.DeleteValue(WinValue, false);
    }

    // ── macOS ──
    static string MacPlist => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Library", "LaunchAgents", "org.musicbrainz.scribe.plist");
    static void MacSet(bool on)
    {
        if (!on) { try { File.Delete(MacPlist); } catch { } return; }
        Directory.CreateDirectory(Path.GetDirectoryName(MacPlist)!);
        var argsXml = string.Concat(ArgList().Select(a => $"    <string>{Esc(a)}</string>\n"));
        File.WriteAllText(MacPlist,
$@"<?xml version=""1.0"" encoding=""UTF-8""?>
<!DOCTYPE plist PUBLIC ""-//Apple//DTD PLIST 1.0//EN"" ""http://www.apple.com/DTDs/PropertyList-1.0.dtd"">
<plist version=""1.0""><dict>
  <key>Label</key><string>org.musicbrainz.scribe</string>
  <key>ProgramArguments</key><array>
{argsXml}  </array>
  <key>RunAtLoad</key><true/>
</dict></plist>");
    }

    // ── Linux (XDG autostart; ApplicationData maps to ~/.config) ──
    static string LinuxDesktop => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "autostart", "scribe.desktop");
    static void LinuxSet(bool on)
    {
        if (!on) { try { File.Delete(LinuxDesktop); } catch { } return; }
        Directory.CreateDirectory(Path.GetDirectoryName(LinuxDesktop)!);
        var exec = string.Join(" ", ArgList().Select(a => a.Contains(' ') ? $"\"{a}\"" : a));
        File.WriteAllText(LinuxDesktop,
            "[Desktop Entry]\nType=Application\nName=Scribe helper\nExec=" + exec + "\nX-GNOME-Autostart-enabled=true\nNoDisplay=true\n");
    }

    static string Esc(string s) => s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;");
}
