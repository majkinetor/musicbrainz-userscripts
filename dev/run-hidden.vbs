' Launch a PowerShell script with NO console window flash.
'
' Background: Task Scheduler invoking `powershell.exe -WindowStyle Hidden
' -File <script>.ps1` still flashes a console window for one frame before
' the runtime applies the Hidden style — long-standing Windows quirk.
' WScript.Shell.Run with intWindowStyle = 0 starts the process with no
' window from the very first frame, eliminating the flicker.
'
' Usage:
'   wscript.exe run-hidden.vbs <absolute-path-to-script.ps1>
'
' Wired in from `install-notification-task.ps1`; the registered task
' invokes wscript on this file instead of powershell directly.

If WScript.Arguments.Count < 1 Then
    WScript.Quit 1
End If

Dim shell, cmd
Set shell = CreateObject("WScript.Shell")
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & WScript.Arguments(0) & """"

' Run(command, intWindowStyle, bWaitOnReturn)
'   intWindowStyle = 0  -> hidden, no window ever shown
'   bWaitOnReturn  = True -> propagate exit code so Task Scheduler logs it
shell.Run cmd, 0, True
