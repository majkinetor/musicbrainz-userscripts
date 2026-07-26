# Falcon <img src="./icon.svg" align="left" width="40" height="40">

**Falcon** adds external links to a *batch* of MusicBrainz artists/labels/recordings at once — no popup-per-entity, no tab churn. A small pool of persistent worker iframes churns through a queue, each submitting its own edit and moving straight to the next entity.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/falcon/falcon.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/falcon/falcon.user.js)
- [Changelog](./CHANGELOG.md)

## Why

Bulk-linking a batch of artists (the recurring case: an importer like Harmony hands you 20-50 artists that each need a Bandcamp/Discogs/etc. link) has no good options today — MusicBrainz has no write API for relationships (`/ws/2/` only supports tags/ratings/ISRCs/collections), so every tool has to drive the real edit page. The obvious approach — a tab per artist — is what Harmony already does, and it's bad UX: a popup storm you then have to close by hand (or via a "submit all open tabs" helper).

Falcon avoids tabs entirely. Since MusicBrainz sends no `X-Frame-Options` / CSP `frame-ancestors`, its edit pages can be framed — so Falcon's panel (itself just a normal `musicbrainz.org` tab) hosts a handful of same-origin `<iframe>` workers instead. Same-origin means the panel's own script can reach directly into each iframe's DOM (`iframe.contentDocument`) with no `postMessage` handshake — check the form, submit, and once MB redirects off `/edit`, load the next queued entity into a fresh iframe on that same worker. The worker count never grows with the queue size, and nothing opens or closes per item.

Each worker navigates to MusicBrainz's own **seed URL** format (`?edit-<type>.url.0.text=…&…link_type_id=…` — the same one Harmony's "Link external IDs" actions use), so MB fills the form itself as the page renders instead of Falcon simulating typing into it. That's the difference between roughly a second and 10+ seconds per entity. Falcon only touches the form for what seeding can't express: applying a relationship type MB left unresolved, adding a second relationship type on a url that needs two, and clearing rows MB couldn't classify (which would otherwise silently disable the submit button for the entire group).

## Usage

