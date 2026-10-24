// mora source (#813) — pure helpers (no engine imports).
//
// mora.jp's package page (`https://mora.jp/package/<labelCode>/<packageId>/`) is a
// shell; its `<meta name="msApplication-Arguments">` names the package
// (mountPoint, labelId, materialNo), and the album is the packageMeta.json under
// cf.mora.jp (the path Harmony reads). Each track there carries plain-text
// `composer`, `lyrics`, `arranger` and `producer` strings, several names joined
// with `、` or `, `. Names only, so every credit resolves via name search + the
// review table (the Qobuz/Deezer shape). Neither host sends CORS headers → GM.

import { assignVolumePositions } from '../util.js';

const MORA_PACKAGE_RE = /^(?:https?:)?\/\/(?:www\.)?mora\.jp\/package\/(\d+)\/([\w-]+)\/?(?:[?#]|$)/i;

/** Parse a mora package URL → `{ id, pageUrl }`, or `null`. */
export function parseMoraPackageUrl(url) {
    const m = MORA_PACKAGE_RE.exec(url || '');
    return m ? { id: `${m[1]}/${m[2]}`, pageUrl: `https://mora.jp/package/${m[1]}/${m[2]}/` } : null;
}

/** The package page's msApplication-Arguments → the packageMeta.json URL, or null. */
export function moraMetaUrl(html) {
    const raw = /<meta[^>]*name="msApplication-Arguments"[^>]*content="([^"]+)"/i.exec(html || '')?.[1];
    if (!raw) return null;
    let a;
    try { a = JSON.parse(raw.replace(/&quot;/g, '"').replace(/&amp;/g, '&')); } catch (e) { return null; }
    if (!a || !a.materialNo || !a.labelId || !a.mountPoint) return null;
    const p = String(a.materialNo).padStart(10, '0');
    return `https://cf.mora.jp/contents/package/${a.mountPoint}/${a.labelId}/${p.slice(0, 4)}/${p.slice(4, 7)}/${p.slice(7)}/packageMeta.json`;
}

/** mora's per-track credit fields → MB relationship type. */
const MORA_FIELDS = [['composer', 'composer'], ['lyrics', 'lyricist'], ['arranger', 'arranger'], ['producer', 'producer']];

/** One credit string → names: split on 、 ／ / ， and ", " (not on a bare comma
 *  inside a name, which mora doesn't write anyway). */
export function splitMoraNames(s) {
    return String(s || '').split(/\s*(?:、|，|／|\/|,\s)\s*/).map(x => x.trim()).filter(x => x && x !== '-');
}

/** packageMeta.json → `[{ index, credits: [{ name, roles: [rel…] }] }]`, one per track. */
export function extractMoraCredits(json) {
    return ((json && json.trackList) || []).map((t, i) => {
        const byName = new Map();
        for (const [field, rel] of MORA_FIELDS) {
            for (const name of splitMoraNames(t[field])) {
                if (!byName.has(name)) byName.set(name, []);
                const roles = byName.get(name);
                if (!roles.includes(rel)) roles.push(rel);
            }
        }
        return { index: t.trackNo || (i + 1), credits: [...byName].map(([name, roles]) => ({ name, roles })) };
    });
}

/** Album title + artist, for the diagnostic log. */
export function moraAlbumInfo(json) {
    return json ? [json.title, json.artistName].filter(Boolean).join(', ') : '';
}

/** Parsed mora credits → the engine's tracklist-relationship shape (the
 *  `deezerToEngine` contract). */
export function moraToEngine(parsedTracks) {
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
            onload: r => (r.status >= 200 && r.status < 400 && r.responseText) ? resolve(r.responseText) : reject(new Error(`mora ${what} returned ${r.status}`)),
            onerror:   () => reject(new Error(`mora ${what} fetch failed (network)`)),
            ontimeout: () => reject(new Error(`mora ${what} fetch timed out`)),
        });
    });
}

/** Fetch the package page, then its packageMeta.json → `{ metaUrl, json }`. */
export async function fetchMoraPackage(pageUrl) {
    const metaUrl = moraMetaUrl(await gmGet(pageUrl, 'page'));
    if (!metaUrl) throw new Error('mora page has no package arguments (msApplication-Arguments)');
    const text = await gmGet(metaUrl, 'packageMeta.json');
    try { return { metaUrl, json: JSON.parse(text) }; } catch (e) { throw new Error('mora packageMeta.json: malformed JSON'); }
}
