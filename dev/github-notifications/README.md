# GitHub Notifications Poller

Pushes new GitHub activity (issues / PR comments / merges / @-mentions) into a **running** Claude Code session as `<channel source="notif-channel">` events, so the bot reacts in real time with full conversation context. Zero Anthropic tokens consumed unless something actually gets delivered.

The two halves of the pipeline:

- **[`check-gh-notifications.ps1`](./check-gh-notifications.ps1)** (this dir) — polls GitHub's `/notifications` endpoint for new threads, filters to actionable ones, POSTs them to the local channel server. Registered with Task Scheduler to fire every 10 minutes.
- **[`../notif-channel/webhook.mjs`](../notif-channel/webhook.mjs)** — the MCP channel server. Started by Claude Code as a subprocess (via `.mcp.json`). Listens on `http://127.0.0.1:8788`; every POST received becomes a channel event in the running session.

When no Claude session is up with the channel attached, the poller logs `channel-down` and exits without updating state — it'll re-attempt on the next tick. No fallback to `claude -p` (a fresh session loses the conversation context that makes Claude useful here).

## Files

| File | Purpose |
|---|---|
| `check-gh-notifications.ps1` | The poller. Calls `/notifications` + a Search API pass for merged PRs, classifies each thread, POSTs the actionable list to `http://127.0.0.1:8788`, marks each delivered thread as read. Verbose log per tick. Self-contained — no module dependencies. |
| `install-notification-task.ps1` | Registers (or replaces) the Task Scheduler entry that runs the poller every 10 min from 09:00 to 23:50 local time. Idempotent — re-running updates the task in place. |
| `run-hidden.vbs` | wscript wrapper so the registered task doesn't flash a PowerShell console window on every tick. See its header for the rationale (registering powershell directly with `-WindowStyle Hidden` still flashes; wscript starts truly hidden). |

## Runtime state (gitignored)

| File | Purpose |
|---|---|
| `.notification-state.json` | Last-poll ISO timestamp + dedupe set of recently-delivered comment IDs. Survives across polls; lets the script avoid re-emitting the same comment-on-issue twice. |
| `.notif-poll.log` | Every tick appends a `=== poll start ===` block ending in `=== poll end OK ===` or `=== poll end ERROR ===`. Between the markers: GH URL, response code, every thread inspected with title/type/reason/updated, the per-thread filter decision (actionable / skipped + why), channel POST outcome, and mark-as-read PATCHes. Grep `=== poll start ===` for tick boundaries. |
| `../notif-channel/.channel.log` | The MCP server's view: each POST received, whether it forwarded to Claude. Useful when the poll log says delivered but Claude reports nothing. |

## One-time setup

```powershell
# 1. Install the MCP SDK for the channel server
cd dev\notif-channel
npm install
cd ..\..

# 2. Enable the MCP server — Claude reads this on session start
copy dev\notif-channel\mcp.json.template .mcp.json

# 3. Register the recurring poll (every 10 min, 09:00–23:50 local ≈ 90 polls/day)
powershell -ExecutionPolicy Bypass -File dev\github-notifications\install-notification-task.ps1
```

### Make the bot watch the repo

For the bot account (`claude-ai-milic`) to receive notifications on issue activity it didn't directly trigger, it has to **watch the repo**. Being assigned or @-mentioned generates the first one-shot notification, but per-thread auto-subscribe only kicks in when the account is watching the repo at least at the "Participating" level. Without this, the bot gets the initial assign event and then no follow-up comments — silent gap.

```powershell
$pat = (Get-Content dev\.github-credentials.json -Raw | ConvertFrom-Json).token
$h = @{ Authorization = "token $pat"; Accept = 'application/vnd.github+json'; 'User-Agent' = 'mb-userscripts-notifier' }
$body = '{"subscribed":true,"ignored":false}'
Invoke-RestMethod -Uri 'https://api.github.com/repos/majkinetor/musicbrainz-userscripts/subscription' `
    -Method PUT -Headers $h -ContentType 'application/json' -Body $body
```

This needs to run once per bot account, not once per checkout.

## Day-to-day

Launch Claude **with the channel attached** from the repo root:

```powershell
cd C:\Work\mb-userscripts
claude --dangerously-load-development-channels server:notif-channel
```

(The `--dangerously-load-development-channels` flag is required during the channels research preview — custom channels aren't on the Anthropic allowlist yet.)

Keep that terminal open as long as you want auto-react. The poller fires every 10 min; if there's actionable activity, the Claude session there receives the event and acts.

## Manual one-shot

To run a single poll without waiting for the next tick:

```powershell
powershell -ExecutionPolicy Bypass -File dev\github-notifications\check-gh-notifications.ps1
```

Useful when iterating on filter rules or after editing the script — confirms the parse, the API auth, and the channel reachability before the next scheduled run.

## Auth

The poller reads the bot PAT from `../.github-credentials.json` (repo-root `dev/`). Missing file is a hard error; the poll exits before hitting the API. The PAT needs `repo` + `notifications` scopes (classic PAT — fine-grained tokens don't have notifications scope).

## Manage the scheduled task

```powershell
schtasks /Query  /TN "Check github notifications for mb-userscripts" /V /FO LIST   # status + last run
schtasks /Change /TN "Check github notifications for mb-userscripts" /DISABLE      # pause
schtasks /Change /TN "Check github notifications for mb-userscripts" /ENABLE       # resume
schtasks /Delete /TN "Check github notifications for mb-userscripts" /F            # remove
```

Uninstall flow: `/Delete /F` the task, optionally also `Invoke-RestMethod -Method DELETE -Uri 'https://api.github.com/repos/majkinetor/musicbrainz-userscripts/subscription' -Headers $h` to unwatch the repo.

## What "actionable" means

The filter runs against each unread notification:

| Reason | Treated as |
|---|---|
| `assign` | Actionable (new issue assigned to the bot) |
| `mention` | Actionable (@-mention of the bot) |
| `comment` on a thread the bot is participating in | Actionable IF the latest comment author ≠ the bot itself |
| `state_change`, `subscribed`, etc. | Actionable as `kind=event` (no comment payload) |
| `author` (the bot is the author of the thread) | Skipped — own activity |

A second deterministic pass runs the Search API for PRs the bot authored that were `merged` since `lastPolled`, since GitHub doesn't reliably emit notification events for those.

After successful delivery, each delivered thread is PATCHed to mark as read — keeps the bot's `/notifications` list clean so future polls aren't churning through stale already-handled items.

## Troubleshooting

- **"channel-down" in the log every tick** — no Claude session is up with the channel attached. Start one: `claude --dangerously-load-development-channels server:notif-channel` from the repo root.
- **Bot doesn't get notified despite being assigned** — confirm the bot is watching the repo (see the one-time-setup section above). `gh api repos/majkinetor/musicbrainz-userscripts/subscription` should return `subscribed: true`, not 404.
- **Same event delivered twice** — check `.notification-state.json` — the `seenComments` array should contain the dedupe keys. If it's getting truncated unexpectedly, see the `Select-Object -Last 200` line in the script.
- **PowerShell window flashes on tick** — `run-hidden.vbs` isn't being used. Re-run `install-notification-task.ps1` to fix the task action.
