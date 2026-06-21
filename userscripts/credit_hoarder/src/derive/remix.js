// Derive remixer credits from track titles (#271).
//
// Providers frequently omit remix data that is stated plainly in the track
// title — "Song (Aphex Twin Remix)", "Track (KiNK Dub)", "Tune (Remixed by
// Someone)". This module parses ONLY the reliable parenthetical disambiguation
// convention — a NAME immediately before (or after "…by") a remix keyword —
// and synthesizes ordinary `remixer` tracklist roles. Those flow through the
// exact same review → Instant Fill pipeline as any provider credit, so a
// remixer no provider exposes still lands as a proper recording→artist
// relationship.
//
// The Credit Review Table is the safety net: every derived remixer is matched
// against MB (name search + manual fix) and confirmed by a human before
// anything is committed, so heuristic parsing is acceptable here. We err on
// the side of NOT firing when there's no clear name:
//
//   "(Extended Mix)" / "(Radio Edit)" / "(Original Mix)" / "(Remix)" / "(Dub)"
//        → anonymous descriptors, no artist → an edit/version of the original
//          (recording↔recording, out of scope) → SKIPPED.
//   "(Aphex Twin Remix)" / "(KiNK Dub)" / "(Tom Moulton Mix)" / "(Remixed by X)"
//        → a named remix → remixer credit.
//
// "Mixed by" / "Edited by" are deliberately NOT matched by the "…by" form —
// those name an engineer, not a remixer.
//
// Pure module: no DOM, no MB API, no IDB. Unit-tested in test/sources-parse.mjs.

// Naming a remixer from a parenthetical is a lexical guess, and two real cases
// pull in opposite directions in the SAME kind of title:
//
//   "(Masters at Work main mix)"  → name is "Masters at Work"   (drop "main")
//   "(Cotton Club remix)"         → name is "Cotton Club"        (KEEP "Club")
//
// So we split the decorator vocabulary in two:
//
//   STRONG — pure mix descriptors that are essentially never the LAST word of
//            an artist name ("extended", "original", "radio", "main", a vinyl
//            size, …). These are trimmed off the *trailing* edge of the name
//            (between the name and the keyword). Leading-edge trimming is NOT
//            done — it would maim "Main Source", "The Orb", "A Guy Called
//            Gerald", etc.
//   WEAK   — genre/vibe words that often ARE part of a band name ("club",
//            "deep", "house", "disco", articles, …). Never trimmed; they only
//            count toward the "all-decorator" test below.
//
// After trailing-trim, if every surviving token is a decorator (STRONG ∪ WEAK ∪
// vinyl size) the parenthetical is anonymous — "(Extended Club Mix)",
// "(Club Mix)", "(The Remix)" → no credit — while a name with a real token
// ("Cotton Club", "Deep Dish") survives intact.
const STRONG = new Set([
    'extended', 'original', 'radio', 'instrumental', 'acapella', 'acappella',
    'acoustic', 'album', 'single', 'main', 'long', 'short', 'full', 'special',
    'bonus', 'alternative', 'alternate', 'vip', 'rmx', 'redux', 'dancefloor',
    'unplugged', 'demo', 'remastered',
    // remix-family words, in case a lead carries a second one
    // ("Extended Remix Edit"): strip them off the trailing edge too.
    'dub', 'edit', 'mix', 'remix', 'rework', 'remodel', 'reshuffle', 'reprise',
    'version', 're-edit', 'reedit',
]);
const WEAK = new Set([
    'club', 'deep', 'tech', 'soulful', 'disco', 'electro', 'house', 'techno',
    'progressive', 'tribal', 'vocal', 'classic', 'clean', 'dirty', 'censored',
    'uncensored', 'studio', 'live', 'the', 'a', 'an',
]);

// Separators between co-remixers inside one parenthetical. Conservative — only
// unambiguous joiners. NOT bare "and"/"x" (appear inside real names), and NOT
// "vs"/"versus": "Fetisch Park vs. Bob Humid" is a *single* MB collaboration
// artist, so splitting it would be wrong (#271 review).
const SEP_RE = /\s*(?:&|\+|,|\/|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b)\s*/i;

