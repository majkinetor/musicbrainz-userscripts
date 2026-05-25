// IndexedDB cache for Discogs↔MB entity resolutions.
//
// Single object store `mblinks`, keyed by `discogs_id` ("artist/12345" etc.).
// Record shape: { discogs_id, mb_links: [url], mb_name?, mb_disambiguation? }.
//
// `db` is exported as a live binding — `null` until `indexedDB.open()`'s
// async success callback fires, then the IDBDatabase. ES-module imports
// see the latest value automatically, so callers can read `db.transaction…`
// once it's ready. Guard with `if (!db) return …` for the brief startup
// window when reads might race the open.

export let db = null;

const _request = indexedDB.open('mblink');

_request.onerror = function () {
    console.error("Why didn't you allow my web app to use IndexedDB?!");
};
_request.onsuccess = function (event) {
    db = event.target.result;
};
_request.onupgradeneeded = function (event) {
    const upgradeDb = event.target.result;
    upgradeDb.createObjectStore('mblinks', {
        keyPath: 'discogs_id',
    });
};

/**
 * Read a single record from the `mblinks` store. Resolves to the record (or
 * `null` if not present or if `db` isn't open yet). Never rejects — IDB
 * errors and missing-db both resolve to null so call sites can write a
 * simple `if (!rec)` guard.
 */
export function readIdbRecord(key) {
    return new Promise(resolve => {
        if (!key || !db) return resolve(null);
        try {
            const tx = db.transaction(['mblinks'], 'readonly');
            const req = tx.objectStore('mblinks').get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror  = () => resolve(null);
        } catch(e) { resolve(null); }
    });
}
