// Metal Archives (Encyclopaedia Metallum) source — modeled on tidal.js. #453
//
// Metal Archives is Cloudflare-walled (a plain GM_xmlhttpRequest is challenged),
// so — exactly like the Tidal harvest — the MB side opens the album page in a
// BACKGROUND TAB (a real browser clears the CF challenge), the script also runs
// there (@match metal-archives.com/albums/*), reads the DOM, and posts the result
// back over the GM-storage handshake (crosses origins; BroadcastChannel doesn't).
//
// Unlike Tidal it's plain STATIC HTML — the lineup lives in three tables that are
// present on load, so there's no SPA "wait for render" dance:
//   #album_members_lineup  → Band members     (per-track performance)
//   #album_members_guest   → Guest/session    (per-track performance, `guest` attr)
//   #album_members_misc    → Other staff      (release-level production/art)
// Each row is an artist (with a stable id → MB "other databases" URL rel, so it
// resolves EXACTLY via /ws/2/url?resource=) plus a free-text role string.
//
// Credits are ALBUM-level with optional per-track qualifiers "(track N)" /
// "(tracks 1-8, 10)". A performance/work credit with no qualifier applies to the
// whole tracklist; production/art staff are release-level.
//
// Roles are bridged to the Discogs vocabulary and resolved through the shared
// getArtistRoles() (ENTITY_TYPE_MAP + INSTRUMENTS) — the same path the Tidal
// "everything else" branch uses — so we don't re-implement instrument/role mapping.

import { getArtistRoles } from '../mappers.js';

/* ── URL parsing ─────────────────────────────────────────────────────────── */

