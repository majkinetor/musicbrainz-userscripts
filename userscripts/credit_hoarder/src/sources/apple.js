// Apple Music source (#435) — roled per-track credits from the amp-api, anonymously.
//
// Apple's web player fetches credits from `amp-api.music.apple.com` with a bearer
// token that lives in its PUBLIC JS bundle — no user login. The flow per release:
//   1. album link (music.apple.com/<sf>/album/<id>) → GET catalog/<sf>/albums/<id>
//      → its `relationships.tracks` gives the ordered song ids;
//   2. per song → GET catalog/<sf>/songs/<id>/credits?l=en-US (the `l=` is REQUIRED;
//      without it the endpoint 404s) → credits grouped by role category, each entry a
//      name + roleNames[]. No artist URL is exposed, so every credit resolves
//      NAME-ONLY (the Qobuz/Deezer shape). A song with no credits answers 404 "No
//      related resources" — treated as "no credits", not an error.
//
// Role names are bridged to Discogs-style role strings and run through the shared
// `getArtistRoles` → ENTITY_TYPE_MAP / INSTRUMENTS vocabulary, so instruments and
// task attributes resolve the same way they do for Discogs/Tidal.

import { getArtistRoles } from '../mappers.js';

export const APPLE_AMP = 'https://amp-api.music.apple.com/v1/catalog';

