# ISRC Import

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
| **⟳ SoundExchange** | [SoundExchange](https://isrc.soundexchange.com/) | none | Searches every track by title/artist, shows candidate ISRCs per row, auto-fills confident matches into empty fields. Ported from `magicisrc_soundexchange`. |
| **Deezer** | `api.deezer.com` | none | Enabled when the release has a Deezer album relationship. Fetches each track's ISRC and maps by disc/position (title fallback). |
| **Spotify** | `api.spotify.com` | tab-harvest | Enabled when the release has a Spotify album relationship. Briefly opens an `open.spotify.com` tab, borrows the **web player's own token** (free account, no Premium, no bot-block), then closes it — so allow popups for musicbrainz.org. Optionally use a Spotify developer app instead (silent, but needs Premium). Fetches ISRCs per track (`/v1/tracks/{id}` — the bulk endpoint was removed Feb 2026). |

Source buttons only fill **empty** fields and never touch existing ISRCs.

### Per-track helpers

- **+1** — fill with the previous track's ISRC incremented by one.
- Click any SoundExchange candidate to use it.

### Bulk / Export (⇪)

- **Paste** one ISRC per line in track order (blank line skips a track), or target specific tracks:
  `3=USABC1234567`, `USABC1234567 | 1.3` (medium.track), or `1.3 USABC1234567`.
- **Apply to empty fields** / **Apply (overwrite)**.
- **Export text** (one per line) / **Export JSON** (`{ recordingMBID: "ISRC" }`) — copied to clipboard.
  Exported JSON can be pasted straight back into the box and re-applied.

## Submitting (one-time setup)

ISRC submission to MusicBrainz **requires OAuth** — the website session cookie cannot write ISRCs,
and there is no native ISRC web form. This script uses the `submit_isrc` scope with
`access_type=offline`, so the refresh token is stored locally and you **authorize exactly once,
forever** (unlike MagicISRC / ISRC Hunt, which re-prompt because they don't persist an offline
token).

1. Register an application **once** at
   [account → applications → register](https://musicbrainz.org/account/applications/register):
   - **Type:** Installed application
   - **Redirect URI:** `urn:ietf:wg:oauth:2.0:oob`

   Copy the **OAuth Client ID** and **Client Secret**.

2. In the editor click **⚙ Setup**, paste the Client ID + Secret, click **Authorize**. A MusicBrainz
   tab opens — approve, copy the code it shows, and paste it back. Done permanently.

3. Fill in ISRCs, click **Submit to MusicBrainz**.

Your credentials and tokens live only in the userscript's local storage (`GM_setValue`). **Sign out**
in Setup clears the stored token.

### How Spotify import works (no Premium, no app)

Spotify's developer API now requires a **Premium** subscription, and its anonymous token endpoint is
bot-blocked — so the script doesn't rely on either. Instead, when you click **Spotify**, it opens a
short-lived `open.spotify.com` tab: the real web player mints its own access token (which works for
**free** accounts and handles Spotify's anti-bot itself), the script captures that token off the
player's own requests, hands it to the MusicBrainz tab, and closes the Spotify tab. So:

- **Allow popups** for `musicbrainz.org` (the click is the gesture that opens the tab).
- Being logged into Spotify isn't required, but helps reliability.
- The token is cached ~50 min, so the tab only reopens occasionally.

**Optional silent path:** if you happen to have a Spotify developer app (Premium), paste its Client
ID + Secret into ⚙ Setup → *Spotify app* and it'll use a client-credentials token with no tab.

**Caveat:** Spotify keeps removing Web API endpoints (it dropped the bulk track/album endpoints and
briefly even removed the ISRC field in early 2026), so Spotify import can break regardless. **Deezer
and SoundExchange are the stable sources.**

## Why not the session cookie / `/ws/js/edit/create`?

That internal endpoint works for many edit types but has a hardcoded whitelist that **excludes**
`EDIT_RECORDING_ADD_ISRCS` (type 76), and ISRCs have no website form to scrape. WS2 + OAuth is the
only path that can actually write ISRCs.
