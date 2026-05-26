# Poll GitHub for new repo notifications and show a Windows toast for each
# unread thread that has fresh activity since the last poll.
#
# Used by the maintainer to learn about external GH events (issue comments,
# reviews, mentions on the bot's PRs) without having Claude in the loop.
# Task Scheduler invokes this every N minutes; the Claude session stays
# silent until the user actually engages it.
#
# Auth: reads the same bot PAT that the rest of the workflow uses
#   (`dev/.github-credentials.json`). Querying GH notifications requires the
#   `notifications` scope, which the bot PAT already has.
#
# State: `dev/.notification-state.json` (gitignored) — stores the ISO8601
# timestamp of the previous poll so the next poll only sees fresh activity.
# Wipe this file to "see everything again from now on".
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File dev/check-gh-notifications.ps1
#   (Task Scheduler does the same, on a recurring trigger.)
#
# To register the task, run `dev/install-notification-task.ps1` once.

$ErrorActionPreference = 'Stop'

$here      = Split-Path -Parent $MyInvocation.MyCommand.Path
$credFile  = Join-Path $here '.github-credentials.json'
$stateFile = Join-Path $here '.notification-state.json'

if (-not (Test-Path $credFile)) {
    Write-Error "Missing $credFile — bot PAT not found."
    exit 1
}

$cred = Get-Content $credFile -Raw | ConvertFrom-Json
$pat  = $cred.token
$botLogin = if ($cred.login) { $cred.login } else { 'claude-ai-milic' }

# Load previous-poll state. First run: poll all unread non-self threads.
$state = if (Test-Path $stateFile) {
    Get-Content $stateFile -Raw | ConvertFrom-Json
} else {
    [pscustomobject]@{ lastPolled = $null; seenComments = @() }
}

$headers = @{
    Authorization = "token $pat"
    Accept        = 'application/vnd.github+json'
    'User-Agent'  = 'mb-userscripts-notifier/1.0'
}

# Query unread, participating threads (the same filter the Claude-side
# checks have been using). `since=<ts>` further narrows to fresh activity.
$qs = 'all=false&participating=true'
if ($state.lastPolled) { $qs = $qs + '&since=' + $state.lastPolled }
$apiUrl = 'https://api.github.com/notifications?' + $qs

$notifs = @()
try {
    $resp = Invoke-RestMethod -Uri $apiUrl -Headers $headers -ErrorAction Stop
    if ($resp) { $notifs = @($resp) }
} catch {
    Write-Error "Failed to fetch notifications: $($_.Exception.Message)"
    exit 1
}

# Filter: only surface threads whose latest comment is by someone OTHER
# than the bot. Self-comments (the bot opening / commenting on its own
# PRs) are noise the maintainer doesn't need to see.
$actionable = @()
foreach ($n in $notifs) {
    if (-not $n.subject.latest_comment_url) { continue }
    # Skip threads whose latest_comment URL hasn't changed since last poll —
    # avoids re-firing on the same activity if the user clicks but doesn't
    # mark-read.
    if ($state.seenComments -contains $n.subject.latest_comment_url) { continue }
    try {
        $comment = Invoke-RestMethod -Uri $n.subject.latest_comment_url -Headers $headers -ErrorAction Stop
        $author = $comment.user.login
        if ($author -and $author -ne $botLogin) {
            $actionable += [pscustomobject]@{
                title  = $n.subject.title
                author = $author
                type   = $n.subject.type
                url    = $n.subject.url -replace 'api\.github\.com/repos', 'github.com'
                commentUrl = $n.subject.latest_comment_url
            }
        }
    } catch {
        # Comment fetch failed (deleted / 404) — skip silently.
    }
}

# Show one balloon per actionable thread. NotifyIcon.ShowBalloonTip needs
# an icon to be visible; we use the system Information icon. The script
# disposes the icon after the balloon timeout — without that, the tray
# would accumulate one icon per run.
if ($actionable.Count -gt 0) {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    foreach ($a in $actionable) {
        $ni = New-Object System.Windows.Forms.NotifyIcon
        $ni.Icon    = [System.Drawing.SystemIcons]::Information
        $ni.Visible = $true
        $title   = "GH ($($a.type)): $($a.author)"
        $message = $a.title
        $ni.ShowBalloonTip(8000, $title, $message, [System.Windows.Forms.ToolTipIcon]::Info)
        Start-Sleep -Milliseconds 800
        $ni.Dispose()
    }
}

# Update state. `lastPolled` is now (so the next call uses `since=`);
# `seenComments` is the union of previous + this run's comment URLs,
# capped to the most recent 200 so the file doesn't grow unbounded.
# The `Where-Object { $_ }` filter drops empties — PowerShell sometimes
# materialises `null` placeholders from coerced empty arrays, which
# would otherwise accumulate in the JSON.
$prev = @($state.seenComments) | Where-Object { $_ }
$new  = @($actionable | ForEach-Object { $_.commentUrl }) | Where-Object { $_ }
$allSeen = @($prev) + @($new) | Select-Object -Last 200
$newState = [pscustomobject]@{
    lastPolled   = (Get-Date).ToUniversalTime().ToString('o')
    seenComments = @($allSeen)
}
# Write UTF-8 *without* BOM. `Set-Content -Encoding UTF8` writes BOM on
# PS5.x; `[System.IO.File]::WriteAllText` with a no-BOM encoding writes
# clean UTF-8 across PS versions.
$json = $newState | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($stateFile, $json, [System.Text.UTF8Encoding]::new($false))

Write-Host "Polled GH: $($notifs.Count) unread thread(s), $($actionable.Count) actionable."
