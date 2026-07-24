# Falcon <img src="./icon.svg" align="left" width="40" height="40">

**Falcon** adds external links to a *batch* of MusicBrainz artists/labels/recordings at once — no popup-per-entity, no tab churn. A small pool of persistent worker iframes churns through a queue, each submitting its own edit and moving straight to the next entity.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/falcon/falcon.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/falcon/falcon.user.js)
- [Changelog](./CHANGELOG.md)

## Why

Bulk-linking a batch of artists (the recurring case: an importer like Harmony hands you 20-50 artists that each need a Bandcamp/Discogs/etc. link) has no good options today — MusicBrainz has no write API for relationships (`/ws/2/` only supports tags/ratings/ISRCs/collections), so every tool has to drive the real edit page. The obvious approach — a tab per artist — is what Harmony already does, and it's bad UX: a popup storm you then have to close by hand (or via a "submit all open tabs" helper).

Falcon avoids tabs entirely. Since MusicBrainz sends no `X-Frame-Options` / CSP `frame-ancestors`, its edit pages can be framed — so Falcon's panel (itself just a normal `musicbrainz.org` tab) hosts a handful of same-origin `<iframe>` workers instead. Same-origin means the panel's own script can reach directly into each iframe's DOM (`iframe.contentDocument`) with no `postMessage` handshake — fill the field, submit, and once MB redirects off `/edit`, re-point that **same** iframe at the next queued entity. The worker count never grows with the queue size, and nothing opens or closes per item.

## Usage

1. Click the small rocket button in the bottom-right corner of any MusicBrainz page (or press **Ctrl+Alt+F**) to open the panel, which opens centered on screen (drag its header to move it).
2. Paste one entity per line into the box: `<mbid>,<url>` (defaults to artist). Prefix with `label:` or `recording:` for those entity types, e.g. `label:<mbid>,<url>`. A full `musicbrainz.org/artist/<mbid>` URL works in place of the bare mbid too. Multiple lines for the same mbid are grouped into a single edit — Falcon never revisits (or, worse, concurrently visits) the same entity's edit page twice.
3. Click **+ Add to queue**, set how many workers to run at once, then **▶ Start**. Switch to the **Workers** tab to watch the live iframes — click a worker's **⛶** to view just that one large (useful for reading a validation error). The panel itself has a **⛶** maximize toggle in the header too.
4. Watch the queue list — each row shows the entity's real name (resolved from MB in the background; falls back to `type/mbid-prefix` until it loads), a status dot (queued/in-progress/done/partial/failed), and, on failure, MB's own real error message on hover (e.g. *"This URL is not allowed for artists."*, *"This relationship already exists."* — scraped from the page, not guessed).
5. A worker whose item doesn't cleanly commit (e.g. a duplicate/rejected url) freezes that worker card in place — dimmed, showing its last state — instead of disappearing, so you can see what happened; a fresh worker card takes over the rest of the queue. A worker that *does* commit keeps flowing through the queue on the same card.

### From Harmony

Open a Harmony **Release Actions** page and a **"Send N to Falcon"** button appears in the bottom-right corner. Harmony's "Link external IDs" actions are already standard MusicBrainz seed URLs — Falcon decodes them directly, including the case where the same URL needs two different relationship types (e.g. a Bandcamp track that's both "stream for free" and "purchase for download" — handled via MB's own "Add another relationship" row). Clicking the button opens MusicBrainz in a new tab with the batch queued and the panel open, ready to review and Start.

The button currently sends **artist and label** actions only — a release's *recording* actions usually vastly outnumber those, and packing all of them into one URL blows past what browsers/servers accept (a real 86-action release produced a 32,000-character url and MusicBrainz's front-end just dropped the connection rather than erroring cleanly). Bulk recording links are a planned follow-up with a transport that doesn't put the whole batch in the URL.

### From another script

Falcon can be handed a queue directly via a URL parameter, so another tool never has to open its own popups: append `?falcon=<base64(JSON)>` to any `musicbrainz.org` URL, where the JSON is an array of `{ "entityType": "artist" | "label" | "recording", "mbid": "...", "url": "...", "linkTypeId"?: "...", "note"?: "..." }` (`linkTypeId` is optional — when present it's used to set MB's relationship-type dropdown if one is shown; otherwise MB auto-classifies as usual). Falcon detects the param on load, seeds the queue, and opens the panel automatically (does not auto-start — review, then click Start).

## Shortcuts

| Shortcut | Action |
| --- | --- |
| **Ctrl+Alt+F** | Open / close the Falcon panel |

## Scope

Artist, label, and recording external links. The same worker mechanism applies to release-level external links (MB's edit form uses the identical "Add another link" input there) and to other settable fields — both are natural follow-ups, not yet built.
