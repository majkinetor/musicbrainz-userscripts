// Userscript-metadata block (`// ==UserScript== … // ==/UserScript==`) lives
// in `src/meta.txt`. `build.mjs` prepends it to the bundled output so
// VM/TM see the headers verbatim. This file is the entry module for esbuild.
//
// The entry is now small — every meaningful function moved to its own
// `src/<module>.js`. What's left:
//   - the cross-tab BroadcastChannel listener that runs on MB artist/label/place
//     pages opened by the "Create in MB" button (it signals success back to the
//     opener via `discogs-importer-artist` and closes itself);
//   - the release-page bootstrap that detects a Discogs link on the release and,
//     if present, mounts the UI bar via `insertDiscogsBar`.
//
// Side-effect imports (`./storage.js`, `./ui-bar.js`) trigger module init at
// load time — opening IndexedDB and running the localStorage-cleanup IIFE.

import { getSourceUrlsForRelease } from './api-mb.js';
import { insertDiscogsBar, probeTitleRemixes } from './ui-bar.js';
import { DISCOGS_CHANNEL }       from './constants.js';
import { installHoverHighlight } from './hover-highlight.js';
import { installBatchRemove }    from './batch-remove.js';
import { runTidalHarvestPage }   from './sources/tidal.js';
import                                './storage.js';   // opens IndexedDB on load

// ── tidal.com: credits-harvest companion (#193) ──────────────────────────────
// The script also @matches tidal.com album pages. When the MB side opened
// this tab (URL carries `#ch-req=`), harvest the rendered credits and post
// them back through GM storage, then close. A no-op on every other Tidal
// page — and everything below this block is MB-only.
if (/(^|\.)tidal\.com$/i.test(location.hostname)) {
    runTidalHarvestPage();
}

// ── BroadcastChannel: cross-tab artist creation signalling ────────────────────
// `DISCOGS_CHANNEL` is created once in `constants.js` and imported here +
// in `review-table.js` so both sides share one channel instance. The bootstrap
// below is the LISTENER half — when this script runs on an MB
// artist/label/place page that was opened by the "Create in MB" button, it
// detects the successful creation (URL contains a MBID), posts the new entity
// back to the opener tab via the channel, then closes itself.

