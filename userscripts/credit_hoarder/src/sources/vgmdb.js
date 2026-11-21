// VGMdb source (#1090), modeled on metal_archives.js.
//
// VGMdb is behind Cloudflare, so the MB side opens the album page in a background
// tab. The script also runs there (@match vgmdb.net/album/*), reads the credits
// table and the tracklist, and posts them back over GM storage.
//
// VGMdb credits are album-level: one row per role (#collapse_credits tr.maincred),
// with no track qualifiers. Performance and work roles go on every track;
// production, art and engineering roles are release-level. Roles go through the
// shared Discogs mapper (getArtistRoles); the ones it does not know are skipped.

import { getArtistRoles } from '../mappers.js';

/* ── URL parsing ─────────────────────────────────────────────────────────── */

const VGM_ALBUM_RE = /^https?:\/\/(?:www\.)?vgmdb\.net\/album\/(\d+)/i;
const VGM_ARTIST_RE = /^https?:\/\/(?:www\.)?vgmdb\.net\/artist\/(\d+)/i;

export function parseVgmdbAlbumUrl(url) {
    const m = String(url || '').match(VGM_ALBUM_RE);
    return m ? { id: m[1], albumUrl: `https://vgmdb.net/album/${m[1]}` } : null;
}

/** VGMdb person URL → `{ id, key, cleanUrl }` (same shape as the other sources). */
export function parseVgmdbArtistUrl(url) {
    const m = String(url || '').match(VGM_ARTIST_RE);
    return m ? { id: m[1], key: `vgmdb-${m[1]}`, cleanUrl: `https://vgmdb.net/artist/${m[1]}` } : null;
}

/* ── role bridge (VGMdb role → Discogs vocabulary) ───────────────────────── */

// Per-track roles (performance and work). Value = the Discogs role name.
const VGM_TRACK_ROLE = {
    'music': 'Composed By', 'composer': 'Composed By', 'composition': 'Composed By', 'composed by': 'Composed By',
    'arrangement': 'Arranged By', 'arranger': 'Arranged By', 'arranged by': 'Arranged By',
    'lyricist': 'Lyrics By', 'lyrics': 'Lyrics By', 'lyrics by': 'Lyrics By',
    'performer': 'Performer', 'performed by': 'Performer', 'performers': 'Performer',
    'vocals': 'Vocals', 'vocal': 'Vocals', 'chorus': 'Chorus', 'backing vocals': 'Backing Vocals',
    'orchestra': 'Orchestra', 'conductor': 'Conductor', 'conducted by': 'Conductor',
    'synthesizer programming': 'Programmed By', 'synthesizer programmer': 'Programmed By',
    'programming': 'Programmed By', 'sound programming': 'Programmed By',
    'assistant synthesizer programmer': 'Programmed By',
};
// Release-level roles (production, engineering, art).
const VGM_RELEASE_ROLE = {
    'producer': 'Producer', 'produced by': 'Producer', 'sound producer': 'Producer', 'music producer': 'Producer',
    'executive producer': 'Executive-Producer',
    'directed by': 'Directed By', 'director': 'Directed By', 'sound director': 'Directed By',
    'recorded by': 'Recorded By', 'recording engineer': 'Recorded By', 'recording': 'Recorded By',
    'mixed by': 'Mixed By', 'mixing engineer': 'Mixed By', 'mixing': 'Mixed By',
    'mastered by': 'Mastered By', 'mastering engineer': 'Mastered By', 'mastering': 'Mastered By',
    'engineer': 'Engineer', 'sound engineer': 'Engineer',
    'illustration': 'Illustration', 'illustrator': 'Illustration', 'cover illustration': 'Illustration', 'jacket illustration': 'Illustration',
    'art direction': 'Art Direction', 'art director': 'Art Direction',
    'design': 'Design', 'designer': 'Design', 'graphic design': 'Design', 'package design': 'Design',
    'photography': 'Photography By', 'photographer': 'Photography By',
    'liner notes': 'Liner Notes',
};

function normRole(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[:：]\s*$/, '').trim(); }

/* ── DOM extraction ──────────────────────────────────────────────────────── */