const isVinyl     = t => /^\d+(?:"|''|”|inch|in)?$/.test(t);
const norm        = t => t.toLowerCase().replace(/[.''`]+$/, '');
const isStrong    = t => { const l = norm(t); return STRONG.has(l) || isVinyl(l); };
const isDecorator = t => { const l = norm(t); return STRONG.has(l) || WEAK.has(l) || isVinyl(l); };

// Trailing form: "<name> [qualifiers] <keyword>" — the keyword sits at the end.
// Covers remix / rework / remodel / reshuffle / reprise / edit / dub / mix, with
// an optional re- / re_ / re-space prefix and an -ed/-es/-s/-d inflection.
const TRAILING_RE = /^(.+?)\s+((?:re[-_ ]?)?(?:remix|rework|remodel|reshuffle|reprise|edit|dub|mix))(?:es|ed|s|d)?$/i;

// "…by <name>" form — only true remix verbs. NOT "mixed by"/"edited by", which
// credit an engineer rather than a remixer.
const BY_RE = /^(?:re[-_ ]?)?(?:remix|rework|remodel|reshuffle|rerub)(?:es|ed|s|d)?\s+by\s+(.+)$/i;

// Trim STRONG mix-descriptors off the trailing edge, then reject the whole
// thing if nothing but decorators is left. Drops a trailing possessive
// ("Aphex Twin's" → "Aphex Twin"). Returns null for an anonymous descriptor.
function cleanName(raw) {
    // Drop a nested/trailing parenthetical and any stray bracket the group regex
    // left unbalanced — e.g. "remix by Carlsbop (Fetisch Park vs. Bob Humid)"
    // captures "Carlsbop (Fetisch Park vs. Bob Humid"; keep just "Carlsbop".
    let s = String(raw || '').replace(/\s*[([].*$/, '').replace(/[)\]]+\s*$/, '');
    let tokens = s.trim().split(/\s+/).filter(Boolean);
    // Possessive form "<Artist>'s <remix title> <keyword>" — the owner of the
    // possessive is the artist; everything after it names the remix, not a
    // person. "Kettenkarussell's Triangle Player" → "Kettenkarussell",
    // "Funk D'Void's Hope" → "Funk D'Void" (the LAST apostrophe-s is the
    // possessive, so the internal one in "D'Void" is preserved). #271.
    const pIdx = tokens.findIndex(t => /['']s$/i.test(t));
    if (pIdx !== -1) {
        tokens = tokens.slice(0, pIdx + 1);
        tokens[pIdx] = tokens[pIdx].replace(/['']s$/i, '');
    }
    while (tokens.length && isStrong(tokens[tokens.length - 1])) tokens.pop();
    if (!tokens.length) return null;
    if (tokens.every(isDecorator)) return null;   // "(Extended Club Mix)", "(The Remix)" → anonymous
    const name = tokens.join(' ').replace(/['']s$/i, '').trim();
    if (!/[A-Za-z0-9]/.test(name)) return null;
    return name;
}

/**
 * Parse a single track title for named remixes.
 *
 *   parseRemixTitle('Around the World (Daft Punk Remix)')
 *     → { base: 'Around the World', remixers: ['Daft Punk'], kind: 'remix' }
 *   parseRemixTitle('Song (Extended Mix)')
 *     → { base: 'Song (Extended Mix)', remixers: [], kind: null }
 *
 * `base` is the title with every matched remix parenthetical removed; `kind`
 * is the first keyword family seen (informational — every named match becomes a
 * `remixer` relationship regardless).
 */
export function parseRemixTitle(title) {
    const result = { base: title || '', remixers: [], kind: null };
    if (!title || typeof title !== 'string') return result;
    const groups = title.match(/[([][^)\]]*[)\]]/g);
    if (!groups) return result;
    for (const g of groups) {
        const inner = g.slice(1, -1).trim();
        let captured = null, kind = null;
        let m = BY_RE.exec(inner);
        if (m) { captured = m[1]; kind = 'remix'; }
        else {
            m = TRAILING_RE.exec(inner);
            if (m) { captured = m[1]; kind = /mix$/i.test(m[2]) && !/remix$/i.test(m[2]) ? 'mix' : /edit$/i.test(m[2]) ? 'edit' : /dub$/i.test(m[2]) ? 'dub' : 'remix'; }
        }
        if (!captured) continue;
        const names = captured.split(SEP_RE).map(cleanName).filter(Boolean);
        if (!names.length) continue;   // anonymous ("Extended Mix", "Original Dub", …)
        result.kind = result.kind || kind;
        for (const n of names) if (!result.remixers.includes(n)) result.remixers.push(n);
        result.base = result.base.replace(g, '').replace(/\s{2,}/g, ' ').trim();
    }
    return result;
}

/**
 * Walk a tracklist and emit synthesized `remixer` tracklist roles for every
 * named remix found in the titles. Accepts the same track-object shape every
 * source already produces (`{ title, position, … }`); Discogs index/heading
 * rows (`type_ !== 'track'`) are skipped. The emitted role mirrors a provider
 * tracklist role — name-only artist (no URL, like Qobuz), so preflight keys it
 * as `_nourl_<name>` and resolves it via name search + the review table.
 *
 * `releaseMbid` (optional) gives each derived artist a release-scoped
 * `_cacheKey`, so a manual review pick (or auto-match) for a name-only remixer
 * persists across sessions of THIS release — without a bare name like "Friends"
 * leaking a resolution onto other releases. Omit it (e.g. the load-time probe,
 * which only counts) and no cache key is set.
 */
export function deriveRemixRoles(tracklist, releaseMbid) {
    if (!Array.isArray(tracklist)) return [];
    const roles = [];
    for (const track of tracklist) {
        if (!track || (track.type_ && track.type_ !== 'track')) continue;
        if (!track.title) continue;
        const { remixers } = parseRemixTitle(track.title);
        for (const name of remixers) {
            const artist = { name, anv: '', resource_url: '', _derived: true };
            if (releaseMbid) artist._cacheKey = `titles-remix/${releaseMbid}/${name.toLowerCase().trim()}`;
            roles.push({
                linkType: 'remixer',
                artist,
                track,
                creditedAs: name,
                attributes: [],
                entityType: 'artist',
            });
        }
    }
    return roles;
}
