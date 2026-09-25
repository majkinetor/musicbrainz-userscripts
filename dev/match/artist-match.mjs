// Shared artist/label matching — ONE source for Apollo Editor, Group Therapy and
// Credit Hoarder (#613).
//
// Every function here is self-contained (it may call the others, nothing else), so
// dev/match/sync-match.mjs can inline them verbatim — via their own source text —
// into the single-file scripts between `// <ST-MATCH>` markers, while Credit
// Hoarder's esbuild build and the node unit tests import this module directly.
// Edit HERE, never in a generated block.
//
// The rule these functions exist for (#613, measured on production MusicBrainz):
// the /ws/2 search does NOT rank exact name/alias holders first. For a short name
// the phrase `artist:"kim"` matches every artist CONTAINING "kim" (2,777 of them),
// so "exactly one exact holder among the results" proves nothing unless the
// results are COMPLETE — `count` ≤ what was fetched. Distinctive names pass
// (Don Abi: 1 match); common ones can't be proven unique and must not auto-match.

/** Results to fetch for an exact-identity query: the /ws/2 maximum. */
export const MBM_EXACT_LIMIT = 100;

/** MusicBrainz SPECIAL-PURPOSE artists — never matched against, never a context
 *  artist (#618), never given links (#306/#428); their aliases are junk (#171). */
export const MBM_SPECIAL_PURPOSE = [
    '125ec42a-7229-4250-afc5-e057484327fe', // [unknown]
    'f731ccc4-e22a-43af-a747-64213329e088', // [anonymous]
    '33cf029c-63b0-41a0-9855-be2a3665fb3b', // [data]
    '314e1c25-dde7-4e4d-b2f4-0a7b9f7c56dc', // [dialogue]
    'eec63d3c-3b81-4ad4-b1e4-7c147d4d2b61', // [no artist]
    '9be7f096-97ec-4615-8957-8d40b5dcbc41', // [traditional]
    '89ad4ac3-39f7-470e-963a-56509c546377', // Various Artists
    '7e84f845-ac16-41fe-9ff8-df12eb32af55', // MusicBrainz Test Artist
    '66ea0139-149f-4a0c-8fbf-5ea9ec4a6e49', // [Disney]
    'a0ef7e1d-44ff-4039-9435-7d5fefdeecc9', // [theatre]
    '90068d37-bae7-4292-be4a-704c145bd616', // [church chimes]
    '80a8851f-444c-4539-892b-ad2a49292aa9', // [language instruction]
];

/** Case-, accent- and dash-insensitive form of a name, for equality tests. */
export function mbmFold(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').replace(/[‐‑‒–—―−]/g, '-').toLowerCase().replace(/\s+/g, ' ').trim();
}
/** mbmFold without the lower-casing — for the case-exact tie-break. */
export function mbmFoldKeepCase(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').replace(/[‐‑‒–—―−]/g, '-').replace(/\s+/g, ' ').trim();
}
export function mbmSameName(a, b) { return mbmFold(a) === mbmFold(b) && mbmFold(a) !== ''; }
export function mbmSameNameCase(a, b) { return mbmFoldKeepCase(a) === mbmFoldKeepCase(b) && mbmFoldKeepCase(a) !== ''; }

/** Does a /ws/2 search hit carry `name` as its name ('name') or an alias ('alias')? */
export function mbmHolds(entity, name, caseExact) {
    if (!entity) return null;
    const same = caseExact ? mbmSameNameCase : mbmSameName;
    if (same(entity.name, name)) return 'name';
    if ((entity.aliases || []).some(al => same(al && (al.name != null ? al.name : al), name))) return 'alias';
    return null;
}

/** The exact-identity query: `alias:"x" OR <field>:"x"` (field: artist | label). */
export function mbmIdentityQuery(name, field) {
    const q = String(name == null ? '' : name).replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim();
    return q ? 'alias:"' + q + '" OR ' + (field || 'artist') + ':"' + q + '"' : '';
}

/**
 * Decide an exact identity from a /ws/2 search response (artists or labels).
 *   → { status: 'unique',     hit, via: 'name'|'alias', exact, complete }   safe to auto-match
 *   → { status: 'ambiguous',  exact, complete }   two or more MB entities hold the name
 *   → { status: 'incomplete', exact, complete }   more matches exist than were returned —
 *                                                  uniqueness can't be proven (common names)
 *   → { status: 'none',       exact, complete }   complete, and nobody holds the name
 *   → { status: 'failed',     exact: [] }         no response (throttled / network) — never cache
 * opts.scoreGap: with several exact holders, take the top one when MB's search score
 * beats the runner-up by at least this much (Group Therapy's label rule, #522). Off
 * unless given — artists stay strict (#613).
 */
