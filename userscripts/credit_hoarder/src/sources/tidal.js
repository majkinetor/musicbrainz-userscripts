// Tidal source — pure helpers (no GM, no engine imports). Release-level
// credits are bridged to Discogs role strings here; the caller runs them
// through `getArtistRoles` so they share the full ENTITY_TYPE_MAP / INSTRUMENTS
// resolution (kept at the call site to keep this module node-importable).
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
    'Remixer':           { target: 'recording', rel: 'remixer' },   // #257 artist→recording remixer (was unrecognized → dropped)
    'Mixing Engineer':   { target: 'recording', rel: 'mix' },
    'Recording Engineer':{ target: 'recording', rel: 'recording' },
    'Sound Engineer':    { target: 'recording', rel: 'sound engineer' },
    'Composer':          { target: 'work',      rel: 'composer' },
    'Lyricist':          { target: 'work',      rel: 'lyricist' },
    'Writer':            { target: 'work',      rel: 'writer' },
    'Orchestrator':      { target: 'work',      rel: 'orchestrator' },
    'Music Publisher':   { target: 'work',      rel: 'publisher' },
    'Publisher':         { target: 'work',      rel: 'publisher' },
    // Not mapped (reported, not imported): Mastering Engineer (artist→recording mastering
    // is deprecated in MB — it's release-level), Sound Editor, the Assistant * Engineer
    // variants (need an MB "assistant" attribute), and Studio Personnel (too generic).
};

/** Tidal artist id of the "Copyright Control" placeholder publisher. */
export const TIDAL_COPYRIGHT_CONTROL_ID = '15780';

/** True for the "Copyright Control" placeholder publisher (Tidal artist 15780,
 *  or that literal name) — meaning "no publisher registered". Never imported. */
const isCopyrightControl = n =>
    n?.tidalId === TIDAL_COPYRIGHT_CONTROL_ID || /^copyright control$/i.test(n?.name || '');

// ── Release-level credits (Info tab → "Additional Credits") ─────────────────
// These are album-wide, not per-track. Tidal labels them with its own role
// names; bridge the ones that differ to the Discogs role strings the shared
// mapper understands. Anything not listed is passed through verbatim —
// instruments like "Guitar"/"Drums"/"Piano" already match the INSTRUMENTS
// table, and plain roles like "Producer"/"Conductor"/"Artwork" already match
// ENTITY_TYPE_MAP. Roles that still resolve to nothing are reported, not
// dropped silently. `[Assistant]` is appended so getArtistRoles attaches the
// MB assistant attribute (see TIDAL_ROLE_MAP for the per-track equivalent).
export const TIDAL_RELEASE_ROLE_MAP = {
    'Mixing':              'Mixed By',
    'Mixing Engineer':     'Mixed By',
    'Recording':           'Recorded By',
    'Recording Engineer':  'Recorded By',
    'Sound Engineer':      'sound engineer',
    'Mastering':           'Mastered By',
    'Mastering Engineer':  'Mastered By',
    'Vocals (Background)': 'Backing Vocals',
    'Background Vocals':   'Backing Vocals',
    'Composer':            'Composed By',
    'Lyricist':            'Lyrics By',
    'Writer':              'Written-By',
    'Orchestrator':        'Orchestrated By',
};

// Release-level roles that are label/company credits → release↔label rels (the
// `companies` path, same as Discogs). Maps the Tidal label to the Discogs
// company role string that ENTITY_TYPE_MAP resolves (e.g. distributed).
export const TIDAL_RELEASE_COMPANY_MAP = {
    'Current Distributor': 'Distributed By',
    'Distributor':         'Distributed By',
};

// Release roles that are NOT relationships at all — the album/track main artist
// (already the release's artist credit), the release's own label (set via the
// label field), or copyright lines. Dropped explicitly (and reported).
export const TIDAL_RELEASE_ROLE_SKIP = new Set([
    'Primary Artist', 'Featured Artist', 'Main Artist', 'Artist',
    'Record Label', 'Manufacturer',
    'Copyright', 'Phonographic Copyright',
]);

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
 * Extract the Info tab's "Additional Credits" — release-level credits that
 * aren't tied to any track. Same `_creditsCell` markup as the per-track cells,
 * just outside any `album-info-item`. Returns `[{ role, names:[{name,tidalId}] }]`.
 * Linked names carry a Tidal artist id (exact MB resolution); unlinked ones
 * (e.g. artwork, assistant engineers) are name-only → name search + review.
 */
