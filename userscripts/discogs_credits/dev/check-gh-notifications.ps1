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
# Logging is split across three files so each side is auditable:
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

if (-not (Test-Path $credFile)) {
    Log-Line "ERROR: missing $credFile -- bot PAT not found, exiting"
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

$qs = 'all=false&participating=true'
if ($state.lastPolled) { $qs = $qs + '&since=' + $state.lastPolled }
$apiUrl = 'https://api.github.com/notifications?' + $qs

$notifs = @()
try {
    $resp = Invoke-RestMethod -Uri $apiUrl -Headers $headers -ErrorAction Stop
    if ($resp) { $notifs = @($resp) }
} catch {
    Log-Line "ERROR: GH /notifications fetch failed: $($_.Exception.Message)"
    Write-Error "Failed to fetch notifications: $($_.Exception.Message)"
    exit 1
}

# Filter to threads where the latest comment is by someone OTHER than the
# bot. Self-comments (the bot opening / commenting on its own PRs) are
# noise.
$actionable = @()
foreach ($n in $notifs) {
    if (-not $n.subject.latest_comment_url) { continue }
    if ($state.seenComments -contains $n.subject.latest_comment_url) { continue }
    try {
        $comment = Invoke-RestMethod -Uri $n.subject.latest_comment_url -Headers $headers -ErrorAction Stop
        $author = $comment.user.login
        if ($author -and $author -ne $botLogin) {
            $actionable += [pscustomobject]@{
                title      = $n.subject.title
                author     = $author
                type       = $n.subject.type
                url        = $n.subject.url -replace 'api\.github\.com/repos', 'github.com'
                commentUrl = $n.subject.latest_comment_url
            }
        }
    } catch {
        # Comment fetch failed (deleted / 404) -- skip silently.
    }
}

if ($actionable.Count -eq 0) {
    Log-Line "OK: $($notifs.Count) unread, 0 actionable"
    Write-Host "Polled GH: $($notifs.Count) unread thread(s), 0 actionable."
    # Update state -- nothing to dedupe, just bump lastPolled.
    $newState = [pscustomobject]@{
        lastPolled   = (Get-Date).ToUniversalTime().ToString('o')
        seenComments = @(@($state.seenComments) | Where-Object { $_ } | Select-Object -Last 200)
    }
    $json = $newState | ConvertTo-Json -Depth 4
    [System.IO.File]::WriteAllText($stateFile, $json, [System.Text.UTF8Encoding]::new($false))
    exit 0
}

# POST the actionable list to the local channel server. If it's down, log
# and exit without updating state -- next poll re-attempts.
$payload = [pscustomobject]@{
    source     = 'gh-notifications-poller'
    pollAt     = (Get-Date).ToString('o')
    actionable = $actionable
} | ConvertTo-Json -Depth 5

Log-Line "DELIVER: $($actionable.Count) actionable to $channelUrl"
try {
    $resp = Invoke-WebRequest -Uri $channelUrl -Method POST `
        -Body $payload `
        -ContentType 'application/json' `
        -TimeoutSec 5 `
        -UseBasicParsing `
        -ErrorAction Stop
    $status = [int]$resp.StatusCode
    if ($status -lt 200 -or $status -ge 300) {
        Log-Line "WARN: channel returned HTTP $status; will retry next poll"
        Write-Host "Polled GH: $($notifs.Count) unread, $($actionable.Count) actionable -- channel HTTP $status, will retry."
        exit 0
    }
    Log-Line "OK: delivered to channel (HTTP $status)"
    Write-Host "Polled GH: $($notifs.Count) unread, $($actionable.Count) actionable -- delivered to channel."
} catch {
    # Connection refused / timeout / DNS / etc. -- Claude session is
    # probably not running with the channel attached. Skip state update.
    $msg = $_.Exception.Message
    Log-Line "channel-down: $msg -- not updating state, will retry next poll"
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
