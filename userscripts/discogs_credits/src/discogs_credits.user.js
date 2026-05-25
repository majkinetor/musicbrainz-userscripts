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

import { getDiscogsUrlForRelease } from './api-mb.js';
import { insertDiscogsBar }      from './ui-bar.js';
import                                './storage.js';   // opens IndexedDB on load

// ── BroadcastChannel: cross-tab artist creation signalling ────────────────────
// When this script runs on an MB artist page that was opened by the "Create in MB"
// button, it detects the successful creation (URL contains a MBID) and posts the
// new artist data back to the opener tab, then closes itself.
const DISCOGS_CHANNEL = new BroadcastChannel('discogs-importer-artist');

(function handleEntityPageIfNeeded() {
    // Match artist, label, or place pages with a MBID
    const entityMatch = location.href.match(
        /musicbrainz\.org\/(artist|label|place)\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?:[^/]|$)/i
    );
    if (!entityMatch) return;

    const entityType = entityMatch[1];
    const mbid       = entityMatch[2];

    // Check if we were opened by the importer
    const pendingKey = 'discogs-importer-pending-artist';
    const pending = sessionStorage.getItem(pendingKey);
    if (!pending) return;

    sessionStorage.removeItem(pendingKey);

    // Fetch entity name to send back
    fetch(`//musicbrainz.org/ws/2/${entityType}/${mbid}?fmt=json`)
        .then(r => r.json())
        .then(json => {
            DISCOGS_CHANNEL.postMessage({
                type: 'artist-created',  // keep same message type for compatibility
                id: mbid,
                name: json.name || '',
                disambiguation: json.disambiguation || '',
                resourceUrl: pending,
            });
            setTimeout(() => window.close(), 800);
        })
        .catch(() => {
            DISCOGS_CHANNEL.postMessage({
                type: 'artist-created',
                id: mbid,
                name: '',
                disambiguation: '',
                resourceUrl: pending,
            });
            setTimeout(() => window.close(), 800);
        });
})();

// ── Release-page bootstrap ────────────────────────────────────────────────────
$(document).ready(function () {
    const re = /musicbrainz\.org\/release\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/edit-relationships/i;
    const m = window.location.href.match(re);
    if (!m) return;
    getDiscogsUrlForRelease(m[1]).then(discogsUrl => {
        if (discogsUrl) {
            insertDiscogsBar(discogsUrl);
        }
    });
});