export function extractTidalReleaseCreditsDom(doc) {
    const out = [];
    for (const cell of doc.querySelectorAll('[class*="_creditsCell"]')) {
        if (cell.closest('[data-test="album-info-item"]')) continue; // per-track — handled elsewhere
        const role = cell.querySelector('[data-uppercase]')?.textContent?.trim();
        if (!role) continue;
        const names = [];
        const seen  = new Set();
        // Linked + plain-text names both sit in the value span; anchors carry
        // the artist id, plain `[title]` nodes carry the name only.
        const textBox = cell.querySelector('[class*="_creditsCellText"]') || cell;
        for (const el of textBox.querySelectorAll('a, [title]')) {
            const name = (el.getAttribute('title') || el.textContent || '').trim();
            if (!name || seen.has(name)) continue;
            seen.add(name);
            names.push({ name, tidalId: (el.getAttribute('href') || '').match(/\/artist\/(\d+)/)?.[1] || null });
        }
        if (!names.length) {
            // No marked-up name nodes — split the raw text on commas.
            (textBox.textContent || '').split(/\s*,\s*/).map(s => s.trim()).filter(Boolean)
                .forEach(name => { if (!seen.has(name)) { seen.add(name); names.push({ name, tidalId: null }); } });
        }
        if (names.length) out.push({ role, names });
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
                    !(/^(?:Music )?Publisher$/.test(c.role) && isCopyrightControl(n))),
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
 * `Music Publisher` is resolved as a LABEL and attached to each track's work
 * (label→work "publishing"); `Copyright Control` is filtered out. Returns:
 *   { tracklistRels, tracklist, skipped, multiVolume }
 * `tracklist` mirrors the Discogs tracklist shape dispatch needs for its
 * position bookkeeping. `multiVolume` is true when track numbers repeat —
 * Tidal numbers per volume while MB multi-medium positions are "m-p", so
 * the caller should warn that positions may not all match.
 */
/** A music-publisher credit → label→work "publishing" rel. The publisher is a
 *  LABEL entity (entityType:'label'), resolved by name against MB labels —
 *  Tidal exposes no usable label URL, so resource_url is always empty. Pass a
 *  `track` for a per-track work; omit it for a release-level (all works) rel. */
function tidalPublisherRole(name, track) {
    const role = {
        linkType:   'publishing',
        entityType: 'label',
        attributes: [],
        artist:     { name, anv: '', entityType: 'label', resource_url: '' },
    };
    if (track) role.track = track;
    return role;
}

/** A label/company release credit (e.g. distributor) → a `companies` entry in
 *  the Discogs shape dispatchCompanies consumes. `entityTypeName` is the Discogs
 *  role string ENTITY_TYPE_MAP maps (e.g. "Distributed By" → label, distributed).
 *  Tidal exposes no label URL, so synthesise a unique resource_url (the companies
 *  path keys on it and requires it) — it 404s on MB's url endpoint, so resolution
 *  falls to a name search against MB labels. */
function tidalCompany(name, entityTypeName) {
    return {
        entity_type_name: entityTypeName,
        name,
        resource_url: 'https://tidal.com/_company/' + encodeURIComponent(entityTypeName) + '/' + encodeURIComponent(name),
    };
}

export function tidalToEngine(tracks) {
    // Derive the per-track role→linkType map straight from TIDAL_ROLE_MAP so the two
    // can't drift — a hardcoded copy here is exactly why a freshly-mapped role (Remixer,
    // #257) passed filterTidalCredits but was then dropped as "Not imported (v1 scope)".
    // Publisher / Music Publisher are handled separately below (label→work), so exclude them.
    const IMPORT_ROLES = Object.fromEntries(
        Object.entries(TIDAL_ROLE_MAP)
            .filter(([role]) => role !== 'Publisher' && role !== 'Music Publisher')
            .map(([role, { rel }]) => [role, rel]),
    );
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
            // Music publisher → label→work "publishing" (label-entity resolution).
            if (base === 'Music Publisher' || base === 'Publisher') {
                for (const n of c.names) {
                    if (isCopyrightControl(n)) continue;
                    tracklistRels.push(tidalPublisherRole(n.name, track));
                }
                continue;
            }
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

/**
 * Bridge the Info-tab release-level credits into Discogs-artist shapes
 * (`{ name, anv, role, id, resource_url }`) that the caller feeds to
 * `getArtistRoles` — the same release-level path Discogs uses, so the full
 * ENTITY_TYPE_MAP / INSTRUMENTS resolution applies. Non-artist roles (album
 * artist, the release's own label) are dropped and reported. Music-publisher
 * credits come back as pre-formed label→work `publishers` roles, and label
 * release credits (e.g. distributor) as `companies` (Discogs shape) — both
 * bypass getArtistRoles since they're label entities, not artists. Returns
 * `{ artists, publishers, companies, skipped }`.
 */
export function tidalReleaseArtists(releaseCredits) {
    const artists = [];
    const publishers = [];
    const companies = [];
    const skipped = [];
    for (const c of (releaseCredits || [])) {
        const baseRole = tidalRoleBase(c.role);
        if (baseRole === 'Music Publisher' || baseRole === 'Publisher') {
            for (const n of (c.names || [])) {
                if (isCopyrightControl(n)) continue;
                publishers.push(tidalPublisherRole(n.name));   // no track → all works
            }
            continue;
        }
        if (TIDAL_RELEASE_COMPANY_MAP[c.role]) {               // distributor → release↔label rel
            for (const n of (c.names || [])) companies.push(tidalCompany(n.name, TIDAL_RELEASE_COMPANY_MAP[c.role]));
            continue;
        }
        if (TIDAL_RELEASE_ROLE_SKIP.has(c.role)) {
            (c.names || []).forEach(n => skipped.push(`release: ${c.role} — ${n.name}`));
            continue;
        }
        // "Assistant X" → base role + assistant attribute (appended by the
        // caller after mapping), mirroring the per-track handling. Avoids the
        // bogus task attribute getArtistRoles would add for "Engineer [Assistant]".
        const base       = tidalRoleBase(c.role);
        const assistant  = base !== c.role;
        const discogsRole = TIDAL_RELEASE_ROLE_MAP[base] || base;
        for (const n of (c.names || [])) {
            artists.push({
                id:           n.tidalId ? `tidal-${n.tidalId}` : undefined,
                name:         n.name,
                anv:          '',
                role:         discogsRole,
                assistant,
                tidalRole:    c.role,   // for "not imported" reporting at the call site
                resource_url: n.tidalId ? `https://tidal.com/artist/${n.tidalId}` : '',
            });
        }
    }
    return { artists, publishers, companies, skipped };
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
                const tracks = extractTidalCreditsDom(document);
                harvestReleaseThenPost(tracks, post);
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

/** Switch to the Info tab, wait for its "Additional Credits" to paint, harvest
 *  the release-level credits, then post both per-track + release credits. The
 *  tab marker `data-test="album-info-tab-info"` is not localised. Best-effort:
 *  if the tab is absent or never paints, posts with empty release credits. */
function harvestReleaseThenPost(tracks, post) {
    const finish = releaseCredits => { post({ ok: true, tracks, releaseCredits }); setTimeout(() => window.close(), 250); };
    const infoTab = document.querySelector('[data-test="album-info-tab-info"]');
    if (!infoTab) { finish([]); return; }
    try { infoTab.click(); } catch (e) { finish([]); return; }
    const start = Date.now();
    const t = setInterval(() => {
        const cells = [...document.querySelectorAll('[class*="_creditsCell"]')]
            .filter(c => !c.closest('[data-test="album-info-item"]'));
        if (cells.length > 0) {
            clearInterval(t);
            // small settle so all blocks are present before extraction
            setTimeout(() => finish(extractTidalReleaseCreditsDom(document)), 600);
        } else if (Date.now() - start > 6000) {
            clearInterval(t);
            finish([]);
        }
    }, 250);
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
