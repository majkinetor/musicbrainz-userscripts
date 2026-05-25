// IndexedDB cache for Discogs↔MB entity resolutions.
//
// Single object store `entity_cache`, keyed by `discogs_id` of the form
// `"<type>/<id>"` (e.g. `"artist/12345"`, `"label/678"`).
//
// Record shape — RESOLVED (preflight found an unambiguous MB match):
//
//   {
//     discogs_id,      // mirror of the key
//     mbid,            // MB GUID, lowercase hex with dashes
//     entityType,      // 'artist' | 'label' | 'place' — the MB-side type
//                      // (a Discogs label may resolve to a MB place, etc.)
//     mbUrl,           // convenience: `//musicbrainz.org/<entityType>/<mbid>`
//     name,            // MB display name (may be null until a follow-up
//                      // /ws/2/<type>/<mbid> hit populates it)
//     disambiguation,  // MB disambiguation comment (may be '')
//     resolvedVia,     // 'cache' | 'name' | 'url' | 'both' | 'user'
//                      //   cache — read from a prior session
//                      //   name  — MB name search exact hit (only)
//                      //   url   — MB URL relation lookup (only)
//                      //   both  — name AND url agreed (high confidence)
//                      //   user  — user picked / confirmed in the review table
//     resolvedAt,      // ISO8601 timestamp of the resolution
//   }
//
// Record shape — UNRESOLVED (preflight found no auto-match, user needs to
// pick or skip). Stored so an immediate page reload doesn't redo the MB
// queries for entities that genuinely have no exact-name + URL match:
//
//   {
//     discogs_id,
//     mbid:           null,
//     entityType:     null,
//     mbUrl:          null,
//     name:           null,
//     disambiguation: '',
//     resolvedVia:    null,
//     nameMatches:    [ { id, name, disambiguation, score }, … ],  // search hits
//     resolvedAt,
//   }
//
// Negative cache is sticky — the "🔄 Refresh from MB" button in the review
// table sets `bypassIdb: true` to force a fresh resolve when the user wants
// to re-check (e.g. they just created the entity in MB on another tab).
// Negative cache is NOT written when the name search itself failed
// (network error / rate-limit) — that's a "don't know" state, retry next
// time, not "we know there's nothing".
//
// `db` is exported as a live binding — `null` until `indexedDB.open()`'s
// async success callback fires, then the IDBDatabase. ES-module imports
// see the latest value automatically, so call sites that need to write
// data not yet covered by the helpers (rare) can do
// `db.transaction(['entity_cache'], …)` directly.
//
// Schema-v1 (the old `mblinks` store) is no longer read or written.
// Per the maintainer's earlier authorization (`dev/DECISIONS.md` 2026-05-23
// 14:00) we do not migrate from v1 → v2: a fresh `entity_cache` starts
// empty and re-populates as the script runs. The legacy `mblinks` store
// stays in the user's browser doing nothing; deleting it is left to the
// browser's normal IDB GC.

const DB_NAME    = 'mblink';
const DB_VERSION = 2;
const STORE      = 'entity_cache';

export let db = null;

const _request = indexedDB.open(DB_NAME, DB_VERSION);
_request.onerror = function () {
    console.error("Why didn't you allow my web app to use IndexedDB?!");
};
_request.onsuccess = function (event) {
    db = event.target.result;
};
_request.onupgradeneeded = function (event) {
    const upgradeDb = event.target.result;
    if (!upgradeDb.objectStoreNames.contains(STORE)) {
        upgradeDb.createObjectStore(STORE, { keyPath: 'discogs_id' });
    }
    // Note: the legacy `mblinks` store (v1) is intentionally NOT deleted —
    // leaving it costs nothing and avoids a destructive delete on upgrade.
};

/**
 * Build a canonical MB URL from the MB-side entity type and MBID.
 *
 * (Exported because a few call sites still want the URL form without
 * having to manually template — e.g. cache writes use both `mbid` and
 * `mbUrl` so reads don't have to recompute.)
 */
export function mbUrlOf(entityType, mbid) {
    return `//musicbrainz.org/${entityType}/${mbid}`;
}

/**
 * Read a single record from `entity_cache`. Resolves to the record (or
 * `null` if not present or if `db` isn't open yet). Never rejects — IDB
 * errors and missing-db both resolve to null so call sites can write a
 * simple `if (!rec)` guard.
 */
export function readIdbRecord(key) {
    return new Promise(resolve => {
        if (!key || !db) return resolve(null);
        try {
            const tx  = db.transaction([STORE], 'readonly');
            const req = tx.objectStore(STORE).get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror  = () => resolve(null);
        } catch(e) { resolve(null); }
    });
}

/**
 * Write (merge-upsert) a record into `entity_cache`.
 *
 *   - `key` — the `discogs_id` (`"<type>/<id>"`).
 *   - `partial` — object whose fields are merged into the existing record.
 *     Always sets `discogs_id` from `key` and `resolvedAt` from `Date.now()`.
 *     If `mbid` and `entityType` are both present, `mbUrl` is also computed
 *     so consumers don't have to.
 *
 * Returns a Promise that resolves to the final record (post-merge) or
 * `null` on error. Never rejects.
 *
 * Merge semantics: existing fields are preserved unless `partial`
 * overrides them. Use `null` in `partial` to explicitly null a field.
 */
export function writeIdbRecord(key, partial) {
    return new Promise(resolve => {
        if (!key || !db) return resolve(null);
        try {
            const tx    = db.transaction([STORE], 'readwrite');
            const store = tx.objectStore(STORE);
            const getReq = store.get(key);
            getReq.onsuccess = () => {
                const existing = getReq.result || {};
                const merged = { ...existing, ...partial, discogs_id: key, resolvedAt: new Date().toISOString() };
                if (merged.mbid && merged.entityType && !partial.mbUrl) {
                    merged.mbUrl = mbUrlOf(merged.entityType, merged.mbid);
                }
                const putReq = store.put(merged);
                putReq.onsuccess = () => resolve(merged);
                putReq.onerror   = () => resolve(null);
            };
            getReq.onerror = () => resolve(null);
        } catch(e) { resolve(null); }
    });
}
