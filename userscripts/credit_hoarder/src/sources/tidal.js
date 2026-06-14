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
    'Producer':          { target: 'recording', rel: 'producer' },
    'Mixing Engineer':   { target: 'recording', rel: 'mix' },
    'Recording Engineer':{ target: 'recording', rel: 'recording' },
    'Sound Engineer':    { target: 'recording', rel: 'sound engineer' },
    'Composer':          { target: 'work',      rel: 'composer' },
    'Lyricist':          { target: 'work',      rel: 'lyricist' },
    'Writer':            { target: 'work',      rel: 'writer' },
    'Orchestrator':      { target: 'work',      rel: 'orchestrator' },
    'Music Publisher':   { target: 'work',      rel: 'publisher' },
    // Not mapped (reported, not imported): Mastering Engineer (artist→recording mastering
    // is deprecated in MB — it's release-level), Sound Editor, the Assistant * Engineer
    // variants (need an MB "assistant" attribute), and Studio Personnel (too generic).
};

/** Tidal artist id of the "Copyright Control" placeholder publisher. */
export const TIDAL_COPYRIGHT_CONTROL_ID = '15780';

// MB's `/ws/js/release` rel hrefs are PROTOCOL-RELATIVE (`//tidal.com/…`) —
// both regexes accept that form alongside https://.
const TIDAL_ALBUM_RE = /^(?:https?:)?\/\/(?:www\.|listen\.)?tidal\.com\/(?:browse\/)?album\/(\d+)/i;

/**
 * Parse a Tidal album URL → `{ id, creditsUrl }`, or `null`.
 * Accepts tidal.com, listen.tidal.com, /browse/ and protocol-relative variants.
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
 * Strip an "Assistant …" prefix off a Tidal role. MB has no distinct
 * "assistant mixing engineer" relationship — it's the base relationship
 * (mix / recording / sound …) with the `assistant` attribute ticked — so we
 * map the base role and carry the assistant flag separately.
 *   "Assistant Mixing Engineer" -> "Mixing Engineer"
 *   "Mixing Engineer"           -> "Mixing Engineer"
 */
const ASSISTANT_RE = /^Assistant\s+(.+)$/i;
export function tidalRoleBase(role) {
    const m = ASSISTANT_RE.exec(role || '');
    return m ? m[1] : role;
}

/**
 * Drop credits we never import: the Copyright Control placeholder publisher
 * and any role whose base is missing from `TIDAL_ROLE_MAP`. Pure filter —
 * keeps the raw harvest intact for the diagnostic log ("Copy Tidal").
 */
export function filterTidalCredits(tracks) {
    return tracks.map(t => ({
        ...t,
        credits: t.credits
            .filter(c => TIDAL_ROLE_MAP[tidalRoleBase(c.role)])
            .map(c => ({
                ...c,
                names: c.names.filter(n =>
                    !(c.role === 'Music Publisher' &&
                      (n.tidalId === TIDAL_COPYRIGHT_CONTROL_ID || /^copyright control$/i.test(n.name)))),
            }))
            .filter(c => c.names.length),
    }));
}

const TIDAL_ARTIST_RE = /^(?:https?:)?\/\/(?:www\.|listen\.)?tidal\.com\/(?:browse\/)?artist\/(\d+)/i;

/** Parse a Tidal artist URL → `{ id, key, cleanUrl }` (key = IDB cache key,
 *  `tidal-` prefixed so numeric Tidal ids never collide with Discogs ids),
 *  or `null`. `cleanUrl` is MB's canonical Tidal artist URL form — the one
 *  `/ws/2/url?resource=` is queried with during preflight. */
export function parseTidalArtistUrl(url) {
    const m = TIDAL_ARTIST_RE.exec(url || '');
    if (!m) return null;
    return { id: m[1], key: `tidal-artist/${m[1]}`, cleanUrl: `https://tidal.com/artist/${m[1]}` };
}

/**
 * Map a raw Tidal harvest to the engine's tracklist-relationship shape
 * (what the Discogs path builds in ui-bar's runImport):
 *   `{ linkType, entityType, attributes, artist, track }`
 * with `artist.resource_url` set to the canonical Tidal artist URL when the
 * credit carries an id (→ preflight resolves it EXACTLY via MB's Tidal URL
 * rel), or `''` when it doesn't (→ name search + review, like a Discogs
 * credit with no resource_url).
 *
 * v1 imports Producer / Composer / Lyricist. `Music Publisher` is reported
 * in `skipped` (work-publisher seeding is label-entity work, deferred), as
 * is anything Copyright-Control. Returns:
 *   { tracklistRels, tracklist, skipped, multiVolume }
 * `tracklist` mirrors the Discogs tracklist shape dispatch needs for its
 * position bookkeeping. `multiVolume` is true when track numbers repeat —
 * Tidal numbers per volume while MB multi-medium positions are "m-p", so
 * the caller should warn that positions may not all match.
 */
