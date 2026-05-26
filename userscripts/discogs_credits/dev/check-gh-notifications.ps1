# Poll GitHub for new repo notifications. When a non-self comment lands on
# a thread the bot owns, POST the actionable list to the local MCP channel
# server (`dev/notif-channel/webhook.mjs`) so the running Claude Code
# session can react to it with full transcript context.
#
# No fallback: if the channel server isn't reachable (Claude session not
# running, or webhook.mjs not loaded as an MCP server), the poller logs
# `channel-down` and exits without doing anything. The actionable items
# stay un-deduped in the state file, so the next poll re-attempts.
#
# Cost model: zero Anthropic tokens unless an event reaches Claude. The
# poll itself is just an HTTPS call to GH + a local TCP probe.
#
# Logging is verbose by design — every tick writes a `=== poll start ===`
# block ending in `=== poll end OK ===` or `=== poll end ERROR ===` to
# `dev/.notif-poll.log`. Between the markers: the exact GH URL, response
# status, every thread inspected with title/type/reason/updated, the
# per-thread filter decision (actionable / skipped + why), and the
# channel POST outcome. Each log line is timestamped so you can grep
# `=== poll start ===` to find tick boundaries.
#
#   dev/.notification-state.json   last-poll timestamp + dedupe set
#   dev/.notif-poll.log            per-poll outcome from this script
#   dev/notif-channel/.channel.log webhook.mjs's view of each POST
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File dev/check-gh-notifications.ps1
# Task Scheduler does the same on a recurring trigger.

$ErrorActionPreference = 'Stop'

$here       = Split-Path -Parent $MyInvocation.MyCommand.Path
$credFile   = Join-Path $here '.github-credentials.json'
$stateFile  = Join-Path $here '.notification-state.json'
$pollLog    = Join-Path $here '.notif-poll.log'
$channelUrl = 'http://127.0.0.1:8788'

function Log-Line {
    param([string]$msg)
    $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    try { Add-Content -Path $pollLog -Value "[$ts] $msg" } catch {}
}

Log-Line '=== poll start ==='

if (-not (Test-Path $credFile)) {
    Log-Line "  ERROR: missing $credFile -- bot PAT not found"
    Log-Line '=== poll end ERROR ==='
    Write-Error "Missing $credFile -- bot PAT not found."
    exit 1
}

$cred     = Get-Content $credFile -Raw | ConvertFrom-Json
$pat      = $cred.token
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
    'User-Agent'  = 'mb-userscripts-notifier/2.0'
}

# GH requires `since` in ISO 8601 `YYYY-MM-DDTHH:MM:SSZ` (no fractional
# seconds). PowerShell 7+'s ConvertFrom-Json auto-parses ISO strings into
# `[DateTime]`, which then string-interpolates as the current locale
# (e.g. `05/26/2026 16:30:02` in US) — GH 422s on that. PS 5.x doesn't
# auto-parse, so Task-Scheduler-launched runs were unaffected. Normalize
# to a culture-invariant ISO string regardless of how the JSON parser
# represented the field.
$qs = 'all=false&participating=true'
$sinceText = $null
if ($state.lastPolled) {
    $sinceText = if ($state.lastPolled -is [DateTime]) {
        $state.lastPolled.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ', [System.Globalization.CultureInfo]::InvariantCulture)
    } else {
        # Already a string -- trim fractional seconds if present so we
        # always send the canonical GH-accepted form.
        ([string]$state.lastPolled) -replace '\.\d+Z$', 'Z'
    }
    $qs = $qs + '&since=' + $sinceText
}
$apiUrl = 'https://api.github.com/notifications?' + $qs
Log-Line "  bot=$botLogin  since=$sinceText"
Log-Line "  GET $apiUrl"

