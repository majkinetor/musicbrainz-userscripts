// Qobuz source — pure helpers (no GM, no engine imports).
//
// The public Qobuz album page (`https://www.qobuz.com/<store>/album/<slug>/<id>`)
// *server-renders* all per-track credits — one `<p class="track__info">` per
// track — so a plain unauthenticated GM_xmlhttpRequest from the MB page is
// enough; no companion tab, no token. Verified on album vft3hpnx5c3lc:
// 16/16 tracks parsed, matching the Tidal credits for the same release.
//
// Line format (segments joined with " - ", each segment "Name, Role[, Role…]"):
//   Copyright Control, MusicPublisher - Kwadwo Donkoh, Producer - Wulomei, MainArtist - Nii Tei Ashitey, Composer, Lyricist
//
// Unlike Tidal, Qobuz exposes *names only* — no artist ids/links — so
// resolution is name-based (MB search + the review table), the same path
// unlinked Discogs credits take.
//
// The Qobuz API (`album/get`) is NOT an option without auth: it answers
// 401 "User authentication is required" with an app_id alone. The page
// scrape is the unauthenticated path. (If a fresh bundle-scraped app_id
// turns out to unlock catalog reads, swapping fetchers is a 1-function
// change — the parsed shape below stays.)

import { getArtistRoles } from '../mappers.js';
import { INSTRUMENTS }     from '../data/instruments.js';

/** Role vocabulary seen in Qobuz `performers` strings → MB relationship plan.
 *  Qobuz's vocabulary varies by album — some use camelCase tokens
 *  (`MixingEngineer`), others spaced ones (`Mixing Engineer`) — so BOTH forms
 *  are listed. `null` = recognised but never imported (Main Artist duplicates
 *  the track artist credit; Associated Performer / Studio Personnel are too
 *  vague). #311: instruments (Bass, Drums, Guitar…) aren't here — they're
 *  recognised via INSTRUMENTS and resolved through getArtistRoles. */
export const QOBUZ_ROLE_MAP = {
    'Composer':            { target: 'work',      rel: 'composer' },
    'Lyricist':            { target: 'work',      rel: 'lyricist' },
    'Author':              { target: 'work',      rel: 'lyricist' },
    'ComposerLyricist':    { target: 'work',      rel: 'writer' },
    'Writer':              { target: 'work',      rel: 'writer' },
    'Arranger':            { target: 'work',      rel: 'arranger' },
    'Performance Arranger':{ target: 'recording', rel: 'arranger' },
    'Producer':            { target: 'recording', rel: 'producer' },
    'Co-Producer':         { target: 'recording', rel: 'producer' },
    'Assistant Producer':  { target: 'recording', rel: 'producer', attributes: ['assistant'] },
    'Mixer':               { target: 'recording', rel: 'mix' },
    'MixingEngineer':      { target: 'recording', rel: 'mix' },
    'Mixing Engineer':     { target: 'recording', rel: 'mix' },
    'Engineer':            { target: 'recording', rel: 'engineer' },
    'Assistant Engineer':  { target: 'recording', rel: 'engineer', attributes: ['assistant'] },
    'RecordingEngineer':   { target: 'recording', rel: 'recording' },
    'Recording Engineer':  { target: 'recording', rel: 'recording' },
    'MasteringEngineer':   { target: 'recording', rel: 'mastering' },
    'Mastering Engineer':  { target: 'recording', rel: 'mastering' },
    'Editor':              { target: 'recording', rel: 'editor' },
    'Remixer':             { target: 'recording', rel: 'remixer' },
    'Conductor':           { target: 'recording', rel: 'conductor' },
    'Vocals':              { target: 'recording', rel: 'vocal' },
    'Vocal':               { target: 'recording', rel: 'vocal' },
    'Background Vocal':     { target: 'recording', rel: 'vocal', attributes: [{ _type: 'vocal', value: 'background vocals' }] },
    'Background Vocals':    { target: 'recording', rel: 'vocal', attributes: [{ _type: 'vocal', value: 'background vocals' }] },
    'MusicPublisher':      { target: 'work',      rel: 'publisher' },
    'Music Publisher':     { target: 'work',      rel: 'publisher' },
    'MainArtist':          null,
    'Main Artist':         null,
    'FeaturedArtist':      null,
    'Featured Artist':     null,
    'AssociatedPerformer': null,
    'Associated Performer': null,
    'StudioPersonnel':     null,
    'Studio Personnel':    null,
};

