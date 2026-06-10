# ISRC Scout <img src="icon.svg" align="left" width="48">

Self-contained ISRC editor that lives **on the MusicBrainz release page**. Reads the release's existing ISRCs, lets you fill in the missing ones from several sources, and submits them straight to MusicBrainz.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/isrc_scout/isrc_scout.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/isrc_scout/isrc_scout.user.js)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=type&conditions.0.operator=%3D&conditions.0.args=76&conditions.0.args=78&conditions.1.field=edit_note_content&conditions.1.operator=includes&conditions.1.args.0=ISRC+Scout)

![screenshot](./screenshot.png)

https://github.com/user-attachments/assets/7549eacf-8993-4fd7-ad17-2566ad827da0

## The button

An **ISRC** button is injected next to the release title, showing how many tracks already have an ISRC (`✓ 12/12`) or pulsing pink when some are missing (`⚠ 9/12`). Click it to open the editor.

## The editor

A table of every track with its existing ISRCs and an input for the new one. Live validation flags invalid (red), duplicate (orange), and good (green) values. The footer shows how many will be submitted.

### Import sources

| Button | Source | Auth | Notes |
| --- | --- | --- | --- |
| **⟳ SoundExchange** | [SoundExchange](https://isrc.soundexchange.com/) | none | Searches each track by title/artist, shows candidate ISRCs per row, auto-fills confident matches into empty fields. Searches are capped at **30 at a time** so SoundExchange doesn't block us — remaining tracks show a *"Not searched — click to load the next 30"* message; click any one to continue.|
| **Deezer** | `api.deezer.com` | none | Enabled when the release has a Deezer album relationship. Fetches each track's ISRC and maps by disc/position (title fallback). Deezer needs one request **per track**, so imports are capped at **50 tracks per batch** (a *"Deezer N/M — click to fetch the next 50"* prompt continues) to avoid spamming Deezer on huge releases. |
| **Spotify** | `isrchunt.com` | none | Enabled when the release has a Spotify album relationship. Delegates to ISRC Hunt (which does the Spotify lookup server-side) and scrapes the ISRCs from its result page |
| **Beatport** | `beatport.com` release page | none | Enabled when the release has a Beatport relationship. Beatport is Cloudflare-walled, so a direct cross-origin fetch is always blocked — instead the script opens the release in a brief **background tab** where the page (which the script also runs on) reads the ISRCs out of the embedded `__NEXT_DATA__` and hands them back, then the tab closes. Results are cached, so a repeat import (or one after you've simply visited the page yourself) is instant. |
| **Tidal** | `openapi.tidal.com` | app token (baked in) | Enabled when the release has a Tidal album relationship. Uses Tidal's official API with a built-in client-credentials app token (catalog access, **no user login**); maps each track's ISRC by disc/track number. |
| **Volumo** | `volumo.com/api/v1` | none | Enabled when the release has a Volumo relationship (or one Platform Check found via barcode). Clean unauthenticated API — one call returns every track's ISRC; no Cloudflare/token. Link-only, like the others. |
| **HDtracks** | `hdtracks.azurewebsites.net/api/v1` | none | Enabled when the release has an HDtracks relationship (or one Platform Check found via barcode). Clean unauthenticated, CORS-open API — one `/album/<id>` call returns every track's ISRC inline; no per-track fan-out, no token. The album id is a 24-char ObjectId; a barcode/UPC (e.g. from a legacy `valbum_code` rel) is resolved to it via search first. |

The **Deezer**, **Beatport**, **Tidal**, **Volumo** and **HDtracks** buttons each have a **▾** menu to *import from a custom album URL* — paste any matching album/release URL (or bare id) to import from it, even when the release has no such link. If the [`platform_check`](../platform_check/README.md) userscript is also installed and has found a URL for that platform, the menu also offers a one-click **"Use the &lt;platform&gt; URL Platform Check found"** option (skipped silently when `platform_check` isn't present). Spotify has no such menu: its import goes through ISRC Hunt, which resolves the MB release *from* the Spotify URL — so a custom or not-yet-in-MB URL does not work.

The import-source buttons can show as **brand icons, text labels, or both** — toggle under **⚙ Setup → Import-source buttons** (defaults to icons, to keep the toolbar compact). The **⟳ SoundExchange** *exact title/artist/release* toggles are collapsed behind a small **exact ▾** control (state remembered) for the same reason.

### Per-track helpers

- **+1** — fill with the previous track's ISRC incremented by one.
- **SX** — search this track on SoundExchange on demand: verifies the ISRC currently in the field, or — when the field is empty — opens the refine panel to search by title/artist.
- Click any SoundExchange candidate to use it, or **⚙ refine search** to open a panel where you can tweak the title/artist/release + exact toggles. The panel has a **Search on SoundExchange ↗** link that runs the same query on the SoundExchange website.
- Track titles link to the MB recording. To avoid hammering SoundExchange (which now serves a captcha after too many requests), SoundExchange is **not** called automatically as you type or when values are imported from Deezer / Spotify / **+1**. A field is verified on SoundExchange only when you **blur a manually-typed ISRC**, press the row's **SX** button, or run the bulk **⟳ SoundExchange** search; values picked from a SoundExchange search still show their match instantly (from cache, no extra request). ISRCs duplicated across different recordings are flagged pink. If SoundExchange shows a captcha, the toolbar links you to solve it in the browser, then retry.

#### Match checks & highlighting

Every SoundExchange result is checked against the MB track and **mismatching fields are highlighted in red** (wavy underline, with a tooltip):

| Field | Check |
| --- | --- |
| **Title** | word-set match (tolerates a couple of extra words, e.g. a version suffix) |
| **Artist** | word-set match either direction |
| **Year** | the recording year must be **≤ the MB release year (+1)** — a later recording can't be the source of release's ISRC |
| **Length** | flagged when it differs from MB by **> 10 s**; MB's length is shown inline (`↔ m:ss`) for comparison |

A result that passes all checks is the **best** match (blue, auto-filled when the field is empty); a length-only disagreement is a **warn** (yellow); a title/artist/year disagreement drops it out of the auto-fill running entirely.

### Deleting existing ISRCs

Check the box next to any existing ISRC and click **🗑 Delete checked**. Deletion goes through the MusicBrainz recording-edit form using your logged-in session (ISRC removal isn't a WS2 operation), and each removal is verified via the web service. Creates normal "Remove ISRC" edits — so you must be logged into musicbrainz.org.

### Bulk / Export (⇪)

- **Paste** one ISRC per line in track order (blank line skips a track), or target specific tracks: `3=USABC1234567`, `USABC1234567 | 1.3` (medium.track), or `1.3 USABC1234567`.
- **Apply to empty fields** / **Apply (overwrite)**.
- **Export text** (one per line) / **Export JSON** (`{ recordingMBID: "ISRC" }`) — copied to clipboard.

## Submitting (one-time authorization)

ISRC submission to MusicBrainz **requires OAuth**:

1. In the editor click **⚙ Setup → Authorize**. A MusicBrainz tab opens, approve, done.
2. Fill in ISRCs, click **Submit to MusicBrainz**.

Credentials and tokens are stored in the userscript's local storage (`GM_setValue`). **Sign out** in Setup clears the stored token.

### Spotify import

The script uses [ISRC Hunt](https://isrchunt.com), which does the Spotify lookup **server-side** (with its own credentials) and renders the ISRCs into a plain HTML table. The script fetches `isrchunt.com/spotify/importisrc?releaseId=<album url>`, scrapes that table, and maps the ISRCs to your tracks.

### Beatport import

Beatport release pages embed the full tracklist — including each track's ISRC — in their `__NEXT_DATA__` hydration JSON, but the site is behind Cloudflare, so a `GM_xmlhttpRequest` from MusicBrainz is always challenged. To get around that the script **also runs on `beatport.com/release/*`**: when you import, it opens the release in a background tab, the in-page copy reads the ISRCs from `__NEXT_DATA__`, stashes them in shared storage for the MusicBrainz tab, and the tab closes itself. Tabs you (or Platform Check) open are harvested too but left open. Harvested ISRCs are cached per release.

### Tidal import

Uses Tidal's official API (`openapi.tidal.com`) with a baked-in client-credentials app token — app-level catalog access, so **no Tidal login is needed**. It reads `/albums/{id}/relationships/items`, taking each track's ISRC from the included track resources and the disc/track number from the relationship metadata.
