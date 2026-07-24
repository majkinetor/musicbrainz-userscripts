# Falcon <img src="./icon.svg" align="left" width="40" height="40">

**Falcon** adds external links to a *batch* of MusicBrainz artists/labels at once — no popup-per-entity, no tab churn. A small pool of persistent worker iframes churns through a queue, each submitting its own edit and moving straight to the next entity.

- Install: [stable](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/stable/userscripts/falcon/falcon.user.js) or [latest](https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/refs/heads/main/userscripts/falcon/falcon.user.js)
- [Changelog](./CHANGELOG.md)

## Why

Bulk-linking a batch of artists (the recurring case: an importer like Harmony hands you 20-50 artists that each need a Bandcamp/Discogs/etc. link) has no good options today — MusicBrainz has no write API for relationships (`/ws/2/` only supports tags/ratings/ISRCs/collections), so every tool has to drive the real edit page. The obvious approach — a tab per artist — is what Harmony already does, and it's bad UX: a popup storm you then have to close by hand (or via a "submit all open tabs" helper).

Falcon avoids tabs entirely. Since MusicBrainz sends no `X-Frame-Options` / CSP `frame-ancestors`, its edit pages can be framed — so Falcon's panel (itself just a normal `musicbrainz.org` tab) hosts a handful of same-origin `<iframe>` workers instead. Same-origin means the panel's own script can reach directly into each iframe's DOM (`iframe.contentDocument`) with no `postMessage` handshake — fill the field, submit, and once MB redirects off `/edit`, re-point that **same** iframe at the next queued entity. The worker count never grows with the queue size, and nothing opens or closes per item.

## Usage

1. Click the small rocket button in the bottom-right corner of any MusicBrainz page (or press **Ctrl+Alt+F**) to open the panel.
2. Paste one entity per line into the box: `<artist-mbid>,<url>` (defaults to artist). Prefix with `label:` for a label, e.g. `label:<mbid>,<url>`. A full `musicbrainz.org/artist/<mbid>` URL works in place of the bare mbid too.
3. Click **+ Add to queue**, set how many workers to run at once, then **▶ Start**.
4. Watch the queue list — each row shows a status dot (queued/in-progress/done/failed) and, on failure, the reason on hover.

### From another script (e.g. Harmony)

Falcon can be handed a queue directly via a URL parameter, so another tool never has to open its own popups: append `?falcon=<base64(JSON)>` to any `musicbrainz.org` URL, where the JSON is an array of `{ "entityType": "artist" | "label", "mbid": "...", "url": "..." }`. Falcon detects the param on load, seeds the queue, and opens the panel automatically (does not auto-start — review, then click Start).

## Shortcuts

| Shortcut | Action |
| --- | --- |
| **Ctrl+Alt+F** | Open / close the Falcon panel |

## Scope

v1 covers artist and label external links. The same worker mechanism applies to release-level external links (MB's edit form uses the identical "Add another link" input there) and to other settable fields — both are natural follow-ups, not yet built.