$notifs = @()
try {
    # Invoke-WebRequest gives access to StatusCode for the log; convert
    # body once afterwards. `-UseBasicParsing` keeps it light.
    $resp = Invoke-WebRequest -Uri $apiUrl -Headers $headers -UseBasicParsing -ErrorAction Stop
    $status = [int]$resp.StatusCode
    $notifs = if ($resp.Content) { @(($resp.Content | ConvertFrom-Json)) } else { @() }
    Log-Line "    -> HTTP $status, $($notifs.Count) thread(s)"
} catch {
    $msg = $_.Exception.Message
    $body = ''
    $statusCode = ''
    if ($_.Exception.Response) {
        try {
            $statusCode = [int]$_.Exception.Response.StatusCode
            # PS 7+: ErrorDetails carries the response body; PS 5.x: read
            # the stream directly. Cover both.
            if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
                $body = $_.ErrorDetails.Message
            } else {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $body = $reader.ReadToEnd()
                    $reader.Close()
                }
            }
        } catch {}
    }
    Log-Line "    -> ERROR: HTTP $statusCode  $msg"
    if ($body) { Log-Line "       body: $($body.Substring(0, [Math]::Min(500, $body.Length)))" }
    Log-Line '=== poll end ERROR ==='
    Write-Error "Failed to fetch notifications: $msg"
    exit 1
}

# Inspect each notification. Two paths:
#   - Has `latest_comment_url`: fetch the comment, treat as actionable if
#     its author is someone OTHER than the bot (self-comments are noise).
#   - No `latest_comment_url` (typical for `state_change` events like
#     merges, `subscribed`, etc.): surface the notification itself as
#     actionable, using `kind=event` so the channel side can distinguish
#     from regular comments. Dedupe by `<thread-id>@<updated_at>` so the
#     same merge doesn't fire twice.
$actionable = @()
foreach ($n in $notifs) {
    $title = $n.subject.title
    $type  = $n.subject.type
    $reason = $n.reason
    $updated = $n.updated_at
    # Subject url shape (issues + PRs share the same trailing `/N`):
    #   https://api.github.com/repos/<owner>/<repo>/{issues|pulls}/65
    # Extract `65` -> render as `#65` for log lines.
    $num = ''
    if ($n.subject.url -and $n.subject.url -match '/(\d+)(?:[?#].*)?$') {
        $num = '#' + $matches[1]
    }
    $label = if ($num) { "$num '$title'" } else { "'$title'" }
    Log-Line "  $label  (type=$type, reason=$reason, updated=$updated)"

    if ($n.subject.latest_comment_url) {
        # === comment path =================================================
        if ($state.seenComments -contains $n.subject.latest_comment_url) {
            Log-Line '    -> skip: already seen (dedupe)'
            continue
        }
        try {
            $comment = Invoke-RestMethod -Uri $n.subject.latest_comment_url -Headers $headers -ErrorAction Stop
            $author = $comment.user.login
            if (-not $author) {
                Log-Line '    -> skip: comment has no author'
                continue
            }
            if ($author -eq $botLogin) {
                Log-Line "    -> skip: latest comment by self ($author)"
                continue
            }
            Log-Line "    -> ACTIONABLE (comment): latest comment by $author"
            $actionable += [pscustomobject]@{
                kind       = 'comment'
                number     = $num
                title      = $title
                author     = $author
                type       = $type
                reason     = $reason
                url        = $n.subject.url -replace 'api\.github\.com/repos', 'github.com'
                commentUrl = $n.subject.latest_comment_url
            }
        } catch {
            $cmsg = $_.Exception.Message
            Log-Line "    -> skip: comment fetch failed: $cmsg"
        }
        continue
    }

    # === event path (merges, state_change, subscribed, etc.) =============
    # No comment URL means GH considers this a thread-level event. We use
    # `thread.id@updated_at` as a dedupe key so the same merge doesn't
    # fire on a second tick (since the same event can stay in the
    # notification list briefly after first seen).
    $eventKey = "$($n.id)@$updated"
    if ($state.seenComments -contains $eventKey) {
        Log-Line '    -> skip: already seen (dedupe)'
        continue
    }
    Log-Line "    -> ACTIONABLE (event): no comment; surfacing reason=$reason"
    $actionable += [pscustomobject]@{
        kind       = 'event'
        number     = $num
        title      = $title
        author     = ''        # event has no single author
        type       = $type
        reason     = $reason   # state_change / subscribed / …
        url        = $n.subject.url -replace 'api\.github\.com/repos', 'github.com'
        commentUrl = $eventKey # carries the dedupe key for state update below
    }
}