1. Click the small rocket button in the bottom-right corner of any MusicBrainz page (or press **Ctrl+Alt+F**) to open the panel, which opens centered on screen (drag its header to move it).
2. Click the **+** button to expand the paste box, and paste one entity per line: `<mbid>,<url>` (defaults to artist). Prefix with `label:` or `recording:` for those entity types, e.g. `label:<mbid>,<url>`. A full `musicbrainz.org/artist/<mbid>` URL works in place of the bare mbid too. Multiple lines for the same mbid are grouped into a single edit — Falcon never revisits (or, worse, concurrently visits) the same entity's edit page twice. Click **+ Add to queue**; the paste box collapses back to the **+** button.
3. The queue list is the main part of the panel — each row shows the entity's real name (resolved from MB in the background; falls back to `type/mbid-prefix` until it loads), a status dot (queued/in-progress/done/partial/failed/manual), and, on failure, MB's own real error message on hover (e.g. *"This URL is not allowed for artists."*, *"This relationship already exists."* — scraped from the page, not guessed). Click the **▸** to expand a row and see every url in that entity's group individually, each with its own ✓/✗ once processed — or use the **Expand all** / **Collapse all** toggle in the toolbar to do every row at once.
4. Each row also has **⇗** (open this entity's edit page in a real tab, pre-filled the same way a worker would — but left for you to review and click "Enter edit" yourself; useful for retrying something the queue couldn't commit automatically) and **✕** (remove from the queue). Check the **all** box or several rows individually and use **Remove selected** to drop a whole group at once. Right-click a row's entity-type column (`art`/`lbl`/`rec`) to select every item of that same type at once.
5. Click a red **FAILED**/**PARTIAL** status label to jump straight to that item's real worker in the **Workers** tab — the exact live page it left off on (not a fresh reload), zoomed large, with the error shown as a banner right on the card. Falls back to a plain text popup only for an item no worker ever picked up.
6. Set how many workers to run at once at the bottom, then **▶ Start**. The default is 5, which measured fastest on a real batch (~1.8s per item, against ~2.3s at 3); the gain flattens above that, so the cap is 6. Switch to the **Workers** tab to watch the live iframes — click a worker's **⛶** to view just that one large (useful for reading a validation error). The panel itself has a **⛶** maximize toggle in the header too.
7. A worker whose item doesn't cleanly commit (e.g. a duplicate/rejected url) retires that card in place — dimmed but still live and inspectable (nothing is discarded) — while a fresh worker card takes over the rest of the queue. A worker that *does* commit keeps flowing through the queue on the same card, reusing its iframe and navigating it to each new item.

Every toolbar button collapses to icon-only (tooltips carry the meaning) when the panel is narrow enough that the bar would otherwise wrap, and the labels come back as you widen or maximize it.

Entity names resolve through the same rate-limit-aware throttle MB API calls use elsewhere in these scripts (a handful concurrently, cooperatively backing off on an actual 429/503 via its Retry-After header) — fast for a normal batch, but still polite to MB's webservice under a big one.

A url that MB considers ambiguous (a Bandcamp track is the common case — could be "purchase for download", "streaming", etc.) needs an explicit relationship type MusicBrainz can't infer on its own; without one, Falcon reports that specific url as failed with a clear reason rather than letting it silently block the rest of its group's submission. Use **⇗** to open it in a tab and pick the type by hand.

### From Harmony

Open a Harmony **Release Actions** page and a **"Send N to Falcon"** button appears in the bottom-right corner, covering every entity type Harmony offers — artists, labels, *and* recordings. Harmony's "Link external IDs" actions are already standard MusicBrainz seed URLs — Falcon decodes them directly, including the case where the same URL needs two different relationship types (e.g. a Bandcamp track that's both "stream for free" and "purchase for download" — seeded as two entries of the same url, which MusicBrainz renders as both relationships natively). Clicking the button opens MusicBrainz in a new tab with the batch queued and the panel open, ready to review and Start.

The whole batch (recordings included, even a release with 80+ actions) travels via a short random token backed by the userscript's own storage rather than a `?falcon=` payload in the URL — that avoids the URL-length ceiling a large batch used to hit (a real 86-action release produced a 32,000-character url and MusicBrainz's front-end just dropped the connection rather than erroring cleanly).

### From another script

Any other script can hand Falcon a queue directly via a URL parameter: append `?falcon=<base64(JSON)>` to any `musicbrainz.org` URL, where the JSON is an array of `{ "entityType": "artist" | "label" | "recording", "mbid": "...", "url": "...", "linkTypeId"?: "...", "note"?: "..." }` (`linkTypeId` is optional — when present it's used to set MB's relationship-type dropdown if one is shown; otherwise MB auto-classifies as usual). Falcon detects the param on load, seeds the queue, and opens the panel automatically (does not auto-start — review, then click Start). (The GM-storage-token scheme Harmony uses above only works between Falcon's own two ends, since userscript storage isn't shared across different scripts — the base64 form is the contract for everyone else.)

### Reporting a problem

The **Log** tab traces every worker step — which entity it loaded, how each url was resolved (already present / seeded and classified / typed / rejected and why), whether the submit button was reachable, and how long each stage took. Lines are tagged per worker (`[w1]`, `[w2]`…) since workers run concurrently. Leave the **debug** checkbox on, reproduce the problem, then hit **Copy log** and paste it into the issue — that's usually enough to pinpoint a worker that stopped short of submitting without needing a live reproduction.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| **Ctrl+Alt+F** | Open / close the Falcon panel |

## Scope

Artist, label, and recording external links. The same worker mechanism applies to release-level external links (MB's edit form uses the identical "Add another link" input there) and to other settable fields — both are natural follow-ups, not yet built.