export function tidalToEngine(tracks) {
    // Subset of TIDAL_ROLE_MAP actually dispatched as track/recording/work rels.
    // 'Music Publisher' is intentionally excluded — work-publisher is label-entity
    // work, deferred (handled via `skipped` below).
    const IMPORT_ROLES = {
        'Producer':           'producer',
        'Mixing Engineer':    'mix',
        'Recording Engineer': 'recording',
        'Sound Engineer':     'sound engineer',
        'Composer':           'composer',
        'Lyricist':           'lyricist',
        'Writer':             'writer',
        'Orchestrator':       'orchestrator',
    };
    const tracklistRels = [];
    const tracklist = [];
    const skipped = [];
    const seenPositions = new Set();
    let multiVolume = false;
    for (const t of filterTidalCredits(tracks)) {
        const position = String(t.num || '').trim();
        if (seenPositions.has(position)) multiVolume = true;
        seenPositions.add(position);
        const track = { position, title: t.title || '', type_: 'track' };
        tracklist.push(track);
        for (const c of t.credits) {
            const base      = tidalRoleBase(c.role);
            const assistant = base !== c.role;
            const linkType  = IMPORT_ROLES[base];
            for (const n of c.names) {
                if (!linkType) {
                    skipped.push(`track ${position} "${t.title}": ${c.role} — ${n.name}`);
                    continue;
                }
                tracklistRels.push({
                    linkType,
                    entityType: 'artist',
                    attributes: assistant ? ['assistant'] : [],
                    artist: {
                        id:           n.tidalId ? `tidal-${n.tidalId}` : undefined,
                        name:         n.name,
                        anv:          '',
                        resource_url: n.tidalId ? `https://tidal.com/artist/${n.tidalId}` : '',
                    },
                    track,
                });
            }
        }
    }
    return { tracklistRels, tracklist, skipped, multiVolume };
}

// ── Cross-tab harvest (GM storage handshake) ────────────────────────────────
// The MB side opens `https://tidal.com/album/<id>/credits#ch-req=<reqId>`;
// this script also runs there (meta @match), waits for the SPA to paint the
// credits, extracts them, and posts the result through GM storage — which,
// unlike BroadcastChannel, is per-script and crosses origins.

const HARVEST_KEY = reqId => `ch-tidal-result:${reqId}`;
const HARVEST_TIMEOUT_MS = 45000;

/** Tidal-tab side. Call once at script start when running on tidal.com.
 *  No-op unless the URL carries our `#ch-req=` marker (so a user just
 *  browsing Tidal with the script installed is never affected). */
export function runTidalHarvestPage() {
    const m = location.hash.match(/ch-req=([a-z0-9.-]+)/i);
    if (!m) return;
    const reqId = m[1];
    const albumId = (location.pathname.match(/\/album\/(\d+)/) || [])[1] || null;
    const post = payload => { try { GM_setValue(HARVEST_KEY(reqId), { albumId, ts: Date.now(), ...payload }); } catch (e) { /* GM missing */ } };
    const started = Date.now();
    let lastCount = -1, stableSince = 0;
    const timer = setInterval(() => {
        const items = document.querySelectorAll('[data-test="album-info-item"]');
        if (items.length > 0) {
            // wait until the count is stable for ~1.2s — the SPA appends
            // tracks in chunks and we don't want a partial harvest
            if (items.length !== lastCount) { lastCount = items.length; stableSince = Date.now(); }
            else if (Date.now() - stableSince > 1200) {
                clearInterval(timer);
                post({ ok: true, tracks: extractTidalCreditsDom(document) });
                setTimeout(() => window.close(), 250);
                return;
            }
        }
        if (Date.now() - started > HARVEST_TIMEOUT_MS - 5000) {
            clearInterval(timer);
            post({ ok: false, error: lastCount > 0 ? 'render never stabilised' : 'credits never rendered (login wall? geo block?)' });
            setTimeout(() => window.close(), 250);
        }
    }, 300);
}

/** MB side. Opens the credits tab and resolves with the harvested
 *  `{ ok, tracks | error, albumId }` payload, or rejects on timeout /
 *  blocked popup. Cleans up its GM key either way. */
export function harvestTidalAlbum(albumUrl) {
    const parsed = parseTidalAlbumUrl(albumUrl);
    if (!parsed) return Promise.reject(new Error(`Not a Tidal album URL: ${albumUrl}`));
    const reqId = `${parsed.id}.${Date.now().toString(36)}`;
    const key = HARVEST_KEY(reqId);
    const harvestUrl = `${parsed.creditsUrl}#ch-req=${reqId}`;
    // Background tab — the user shouldn't lose the MB editor while the
    // harvest runs. GM_openInTab supports `active:false`; plain window.open
    // (foreground) is the fallback on managers without it.
    if (typeof GM_openInTab === 'function') {
        GM_openInTab(harvestUrl, { active: false, insert: true, setParent: true });
    } else {
        const tab = window.open(harvestUrl, '_blank');
        if (!tab) return Promise.reject(new Error('Popup blocked — allow popups for musicbrainz.org and retry'));
    }
    return new Promise((resolve, reject) => {
        let listenerId = null;
        let pollTimer = null;
        const done = (fn, arg) => {
            if (pollTimer) clearInterval(pollTimer);
            clearTimeout(deadline);
            try { if (listenerId !== null && typeof GM_removeValueChangeListener === 'function') GM_removeValueChangeListener(listenerId); } catch (e) {}
            try { GM_deleteValue(key); } catch (e) {}
            fn(arg);
        };
        const check = value => { if (value && typeof value === 'object') done(resolve, value); };
        if (typeof GM_addValueChangeListener === 'function') {
            listenerId = GM_addValueChangeListener(key, (_n, _o, value) => check(value));
        }
        // Poll as well — belt and braces, and the only path on managers
        // without GM_addValueChangeListener.
        pollTimer = setInterval(() => { try { check(GM_getValue(key)); } catch (e) {} }, 700);
        const deadline = setTimeout(() => done(reject, new Error('Tidal harvest timed out — is the credits tab open and loading?')), HARVEST_TIMEOUT_MS);
    });
}