// Case-insensitive instrument lookup, so Qobuz instrument roles (Bass, Drums,
// Guitar, Piano, Keyboards, Strings, Bass Guitar…) are recognised as roles and
// resolved through the shared INSTRUMENTS table. #311
const QOBUZ_INSTRUMENTS_CI = new Set(Object.keys(INSTRUMENTS).map(k => k.toLowerCase()));

/** A credit-line token is a "role" if it's a known Qobuz role OR an instrument
 *  — used to find where a name ends and its roles begin. #311 */
export function isQobuzRole(token) {
    return Object.prototype.hasOwnProperty.call(QOBUZ_ROLE_MAP, token) || QOBUZ_INSTRUMENTS_CI.has(token.toLowerCase());
}

const QOBUZ_ALBUM_RE = /^(?:https?:)?\/\/(?:www\.|play\.|open\.)?qobuz\.com\/(?:[a-z]{2}-[a-z]{2}\/)?album\/(?:[^/]+\/)?([a-z0-9]+)\/?(?:[?#]|$)/i;

/**
 * Parse a Qobuz album URL → `{ id, pageUrl }`, or `null`. Accepts the
 * store-page form (`/us-en/album/<slug>/<id>`), the bare `/album/<id>`,
 * play./open. subdomain links and MB's protocol-relative hrefs.
 *
 * `pageUrl` is always the **store** page: open.qobuz.com is a tiny SPA
 * shell with no credits, while the store page server-renders everything.
 * MB rels carry no slug — a wrong-slug URL (`/album/x/<id>`) redirects to
 * the canonical page (verified), so the synthesized form always lands.
 */
export function parseQobuzAlbumUrl(url) {
    const m = QOBUZ_ALBUM_RE.exec(url || '');
    if (!m) return null;
    const original = String(url).replace(/^\/\//, 'https://');
    const isStore  = /^https?:\/\/(www\.)?qobuz\.com\/[a-z]{2}-[a-z]{2}\/album\//i.test(original);
    return { id: m[1], pageUrl: isStore ? original.split(/[?#]/)[0] : `https://www.qobuz.com/us-en/album/x/${m[1]}` };
}

/** Minimal HTML-entity decode for the entities Qobuz pages actually emit
 *  (`&#039;`, `&amp;`, `&quot;`, numeric refs). */
export function decodeEntities(s) {
    return String(s)
        .replace(/&#(\d+);/g,        (_, n) => String.fromCodePoint(+n))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
}

/** A copyright / publishing notice line, not a credit (e.g. "(P) 2016 Sony…"). */
const QOBUZ_NOTICE_RE = /^\s*[(℗©]|\bcopyright\b/i;

/**
 * Parse one `track__info` credit line into `[{ name, roles: [role…] }]`.
 *
 * Strategy: split on " - " into segments ("Name, Role[, Role…]"), then split
 * each segment on ", ". A token is a role if `isQobuzRole` (known role OR
 * instrument); everything before the first role token is the name.
 *
 * #311: role recognition now covers Qobuz's spaced role names and instruments,
 * so people are no longer glued into one garbled name. A segment with NO role
 * token is a person Qobuz didn't label — kept as a role-less entry (reported
 * as unresolved downstream), not glued onto the previous person. Copyright
 * notices are dropped.
 */
export function parseQobuzCreditLine(line) {
    const out = [];
    for (const seg of String(line).split(' - ')) {
        const raw = seg.trim();
        if (!raw || QOBUZ_NOTICE_RE.test(raw)) continue;
        const tokens   = raw.split(',').map(t => t.trim()).filter(Boolean);
        const firstRole = tokens.findIndex(isQobuzRole);
        if (firstRole === -1) {
            // No role token — a person Qobuz left unlabelled. Keep so it's reported.
            out.push({ name: tokens.join(', '), roles: [] });
            continue;
        }
        const name  = tokens.slice(0, firstRole).join(', ');
        const roles = tokens.slice(firstRole).filter(isQobuzRole);
        if (name) out.push({ name, roles });
        else if (out.length) out[out.length - 1].roles.push(...roles); // role-only segment continues previous credit
    }
    return out;
}

/**
 * Extract per-track credit lines from raw album-page HTML.
 * Returns `[{ index, credits: [{ name, roles }] }]` — one entry per
 * `<p class="track__info">`, in page order (tracks are listed in order, so
 * `index` aligns with the page's tracklist).
 */
export function extractQobuzCredits(html) {
    // DO NOT index credit lines by element order: the store page emits MORE
    // `track__info`-classed <p>s than tracks (empty responsive duplicates —
    // 32 for a 16-track album), which shifted every position and seeded
    // credits onto the WRONG tracks in the first live test. Each track row
    // carries `id="popinAddToCartBtnPlayerTrack<N>"` with the REAL track
    // number — anchor every credits line to the nearest preceding marker.
    const byTrack = new Map();   // real track number → credits
    const re = /id="popinAddToCartBtnPlayerTrack(\d+)"|<p[^>]*class="[^"]*\btrack__info\b[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
    let m, current = 0;
    while ((m = re.exec(html)) !== null) {
        if (m[1] !== undefined) { current = parseInt(m[1], 10); continue; }
        const text = decodeEntities((m[2] || '').replace(/<[^>]+>/g, '').trim());
        if (!text || !current) continue;               // empty duplicate / preamble
        if (!byTrack.has(current)) byTrack.set(current, parseQobuzCreditLine(text));
    }
    return [...byTrack.entries()].sort((a, b) => a[0] - b[0]).map(([index, credits]) => ({ index, credits }));
}

/** Album title + artist from the store page, for the diagnostic log.
 *  og:title is `"<Album>, <Artist> - Qobuz"` (verified). */
export function extractQobuzAlbumInfo(html) {
    const og = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] || '';
    return decodeEntities(og.replace(/ - Qobuz$/, ''));
}

/**
 * Map parsed Qobuz credits to the engine's tracklist-relationship shape
 * (same contract as `tidalToEngine`). Qobuz exposes names only — every
 * credit goes through name search + review (`resource_url: ''`).
 *
 * v1 imports the roles `QOBUZ_ROLE_MAP` targets at work/recording
 * (Composer, Lyricist, Writer, Arranger, Producer, Mixer, Engineer, …).
 * `MusicPublisher` is reported in `skipped` (work-publisher seeding
 * deferred, as in the Tidal source) — except the `Copyright Control`
 * placeholder, which is dropped outright. Null-mapped roles (MainArtist,
 * FeaturedArtist, AssociatedPerformer, …) are skipped silently.
 */
export function qobuzToEngine(parsedTracks) {
    const tracklistRels = [];
    const tracklist = [];
    const skipped = [];
    for (const t of parsedTracks) {
        const track = { position: String(t.index), title: '', type_: 'track' };
        tracklist.push(track);
        for (const credit of t.credits) {
            if (!credit.roles.length) {   // #311: person Qobuz left unlabelled — can't import without a role
                if (credit.name && !/^copyright control$/i.test(credit.name)) skipped.push(`track ${track.position}: (no role) — ${credit.name}`);
                continue;
            }
            for (const role of credit.roles) {
                if (role === 'MusicPublisher' || role === 'Music Publisher') {
                    if (!/^copyright control$/i.test(credit.name)) skipped.push(`track ${track.position}: Music Publisher — ${credit.name}`);
                    continue;
                }
                if (Object.prototype.hasOwnProperty.call(QOBUZ_ROLE_MAP, role)) {
                    const plan = QOBUZ_ROLE_MAP[role];
                    if (!plan) continue;   // Main Artist & friends — never imported
                    tracklistRels.push({
                        linkType:   plan.rel,
                        entityType: 'artist',
                        attributes: [...(plan.attributes || [])],
                        artist: { name: credit.name, anv: '', resource_url: '' },
                        track,
                    });
                    continue;
                }
                // #311: instrument role → shared resolver (INSTRUMENTS → instrument rel)
                const rels = getArtistRoles({ name: credit.name, anv: '', role, resource_url: '' });
                if (!rels.length) { skipped.push(`track ${track.position}: ${role} — ${credit.name}`); continue; }
                for (const r of rels) {
                    tracklistRels.push({
                        linkType:   r.linkType,
                        entityType: 'artist',
                        attributes: r.attributes || [],
                        artist:     r.artist,
                        track,
                    });
                }
            }
        }
    }
    return { tracklistRels, tracklist, skipped };
}

/** Fetch the store page HTML cross-origin via GM_xmlhttpRequest
 *  (musicbrainz.org → www.qobuz.com; `@connect qobuz.com`). */
export function fetchQobuzAlbumPage(pageUrl) {
    return new Promise((resolve, reject) => {
        if (typeof GM_xmlhttpRequest !== 'function') { reject(new Error('GM_xmlhttpRequest unavailable')); return; }
        GM_xmlhttpRequest({
            method: 'GET',
            url: pageUrl,
            headers: { 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.8' },
            timeout: 20000,
            onload: r => (r.status >= 200 && r.status < 400 && r.responseText)
                ? resolve(r.responseText)
                : reject(new Error(`Qobuz page returned ${r.status}`)),
            onerror:   () => reject(new Error('Qobuz page fetch failed (network)')),
            ontimeout: () => reject(new Error('Qobuz page fetch timed out')),
        });
    });
}
