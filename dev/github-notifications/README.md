# GitHub Notifications Poller

Windows Task Scheduler entry that polls GitHub for new actionable activity (issues / PR comments / merges / mentions) on `majkinetor/musicbrainz-userscripts` and pushes them into a running Claude Code session as `<channel source="notif-channel">` events. The session reacts in real time without anyone re-prompting it.

The "channel" half of the loop lives at [`../notif-channel/`](../notif-channel/) — a tiny Node-based MCP server. This dir is just the **poller** half.

## Files

| File | Purpose |
|---|---|
| `check-gh-notifications.ps1` | The poller. Calls `/notifications`, classifies each thread, POSTs the actionable list to `http://127.0.0.1:8788`. Verbose log written per tick. Self-contained — no module dependencies. |
| `install-notification-task.ps1` | Registers (or replaces) the Task Scheduler entry that runs the poller every 10 min from 09:00 to 23:50 local time. Idempotent — re-running updates the task in place. |
| `run-hidden.vbs` | wscript wrapper so the registered task doesn't flash a PowerShell console window on every tick. See its header for the rationale (registering powershell directly with `-WindowStyle Hidden` still flashes; wscript starts truly hidden). |

## Runtime state (gitignored)

| File | Purpose |
|---|---|
| `.notification-state.json` | Last-poll ISO timestamp + dedupe set of comment IDs already delivered. Survives across polls; lets the script avoid re-emitting the same event. |
| `.notif-poll.log` | Every tick appends a `=== poll start ===` block ending in `=== poll end OK ===` or `=== poll end ERROR ===`. Between the markers: GH URL, response code, every thread inspected with title/type/reason/updated, the per-thread filter decision (actionable / skipped + why), and the channel POST outcome. Grep `=== poll start ===` for tick boundaries. |

## Install / uninstall

From repo root:

```powershell
# Install (or re-install — idempotent)
powershell -ExecutionPolicy Bypass -File dev\github-notifications\install-notification-task.ps1

# Uninstall
schtasks /Delete /TN "Check github notifications for mb-userscripts" /F
```

Adjust `$startMinutes` and `$hourRange` in `install-notification-task.ps1` if the default 10-min cadence between 09:00–23:50 doesn't suit you.

## Manual one-shot

To run a single poll without waiting for the next tick:

```powershell
powershell -ExecutionPolicy Bypass -File dev\github-notifications\check-gh-notifications.ps1
```

Useful when iterating on filter rules or after editing the script — confirms it still parses + the channel server is reachable before the next scheduled run.

## Auth

Reads the bot PAT from `../.github-credentials.json` (repo-root `dev/`). Failing to find it is a hard error; the poll exits before hitting the API.