Log-Line "  result: $($notifs.Count) unread, $($actionable.Count) actionable"
if ($actionable.Count -gt 0) {
    # One-line summary of every actionable item:
    #   '#65 by majkinetor: title'             (comment)
    #   '#70 event (state_change): title'      (event)
    foreach ($a in $actionable) {
        $tag = if ($a.number) { $a.number } else { '#?' }
        $who = if ($a.kind -eq 'event') { "event ($($a.reason))" } else { "by $($a.author)" }
        Log-Line "    $tag ${who}: $($a.title)"
    }
}

if ($actionable.Count -eq 0) {
    # Nothing to deliver -- just bump lastPolled.
    $newState = [pscustomobject]@{
        lastPolled   = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ', [System.Globalization.CultureInfo]::InvariantCulture)
        seenComments = @(@($state.seenComments) | Where-Object { $_ } | Select-Object -Last 200)
    }
    $json = $newState | ConvertTo-Json -Depth 4
    [System.IO.File]::WriteAllText($stateFile, $json, [System.Text.UTF8Encoding]::new($false))
    Log-Line '=== poll end OK ==='
    Write-Host "Polled GH: $($notifs.Count) unread thread(s), 0 actionable."
    exit 0
}

# POST the actionable list to the local channel server. If it's down, log
# and exit without updating state -- next poll re-attempts.
$payload = [pscustomobject]@{
    source     = 'gh-notifications-poller'
    pollAt     = (Get-Date).ToString('o')
    actionable = $actionable
} | ConvertTo-Json -Depth 5

Log-Line "  POST $channelUrl  ($($actionable.Count) actionable, $($payload.Length) bytes)"
try {
    $resp = Invoke-WebRequest -Uri $channelUrl -Method POST `
        -Body $payload `
        -ContentType 'application/json' `
        -TimeoutSec 5 `
        -UseBasicParsing `
        -ErrorAction Stop
    $status = [int]$resp.StatusCode
    if ($status -lt 200 -or $status -ge 300) {
        Log-Line "    -> WARN: channel returned HTTP $status; will retry next poll"
        Log-Line '=== poll end OK (channel-degraded) ==='
        Write-Host "Polled GH: $($notifs.Count) unread, $($actionable.Count) actionable -- channel HTTP $status, will retry."
        exit 0
    }
    Log-Line "    -> HTTP $status, delivered"
} catch {
    # Connection refused / timeout / DNS / etc. -- Claude session is
    # probably not running with the channel attached. Skip state update.
    $msg = $_.Exception.Message
    Log-Line "    -> channel-down: $msg (not updating state, will retry next poll)"
    Log-Line '=== poll end OK (channel-down) ==='
    Write-Host "Polled GH: $($notifs.Count) unread, $($actionable.Count) actionable -- channel down, will retry."
    exit 0
}

# Channel delivered successfully -- now safe to update dedupe state so the
# same items don't fire again next poll.
$prev = @($state.seenComments) | Where-Object { $_ }
$new  = @($actionable | ForEach-Object { $_.commentUrl }) | Where-Object { $_ }
$allSeen = @($prev) + @($new) | Select-Object -Last 200
$newState = [pscustomobject]@{
    lastPolled   = (Get-Date).ToUniversalTime().ToString('o')
    seenComments = @($allSeen)
}
$json = $newState | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($stateFile, $json, [System.Text.UTF8Encoding]::new($false))
Log-Line '=== poll end OK ==='
Write-Host "Polled GH: $($notifs.Count) unread, $($actionable.Count) actionable -- delivered to channel."