// Accepts music.apple.com AND legacy itunes.apple.com links (equivalent — #436),
// an optional storefront (iTunes links sometimes omit it), and the iTunes `id` prefix.
const APPLE_ALBUM_RE = /(?:music|itunes)\.apple\.com\/(?:([a-z]{2})\/)?album\/(?:[^/?#]+\/)?(?:id)?(\d+)/i;

/** Parse an Apple Music album URL → `{ storefront, id }`, or `null`. Accepts the
 *  slugged and slug-less forms, the per-track `…/album/<slug>/<albumId>?i=<songId>`
 *  form (we take the ALBUM id — imports are album-scoped), and legacy iTunes URLs
 *  like `itunes.apple.com/us/album/id123` (#436). */
export function parseAppleAlbumUrl(url) {
    const m = APPLE_ALBUM_RE.exec(url || '');
    return m ? { storefront: (m[1] || 'us').toLowerCase(), id: m[2] } : null;
}

// Apple role name → Discogs-style role key (resolved via ENTITY_TYPE_MAP). Anything
// not listed passes through VERBATIM so instrument/vocal role names (Guitar, Bass,
// Piano…) resolve through INSTRUMENTS. Two roles are intentionally dropped and
// reported: "Performer" (Apple stamps the track's own main artist — redundant) and
// "Mastering Engineer" (mastering is a RELEASE-level rel in MB, not per-recording,
// exactly as the Tidal source treats it).
const APPLE_ROLE_BRIDGE = {
    'Songwriter':       'Written-By',
    'Writer':           'Written-By',
    'Composer':         'Composed By',
    'Lyricist':         'Lyrics By',
    'Producer':         'Producer',
    'Mixing Engineer':  'Mixed By',
    'Mixer':            'Mixed By',
    'Recording Engineer':'Recording Engineer',
    'Engineer':         'Engineer',
    'Arranger':         'Arranged By',
    'Vocalist':         'Vocals',
    'Vocal':            'Vocals',
    'Background Vocals':'Backing Vocals',
    'Background Vocal': 'Backing Vocals',
};
const APPLE_SKIP = new Set(['Performer', 'Mastering Engineer', 'Studio Personnel']);

/**
 * Map parsed Apple credits to the engine's tracklist-relationship shape (same
 * contract as `deezerToEngine` / `qobuzToEngine`). Apple exposes names only, so
 * every credit goes through name search + review (`resource_url: ''`). Returns
 * `{ tracklistRels, tracklist, skipped }`.
 *
 * `parsedTracks` = `[{ index, title, credits: [{ name, role }] }]`.
 */
export function appleToEngine(parsedTracks) {
    const tracklistRels = [];
    const tracklist = [];
    const skipped = [];
    for (const t of (parsedTracks || [])) {
        const track = { position: String(t.index), title: t.title || '', type_: 'track' };
        tracklist.push(track);
        for (const c of (t.credits || [])) {
            const role = String(c.role || '').trim();
            const name = String(c.name || '').trim();
            if (!role || !name) continue;
            if (APPLE_SKIP.has(role)) { skipped.push(`track ${t.index}: ${role} — ${name}`); continue; }
            const discogsRole = APPLE_ROLE_BRIDGE[role] || role;
            const rels = getArtistRoles({ name, anv: '', role: discogsRole, resource_url: '' });
            if (!rels || !rels.length) { skipped.push(`track ${t.index}: ${role} — ${name} (unmapped)`); continue; }
            for (const rel of rels) tracklistRels.push({ ...rel, artist: rel.artist || { name, anv: '', resource_url: '' }, track });
        }
    }
    return { tracklistRels, tracklist, skipped };
}

// ── network (GM_xmlhttpRequest; @connect music.apple.com, amp-api.music.apple.com) ──
function appleGet(url, headers) {
    return new Promise((resolve, reject) => {
        if (typeof GM_xmlhttpRequest !== 'function') { reject(new Error('GM_xmlhttpRequest unavailable')); return; }
        GM_xmlhttpRequest({
            method: 'GET', url, headers: headers || {}, timeout: 20000,
            onload: r => resolve({ status: r.status, text: r.responseText || '' }),
            onerror:   () => reject(new Error('Apple request failed (network)')),
            ontimeout: () => reject(new Error('Apple request timed out')),
        });
    });
}

let _appleToken = null;
const APPLE_TOKEN_LS = 'ch:apple-token';
/** Extract the anonymous developer bearer token from the web player's public JS.
 *  Cached in-memory + localStorage (12h). Two requests on a cold cache: the album
 *  page (to find the hashed JS asset) then that JS (to grep the `eyJ…` token). */
export async function appleToken() {
    if (_appleToken) return _appleToken;
    try {
        const raw = JSON.parse(localStorage.getItem(APPLE_TOKEN_LS) || 'null');
        if (raw && raw.t && raw.at && (Date.now() - raw.at) < 12 * 3600e3) { _appleToken = raw.t; return _appleToken; }
    } catch (e) { /* ignore */ }
    const home = await appleGet('https://music.apple.com/us/browse', { 'Accept': 'text/html' });
    const asset = (home.text.match(/\/assets\/index-legacy~[a-z0-9]+\.js/i) || home.text.match(/\/assets\/index~[a-z0-9]+\.js/i) || [])[0];
    if (!asset) throw new Error('Apple: could not locate the web-player JS asset');
    const js = await appleGet('https://music.apple.com' + asset, {});
    const tok = (js.text.match(/eyJ[A-Za-z0-9._\-]{80,}/) || [])[0];
    if (!tok) throw new Error('Apple: no bearer token in the web-player JS');
    _appleToken = tok;
    try { localStorage.setItem(APPLE_TOKEN_LS, JSON.stringify({ t: tok, at: Date.now() })); } catch (e) { /* ignore */ }
    return tok;
}

function ampHeaders(tok) { return { Authorization: 'Bearer ' + tok, Origin: 'https://music.apple.com', Accept: 'application/json' }; }

/**
 * Fetch an Apple album's per-track credits. Resolves
 * `{ album, tracks: [{ index, title, credits: [{ name, role }] }] }` — only tracks
 * with ≥1 usable credit are included. `onProgress(done, total)` fires per track.
 */
export async function fetchAppleCredits(storefront, albumId, onProgress) {
    const sf = storefront || 'us';
    const tok = await appleToken();
    const albRes = await appleGet(`${APPLE_AMP}/${sf}/albums/${encodeURIComponent(albumId)}?l=en-US`, ampHeaders(tok));
    if (albRes.status !== 200) throw new Error(`Apple album ${albumId} → HTTP ${albRes.status}`);
    let albJson; try { albJson = JSON.parse(albRes.text); } catch (e) { throw new Error('Apple: malformed album JSON'); }
    const album = albJson.data && albJson.data[0];
    const albumName = (album && album.attributes && album.attributes.name) || '';
    let songs = (album && album.relationships && album.relationships.tracks && album.relationships.tracks.data) || [];
    // tracks can be paged (>100) — follow `next`
    let next = album && album.relationships && album.relationships.tracks && album.relationships.tracks.next;
    while (next) {
        const pg = await appleGet('https://amp-api.music.apple.com' + next + (next.includes('?') ? '&' : '?') + 'l=en-US', ampHeaders(tok));
        let pj; try { pj = JSON.parse(pg.text); } catch (e) { break; }
        songs = songs.concat(pj.data || []);
        next = pj.next;
    }
    const tracks = [];
    let done = 0;
    for (const s of songs) {
        const sid = s.id;
        const num = (s.attributes && s.attributes.trackNumber) || (done + 1);
        const title = (s.attributes && s.attributes.name) || '';
        const credits = [];
        try {
            const cr = await appleGet(`${APPLE_AMP}/${sf}/songs/${encodeURIComponent(sid)}/credits?l=en-US`, ampHeaders(tok));
            if (cr.status === 200) {
                let cj; try { cj = JSON.parse(cr.text); } catch (e) { cj = null; }
                for (const grp of (cj && cj.data) || []) {
                    const arts = (grp.relationships && grp.relationships['credit-artists'] && grp.relationships['credit-artists'].data) || [];
                    for (const a of arts) {
                        const name = a.attributes && a.attributes.name;
                        for (const role of (a.attributes && a.attributes.roleNames) || []) {
                            if (name && role) credits.push({ name, role });
                        }
                    }
                }
            }
            // status 404 = "no related resources" → this track simply has no credits
        } catch (e) { /* per-track failure — skip that track's credits, keep going */ }
        if (credits.length) tracks.push({ index: +num, title, credits });
        done++;
        if (onProgress) { try { onProgress(done, songs.length); } catch (e) {} }
    }
    return { album: albumName, tracks };
}
