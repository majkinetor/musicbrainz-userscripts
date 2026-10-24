// AllMusic source (#814) — pure helpers (no engine imports).
//
// AllMusic's pages are behind a bot check, but its data comes from TiVo's music
// API, whose staging host answers without a key (CORS `*`). A release
// (`allmusic.com/album/release/mr…`) is `/lookup/release?releaseId=MR…`, and a
// barcode is `/lookup/release?productCode=…`. Each track carries `performers`
// and `composers` (`{ nameId, name, role }`), the roles worded like Discogs'
// ("Guitar (Bass)", "Vocals (Background)"), so they go through the shared
// resolver. A cold call can take 20 s, hence the long timeout; a failure only
// fails this source.

import { getArtistRoles } from '../mappers.js';
import { assignVolumePositions } from '../util.js';

export const TIVO_API = 'https://tivomusicapi-staging-elb.digitalsmiths.net/sd/tivomusicapi/taps/v3';

const ALLMUSIC_RELEASE_RE = /^(?:https?:)?\/\/(?:www\.)?allmusic\.com\/album\/release\/(?:[^/?#]*-)?(mr\d{10})/i;

/** Parse an AllMusic release URL → `{ id: 'MR…', pageUrl }`, or `null`. */
export function parseAllMusicReleaseUrl(url) {
    const m = ALLMUSIC_RELEASE_RE.exec(url || '');
    return m ? { id: m[1].toUpperCase(), pageUrl: `https://www.allmusic.com/album/release/${m[1].toLowerCase()}` } : null;
}

/** An AllMusic artist page for a TiVo name id (`MN…`). */
export const allMusicArtistUrl = id => /^MN\d+$/i.test(id || '') ? `https://www.allmusic.com/artist/${id.toLowerCase()}` : '';

/** An AllMusic artist URL → `{ key, cleanUrl }` (the registry's shape), or `null`. */
export function parseAllMusicArtistUrl(url) {
    const m = /allmusic\.com\/artist\/(?:[^/?#]*-)?(mn\d{10})/i.exec(url || '');
    return m ? { key: `allmusic-artist/${m[1].toLowerCase()}`, cleanUrl: `https://www.allmusic.com/artist/${m[1].toLowerCase()}` } : null;
}

/** TiVo's role words → Discogs' role words where they differ. */
const ROLE_ALIASES = {
    'Composer': 'Composed By', 'Lyricist': 'Lyrics By', 'Arranger': 'Arranged By',
    'Vocals (Background)': 'Backing Vocals', 'Guitar (Bass)': 'Bass Guitar',
    'Guitar (Acoustic)': 'Acoustic Guitar', 'Guitar (Electric)': 'Electric Guitar',
    'Engineer': 'Engineer', 'Mixing': 'Mixed By', 'Mastering': 'Mastered By',
};
const SKIP_ROLES = /^(?:primary artist|featured artist|main personnel)$/i;

/** The lookup JSON's first hit → `{ title, tracks: [{ index, disc, title, credits: [{ name, url, role }] }] }`. */
export function allMusicTracks(json) {
    const hit = json && json.hits && json.hits[0];
    if (!hit) return null;
    const tracks = (hit.tracks || []).map((t, i) => ({
        index: +t.phyTrackNum || (i + 1),
        disc: +t.disc || 1,
        title: t.title || '',
        credits: [...(t.performers || []), ...(t.composers || [])].map(p => ({ name: p.name || '', url: allMusicArtistUrl(p.nameId), role: p.role || (t.composers?.includes(p) ? 'Composer' : '') })),
    }));
    return { title: hit.title || '', id: hit.id || '', tracks };
}

/** Parsed AllMusic tracks → the engine's tracklist-relationship shape. */
export function allMusicToEngine(parsedTracks) {
    const tracklistRels = [];
    const tracklist = [];
    const skipped = [];
    const { positions, multiVolume } = assignVolumePositions(parsedTracks, t => t.index);
    parsedTracks.forEach((t, i) => {
        const track = { position: positions[i], title: '', type_: 'track' };
        tracklist.push(track);
        for (const c of t.credits) {
            if (!c.name || !c.role || SKIP_ROLES.test(c.role)) continue;
            // "Guitar (Steel)" → "Steel Guitar" when no alias says otherwise
            const role = ROLE_ALIASES[c.role] || c.role.replace(/^(.+?) \((.+)\)$/, '$2 $1');
            const rels = getArtistRoles({ name: c.name, anv: '', role, resource_url: c.url });
            if (!rels.length) { skipped.push(`track ${track.position}: ${c.role} — ${c.name}`); continue; }
            for (const r of rels) tracklistRels.push({ linkType: r.linkType, entityType: 'artist', attributes: r.attributes || [], artist: r.artist, track });
        }
    });
    return { tracklistRels, artistRoles: [], tracklist, skipped, multiVolume };
}

/** GET a TiVo lookup → parsed JSON. Rejects on a non-2xx, a timeout or bad JSON. */
export function tivoGet(path, timeout = 25000) {
    return new Promise((resolve, reject) => {
        if (typeof GM_xmlhttpRequest !== 'function') { reject(new Error('GM_xmlhttpRequest unavailable')); return; }
        GM_xmlhttpRequest({
            method: 'GET',
            url: TIVO_API + path,
            timeout,
            onload: r => {
                if (r.status < 200 || r.status >= 300) { reject(new Error(`AllMusic API returned ${r.status}`)); return; }
                try { resolve(JSON.parse(r.responseText)); } catch { reject(new Error('AllMusic API: malformed JSON')); }
            },
            onerror:   () => reject(new Error('AllMusic API fetch failed (network)')),
            ontimeout: () => reject(new Error('AllMusic API timed out')),
        });
    });
}

/** Credits by release id, else by barcode → `allMusicTracks` result (or null when not found). */
export async function fetchAllMusicCredits({ id, barcode }) {
    const q = id ? `releaseId=${encodeURIComponent(id)}` : `productCode=${encodeURIComponent(barcode)}`;
    return allMusicTracks(await tivoGet(`/lookup/release?${q}`));
}
