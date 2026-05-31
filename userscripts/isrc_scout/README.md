# ISRC Scout

Self-contained ISRC editor that lives **on the MusicBrainz release page** — no MagicISRC, no
external editor. Reads the release's existing ISRCs, lets you fill in the missing ones from several
sources, and submits them straight to MusicBrainz.

It combines and replaces the workflow of [`isrc_check`](../isrc_check/README.md) (the button) and
[`magicisrc_soundexchange`](../magicisrc_soundexchange/README.md) (the SoundExchange search), and
adds streaming-service import and bulk tools.

![screenshot](./screenshot.png)

## The button

An **ISRC** button is injected next to the release title, showing how many tracks already have an
ISRC (`✓ 12/12`) or pulsing pink when some are missing (`⚠ 9/12`). Click it to open the editor.

## The editor

A table of every track with its existing ISRCs and an input for the new one. Live validation flags
invalid (red), duplicate (orange), and good (green) values. The footer shows how many will be
submitted.

### Import sources

| Button | Source | Auth | Notes |
| --- | --- | --- | --- |
| **⟳ SoundExchange** | [SoundExchange](https://isrc.soundexchange.com/) | none | Searches each track by title/artist, shows candidate ISRCs per row, auto-fills confident matches into empty fields. Searches are capped at **30 at a time** so SoundExchange doesn't block us — remaining tracks show a *"Not searched — click to load the next 30"* message; click any one to continue. Ported from `magicisrc_soundexchange`. |
| **Deezer** | `api.deezer.com` | none | Enabled when the release has a Deezer album relationship. Fetches each track's ISRC and maps by disc/position (title fallback). Deezer needs one request **per track**, so imports are capped at **50 tracks per batch** (a *"Deezer N/M — click to fetch the next 50"* prompt continues) to avoid spamming Deezer on huge releases. |
| **Spotify** | `isrchunt.com` | none | Enabled when the release has a Spotify album relationship. Delegates to ISRC Hunt (which does the Spotify lookup server-side) and scrapes the ISRCs from its result page — no Spotify token, login, or tab. (Direct Spotify access needs Premium and is heavily bot-blocked.) |

Source buttons only fill **empty** fields and never touch existing ISRCs.

The **Deezer** and **Spotify** buttons each have a **▾** menu to *import from a custom album URL* —
paste any Deezer/Spotify album URL (or bare id) to import from it, even when the release has no such
link. If the [`platform_check`](../platform_check/README.md) userscript is also installed and has
found a Deezer/Spotify URL for the release, the menu offers a one-click **"Use the … URL Platform
Check found"** option (skipped silently when `platform_check` isn't present).

### Per-track helpers

- **+1** — fill with the previous track's ISRC incremented by one.
- Click any SoundExchange candidate to use it, or **⚙ refine search** to open a panel where you can tweak the title/artist/release + exact toggles. The panel has a **Search on SoundExchange ↗** link that runs the same query on the SoundExchange website, and closes with **Esc** / click-outside.
- Track titles link to the MB recording. **Any** value set in a field — typed, **+1**, or imported from Deezer / Spotify / SoundExchange — is verified on SoundExchange inline (cached) with the field-level match highlighting below. ISRCs duplicated across different recordings are flagged pink.

#### Match checks & highlighting

Every SoundExchange result is checked against the MB track and **mismatching fields are highlighted in
red** (wavy underline, with a tooltip), both in the candidate list under the input, in the typed-ISRC
verification bullet, and in the search popup:

| Field | Check |
| --- | --- |
| **Title** | word-set match (tolerates a couple of extra words, e.g. a version suffix) |
| **Artist** | word-set match either direction |
| **Year** | the recording year must be **≤ the MB release year (+1)** — a later recording can't be the source of this release's ISRC |
| **Length** | flagged when it differs from MB by **> 10 s**; MB's length is shown inline (`↔ m:ss`) for comparison |

A result that passes all checks is the **best** match (blue, auto-filled when the field is empty); a
length-only disagreement is a **warn** (yellow); a title/artist/year disagreement drops it out of the
auto-fill running entirely.

### Deleting existing ISRCs

Check the box next to any existing ISRC and click **🗑 Delete checked**. Deletion goes through the
MusicBrainz recording-edit form using your logged-in session (ISRC removal isn't a WS2 operation), and
each removal is verified via the web service. Creates normal "Remove ISRC" edits — so you must be
logged into musicbrainz.org.

### Edit note

**✎ Edit note** opens a pane (hidden by default) pre-filled like `discogs_credits`: a header line
(script name, version, author, homepage — resolved from `GM_info`), the release URL, and a per-source
breakdown of what's being added (e.g. `Added 3 ISRCs: SoundExchange (2), Spotify (1)`). Edit it
freely; it's attached to every add (`<edit-note>` in the WS2 submission) and every remove.

### Bulk / Export (⇪)

- **Paste** one ISRC per line in track order (blank line skips a track), or target specific tracks:
  `3=USABC1234567`, `USABC1234567 | 1.3` (medium.track), or `1.3 USABC1234567`.
- **Apply to empty fields** / **Apply (overwrite)**.
- **Export text** (one per line) / **Export JSON** (`{ recordingMBID: "ISRC" }`) — copied to clipboard.
  Exported JSON can be pasted straight back into the box and re-applied.

## Submitting (one-time authorization)

ISRC submission to MusicBrainz **requires OAuth** — the website session cookie cannot write ISRCs,
and there is no native ISRC web form. This script uses the `submit_isrc` scope with
`access_type=offline`, so the refresh token is stored locally and you **authorize exactly once,
forever** (unlike MagicISRC / ISRC Hunt, which re-prompt because they don't persist an offline
token).

The OAuth app is **baked into the script**, so there's nothing to register:

1. In the editor click **⚙ Setup → Authorize**. A MusicBrainz tab opens — approve, copy the code it
   shows, and paste it back. Done permanently.

2. Fill in ISRCs, click **Submit to MusicBrainz**.

Your credentials and tokens live only in the userscript's local storage (`GM_setValue`). **Sign out**
in Setup clears the stored token.

### How Spotify import works (via ISRC Hunt)

Spotify's developer API now requires a **Premium** subscription, its anonymous token endpoint is
bot-blocked, and the web player fetches its token through a service worker a userscript can't hook —
so a direct token harvest is unreliable. Instead the script delegates to
[ISRC Hunt](https://isrchunt.com), which does the Spotify lookup **server-side** (with its own
credentials) and renders the ISRCs into a plain HTML table. The script fetches
`isrchunt.com/spotify/importisrc?releaseId=<album url>`, scrapes that table, and maps the ISRCs to
your tracks — **no token, no login, no tab.** Spotify can still change things upstream, but **Deezer
and SoundExchange remain the most robust sources.**

## Why not the session cookie / `/ws/js/edit/create`?

That internal endpoint works for many edit types but has a hardcoded whitelist that **excludes**
`EDIT_RECORDING_ADD_ISRCS` (type 76), and ISRCs have no website form to scrape. WS2 + OAuth is the
only path that can actually write ISRCs.

## Tests

A Playwright harness drives the script against real MusicBrainz release pages and asserts it loads
and renders correctly. The script is injected with `addInitScript` (i.e. at *document-start*, before
`<body>` exists), so load-time bugs that only bite under `@run-at document-start` reproduce and fail
the run via the `pageerror` capture.

```sh
cd userscripts/isrc_scout
pnpm install
pnpm test                 # all fixtures, headless
pnpm test -- --headed     # watch the browser
pnpm test -- --only=Om    # filter by name / MBID substring
```

Each fixture in [`test/fixtures.json`](./test/fixtures.json) is **self-validating**: the harness
independently fetches the MB web service for ground truth (track count, ISRC count, streaming links)
and asserts the rendered editor matches — nothing is hard-coded to a DB state that drifts. Per-run
output (summary, per-fixture checks, the script's own Log pane, screenshot) lands in
`test/logs/<timestamp>/` (gitignored).
