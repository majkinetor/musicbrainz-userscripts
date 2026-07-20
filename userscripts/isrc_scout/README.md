# ISRC Scout <img src="icon.svg" align="left" width="48">

Shows the release's existing ISRCs and lets you fill in the missing ones from several sources. Finds and manages store links to the recordings.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/isrc_scout/isrc_scout.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/isrc_scout/isrc_scout.user.js)
    - Or via bundle: [String Theory](../string_theory/README.md)
- [Changelog](./CHANGELOG.md)
- [View users](https://musicbrainz.org/search/edits?auto_edit_filter=&order=desc&negation=0&combinator=and&conditions.0.field=type&conditions.0.operator=%3D&conditions.0.args=76&conditions.0.args=78&conditions.1.field=edit_note_content&conditions.1.operator=includes&conditions.1.args.0=ISRC+Scout)

![screenshot](./screenshots/isrc.png)

## Features

- **[ISRC badge](#isrc-badge)** showing how many are missing
- **[ISRC](#isrc-editor)** — a per-track table of existing/new ISRCs with live validation
    - **[Import sources](#import-sources)** — fill the missing ISRCs from several providers
    - **[Delete existing ISRCs](#deleting-existing-isrcs)** in bulk
    - **[Per-track helpers](#per-track-helpers)** — per-row provider lookup with metadata match checks and highlighting
    - **[Submit to MusicBrainz](#submitting)** — one-time OAuth, then submit straight from the editor
- **[Links](#links)** — find and add streaming / store links to recordings (Deezer, Tidal, Beatport, Volumo, Bandcamp, Apple Music, SoundCloud), and see every other provider a recording already links to.
  - Find links based on release external links and ISRCs
  - [Batch ending or removing](#ending--removing) link relationship
- Using release group external links and [Platform Check](../platform_check/README.md) links

## Providers

ISRC Scout has **two independent provider systems** — a provider can support one without the other:

1. **[ISRC import](#import-sources)** — bulk-fills the missing ISRCs on the release from a provider.
2. **[Per-track links](#links)** — resolves a per-track provider URL and offers it in the **Add** column of the Links tab.

| Provider | ISRC import | Per-track link | How the link resolves |
| --- | :---: | :---: | --- |
| **Deezer** | ✓ | ✓ | by **ISRC** — global by-ISRC lookup, works on any release |
| **Tidal** | ✓ | ✓ | by **ISRC** — official API (baked-in app token), any release |
| **Beatport** | ✓ | ✓ | by **album** — the Beatport tracklist (id + ISRC), matched by ISRC |
| **Volumo** | ✓ | ✓ | by **album** — the Volumo album JSON (id + ISRC), matched by ISRC |
| **Bandcamp** | – | ✓ | by **album** — album page track list, matched by position + title |
| **Apple Music** | ✓ | ✓ | by **album** — the amp-api album tracklist (id + ISRC) read **anonymously** (token from the web-player JS, no login); ISRC import matched by position, per-track link from the `ld+json`. Legacy **iTunes** links (`itunes.apple.com/…/album/id…`) are recognized as the same album |
| **SoundCloud** | ✓ | ✓ | by **set** — the release's SoundCloud **set** (playlist) is the album; each track's `publisher_metadata.isrc` is read **anonymously** from api-v2 (public `client_id` from the web-player JS, no login), matched by position. A bare **track** URL is handled too, as a single-track release. The per-track link (free streaming) is the track's permalink, matched by position + title. Distributed sets also carry the release barcode (`upc_or_ean`), which Scout **logs** (it doesn't set barcodes — that's Platform Check's job) |
| **HDtracks** | ✓ | – | download store — no per-track pages to link |
| **SoundExchange** | ✓ | – | metadata search only; returns no addable URL |
| **Spotify** | ✓ | – | via ISRC Hunt; no anonymous ISRC→track URL to add |
| **Qobuz** | ✓¹ | ✓¹ | ¹ needs a **Qobuz login** in [Platform Check](../platform_check/README.md) (album/get is session-gated). ISRCs matched by position; per-track link is the id-only `open.qobuz.com/track/<id>`, matched by ISRC |

> [!IMPORTANT]
> **Album-based** providers (everything except Deezer/Tidal) need the release's album link — either already in MB, or one [Platform Check](../platform_check/README.md) found by barcode, or a URL you paste yourself.

> [!WARNING] 
> Album imports map tracks **by position**, trusting the link — provider titles legitimately diverge (`(feat. …)`, remaster suffixes), so title mismatches alone don't block anything. But each position-matched fill is checked against the MB track **length** (>10 s off ⇒ probably a different recording): suspicious fills stay filled but get an **amber input + tooltip**, a log warning per row and an `⚠ N implausible` count in the summary. A linked album with **more tracks than the release** is called out as a likely wrong link/edition before the fills even finish. Verify amber rows (e.g. right-click the row's ISRC lookup) before submitting.

Beyond these, the Links tab's **Linked** column also **shows every other provider a recording already links to** (Spotify, Qobuz, YouTube, SoundCloud, Amazon Music, or any host by its name) — even ones ISRC Scout can't add. It can't *add* those, but it **can end / remove** them (that acts on the existing relationship). See [other linked providers](#other-linked-providers).

> [!NOTE] Qobuz auth in Platform Check
> Qobuz per-track ISRCs live behind the session-gated `album/get` endpoint — sign in once under **Platform Check → ⚙ Setup → Auth → Qobuz account** and Scout reads the shared token. Without it, the Qobuz button stays hidden.
>
> Qobuz is also the one provider that geo-blocks anonymous access (it takes a VPN to create the account). Once you're registered and logged in, geo-blocking is no longer a factor.

## ISRC badge

An **ISRC** button is injected next to the release title, showing how many tracks already have an ISRC (`✓ 12/12`) or pulsing pink when some are missing (`⚠ 9/12`). Click it to open the editor.

## ISRC editor

A table of every track with its existing ISRCs and an input for the new one. Live validation flags invalid (red), duplicate (orange), and good (green) values. The footer shows how many will be submitted.

### Import sources

Header toolbar lists available ISRC import sources for the current release. Sources can be generic or depend on appropriate external links and can additionally come via custom URL. 

<img width="800" src="./screenshots/toolbar.png" />

On above screenshots there are 3 types of sources represented by provider icon markings:

1. With border - from external links in release
2. No border - from [Platform Check](../platform_check/README.md) (must be installed)
3. Blue dot - from release group (with [option][Settings] *Use providers from the whole release group*)

Circled providers are from the release, non circled from Platform Check, and blue dot in right upper corner represents provider from the release group.

Button `(+)` lets you import from an URL — paste any album URL to import from it, even when the release has no such link. 

| Button | Source | Auth | Notes |
| --- | --- | --- | --- |
| **⟳ SoundExchange** | [SoundExchange](https://isrc.soundexchange.com/) | none | Searches each track by title/artist, shows candidate ISRCs per row, auto-fills confident matches into empty fields. Searches are capped at **30 at a time** so SoundExchange doesn't block us — remaining tracks show a *"Not searched — click to load the next 30"* message; click any one to continue.|
| **Deezer** | `api.deezer.com` | none | Enabled when the release has a Deezer album relationship. Fetches each track's ISRC and maps by disc/position (title fallback). Deezer needs one request **per track**, so imports are capped at **50 tracks per batch** (a *"Deezer N/M — click to fetch the next 50"* prompt continues) to avoid spamming Deezer on huge releases. |
| **Spotify** | `isrchunt.com` | none | Enabled when the release has a Spotify album relationship. Delegates to ISRC Hunt (which does the Spotify lookup server-side) and scrapes the ISRCs from its result page |
| **Beatport** | `beatport.com` release page | none | Enabled when the release has a Beatport relationship. Beatport is Cloudflare-walled, so a direct cross-origin fetch is always blocked — instead the script opens the release in a brief **background tab** where the page (which the script also runs on) reads the ISRCs out of the embedded `__NEXT_DATA__` and hands them back, then the tab closes. Results are cached, so a repeat import (or one after you've simply visited the page yourself) is instant. |
| **Tidal** | `openapi.tidal.com` | app token (baked in) | Enabled when the release has a Tidal album relationship. Uses Tidal's official API with a built-in client-credentials app token (catalog access, **no user login**); maps each track's ISRC by disc/track number. |
| **Volumo** | `volumo.com/api/v1` | none | Enabled when the release has a Volumo relationship (or one Platform Check found via barcode). Clean unauthenticated API — one call returns every track's ISRC; no Cloudflare/token. Link-only, like the others. |
| **HDtracks** | `hdtracks.azurewebsites.net/api/v1` | none | Enabled when the release has an HDtracks relationship (or one Platform Check found via barcode). Clean unauthenticated, CORS-open API — one `/album/<id>` call returns every track's ISRC inline; no per-track fan-out, no token. The album id is a 24-char ObjectId; a barcode/UPC (e.g. from a legacy `valbum_code` rel) is resolved to it via search first. |
| **Qobuz** | `www.qobuz.com/api.json/0.2` | **login** | Enabled when the release has a Qobuz relationship (or one Platform Check found) **and** you're signed in to Qobuz under [Platform Check](../platform_check/README.md) → ⚙ Setup → Auth. One `album/get` call (with the shared token) returns every track's ISRC; matched by position. A barcode/UPC is resolved to the album id via `album/search` (zero-padded). Session-gated — see above. |

> [!NOTE] Platform Check links
> A Platform Check link that PC **withheld for a barcode/format mismatch** is **not** used here by default (#314). In principle an ISRC identifies a *recording* and is independent of the release's barcode/format — but a barcode mismatch can equally mean PC matched the **wrong release** (e.g. a 1-track Beatport single by a same-prefixed artist), whose ISRCs would be wrong. To deliberately read ISRCs from a barcode/format-mismatched edition anyway, enable **⚙ [Setup] → Ignore Platform Check link confidence**. Genuine content mismatches (wrong track count, etc.) are always skipped, and an in-MB link or a custom URL you paste yourself is unaffected.

#### Spotify 

The script uses [ISRC Hunt](https://isrchunt.com), which does the Spotify lookup **server-side** (with its own credentials) and renders the ISRCs into a plain HTML table. The script fetches `isrchunt.com/spotify/importisrc?releaseId=<album url>`, scrapes that table, and maps the ISRCs to your tracks.

#### Beatport 

Beatport release pages embed the full tracklist — including each track's ISRC — in their `__NEXT_DATA__` hydration JSON, but the site is behind Cloudflare, so a `GM_xmlhttpRequest` from MusicBrainz is always challenged. To get around that the script **also runs on `beatport.com/release/*`**: when you import, it opens the release in a background tab, the in-page copy reads the ISRCs from `__NEXT_DATA__`, stashes them in shared storage for the MusicBrainz tab, and the tab closes itself. Tabs you (or Platform Check) open are harvested too but left open. Harvested ISRCs are cached per release.

#### Tidal

Uses Tidal's official API (`openapi.tidal.com`) with a baked-in client-credentials app token — app-level catalog access, so **no Tidal login is needed**. It reads `/albums/{id}/relationships/items`, taking each track's ISRC from the included track resources and the disc/track number from the relationship metadata.

### Per-track helpers

<img width="1000" src="./screenshots/isrc-tracks.png" />

- **+1** — fill with the previous track's ISRC incremented by one.
- **ISRC lookup**<br>
Displays track metadata from the ISRC provider. It takes the ISRC in the row (entered or existing) and looks it up **on the selected provider**, showing that track's metadata (title · artist · length, mismatches highlighted) next to the row. It's menu lets you choose an available provider: SoundExchange (default) plus every other provider available for the release. Picking one re-skins **all** per-track buttons to that provider's icon (global for the release, not remembered). **Right-click** a button to inoke on all tracks. Providers with a global by-ISRC endpoint (**SoundExchange**, **Deezer**, **Tidal**) work on any release; the album-based ones (**HDtracks / Volumo / Beatport**) read the release's album (so they need its link, in MB or found by Platform Check) and match by ISRC.
- **⚙ search on SoundExchange**<br>
Open a panel where you can tweak the title/artist/release + exact toggles for SX. The panel has a **Search on SoundExchange ↗** link that runs the same query on the SoundExchange website.

To avoid overloading ISRC providers, lookup is not called automatically as you type or when values are imported from provider or set via **+1**. A field is verified on provider only when you **unfocus a manually-typed ISRC**, press the row's **ISRC lookup** button, or run the bulk **⟳ SoundExchange** search (as values picked from a SoundExchange without extra request). If SoundExchange shows a captcha or rate limit error, it is shown in the toolbar. Resolve captcha manually to continue.

#### Match checks & highlighting

Every ISRC result is checked against the MB track and **mismatching fields are highlighted in red** (wavy underline, with a tooltip):

| Field | Check |
| --- | --- |
| **Title** | word-set match (tolerates a couple of extra words, e.g. a version suffix) |
| **Artist** | word-set match either direction |
| **Year** | the recording year must be **≤ the MB release year (+1)** — a later recording can't be the source of release's ISRC |
| **Length** | flagged when it differs from MB by **> 10 s**; MB's length is shown inline (`↔ m:ss`) for comparison |

A result that passes all checks is the **best** match (blue, auto-filled when the field is empty); a length-only disagreement is a **warn** (yellow); a title/artist/year disagreement drops it out of the auto-fill running entirely.

### Deleting existing ISRCs

Check the box next to any existing ISRC and click **🗑 Delete checked**. Deletion goes through the MusicBrainz recording-edit form using your logged-in session (ISRC removal isn't a WS2 operation), and each removal is verified via the web service. Creates normal "Remove ISRC" edits — so you must be logged into musicbrainz.org.

### Bulk / Export

- **Paste** one ISRC per line in track order (blank line skips a track), or target specific tracks: `3=USABC1234567`, `USABC1234567 | 1.3` (medium.track), or `1.3 USABC1234567`.
- **Apply to empty fields** / **Apply (overwrite)**.
- **Export text** (one per line) / **Export JSON** (`{ recordingMBID: "ISRC" }`) — copied to clipboard.

## Links

ISRC Scout also adds **streaming / store links to recordings** in the background. The **Links** tab shows two columns per track:

- **Linked** — what the recording already links to on MusicBrainz (brand-coloured icon per provider). This includes **every** provider it links to, not just the ones ISRC Scout can add — see [other linked providers](#other-linked-providers) below.
- **Add** — links found but not yet on MB.

<img width="1000" src="./screenshots/links.png" />

### Providers

| Provider | How it resolves | MB link type |
| --- | --- | --- |
| **Deezer**, **Tidal** | by **ISRC** — a global by-ISRC lookup, so it works on any release whose tracks have ISRCs | free streaming / streaming |
| **Beatport**, **Volumo** | by **album** — the release's Beatport/Volumo album carries every track's **ISRC** (and id), so the per-track URL is matched by ISRC. Both are download stores → *purchase for download* | purchase for download |
| **Qobuz** | by **album** — `album/get` (with the shared [Platform Check](../platform_check/README.md) login token) carries every track's **ISRC** + id; the per-track link is the id-only `open.qobuz.com/track/<id>`, matched by ISRC. Needs the Qobuz login | purchase for download |
| **Bandcamp**, **Apple Music** | by **album page** — the release's Bandcamp/Apple album link lists every track URL, matched to the tracklist by **position + title** (a title mismatch is skipped, never guessed) | free streaming / streaming |

A provider is offered for a track only when it's resolvable (Deezer/Tidal need that track's ISRC; Beatport/Volumo/Bandcamp/Apple need the release's album link) or the recording is already linked to it.

#### Other linked providers

The **Linked** column also surfaces **every other provider a recording already links to** — Spotify, Qobuz, YouTube, SoundCloud, Amazon Music (each with its name/colour), or any other host shown with a generic globe by its hostname — so you see the full picture of a recording's links in one place, even for providers ISRC Scout can't resolve.

ISRC Scout **can't _add_** these (there's no per-track resolve path for them), but **ending and removing act on the relationship that's already there** — that's a plain edit by URL, no resolve needed — so they get the **same [end / remove actions](#ending--removing)** as the providers it manages: **right-click** toggles *ended*, **middle-click** removes, with the usual `Ctrl` (whole track) / `Alt` (that provider everywhere) modifiers. Only the **Add** column is unavailable for them (once removed, ISRC Scout can't offer it back). *(Spotify and Qobuz have no anonymous ISRC→track URL, so per-track adding isn't possible; they appear here only when already linked.)*

**Dead links aren't offered.** Deezer keeps an ISRC→track mapping even after it pulls the audio, so a by-ISRC lookup can return a track that no longer streams anywhere (Deezer reports it as unreadable, available in zero countries). Find links treats such a track as not found, so it won't offer a broken link to add.

### Finding & adding

- **🔗 Find links** resolves every track on the available providers and lights up the **Add** column with what's addable (a coloured icon = found, not yet linked). Providers resolve **in parallel** (each with its own light rate-limiting), and the album-based ones (Bandcamp / Apple Music) fetch the album page just once — so a full release resolves in a few seconds rather than one request at a time.
- On an **Add** icon: **left-click** opens the provider track · **right-click** adds it · **Ctrl + right-click** adds every link on that track · **Alt + right-click** adds that provider across all tracks. **➕ Add links** in the footer adds everything found at once.
- Adds happen **in the background** via MusicBrainz's internal edit API over your **logged-in session** — no OAuth needed (unlike ISRC submission); auto-applied if you're an auto-editor, otherwise queued. The edit note matches ISRC Scout's standard format.

### Ending & removing

On a **Linked** icon, **left-click** opens the provider track. **Right-click toggles the relationship's *ended* flag** — use it when a release is taken down and its streaming links no longer resolve ([MB style](https://musicbrainz.org/doc/Style/Relationships/URLs#When_to_remove)); an ended link is shown **faded**, and right-clicking it again reverts it. **Ctrl + right-click** ends the whole track, **Alt + right-click** ends that provider everywhere.

Actual **removal** is on **middle-click** (right-click's modifiers already scope the *ended* toggle): **middle-click** removes that link · **Ctrl + middle-click** removes all on the track · **Alt + middle-click** removes that provider everywhere.

These end / remove actions work on **any** linked provider — including the [other linked providers](#other-linked-providers) ISRC Scout can't add — since they act on the relationship already on MusicBrainz, not on a resolved candidate.

### Use providers from the whole release group (option)

Releases in a release group are often split by platform (one edition carries the Deezer link, another Spotify/Tidal, another Bandcamp). Since the recordings are shared, **⚙ → "Use providers from the whole release group"** (off by default) fills in any provider link the current edition is missing from its **sibling releases** — for both ISRC import and track links. A small **purple dot** marks links pulled this way, with a tooltip naming the sibling release.

## Submitting

ISRC submission to MusicBrainz **requires OAuth**:

1. In the editor click **⚙ Setup → Authorize**. A MusicBrainz tab opens, approve, done.
2. Fill in ISRCs, click **Submit to MusicBrainz**.

Credentials and tokens are stored in the userscript's local storage (`GM_setValue`). **Sign out** in Setup clears the stored token.

## Settings

<img width="1000" src="./screenshots/options.png" />

- Authorize on MusicBrainz
- Import-source buttons: show icons/text<br>
The import-source buttons can show as brand icons, text labels, or both (defaults to icons, to keep the toolbar compact).
- Use providers from the whole release group<br>
Fill provider links from releases in the release group — recordings are shared, so a link on any edition resolves here. Costs one extra lookup.
- Ignore Platform Check link confidence<br>
Import from a Platform-Check link even when PC withheld it for a barcode/format mismatch. Off by default — a mismatch can mean PC matched the wrong release, so its ISRCs would be wrong (#314)

## Shortcuts

Keyboard, in the editor / Links modal:

| Key | Action |
|---|---|
| `Esc` | Close the open sub-panel/popup, else the modal (ignored while typing in a field) |
| `Esc` | Close the SoundExchange search panel |
| `Enter` | Submit the focused **Add link** URL / code input, or run the SoundExchange search |

Modifier-clicks on the **Links tab** Add / Linked icons (see [links tab](#links) for the full description):

| Click | Add column | Linked column |
|---|---|---|
| left-click | — | Open the provider track |
| right-click | Add that one link | Toggle *ended* on that link (faded when ended; right-click reverts) |
| `Ctrl`/`⌘` + right-click | Add every link on that track | End every link on that track |
| `Alt` + right-click | Add that provider across all tracks | End that provider across all tracks |
| middle-click | — | Remove that one link |
| `Ctrl`/`⌘` + middle-click | — | Remove every link on that track |
| `Alt` + middle-click | — | Remove that provider across all tracks |

## Notes

### Qobuz — the full investigation

#353 / #201

Qobuz's public catalogue API (`www.qobuz.com/api.json/0.2/…`) has two relevant endpoints:
- **`album/search`** (album-level: `upc`, `label`, `year`, `tracks_count`) — **works anonymously** with the web-player app_id **`712109809`**. This is all [Platform Check](../platform_check/README.md) needs to *locate/verify* a Qobuz release.
- **`album/get`** — the **only** endpoint that carries per-track **`isrc`** (and roled `performers`). It is **geo-gated, not session-gated** (#418 corrected the original conclusion):
  - **from a country Qobuz serves**, app_id `712109809` returns **`200`** with full `tracks.items[]` (isrc + performers) **anonymously** — no cookies, no token (verified from a HAR capture in #418).
  - **from anywhere else**, the same anonymous request → **`404` "No result matching given argument"** for *every* album id — even ids `album/search` just returned. The anonymous API resolves catalogue visibility by **request IP**; the original #353 investigation ran from a non-Qobuz country, which made it look session-gated.
  - the other web app_id `798273057` → **`401` "User authentication is required"** regardless.
  - **with a logged-in `user_auth_token`** (header `X-User-Auth-Token`) → **`200`** from anywhere: the login's real contribution is the **account's region**, not authentication.
- The **store page HTML has zero ISRCs** — so there's no anonymous scrape fallback.

**So ISRC Scout prefers the session when you're logged in (one request, any country) and works anonymously otherwise** (#418) — in Qobuz countries no login is needed at all, and a stale session falls back to the anonymous path. [Platform Check](../platform_check/README.md) owns the login (email + password → `user_auth_token`, password sent as an MD5 digest and **never stored**) and shares the token via the `mbtools:qobuz` `localStorage` key on the MB origin — exactly how the Beatport token is shared. ISRC Scout reads that token for the ISRC import here; Credit Hoarder reads the same token for roled Qobuz credits.

Other Qobuz gotchas:
- **Brutal rate-limiting** — a few requests and it `429`s; honour `Retry-After`.
- **Barcode padding** — Qobuz stores the UPC as the 13-digit EAN with a **leading zero** (`0199257198605`), so a barcode-first `album/search` must try the zero-padded form (#354).
- The slug-less `open.qobuz.com/album/<id>` form that an MB rel often carries is an **SPA shell** with no data; the album id is the last path segment either way.

[Settings]: #settings
