// YouTube Music source (#648) — per-track credits from the ⋮ → Credits dialog, anonymously.
//
// YouTube Music's web player reads everything through its internal "innertube" API
// (music.youtube.com/youtubei/v1/…), which answers a guest: no login, no key, only a
// client name and a reasonably recent client version. The flow per release:
//   1. the linked album: `…/playlist?list=OLAK5uy_…` (the usual MB link) or
//      `…/browse/MPREb_…` (an album page, which names its OLAK5uy_ playlist);
//   2. browse VL<list> → the album's songs, in album order, each with a videoId;
//   3. per song → browse MPTC<videoId> → the Credits dialog's sections:
//      "Performed by", "Written by", "Produced by", "Music metadata provided by".
//
// Gotchas (found on #649, Platform Check's label):
//   - only a SONG ("ATV" video) has credits. An album page can link the official audio
//     or music video instead ("OMV": every track of Random Access Memories), whose
//     Credits dialog is empty — which is why the songs come from the playlist page,
//     which lists songs even where the album page links videos;
//   - some labels send no credits at all (Bonobo's Migration on Ninja Tune);
//   - YouTube Music numbers a multi-disc album's tracks straight through (1–28 for
//     Mellon Collie's 2×14), so positions are mapped onto the release's own mediums.
//
// Names only, no artist ids — every credit resolves by name search + review (the
// Qobuz/Apple shape). Three role groups, mapped onto the shared Discogs-keyed
// vocabulary: "Written by" → Written-By (writer), "Produced by" → Producer.
// "Performed by" is the track's artist credit (main + featured), not a performer
// relationship, and "Music metadata provided by" is the label/distributor — both
// are reported as not imported.

import { getArtistRoles } from '../mappers.js';
import { log, logDebug } from '../log.js';

export const YTM_API = 'https://music.youtube.com/youtubei/v1/';
const YTM_CLIENT = { clientName: 'WEB_REMIX', clientVersion: '1.20250101.01.00', hl: 'en', gl: 'US' };

