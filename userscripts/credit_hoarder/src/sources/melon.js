// Melon source (#815) — pure helpers (no engine imports).
//
// Melon's album page (`https://www.melon.com/album/detail.htm?albumId=<id>`) has
// no credits; each song's page (`/song/detail.htm?songId=<id>`) lists its 작사
// (lyricist), 작곡 (composer) and 편곡 (arranger) under `ul.list_person`, each
// person an `<li>` with the name and a `<span class="type">`. The album's songs
// come from the app's JSON API on m2.melon.com (the one Harmony reads). Names
// only, so every credit resolves via name search + the review table (the mora
// shape). No CORS on either host → GM.

import { assignVolumePositions } from '../util.js';

const MELON_ALBUM_RE = /^(?:https?:)?\/\/(?:www\.|m2\.|m\.app\.)?melon\.com\/album\/detail\.htm\?(?:[^#]*&)?albumId=(\d+)/i;

/** Parse a Melon album URL → `{ id, pageUrl }`, or `null`. */
export function parseMelonAlbumUrl(url) {
    const m = MELON_ALBUM_RE.exec(url || '');
    return m ? { id: m[1], pageUrl: `https://www.melon.com/album/detail.htm?albumId=${m[1]}` } : null;
}

/** Melon's role words → MB relationship type. */
const MELON_ROLES = { '작사': 'lyricist', '작곡': 'composer', '편곡': 'arranger' };

const unescape = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

/** A song page's HTML → `[{ name, roles: [rel…] }]`. A person can hold several
 *  roles (one `<li>` each, or `작사, 작곡` in one span). */
export function extractMelonSongCredits(html) {
    const list = /<ul class="list_person[^"]*">([\s\S]*?)<\/ul>/i.exec(html || '')?.[1] || '';
    const byName = new Map();
    for (const li of list.split(/<li[\s>]/i).slice(1)) {
        const name = unescape((/class="artist_name"[^>]*>([\s\S]*?)<\/a>/i.exec(li) || /<div class="ellipsis artist">([\s\S]*?)<\/div>/i.exec(li) || [])[1]);
        const type = unescape(/<span class="type">([\s\S]*?)<\/span>/i.exec(li)?.[1]);
        if (!name || !type) continue;
        if (!byName.has(name)) byName.set(name, []);
        const roles = byName.get(name);
        for (const word of type.split(/\s*[,/]\s*/)) {
            const rel = MELON_ROLES[word];
            if (rel && !roles.includes(rel)) roles.push(rel);
        }
    }
    return [...byName].filter(([, roles]) => roles.length).map(([name, roles]) => ({ name, roles }));
}

/** song/list.json → `[{ songId, title, disc, index }]`. */
export function melonSongs(json) {
    const out = [];
    for (const cd of ((json && json.response && json.response.CDLIST) || [])) {
        (cd.SONGLIST || []).forEach((s, i) => out.push({ songId: String(s.SONGID), title: s.SONGNAME || '', disc: +cd.CDNO || 1, index: +s.TRACKNO || (i + 1) }));
    }
    return out;
}

/** Parsed Melon credits → the engine's tracklist-relationship shape (the
 *  `moraToEngine` contract). */
export function melonToEngine(parsedTracks) {
    const tracklistRels = [];
    const tracklist = [];
    const { positions, multiVolume } = assignVolumePositions(parsedTracks, t => t.index);
    parsedTracks.forEach((t, i) => {
        const track = { position: positions[i], title: '', type_: 'track' };
        tracklist.push(track);
        for (const credit of t.credits) {
            for (const rel of credit.roles) {
                tracklistRels.push({ linkType: rel, entityType: 'artist', attributes: [], artist: { name: credit.name, anv: '', resource_url: '' }, track });
            }
        }
    });
    return { tracklistRels, tracklist, skipped: [], multiVolume };
}

function gmGet(url, what) {
    return new Promise((resolve, reject) => {
        if (typeof GM_xmlhttpRequest !== 'function') { reject(new Error('GM_xmlhttpRequest unavailable')); return; }
        GM_xmlhttpRequest({
            method: 'GET',
            url,
            timeout: 20000,
            onload: r => (r.status >= 200 && r.status < 400 && r.responseText) ? resolve(r.responseText) : reject(new Error(`Melon ${what} returned ${r.status}`)),
            onerror:   () => reject(new Error(`Melon ${what} fetch failed (network)`)),
            ontimeout: () => reject(new Error(`Melon ${what} fetch timed out`)),
        });
    });
}

/** The album's songs, then each song page, four at a time →
 *  `{ album, tracks: [{ index, disc, title, songId, credits }] }`. A song page that
 *  fails gives that track no credits (`error` says why). */
export async function fetchMelonCredits(id, onProgress) {
    let json;
    try { json = JSON.parse(await gmGet(`https://m2.melon.com/m6/v2/album/song/list.json?albumId=${id}`, 'song list')); }
    catch (e) { throw e instanceof SyntaxError ? new Error('Melon song list: malformed JSON') : e; }
    const songs = melonSongs(json);
    const tracks = songs.map(s => ({ index: s.index, disc: s.disc, title: s.title, songId: s.songId, credits: [] }));
    let next = 0, done = 0;
    const worker = async () => {
        while (next < tracks.length) {
            const t = tracks[next++];
            try { t.credits = extractMelonSongCredits(await gmGet(`https://www.melon.com/song/detail.htm?songId=${t.songId}`, `song ${t.songId}`)); }
            catch (e) { t.error = e.message || String(e); }
            onProgress && onProgress(++done, tracks.length);
        }
    };
    await Promise.all([0, 1, 2, 3].map(worker));
    return { album: (json.response && json.response.ALBUMNAME) || '', tracks };
}
