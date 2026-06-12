// Tidal source — pure helpers (no GM, no engine imports).
//
// Tidal renders full per-track credits for *logged-out* visitors at
// `https://tidal.com/album/<id>/credits`. The page is a SPA: the raw HTML is
// empty, but after the app boots the DOM contains everything, populated by a
// same-origin call to
//   GET /v1/albums/<id>/items/credits?replace=true&includeContributors=true&offset=0&limit=100&countryCode=…
// Verified on album 427731309: 16/16 tracks, 77 credit entries, 76 of them
// (99%) carrying a stable Tidal artist id via `href="/artist/<id>"`.
//
// Those artist ids are the whole point: like the Discogs importer, a Tidal
// artist id resolves to the MB artist that already carries the matching
// Tidal URL relationship — exact, no fuzzy name matching. Only unlinked
// credits (rare; e.g. a publisher with no Tidal artist page) fall back to
// name search + review.
//
// The harvest itself runs in a `tidal.com` tab (this script @matches it);
// the MB side opens the tab and receives the result over the GM-storage
// cross-tab handshake. BroadcastChannel does NOT work here — it is
// same-origin only; GM storage is per-script and shared across origins.

/** Roles Tidal exposes → MB relationship plan. `Copyright Control` under
 *  Music Publisher is Tidal artist 15780 — a placeholder meaning "no
 *  publisher registered", filtered out by default. */
export const TIDAL_ROLE_MAP = {
    'Producer':        { target: 'recording', rel: 'producer' },
    'Composer':        { target: 'work',      rel: 'composer' },
    'Lyricist':        { target: 'work',      rel: 'lyricist' },
    'Music Publisher': { target: 'work',      rel: 'publisher' },
};

/** Tidal artist id of the "Copyright Control" placeholder publisher. */
export const TIDAL_COPYRIGHT_CONTROL_ID = '15780';

const TIDAL_ALBUM_RE = /^https?:\/\/(?:www\.|listen\.)?tidal\.com\/(?:browse\/)?album\/(\d+)/i;

/**
 * Parse a Tidal album URL → `{ id, creditsUrl }`, or `null`.
 * Accepts tidal.com, listen.tidal.com and /browse/ variants.
 */
export function parseTidalAlbumUrl(url) {
    const m = TIDAL_ALBUM_RE.exec(url || '');
    if (!m) return null;
    return { id: m[1], creditsUrl: `https://tidal.com/album/${m[1]}/credits` };
}

/**
 * Extract per-track credits from the *rendered* credits-page DOM.
 * Runs inside the tidal.com tab after the SPA has painted
 * (`[data-test="album-info-item"]` present).
 *
 * Returns `[{ num, title, tidalTrackId, credits: [{ role, names: [{ name, tidalId }] }] }]`
 * — `tidalId` is `null` for unlinked credits (plain <span>, no artist page).
 */
export function extractTidalCreditsDom(doc) {
    const out = [];
    for (const item of doc.querySelectorAll('[data-test="album-info-item"]')) {
        const num     = item.querySelector('[class*="_trackNumber"]')?.textContent?.trim() || '';
        const titleEl = item.querySelector('[class*="_title_"]');
        const credits = [];
        for (const cell of item.querySelectorAll('[class*="_creditsCell"]')) {
            const role = cell.querySelector('[data-uppercase]')?.textContent?.trim();
            if (!role) continue;
            const names = [...cell.querySelectorAll('[data-test="grid-item-detail-text-title-artist"]')]
                .map(el => ({
                    name:    el.getAttribute('title') || el.textContent.trim(),
                    tidalId: (el.getAttribute('href') || '').match(/\/artist\/(\d+)/)?.[1] || null,
                }))
                .filter(n => n.name);
            credits.push({ role, names });
        }
        out.push({
            num,
            title:        titleEl?.getAttribute('title') || titleEl?.textContent?.trim() || '',
            tidalTrackId: titleEl?.getAttribute('data-test-id') || null,
            credits,
        });
    }
    return out;
}

/**
 * Drop credits we never import: the Copyright Control placeholder publisher
 * and any role missing from `TIDAL_ROLE_MAP`. Pure filter — keeps the raw
 * harvest intact for the diagnostic log ("Copy Tidal").
 */
export function filterTidalCredits(tracks) {
    return tracks.map(t => ({
        ...t,
        credits: t.credits
            .filter(c => TIDAL_ROLE_MAP[c.role])
            .map(c => ({
                ...c,
                names: c.names.filter(n =>
                    !(c.role === 'Music Publisher' &&
                      (n.tidalId === TIDAL_COPYRIGHT_CONTROL_ID || /^copyright control$/i.test(n.name)))),
            }))
            .filter(c => c.names.length),
    }));
}