const MA_ARTIST_RE = /^https?:\/\/(?:www\.)?metal-archives\.com\/artists\/([^/?#]+)\/(\d+)/i;
/** Parse a Metal Archives person URL → `{ id, key, cleanUrl }` (key = IDB cache
 *  key, `metal-archives-` prefixed so numeric ids never collide with Discogs),
 *  or `null`. `cleanUrl` is the canonical form `/ws/2/url?resource=` is queried
 *  with during preflight — MB links persons as `.../artists/<Name>/<id>`. */
export function parseMetalArchivesArtistUrl(url) {
    const m = MA_ARTIST_RE.exec(url || '');
    if (!m) return null;
    return { id: m[2], key: `metal-archives-artist/${m[2]}`, cleanUrl: `https://www.metal-archives.com/artists/${m[1]}/${m[2]}` };
}

const MA_ALBUM_RE = /^https?:\/\/(?:www\.)?metal-archives\.com\/albums\/([^/?#]+)\/([^/?#]+)\/(\d+)/i;
/** Parse a Metal Archives album URL → `{ id, albumUrl }` or `null`. */
export function parseMetalArchivesAlbumUrl(url) {
    const m = MA_ALBUM_RE.exec(url || '');
    if (!m) return null;
    return { id: m[3], albumUrl: `https://www.metal-archives.com/albums/${m[1]}/${m[2]}/${m[3]}` };
}

/* ── role-string bridge → Discogs vocabulary getArtistRoles understands ──────
 * getArtistRoles resolves a Discogs-style role string (comma-separated, with
 * `[bracket]` attribute/task notation) via ENTITY_TYPE_MAP + INSTRUMENTS. We
 * therefore map each Metal Archives role name onto that vocabulary; anything not
 * listed is passed through as-is (many instruments already match INSTRUMENTS_CI)
 * with a trailing-"s" retry, else reported as not-imported. */

// Instruments/performance — Metal Archives name → Discogs/INSTRUMENTS role name.
// (Values chosen to hit INSTRUMENTS_CI / ENTITY_TYPE_MAP; the OP's #453 list.)
const MA_INSTRUMENT_MAP = {
    // Guitars / Bass are special-cased in bridgeToken (electric by default in metal, #453).
    'Drums': 'Drums', 'Drum programming': 'Drum Programming', 'Drum Programming': 'Drum Programming',
    'Keyboards': 'Keyboard', 'Keyboard': 'Keyboard',
    'Synthesizers': 'Synthesizer', 'Synthesizer': 'Synthesizer', 'Synth': 'Synthesizer', 'Synths': 'Synthesizer',
    'Piano': 'Piano', 'Percussion': 'Percussion', 'Classical Percussion': 'Percussion',
    'Bagpipes': 'Bagpipe', 'Bells': 'Bell', 'Round Bells': 'Bell', 'Kettledrums': 'Kettledrum',
    'Contrabass': 'Double Bass', 'Citern': 'Cittern', "Jew's Harp": 'Mouth Harp', 'Oak Stick': 'Rhythm Sticks',
    'Western Concert Flute': 'Concert Flute', 'Woodchimes': 'Chimes', 'Wind instruments': 'Wind Instruments',
    'Saxophone (alto)': 'Alto Saxophone', 'Saxophone (baritone)': 'Baritone Saxophone', 'Saxophone (tenor)': 'Tenor Saxophone',
    // pass-through-friendly names (already in INSTRUMENTS): Accordion, Banjo, Bassoon, Bouzouki, Cello,
    // Clarinet, Concertina, Cowbell, Crumhorn, Domra, Fiddle, Flute, French Horn, Harp, Harpsichord,
    // Hurdy Gurdy, Mandolin, Oboe, Ocarina, Organ, Pan Flute, Saxophone, Shakuhachi, Sopilka, Strings,
    // Tambourine, Timpani, Tin Whistle, Trombone, Trumpet, Viola, Violin, Xylophone, Sitar, Ebow, Samples.
};

// Vocal subtype (parenthetical) → Discogs "… Vocals" role (ENTITY_TYPE_MAP key).
const MA_VOCAL_SUBTYPE = {
    'lead': 'Lead Vocals', 'backing': 'Backing Vocals', 'back': 'Backing Vocals', 'additional': 'Backing Vocals',
    'baritone': 'Baritone Vocals', 'soprano': 'Soprano Vocals', 'tenor': 'Tenor Vocals', 'alto': 'Alto Vocals',
    'choirs': 'Choir Vocals', 'choir': 'Choir Vocals', 'spoken': 'Spoken Vocals', 'spoken word': 'Spoken Vocals',
};

// Other-staff / work — Metal Archives role → Discogs ENTITY_TYPE_MAP key.
const MA_STAFF_MAP = {
    'Songwriting': 'Composed By', 'Composition': 'Composed By',
    'Lyrics': 'Lyrics By', 'Arrangements': 'Arranged By', 'Arrangement': 'Arranged By',
    'Recording': 'Recording Engineer', 'Engineering': 'Engineer', 'Mixing': 'Mixed By',
    'Remixing': 'Remixer', 'Mastering': 'Mastered By', 'Remastering': 'Remastered By',
    'Producer': 'Producer', 'Executive Producer': 'Executive-Producer', 'Co-producer': 'Co-producer',
    'Editing': 'Edited By', 'Technician': 'Instruments', 'Conductor': 'Conductor', 'Choirmaster': 'Chorus Master',
    'Artwork': 'Artwork By', 'Illustrations': 'Illustration', 'Illustration': 'Illustration',
    'Cover Art': 'Artwork By', 'Interior art': 'Artwork By', 'Art Direction': 'Art Direction',
    'Photography': 'Photography By', 'Design': 'Graphic Design',
    'Liner Notes': 'Liner Notes', 'Director': 'Director',
    // design-with-a-task (#453): base rel + a `task` attribute (getArtistRoles doesn't add
    // it for the graphic-design link type, so bridgeToken attaches it explicitly).
};
// Metal Archives "Other staff" role → MB Graphic Design rel + a design task attribute.
const MA_DESIGN_TASK = { 'Layout': 'layout', 'Logo': 'logo', 'Photo manipulation': 'photo manipulation' };

// Reported, not imported (no clean MB target, or out of scope — OP's list).
const MA_SKIP = new Set([
    'All Instruments', 'Everything', 'Unknown', 'Production assistance',
    'Producer (pre-production)', 'Authoring', 'Orchestra leader', 'Menu',
]);
// Ambience → a release-level "field recording" is out of the getArtistRoles vocab; skip+report for now.
const MA_SPECIAL_SKIP = new Set(['Ambience']);

/* ── role-cell parsing ───────────────────────────────────────────────────── */

// Split on commas that are OUTSIDE parentheses, so a nested detail like
// "Guitars (electric, 6 & 12-string acoustic)" stays a single token.
function splitTopLevelCommas(str) {
    const out = []; let depth = 0, cur = '';
    for (const ch of String(str || '')) {
        if (ch === '(') depth++;
        else if (ch === ')') depth = Math.max(0, depth - 1);
        if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; }
        else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
}

// A parenthetical group that is a track list → array of 1-based track numbers, else null.
function parseTrackGroup(inner) {
    if (!/^tracks?\b/i.test(inner)) return null;
    const nums = [];
    inner.replace(/^tracks?\s*/i, '').split(',').forEach(part => {
        const range = part.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
        if (range) { for (let n = +range[1]; n <= +range[2]; n++) nums.push(n); }
        else { const one = part.trim().match(/^\d+$/); if (one) nums.push(+part.trim()); }
    });
    return nums.length ? nums : null;
}

// Parse one role cell into tokens: [{ base, details:[str], tracks:[num]|null }].
// e.g. "Cello (solo) (track 10), Cello" → [{base:'Cello',details:['solo'],tracks:[10]}, {base:'Cello',details:[],tracks:null}]
export function parseMaRoleCell(cell) {
    return splitTopLevelCommas(cell).map(token => {
        const details = []; let tracks = null;
        const base = token.replace(/\(([^()]*)\)/g, (_, inner) => {
            const tg = parseTrackGroup(inner.trim());
            if (tg) tracks = (tracks || []).concat(tg);
            else if (inner.trim()) details.push(inner.trim());
            return '';
        }).replace(/\s+/g, ' ').trim();
        return { base, details, tracks };
    }).filter(t => t.base);
}

// Map one parsed token → `{ role, attrs }` for getArtistRoles (`role` = a Discogs role
// string; `attrs` = extra MB attributes to append after resolution), or null to skip.
function bridgeToken(tok) {
    const base = tok.base;
    if (MA_SKIP.has(base) || MA_SPECIAL_SKIP.has(base)) return null;
    const detail = tok.details.map(d => d.toLowerCase()).join(' ');
    // Guitars / Bass default to the ELECTRIC variant in metal, unless a detail says
    // otherwise (acoustic / classical / double / fretless) — OP #453.
    if (/^guitars?$/i.test(base)) {
        const role = /\belectric\b/.test(detail) ? 'Electric Guitar'
            : /\bacoustic\b/.test(detail) ? 'Acoustic Guitar'
            : /\b(classical|nylon)\b/.test(detail) ? 'Classical Guitar'
            : 'Electric Guitar';
        return { role, attrs: [] };
    }
    if (/^bass(\s*guitar)?$/i.test(base)) {
        const role = /\bacoustic\b/.test(detail) ? 'Acoustic Bass'
            : /\b(double|upright|contrabass)\b/.test(detail) ? 'Double Bass'
            : /\bfretless\b/.test(detail) ? 'Fretless Bass'
            : 'Electric Bass Guitar';   // metal default = MB's specific "electric bass guitar" (OP #453)
        return { role, attrs: [] };
    }
    // Vocals with a subtype detail → "Lead Vocals" / "Backing Vocals" / …
    if (/^vocals?$/i.test(base) || /^voice$/i.test(base) || /^narration$/i.test(base)) {
        if (/^narration$/i.test(base)) return { role: 'Spoken Vocals', attrs: [] };
        const sub = tok.details.map(d => d.toLowerCase()).find(d => MA_VOCAL_SUBTYPE[d]);
        return { role: sub ? MA_VOCAL_SUBTYPE[sub] : 'Vocals', attrs: [] };
    }
    // Design-with-a-task (Layout / Logo / Photo manipulation) → graphic design + task attr.
    if (MA_DESIGN_TASK[base]) return { role: 'Graphic Design', attrs: [{ _type: 'task', value: MA_DESIGN_TASK[base] }] };
    // Named instrument remap, else staff/work remap, else pass through (INSTRUMENTS_CI),
    // else strip a trailing "s" and retry (OP heuristic).
    return { role: MA_INSTRUMENT_MAP[base] || MA_STAFF_MAP[base] || base, attrs: [] };
}

/* ── DOM extraction ──────────────────────────────────────────────────────── */

function textById(doc, id) { const el = doc.getElementById(id); return el ? el.textContent.trim() : ''; }

// One lineup table → rows [{ name, id, url, roleCell, band }]. `[BandName]` header
// rows (multi-artist splits/collabs) set the current band for the rows beneath.
function extractLineupTable(doc, id) {
    const table = doc.getElementById(id);
    const rows = [];
    if (!table) return rows;
    let band = null;
    for (const tr of table.querySelectorAll('tr')) {
        const a = tr.querySelector('a[href*="/artists/"]');
        const tds = [...tr.querySelectorAll('td')];
        if (!a) {
            // a band-group header row on a split/collab (e.g. "[Agalloch]") — no artist link
            const label = tds.map(td => td.textContent.trim()).join(' ').replace(/^\[|\]$/g, '').trim();
            if (label) band = label;
            continue;
        }
        const url = a.href;
        const nameText = a.textContent.trim();   // the name cell may render "Name (R.I.P. YYYY)"; use the link text
        // the role is the cell that does NOT contain the artist link
        const roleTd = tds.find(td => !td.querySelector('a[href*="/artists/"]'));
        const roleCell = roleTd ? roleTd.textContent.trim().replace(/\s+/g, ' ') : '';
        rows.push({ name: nameText, url, roleCell, band });
    }
    return rows;
}

// Tracklist (Songs tab) → [{ position, title, type_ }]. Multi-disc → "disc-track"
// positions (the engine's multi-medium "m-p" convention), else bare numbers.
function extractTracklist(doc) {
    const table = doc.querySelector('#album_tabs_tracklist table.table_lyrics, .album_tabs_tracklist table, table.table_lyrics');
    const tracks = []; let disc = 0;
    if (!table) return { tracks, multiDisc: false };
    // multi-disc when the tracklist carries "Disc N"/"CD N" header rows
    const multiDisc = /\b(?:Disc|CD)\s*\d/i.test(table.textContent);
    for (const tr of table.querySelectorAll('tr')) {
        const tds = [...tr.querySelectorAll('td')];
        // a disc-header row (e.g. "Disc 1") — a single spanning cell, no numbered track
        if (/^(disc|cd|side)\s*\w+/i.test(tr.textContent.trim()) && !tr.querySelector('td.wrapWords')) { disc++; continue; }
        const m = tds[0] && tds[0].textContent.trim().match(/^(\d+)\.?$/);
        if (!m) continue;
        const n = +m[1];
        const titleCell = tr.querySelector('td.wrapWords') || tds[1];
        const title = titleCell ? titleCell.textContent.trim().replace(/\s+/g, ' ') : '';
        tracks.push({ position: multiDisc ? `${disc || 1}-${n}` : String(n), title, type_: 'track' });
    }
    return { tracks, multiDisc };
}

// Extract the whole album page → the harvest payload the MB side consumes.
export function extractMaLineupDom(doc) {
    const typeEl = [...doc.querySelectorAll('#album_info dt, dl.float_left dt')].find(d => /^type\b/i.test(d.textContent.trim()));
    const type = typeEl && typeEl.nextElementSibling ? typeEl.nextElementSibling.textContent.trim() : '';
    const band = extractLineupTable(doc, 'album_members_lineup');
    const guest = extractLineupTable(doc, 'album_members_guest');
    const misc = extractLineupTable(doc, 'album_members_misc');
    const { tracks, multiDisc } = extractTracklist(doc);
    const multiBand = /split|collaboration/i.test(type) || [...band, ...guest].some(r => r.band);
    // On a split, tracklist titles are prefixed "Band - Title" — tag each track with the
    // lineup band it belongs to (and strip the prefix) so credits scope to that band's tracks (#453).
    if (/split/i.test(type)) {
        const bandNames = [...new Set([...band, ...guest, ...misc].map(r => r.band).filter(Boolean))];
        for (const t of tracks) {
            const b = bandNames.find(bn => new RegExp('^' + bn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[-–]\\s*', 'i').test(t.title));
            if (b) { t.band = b; t.title = t.title.replace(new RegExp('^' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[-–]\\s*', 'i'), ''); }
        }
    }
    return { type, multiBand, multiDisc, tracks, band, guest, misc };
}

/* ── cross-tab harvest (GM storage handshake — same pattern as tidal.js) ───── */

const HARVEST_KEY = reqId => `ch-ma-result:${reqId}`;
const HARVEST_TIMEOUT_MS = 45000;

/** metal-archives.com-tab side. Call once at script start when running there.
 *  No-op unless the URL carries our `#ch-req=` marker. The album page is static
 *  HTML, so we just wait for it to have loaded past the Cloudflare challenge,
 *  extract, post, and close. */
export function runMetalArchivesHarvestPage() {
    const m = location.hash.match(/ch-req=([a-z0-9.-]+)/i);
    if (!m) return;
    const reqId = m[1];
    const albumId = (location.pathname.match(/\/albums\/[^/]+\/[^/]+\/(\d+)/) || [])[1] || null;
    const post = payload => { try { GM_setValue(HARVEST_KEY(reqId), { albumId, ts: Date.now(), ...payload }); } catch (e) { /* GM missing */ } };
    const started = Date.now();
    const timer = setInterval(() => {
        const challenged = /just a moment|attention required|checking your browser/i.test(document.title);
        // "real album page" markers (present whether or not there's a lineup)
        const ready = document.querySelector('#album_info, .album_name, #album_tabs_tracklist, table.table_lyrics');
        if (ready && !challenged) {
            clearInterval(timer);
            try { post({ ok: true, ...extractMaLineupDom(document) }); }
            catch (e) { post({ ok: false, error: 'extract failed: ' + (e && e.message) }); }
            setTimeout(() => window.close(), 250);
            return;
        }
        if (Date.now() - started > HARVEST_TIMEOUT_MS - 3000) {
            clearInterval(timer);
            post({ ok: false, error: challenged ? 'Cloudflare challenge did not clear in the tab' : 'album page never rendered' });
            setTimeout(() => window.close(), 250);
        }
    }, 300);
}

/** MB side. Opens the album page in a background tab (a real browser clears the
 *  Cloudflare challenge), waits for the harvested payload over GM storage, and
 *  resolves with `{ ok, type, tracks, band, guest, misc, … }` (or `{ ok:false,
 *  error }`). Cleans up its GM key either way. */
export function harvestMetalArchivesAlbum(albumUrl) {
    const parsed = parseMetalArchivesAlbumUrl(albumUrl);
    if (!parsed) return Promise.reject(new Error(`Not a Metal Archives album URL: ${albumUrl}`));
    const reqId = `${parsed.id}.${Date.now().toString(36)}`;
    const key = HARVEST_KEY(reqId);
    const harvestUrl = `${parsed.albumUrl}#ch-req=${reqId}`;
    if (typeof GM_openInTab === 'function') {
        GM_openInTab(harvestUrl, { active: false, insert: true, setParent: true });
    } else {
        const tab = window.open(harvestUrl, '_blank');
        if (!tab) return Promise.reject(new Error('Popup blocked — allow popups for musicbrainz.org and retry'));
    }
    return new Promise((resolve, reject) => {
        let listenerId = null, pollTimer = null;
        const done = (fn, arg) => {
            if (pollTimer) clearInterval(pollTimer);
            clearTimeout(deadline);
            try { if (listenerId !== null && typeof GM_removeValueChangeListener === 'function') GM_removeValueChangeListener(listenerId); } catch (e) {}
            try { GM_deleteValue(key); } catch (e) {}
            fn(arg);
        };
        const check = value => { if (value && typeof value === 'object') done(resolve, value); };
        if (typeof GM_addValueChangeListener === 'function') listenerId = GM_addValueChangeListener(key, (_n, _o, value) => check(value));
        pollTimer = setInterval(() => { try { check(GM_getValue(key)); } catch (e) {} }, 700);
        const deadline = setTimeout(() => done(reject, new Error('Metal Archives harvest timed out — is the album tab open and loading?')), HARVEST_TIMEOUT_MS);
    });
}

/* ── harvest → engine shape ──────────────────────────────────────────────── */

// Build the `{ id, name, anv, role, resource_url }` artist getArtistRoles wants,
// with the canonical MA person URL so preflight resolves it by URL.
function maArtist(row, discogsRole) {
    const parsed = parseMetalArchivesArtistUrl(row.url);
    return {
        id:           parsed ? `metal-archives-${parsed.id}` : undefined,
        name:         row.name,
        anv:          '',
        role:         discogsRole,
        resource_url: parsed ? parsed.cleanUrl : '',
    };
}

// One lineup row → engine per-track rels. `guest` adds the guest attribute; the
// row's role cell is parsed, each token bridged and resolved, then applied to
// its track(s) — the qualifier's tracks, or (none) → every track.
function rowToTrackRels(row, allTracks, byPosition, guest, skipped, sectionLabel, onlyQualified) {
    const rels = [];
    for (const tok of parseMaRoleCell(row.roleCell)) {
        if (onlyQualified && !tok.tracks) continue;   // other-staff: unqualified → release-level (handled elsewhere)
        const bridged = bridgeToken(tok);
        if (!bridged) { skipped.push(`${sectionLabel}: ${tok.base} — ${row.name}`); continue; }
        // resolve via the shared Discogs resolver; retry once without a trailing "s"
        let resolved = getArtistRoles(maArtist(row, bridged.role));
        if (!resolved.length && /s$/i.test(bridged.role)) resolved = getArtistRoles(maArtist(row, bridged.role.replace(/s$/i, '')));
        if (!resolved.length) { skipped.push(`${sectionLabel}: ${tok.base} — ${row.name}`); continue; }
        const targets = tok.tracks ? tok.tracks.map(n => byPosition.get(String(n))).filter(Boolean) : allTracks;
        for (const track of targets) {
            for (const r of resolved) {
                rels.push({
                    linkType: r.linkType, entityType: 'artist',
                    attributes: [...(r.attributes || []), ...bridged.attrs, ...(guest ? ['guest'] : [])],
                    artist: r.artist, track,
                });
            }
        }
    }
    return rels;
}

/**
 * Map a Metal Archives harvest → the engine's per-track relationship shape
 * `{ tracklistRels, tracklist, skipped, multiVolume }` (same contract as
 * tidalToEngine). Band + Guest performance/work credits become per-track rels;
 * a credit with no "(track N)" qualifier applies to the WHOLE tracklist. Splits
 * (per-band track scoping) are reported for manual review in this version.
 */
export function metalArchivesToEngine(harvest) {
    const tracklist = (harvest.tracks || []).map(t => ({ position: t.position, title: t.title, type_: 'track', band: t.band }));
    const byPosition = new Map(tracklist.map(t => [String(t.position).replace(/^\d+-/, ''), t]));
    // also key bare medium-less numbers for single-disc
    tracklist.forEach(t => byPosition.set(String(t.position), t));
    const skipped = [];
    const tracklistRels = [];
    const isSplit = /split/i.test(harvest.type || '');
    for (const [rows, guest, label] of [[harvest.band || [], false, 'band'], [harvest.guest || [], true, 'guest']]) {
        for (const row of rows) {
            // On a split, scope a band's credits to the tracks tagged with that band (#453);
            // fall back to reporting if the band's tracks couldn't be identified.
            let scope = tracklist;
            if (isSplit && row.band) {
                scope = tracklist.filter(t => t.band === row.band);
                if (!scope.length) { skipped.push(`${label} (split — no tracks matched band "${row.band}"): ${row.roleCell} — ${row.name}`); continue; }
            }
            tracklistRels.push(...rowToTrackRels(row, scope, byPosition, guest, skipped, label));
        }
    }
    // Other-staff (misc) credits with an explicit "(tracks N)" qualifier are recording-level
    // on exactly those tracks (e.g. Bruce Bennett — Engineering (tracks 1, 2)); unqualified
    // misc stays release-level via metalArchivesReleaseArtists. OP #453: don't spread a
    // track-specific engineer/recording credit across the whole tracklist.
    for (const row of (harvest.misc || [])) {
        tracklistRels.push(...rowToTrackRels(row, tracklist, byPosition, false, skipped, 'misc', true));
    }
    return { tracklistRels, tracklist, skipped, multiVolume: !!harvest.multiDisc };
}

/**
 * Map a Metal Archives harvest's Other-staff table → release-level artist roles
 * (`{ artists, publishers, companies, skipped }`, same contract as
 * tidalReleaseArtists) resolved through the shared getArtistRoles at the call
 * site. Production/art credits are release-level; no publishers/companies from MA.
 */
export function metalArchivesReleaseArtists(harvest) {
    const artists = [], skipped = [];
    for (const row of (harvest.misc || [])) {
        for (const tok of parseMaRoleCell(row.roleCell)) {
            if (tok.tracks) continue;   // track-qualified misc → recording-level (metalArchivesToEngine), not release-level (OP #453)
            const bridged = bridgeToken(tok);
            if (!bridged) { skipped.push(`release: ${tok.base} — ${row.name}`); continue; }
            const a = maArtist(row, bridged.role);
            a.maRole = tok.base;       // for "not imported" reporting
            a.maAttrs = bridged.attrs; // extra attributes (design task) the caller appends after getArtistRoles
            artists.push(a);
        }
    }
    return { artists, publishers: [], companies: [], skipped };
}