// #679: an album playlist is the same on www.youtube.com (MB keeps such links as entered);
// the OLAK5uy_ prefix, not the host, is what marks it as an album rather than a user playlist.
export const YTM_ALBUM_RE = /(?:^|\/\/)(?:(?:music|www|m)\.)?youtube\.com\/(?:playlist\?(?:[^#]*&)?list=(OLAK5uy_[\w-]+)|browse\/(MPREb_[\w-]+))/i;

/** Parse a YouTube Music album link → `{ list }` (OLAK5uy_ playlist) or `{ album }`
 *  (MPREb_ album page), or `null`. */
export function parseYtmAlbumUrl(url) {
    const m = YTM_ALBUM_RE.exec(url || '');
    return m ? (m[1] ? { list: m[1] } : { album: m[2] }) : null;
}

// Section title → Discogs-style role key (resolved via ENTITY_TYPE_MAP).
const YTM_ROLE_BRIDGE = {
    'Written by':  'Written-By',
    'Produced by': 'Producer',
};
// Read but not imported, with why (logged per track as "not imported").
const YTM_SKIP = {
    'Performed by':               'the track artist credit',
    'Music metadata provided by': 'the label or distributor',
};

/**
 * Map positions YouTube Music numbers straight through (1..n) onto the release's
 * mediums: with medium sizes [14, 14], song 15 is "2-1". Only when the sizes add up
 * to the song count — otherwise the plain numbers are kept and `mismatch` is set,
 * for the caller to warn about (the songs can't be placed with confidence).
 */
export function ytmPositions(count, mediumSizes) {
    const sizes = (mediumSizes || []).filter(n => n > 0);
    const plain = Array.from({ length: count }, (_, i) => String(i + 1));
    if (sizes.length <= 1) return { positions: plain, multiMedium: false, mismatch: false };
    const total = sizes.reduce((a, b) => a + b, 0);
    if (total !== count) return { positions: plain, multiMedium: true, mismatch: true };
    const positions = [];
    sizes.forEach((n, m) => { for (let t = 1; t <= n; t++) positions.push(`${m + 1}-${t}`); });
    return { positions, multiMedium: true, mismatch: false };
}

/**
 * Map fetched YouTube Music credits to the engine's tracklist-relationship shape
 * (same contract as `appleToEngine`). `songs` = `[{ title, sections: { 'Written by':
 * [names], … } }]` in album order — every song, credited or not, so positions line
 * up. `mediumSizes` = the release's track count per medium.
 */
export function ytmToEngine(songs, mediumSizes) {
    const tracklistRels = [];
    const tracklist = [];
    const skipped = [];
    const list = songs || [];
    const { positions, multiMedium, mismatch } = ytmPositions(list.length, mediumSizes);
    list.forEach((s, i) => {
        const track = { position: positions[i], title: s.title || '', type_: 'track' };
        tracklist.push(track);
        for (const [section, names] of Object.entries(s.sections || {})) {
            const named = (names || []).map(n => String(n || '').trim()).filter(Boolean);
            if (!named.length) continue;
            if (YTM_SKIP[section]) { skipped.push(`track ${track.position}: ${section} — ${named.join(', ')} (${YTM_SKIP[section]})`); continue; }
            const role = YTM_ROLE_BRIDGE[section];
            if (!role) { skipped.push(`track ${track.position}: ${section} — ${named.join(', ')} (unmapped section)`); continue; }
            for (const name of named) {
                const rels = getArtistRoles({ name, anv: '', role, resource_url: '' });
                if (!rels || !rels.length) { skipped.push(`track ${track.position}: ${section} — ${name} (unmapped)`); continue; }
                for (const rel of rels) tracklistRels.push({ ...rel, artist: rel.artist || { name, anv: '', resource_url: '' }, track });
            }
        }
    });
    return { tracklistRels, tracklist, skipped, multiMedium, mismatch };
}

// ── network (GM_xmlhttpRequest; @connect music.youtube.com) ──
function ytmPost(endpoint, body) {
    const what = body.browseId || endpoint;
    return new Promise((resolve, reject) => {
        if (typeof GM_xmlhttpRequest !== 'function') { reject(new Error('GM_xmlhttpRequest unavailable')); return; }
        const t0 = Date.now();
        GM_xmlhttpRequest({
            method: 'POST', url: `${YTM_API}${endpoint}?prettyPrint=false`, anonymous: true, timeout: 20000,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ context: { client: YTM_CLIENT }, ...body }),
            onload: r => {
                const text = r.responseText || '';
                let json = null; try { json = JSON.parse(text); } catch (e) { /* not JSON */ }
                logDebug(`YouTube Music: ${endpoint} ${what} → HTTP ${r.status}, ${text.length}b in ${Date.now() - t0}ms`);
                if (r.status !== 200 || !json) { reject(new Error(`YouTube Music ${endpoint} ${what} → HTTP ${r.status}${r.status === 200 ? ', not JSON' : ''} — YouTube Music's API may have changed`)); return; }
                resolve(json);
            },
            onerror:   () => reject(new Error(`YouTube Music ${endpoint} ${what}: network error`)),
            ontimeout: () => reject(new Error(`YouTube Music ${endpoint} ${what}: timed out`)),
        });
    });
}

const ytmText = t => (t && t.runs ? t.runs.map(x => x.text).join('') : (t && t.simpleText) || '');
function ytmWalk(o, fn) { if (!o || typeof o !== 'object') return; fn(o); for (const k in o) ytmWalk(o[k], fn); }
const videoType = w => w && w.watchEndpointMusicSupportedConfigs && w.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig && w.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig.musicVideoType;

/** The rows of a playlist or album page, in order: `{ title, videoId, type }` —
 *  `type` 'MUSIC_VIDEO_TYPE_ATV' for a song, 'MUSIC_VIDEO_TYPE_OMV' for a video. */
export function ytmRows(json) {
    const rows = [];
    ytmWalk(json, o => {
        const r = o.musicResponsiveListItemRenderer;
        if (!r) return;
        let w = null;
        ytmWalk(r, x => { if (!w && x.watchEndpoint && x.watchEndpoint.videoId) w = x.watchEndpoint; });
        const id = (r.playlistItemData && r.playlistItemData.videoId) || (w && w.videoId);
        if (!id) return;
        const col = r.flexColumns && r.flexColumns[0] && r.flexColumns[0].musicResponsiveListItemFlexColumnRenderer;
        rows.push({ title: ytmText(col && col.text), videoId: id, type: videoType(w) || null });
    });
    return rows;
}

/** A song's Credits dialog (browse MPTC<videoId>) → `{ 'Written by': [names], … }`. */
export function ytmCreditSections(json) {
    const out = {};
    ytmWalk(json, o => {
        const s = o.dismissableDialogContentSectionRenderer;
        if (s) out[ytmText(s.title)] = ((s.subtitle && s.subtitle.runs) || []).map(r => r.text.trim()).filter(Boolean);
    });
    return out;
}

/**
 * Fetch a YouTube Music album's per-song credits. Resolves `{ album, list, songs:
 * [{ title, videoId, sections }] }` — EVERY song in album order (credited or not),
 * so positions line up with the release. `onProgress(done, total)` fires per song.
 */
export async function fetchYtmCredits(url, onProgress) {
    const parsed = parseYtmAlbumUrl(url);
    if (!parsed) throw new Error(`Not a YouTube Music album link: ${url}`);
    let list = parsed.list, album = '';
    if (!list) {
        const a = await ytmPost('browse', { browseId: parsed.album });
        const canon = (a.microformat && a.microformat.microformatDataRenderer && a.microformat.microformatDataRenderer.urlCanonical) || '';
        list = (canon.match(/[?&]list=(OLAK5uy_[\w-]+)/) || JSON.stringify(a).match(/"(OLAK5uy_[\w-]+)"/) || [])[1];
        let h = null; ytmWalk(a, o => { if (!h && o.musicResponsiveHeaderRenderer) h = o.musicResponsiveHeaderRenderer; });
        album = h ? ytmText(h.title) : '';
        log.info(`YouTube Music: album ${parsed.album} "${album}" → playlist ${list || '(none found)'}`);
        if (!list) throw new Error(`YouTube Music: album ${parsed.album} names no playlist — its page may have changed`);
    }
    const pl = await ytmPost('browse', { browseId: 'VL' + list });
    if (!album) {
        let h = null; ytmWalk(pl, o => { if (!h && (o.musicResponsiveHeaderRenderer || o.musicDetailHeaderRenderer)) h = o.musicResponsiveHeaderRenderer || o.musicDetailHeaderRenderer; });
        album = h ? ytmText(h.title) : '';
    }
    // a very long playlist pages its rows; the songs past the first page aren't read
    if (/"continuations?"|"continuationItemRenderer"/.test(JSON.stringify(pl))) log.warn(`YouTube Music: playlist ${list} has more songs than its first page — only those are read`);
    const rows = ytmRows(pl);
    const types = rows.reduce((m, r) => { const k = (r.type || '?').replace('MUSIC_VIDEO_TYPE_', ''); m[k] = (m[k] || 0) + 1; return m; }, {});
    log.info(`YouTube Music: playlist ${list} "${album}" — ${rows.length} row(s) (${Object.entries(types).map(([k, n]) => `${n} ${k}`).join(', ') || 'none'})`);
    const songs = [];
    let done = 0;
    for (const r of rows) {
        let sections = {};
        if (r.type && r.type !== 'MUSIC_VIDEO_TYPE_ATV') logDebug(`YouTube Music: row ${done + 1} "${r.title}" is a ${r.type}, not a song — it has no credits`);
        else {
            try { sections = ytmCreditSections(await ytmPost('browse', { browseId: 'MPTC' + r.videoId })); }
            catch (e) { log.warn(`YouTube Music: credits of "${r.title}" (${r.videoId}) failed — ${e.message}`); }
        }
        logDebug(`YouTube Music: ${done + 1}. "${r.title}" (${r.videoId}) — ${Object.keys(sections).map(k => `${k}: ${sections[k].join(', ')}`).join(' · ') || 'no credits'}`);
        songs.push({ title: r.title, videoId: r.videoId, sections });
        done++;
        if (onProgress) { try { onProgress(done, rows.length); } catch (e) { /* ignore */ } }
    }
    return { album, list, songs };
}
