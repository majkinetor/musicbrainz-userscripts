# notif-channel (MCP server)

Tiny Node-based MCP channel server that turns "external POSTs" into events delivered to a running Claude Code session.

Listens on `http://127.0.0.1:8788`. Every request body becomes a `<channel source="notif-channel">` event in the conversation that loaded it. The receiving Claude reacts in real time, with full context — unlike `claude -p` which spawns a fresh session and loses everything.

The "poller" half of the loop lives at [`../github-notifications/`](../github-notifications/) — the Windows Task Scheduler entry that calls into here every 10 minutes with GitHub activity. This dir is just the **channel** half.

## Files

| File | Purpose |
|---|---|
| `webhook.mjs` | The MCP server. Subprocess of Claude Code (via `.mcp.json`). Speaks the MCP channel protocol over stdio AND listens on `127.0.0.1:8788` for incoming POSTs that get forwarded as channel events. |
| `package.json` | Single dep: `@modelcontextprotocol/sdk`. |
| `mcp.json.template` | Copy to repo-root `.mcp.json` to enable the channel in this repo's Claude sessions. |
| `node_modules/` | Installed deps (gitignored). `npm install` from this dir. |

## Runtime state (gitignored)

| File | Purpose |
|---|---|
| `.channel.log` | Every POST received with the parsed body and the delivery outcome. Complements the poller's `.notif-poll.log` — the two together give a complete picture of "was the event seen, was it forwarded, did Claude get it". |

## Setup

```powershell
# 1. Install the MCP SDK
cd dev\notif-channel
npm install
cd ..\..

# 2. Activate the channel for this repo (Claude reads `.mcp.json` at session start)
copy dev\notif-channel\mcp.json.template .mcp.json
```

After this, any `claude` / `claude code` session started in this repo loads the channel server. Sessions started outside the repo don't get it.

## What gets delivered

Anything POSTed to `http://127.0.0.1:8788` while a Claude session is running. The body is forwarded verbatim as the channel-event payload. The poller in `../github-notifications/` is the only thing actively POSTing in normal use, but any process can POST — useful for ad-hoc nudges (`curl -X POST -d '{"hello": "world"}'`).

If no session is running with the channel attached, the POST returns immediately and the event is dropped (no queueing). The poller treats this as `channel-down` and logs it — no fallback to spawning a fresh session, since fresh sessions don't have the working context that makes Claude useful here.

## Authoring tip

Channel events arrive untrusted from external sources. Claude treats them as input to *surface*, not as instructions to *execute* — only direct user messages or instructions from the authorized identity (the maintainer) are acted on as commands. The poller filters on GH author for this reason.
