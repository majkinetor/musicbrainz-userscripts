#if WINDOWS
using System.Windows.Forms;

namespace Scribe;

// Windows-only system-tray UI (Set editor · Open log · Run at startup · Exit), built on WinForms — which
// ships in the Windows Desktop runtime, so it adds no third-party dependency and keeps the exe tiny.
internal static class WinTray
{
    public static void Run()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new ScribeTray());
    }
}

internal sealed class ScribeTray : ApplicationContext
{
    readonly NotifyIcon _icon;

    public ScribeTray()
    {
        var menu = new ContextMenuStrip();
        menu.Items.Add(new ToolStripMenuItem($"Scribe helper v{Program.Version} — port {Program.Port}") { Enabled = false });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Set editor…", null, (_, _) =>
        {
            var v = Prompt("Editor command — e.g.  code -r   ·   subl   ·   \"C:\\Program Files\\…\\Code.exe\" -r\nBlank = OS default for the file type;  none = don't auto-open.", "Scribe — set editor", Settings.Editor ?? "");
            if (v != null) { Settings.SaveEditor(v); Log.Write("editor set: " + (Settings.Editor ?? "(OS default)")); }
        });
        menu.Items.Add("Open log", null, (_, _) => Log.OpenInViewer());
        var startupItem = new ToolStripMenuItem("Run at startup") { CheckOnClick = true, Checked = Startup.IsEnabled() };
        startupItem.Click += (_, _) =>
        {
            try { Startup.Set(startupItem.Checked, Program.RunCmd); Log.Write("Run at startup: " + (startupItem.Checked ? "on" : "off")); }
            catch (Exception ex) { Log.Write("startup toggle failed: " + ex.Message); }
        };
        menu.Items.Add(startupItem);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Exit", null, (_, _) => { _icon!.Visible = false; Environment.Exit(0); });
        _icon = new NotifyIcon { Icon = TrayIcon(), Text = "Scribe helper", Visible = true, ContextMenuStrip = menu };
        _icon.DoubleClick += (_, _) => Log.OpenInViewer();
    }

    // a tiny modal text prompt (WinForms has no built-in InputBox); returns null on Cancel
    static string? Prompt(string text, string title, string def)
    {
        using var f = new Form { Text = title, Width = 480, Height = 200, FormBorderStyle = FormBorderStyle.FixedDialog, StartPosition = FormStartPosition.CenterScreen, MinimizeBox = false, MaximizeBox = false, TopMost = true, ShowInTaskbar = false };
        var lbl = new Label { Left = 12, Top = 10, Width = 444, Height = 56, Text = text };
        var tb = new TextBox { Left = 12, Top = 74, Width = 444, Text = def };
        var ok = new Button { Text = "OK", Left = 296, Top = 112, Width = 75, DialogResult = DialogResult.OK };
        var cancel = new Button { Text = "Cancel", Left = 381, Top = 112, Width = 75, DialogResult = DialogResult.Cancel };
        f.Controls.AddRange(new Control[] { lbl, tb, ok, cancel });
        f.AcceptButton = ok; f.CancelButton = cancel;
        return f.ShowDialog() == DialogResult.OK ? tb.Text : null;
    }

    // the [ … ] brackets-and-nib mark, drawn to match the userscript icon
    static System.Drawing.Icon TrayIcon()
    {
        try
        {
            using var bmp = new System.Drawing.Bitmap(32, 32);
            using var g = System.Drawing.Graphics.FromImage(bmp);
            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            g.Clear(System.Drawing.Color.Transparent);
            using var pen = new System.Drawing.Pen(System.Drawing.Color.FromArgb(47, 111, 84), 3f) { StartCap = System.Drawing.Drawing2D.LineCap.Round, EndCap = System.Drawing.Drawing2D.LineCap.Round };
            g.DrawLines(pen, new[] { new System.Drawing.PointF(11, 5), new System.Drawing.PointF(6, 5), new System.Drawing.PointF(6, 27), new System.Drawing.PointF(11, 27) });
            g.DrawLines(pen, new[] { new System.Drawing.PointF(21, 5), new System.Drawing.PointF(26, 5), new System.Drawing.PointF(26, 27), new System.Drawing.PointF(21, 27) });
            using var br = new System.Drawing.SolidBrush(System.Drawing.Color.FromArgb(46, 158, 91));
            g.FillPolygon(br, new[] { new System.Drawing.PointF(16, 9), new System.Drawing.PointF(11, 18), new System.Drawing.PointF(16, 26), new System.Drawing.PointF(21, 18) });
            return System.Drawing.Icon.FromHandle(bmp.GetHicon());
        }
        catch { return System.Drawing.SystemIcons.Application; }
    }
}
#endif