// One credit row → { role, sub, artists: [{ name, url }] }. `sub` = an indented
// sub-role under "Performed by" (Vocals, Guitars, …).
function extractCredits(doc) {
    const out = [];
    for (const tr of doc.querySelectorAll('#collapse_credits tr.maincred, #collapse_credits tr.credit')) {
        const tds = tr.querySelectorAll('td');
        if (tds.length < 2) continue;
        const label = tds[0].querySelector('span.label') || tds[0];
        const en = label.querySelector('span.artistname[lang=en]');
        const role = (en || label.querySelector('b') || label).textContent.replace(/\s+/g, ' ').trim();
        const sub = /^[\s00a0]+/.test(label.textContent);
        const artists = [];
        const cell = tds[1];
        for (const a of cell.querySelectorAll('a[href*="/artist/"], a[href*="/org/"]')) {
            const n = a.querySelector('span.artistname[lang=en]') || a;
            artists.push({ name: n.textContent.replace(/\s+/g, ' ').trim(), url: a.href, org: /\/org\//.test(a.getAttribute('href')) });
        }
        // plain-text names (no link): the cell's own text nodes, split on "/" and ","
        const clone = cell.cloneNode(true);
        clone.querySelectorAll('a, span.artistname:not([lang=en])').forEach(e => e.remove());
        for (const part of clone.textContent.split(/[\/,、]/)) {
            const name = part.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
            if (name && name.length > 1 && !artists.some(x => x.name === name)) artists.push({ name, url: '', org: false });
        }
        if (role && artists.length) out.push({ role, sub, artists });
    }
    return out;
}

// Tracklist → [{ position, title }]. The first span.tl is the first language.
function extractTracklist(doc) {
    const tl = doc.querySelector('#tracklist span.tl');
    const tracks = [];
    if (!tl) return { tracks, multiDisc: false };
    const tables = [...tl.querySelectorAll('table.role, table')];
    const multiDisc = tables.length > 1;
    tables.forEach((table, i) => {
        for (const tr of table.querySelectorAll('tr.rolebit, tr')) {
            const tds = tr.querySelectorAll('td');
            const num = tds[0] && tds[0].textContent.trim().match(/^(\d+)$/);
            if (!num || !tds[1]) continue;
            const n = +num[1];
            const title = tds[1].textContent.replace(/\s+/g, ' ').trim();
            tracks.push({ position: multiDisc ? `${i + 1}-${n}` : String(n), title, type_: 'track' });
        }
    });
    return { tracks, multiDisc };
}

export function extractVgmdbDom(doc) {
    const { tracks, multiDisc } = extractTracklist(doc);
    return { credits: extractCredits(doc), tracks, multiDisc };
}

/* ── cross-tab harvest ───────────────────────────────────────────────────── */

const HARVEST_KEY = reqId => `ch-vgm-result:${reqId}`;
const HARVEST_TIMEOUT_MS = 45000;

/** vgmdb.net-tab side. No-op unless the URL carries our `#ch-req=` marker. */
export function runVgmdbHarvestPage() {
    const m = location.hash.match(/ch-req=([a-z0-9.-]+)/i);
    if (!m) return;
    const reqId = m[1];
    const albumId = (location.pathname.match(/\/album\/(\d+)/) || [])[1] || null;
    const post = payload => { try { GM_setValue(HARVEST_KEY(reqId), { albumId, ts: Date.now(), ...payload }); } catch (e) { /* GM missing */ } };
    const started = Date.now();
    const timer = setInterval(() => {
        const challenged = /just a moment|attention required|checking your browser/i.test(document.title);
        const ready = document.querySelector('#tracklist, #collapse_credits, #albumtools');
        if (ready && !challenged) {
            clearInterval(timer);
            try { post({ ok: true, ...extractVgmdbDom(document) }); }
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

/** MB side: open the album in a background tab and wait for the harvest. */
export function harvestVgmdbAlbum(albumUrl) {
    const parsed = parseVgmdbAlbumUrl(albumUrl);
    if (!parsed) return Promise.reject(new Error(`Not a VGMdb album URL: ${albumUrl}`));
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
        const deadline = setTimeout(() => done(reject, new Error('VGMdb harvest timed out — is the album tab open and loading?')), HARVEST_TIMEOUT_MS);
    });
}

/* ── harvest → engine shape ──────────────────────────────────────────────── */

function vgmArtist(a, discogsRole) {
    const parsed = parseVgmdbArtistUrl(a.url);
    return {
        id:           parsed ? parsed.key : undefined,
        name:         a.name,
        anv:          '',
        role:         discogsRole,
        resource_url: parsed ? parsed.cleanUrl : '',
    };
}

// A sub-role under "Performed by" that the map does not know is an instrument:
// pass it through to the shared resolver (INSTRUMENTS), which knows "Guitar" etc.
function trackRoleFor(c) {
    const r = normRole(c.role);
    if (VGM_TRACK_ROLE[r]) return VGM_TRACK_ROLE[r];
    if (c.sub && !VGM_RELEASE_ROLE[r]) return c.role;
    return null;
}

function resolve(a, role) {
    let roles = getArtistRoles(vgmArtist(a, role));
    if (!roles.length && /s$/i.test(role)) roles = getArtistRoles(vgmArtist(a, role.replace(/s$/i, '')));
    return roles;
}

/** Performance and work credits → per-track rels on every track. */
export function vgmdbToEngine(harvest) {
    const tracklist = (harvest.tracks || []).map(t => ({ position: t.position, title: t.title, type_: 'track' }));
    const skipped = [], tracklistRels = [];
    for (const c of (harvest.credits || [])) {
        const role = trackRoleFor(c);
        if (!role) continue;
        for (const a of c.artists) {
            if (a.org) { skipped.push(`${c.role} — ${a.name} (organization)`); continue; }
            const resolved = resolve(a, role);
            if (!resolved.length) { skipped.push(`${c.role} — ${a.name}`); continue; }
            for (const track of tracklist) for (const r of resolved) {
                tracklistRels.push({ linkType: r.linkType, entityType: 'artist', attributes: [...(r.attributes || [])], artist: r.artist, track });
            }
        }
    }
    return { tracklistRels, tracklist, skipped, multiVolume: !!harvest.multiDisc };
}

/** Production, engineering and art credits → release-level artists. Roles in
 *  neither map (Thanks, Promotion, "Recorded at", …) are reported as skipped. */
export function vgmdbReleaseArtists(harvest) {
    const artists = [], skipped = [];
    for (const c of (harvest.credits || [])) {
        if (trackRoleFor(c)) continue;
        const role = VGM_RELEASE_ROLE[normRole(c.role)];
        for (const a of c.artists) {
            if (!role || a.org) { skipped.push(`release: ${c.role} — ${a.name}`); continue; }
            const x = vgmArtist(a, role);
            x.vgmRole = c.role;
            artists.push(x);
        }
    }
    return { artists, publishers: [], companies: [], skipped };
}
