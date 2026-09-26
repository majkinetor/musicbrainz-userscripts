// #612 / #613 — the release's matching CONTEXT: the artists related to its release
// artist(s) (members, collaborators, …), so a credit like "Joni" — hopeless for a
// global search — resolves when exactly one related artist carries that name.
//
// Cost (agreed on #613): ONE /ws/2/artist/<mbid>?inc=aliases+artist-rels request per
// REAL release artist per import, cached for the session. Special-purpose release
// artists (Various Artists, [unknown], …) are never a starting point — on a VA
// release there is no context and no request.
import { mbThrottle } from './api-mb.js';
import { log, logDebug } from './log.js';
import { pageWindow } from './constants.js';
import { MBM_SPECIAL_PURPOSE, mbmRelatedArtists } from '../../../dev/match/artist-match.mjs';

const SPECIAL = new Set(MBM_SPECIAL_PURPOSE);
const _relatedCache = new Map();   // release-artist mbid → related list (session)

/** The release artist credit's MBIDs, from the relationship editor already on the page (no request). */
export function releaseArtistMbids() {
    try {
        const names = pageWindow.MB?.relationshipEditor?.state?.entity?.artistCredit?.names || [];
        return [...new Set(names.map(n => n?.artist?.gid).filter(Boolean))];
    } catch (e) { return []; }
}

/**
 * → { seeds: [mbid], related: [{gid,name,aliases,rel}], coCredit: bool }
 * seeds: the real release artists (the co-credit option searches alongside them).
 */
export async function buildReleaseContext({ coCredit = false } = {}) {
    const all = releaseArtistMbids();
    const seeds = all.filter(g => !SPECIAL.has(g));
    if (all.length && !seeds.length) log.info('Matching context: the release artist is special-purpose (e.g. Various Artists) — no context lookup (#612)');
    const related = [];
    for (const gid of seeds.slice(0, 4)) {
        let list = _relatedCache.get(gid);
        if (!list) {
            const json = await mbThrottle.fetchJson(`//musicbrainz.org/ws/2/artist/${gid}?inc=aliases+artist-rels&fmt=json`);
            if (!json) { log.warn(`Matching context: could not load release artist ${gid} — continuing without it`); continue; }
            list = mbmRelatedArtists(json);
            _relatedCache.set(gid, list);
        }
        for (const r of list) if (!related.some(x => x.gid === r.gid)) related.push(r);
    }
    if (seeds.length) {
        const kinds = related.filter(r => r.rel !== 'self').reduce((m, r) => (m[r.rel] = (m[r.rel] || 0) + 1, m), {});
        log.info(`Matching context: ${seeds.length} release artist(s) → ${related.length - seeds.length} related artist(s)` + (Object.keys(kinds).length ? ` (${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(', ')})` : '') + (coCredit ? ' · co-credit search on' : ''));
        logDebug(`context related: ${related.map(r => `${r.name}[${r.rel}]`).join(', ')}`);
    }
    return { seeds, related, coCredit: !!coCredit };
}