// ── Background create + auto-commit (#273) ───────────────────────────────────
// The review table's "+" chip, right-clicked, opens the MB create form in a
// BACKGROUND tab (GM_openInTab) with the postback identity in the URL hash
// (`#ch-autocommit=…`). Here on the create page we stash that identity as the
// pending marker (so the post-submit entity page closes + posts back, exactly
// like a foreground create) and click MB's "Enter edit" button. The form is
// already pre-filled from the query string, so submitting needs no input.
(function handleCreatePageAutoCommit() {
    const onCreate = /\/(artist|label|place)\/create\b/i.test(location.pathname);
    const onEdit   = /\/(artist|label|place)\/[a-f0-9-]{36}\/edit\b/i.test(location.pathname);
    if (!onCreate && !onEdit) return;
    const m = location.hash.match(/ch-autocommit(?:=([^&]+))?/);
    if (!m) return;
    if (onCreate) {
        // create: stash the postback identity so the post-submit entity page
        // posts the new MBID back (and closes), like a foreground create.
        let identity = '';
        try { identity = decodeURIComponent(m[1] || ''); } catch (e) { identity = m[1] || ''; }
        try { sessionStorage.setItem('discogs-importer-pending-artist', identity); } catch (e) {}
    } else {
        // edit (add link, #273): stash the close-after-edit marker so the
        // post-submit entity page posts `edit-committed` back + closes.
        try { sessionStorage.setItem('discogs-importer-close-after-edit', '1'); } catch (e) {}
    }

    // Click "Enter edit" — but ONLY once the seeded change has actually RENDERED.
    // The "Enter edit" button appears before MB's React external-links editor has
    // applied the seeded URL relation from the query string, so clicking too early
    // submits an EMPTY edit (no link added, no redirect → tab stays open). So we
    // first wait for the seeded URL to appear in the rendered form. Give up quietly
    // if it never does — the tab just stays open for the user.
    const et = (location.pathname.match(/\/(artist|label|place)\//) || [])[1] || 'artist';
    const seedUrl = new URLSearchParams(location.search).get(`edit-${et}.url.0.text`) || '';
    // host+path key (drop scheme / www / trailing slash) — matches MB's rendered href
    const seedKey = seedUrl ? seedUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '').toLowerCase() : '';
    let tries = 0;
    const submit = () => {
        const seedReady = !seedKey || document.body.innerHTML.toLowerCase().includes(seedKey);
        const btn = document.querySelector('button.submit.positive')
            || [...document.querySelectorAll('button[type="submit"]')].find(b => /enter edit/i.test(b.textContent || ''));
        if (seedReady && btn && !btn.disabled) { btn.click(); return; }
        if (tries++ < 100) setTimeout(submit, 200);   // ~20s grace (background tabs are slower)
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', submit);
    else submit();
})();

(function handleEntityPageIfNeeded() {
    // Match artist, label, or place pages with a MBID
    const entityMatch = location.href.match(
        /musicbrainz\.org\/(artist|label|place)\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?:[^/]|$)/i
    );
    if (!entityMatch) return;

    const entityType = entityMatch[1];
    const mbid       = entityMatch[2];

    // A tab opened just to ADD A URL LINK to an existing entity (the review
    // table's 🔗 "Add link" chip) closes itself once the edit submits and
    // redirects here. The marker is only seen on the clean entity page — the
    // `/<type>/<mbid>/edit` form page fails `entityMatch` above, so we never
    // close before the user submits. No postback needed: the opener re-checks
    // the link when it regains focus.
    try {
        if (sessionStorage.getItem('discogs-importer-close-after-edit')) {
            sessionStorage.removeItem('discogs-importer-close-after-edit');
            // #273: tell the opener the edit committed so a BACKGROUND add-link
            // (which never regains focus) can recheck the chip + close this GM
            // tab. A foreground add-link has no listener for this — it's a no-op
            // there, and the focus-return recheck handles it instead.
            try { DISCOGS_CHANNEL.postMessage({ type: 'edit-committed', id: mbid }); } catch (e) {}
            setTimeout(() => window.close(), 50);
            return;
        }
    } catch (e) {}

    // Check if we were opened by the importer
    const pendingKey = 'discogs-importer-pending-artist';
    const pending = sessionStorage.getItem(pendingKey);
    if (!pending) return;

    sessionStorage.removeItem(pendingKey);

    // Fetch entity name to send back, but cap the wait so a slow
    // `/ws/2/<type>/<mbid>` response doesn't keep the new-entity tab
    // open for many seconds (#97). If the fetch beats the timeout, we
    // get the real name + disambiguation; otherwise post with empty
    // strings — the opener tab can backfill via its own state once it
    // sees the `artist-created` message. Closing was previously gated
    // on the fetch promise + a flat 800ms delay; this raced to 10s+
    // whenever MB was slow (which #87 showed is more common than we
    // thought). New worst case: ~1.1s.
    const NAME_FETCH_TIMEOUT_MS = 1000;
    const CLOSE_DELAY_MS = 50; // tiny grace for BroadcastChannel delivery
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), NAME_FETCH_TIMEOUT_MS);
    fetch(`//musicbrainz.org/ws/2/${entityType}/${mbid}?fmt=json`, { signal: ctrl.signal })
        .then(r => r.json())
        .then(json => ({ name: json.name || '', disambiguation: json.disambiguation || '' }))
        .catch(() => ({ name: '', disambiguation: '' }))
        .then(({ name, disambiguation }) => {
            clearTimeout(timer);
            DISCOGS_CHANNEL.postMessage({
                type: 'artist-created',  // keep same message type for compatibility
                id: mbid,
                name,
                disambiguation,
                resourceUrl: pending,
            });
            setTimeout(() => window.close(), CLOSE_DELAY_MS);
        });
})();

// ── Release-page bootstrap ────────────────────────────────────────────────────
// Guarded by hostname — the tidal.com companion context has no jQuery and
// none of this applies there.
if (/musicbrainz\.org$/i.test(location.hostname)) $(document).ready(function () {
    const re = /musicbrainz\.org\/release\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/edit-relationships/i;
    const m = window.location.href.match(re);
    if (!m) return;
    // Hover-highlight runs page-wide on the rel-edit page regardless of
    // whether we mount the import bar. Wiring it here means it's active for
    // MB's rel editor even before (and after) the review table comes and
    // goes — see `src/hover-highlight.js` for why.
    installHoverHighlight();
    // Batch-remove (issue #68) runs on every rel-edit page too — modifier-
    // click on any MB `×` button opens our confirmation popup. See
    // `src/batch-remove.js`.
    installBatchRemove();
    // One rel probe, every import source (#193): detect the linked providers
    // (Discogs / Tidal / Qobuz), and in parallel probe the track titles for any
    // derivable remixers (#271). The bar mounts only when there's something to
    // do — a linked provider OR at least one title-derived remixer — so CH stays
    // out of the way on releases it can't help with. The "Titles" source is then
    // offered only when that probe found remixes.
    Promise.all([
        getSourceUrlsForRelease(m[1]).catch(() => ({})),
        probeTitleRemixes(m[1]),
    ]).then(([sources, remix]) => {
        const hasProvider = !!(sources.discogs || sources.tidal || sources.qobuz);
        const remixCount  = remix?.count || 0;
        if (!hasProvider && remixCount === 0) return;   // nothing to import — don't mount
        insertDiscogsBar(sources.discogs, sources, { titlesRemixCount: remixCount });
    });
});
