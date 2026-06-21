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

// Words that decorate a remix but are not part of the remixer's name. Stripped
// from both ends of the captured text, so "(KiNK Extended Remix)" → "KiNK" and
// '(X 12" Club Mix)' → "X". If nothing survives the strip, the parenthetical is
// anonymous and yields no credit.
const QUALIFIERS = new Set([
    'extended', 'club', 'radio', 'dub', 'instrumental', 'acapella', 'acappella',
    'acoustic', 'original', 'album', 'single', 'main', 'long', 'short', 'full',
    'special', 'bonus', 'alternative', 'alternate', 'vip', 'rmx', 'redux',
    'deep', 'tech', 'soulful', 'disco', 'electro', 'house', 'techno',
    'progressive', 'tribal', 'vocal', 'dancefloor', 'classic', 'clean', 'dirty',
    'censored', 'uncensored', 'studio', 'live', 'demo', 'rough', 'final',
    'new', 'old', 'remastered', 're-edit', 'reedit',
]);

// Articles dropped from the front of a captured name ("(The Remix)" → no name).
const ARTICLES = new Set(['the', 'a', 'an']);

// Separators between co-remixers inside one parenthetical. Conservative — only
// unambiguous joiners, NOT bare "and"/"x" which appear inside real names.
const SEP_RE = /\s*(?:&|\+|,|\/|\bvs\.?\b|\bversus\b|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b)\s*/i;

// Trailing form: "<name> [qualifiers] <keyword>" — the keyword sits at the end.
// Covers remix / rework / remodel / reshuffle / edit / dub / mix, with an
// optional re- / re_ / re-space prefix and an -ed/-es/-s/-d inflection.
const TRAILING_RE = /^(.+?)\s+((?:re[-_ ]?)?(?:remix|rework|remodel|reshuffle|edit|dub|mix))(?:es|ed|s|d)?$/i;

// "…by <name>" form — only true remix verbs. NOT "mixed by"/"edited by", which
// credit an engineer rather than a remixer.
const BY_RE = /^(?:re[-_ ]?)?(?:remix|rework|remodel|reshuffle|rerub)(?:es|ed|s|d)?\s+by\s+(.+)$/i;

function isQualifierToken(tok) {
    const t = tok.toLowerCase().replace(/[.''`]+$/, '');
    return QUALIFIERS.has(t) || ARTICLES.has(t) || /^\d+(?:"|''|”|inch|in)?$/.test(t);
}

// Trim qualifier/article/vinyl-size tokens off both ends; drop a trailing
// possessive ("Aphex Twin's" → "Aphex Twin"). Returns null when nothing
// name-like remains.
function cleanName(raw) {
    let tokens = String(raw || '').trim().split(/\s+/).filter(Boolean);
    while (tokens.length && isQualifierToken(tokens[tokens.length - 1])) tokens.pop();
    while (tokens.length && isQualifierToken(tokens[0])) tokens.shift();
    if (!tokens.length) return null;
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
 */
export function deriveRemixRoles(tracklist) {
    if (!Array.isArray(tracklist)) return [];
    const roles = [];
    for (const track of tracklist) {
        if (!track || (track.type_ && track.type_ !== 'track')) continue;
        if (!track.title) continue;
        const { remixers } = parseRemixTitle(track.title);
        for (const name of remixers) {
            roles.push({
                linkType: 'remixer',
                artist: { name, anv: '', resource_url: '', _derived: true },
                track,
                creditedAs: name,
                attributes: [],
                entityType: 'artist',
            });
        }
    }
    return roles;
}