export function mbmExactIdentity(json, name, opts) {
    const o = opts || {};
    if (!json || typeof json !== 'object') return { status: 'failed', exact: [] };
    const list = json.artists || json.labels || json.places || [];
    let exact = list.filter(e => mbmHolds(e, name));
    if (exact.length > 1) {
        // several case-insensitive holders, exactly one WITH case → that one (#445 "Kasane Teto")
        const caseExact = exact.filter(e => mbmHolds(e, name, true));
        if (caseExact.length === 1) exact = caseExact;
        else if (o.scoreGap) {
            const scored = exact.filter(e => typeof e.score === 'number').sort((a, b) => b.score - a.score);
            if (scored.length >= 2 && scored[0].score - scored[1].score >= o.scoreGap) exact = [scored[0]];
        }
    }
    const offset = typeof json.offset === 'number' ? json.offset : 0;
    const complete = typeof json.count === 'number' && json.count <= offset + list.length;
    if (exact.length === 1 && complete) return { status: 'unique', hit: exact[0], via: mbmHolds(exact[0], name) === 'name' ? 'name' : 'alias', exact, complete };
    if (exact.length > 1) return { status: 'ambiguous', exact, complete };
    if (!complete) return { status: 'incomplete', exact, complete };
    return { status: 'none', exact, complete };
}

/**
 * #612 C3 — the artists related to a release artist, from
 * /ws/2/artist/<gid>?inc=aliases+artist-rels: the artist itself (with its aliases)
 * plus every artist-artist relationship target (members, collaborators, …).
 * → [{ gid, name, aliases: [names], rel }]
 */
export function mbmRelatedArtists(artistJson) {
    if (!artistJson || !artistJson.id) return [];
    const out = [{ gid: artistJson.id, name: artistJson.name || '', aliases: (artistJson.aliases || []).map(a => a && a.name).filter(Boolean), rel: 'self' }];
    for (const r of artistJson.relations || []) {
        const a = r && r.artist;
        if (!a || !a.id || out.some(x => x.gid === a.id)) continue;
        out.push({ gid: a.id, name: a.name || '', aliases: [], rel: r.type || '' });
    }
    return out;
}

/**
 * #612 context match: which related artists carry `name` exactly — by name, by an
 * alias from the relationship data, or by an alias seen on a search candidate with
 * the same MBID (C4 without extra requests). → [{ gid, name, via, rel }]
 */
export function mbmContextHolders(related, name, candidates) {
    const cand = new Map((candidates || []).map(c => [c.id || c.gid, c]));
    const out = [];
    for (const r of related || []) {
        let via = mbmSameName(r.name, name) ? 'name' : (r.aliases || []).some(a => mbmSameName(a, name)) ? 'alias' : null;
        if (!via) { const c = cand.get(r.gid); if (c && mbmHolds(c, name)) via = mbmHolds(c, name); }
        if (via && !out.some(x => x.gid === r.gid)) out.push({ gid: r.gid, name: r.name, via, rel: r.rel });
    }
    return out;
}

/**
 * #437 co-credit: from /ws/2/recording?query=arid:<ctx> AND artistname:"x"&inc=artist-credits,
 * the artists credited as `name` ALONGSIDE the context artist. → [{ gid, name }] (deduped)
 */
export function mbmCoCreditHits(recordingsJson, ctxGid, name) {
    const out = [];
    for (const rec of (recordingsJson && recordingsJson.recordings) || []) {
        for (const c of rec['artist-credit'] || []) {
            const a = c && c.artist;
            if (!a || !a.id || a.id === ctxGid) continue;
            if ((mbmSameName(c.name, name) || mbmSameName(a.name, name)) && !out.some(x => x.gid === a.id)) out.push({ gid: a.id, name: a.name });
        }
    }
    return out;
}

// what sync-match.mjs inlines, in order (constants first)
export const MBM_INLINE = {
    consts: { MBM_EXACT_LIMIT, MBM_SPECIAL_PURPOSE },
    fns: [mbmFold, mbmFoldKeepCase, mbmSameName, mbmSameNameCase, mbmHolds, mbmIdentityQuery, mbmExactIdentity, mbmRelatedArtists, mbmContextHolders, mbmCoCreditHits],
};
