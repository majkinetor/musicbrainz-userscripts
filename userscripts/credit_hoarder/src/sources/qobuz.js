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

/** Role vocabulary seen in Qobuz `performers` strings → MB relationship plan.
 *  `null` = recognised but never imported (MainArtist duplicates the track
 *  artist credit; AssociatedPerformer/StudioPersonnel are too vague). */
export const QOBUZ_ROLE_MAP = {
    'Composer':            { target: 'work',      rel: 'composer' },
    'Lyricist':            { target: 'work',      rel: 'lyricist' },
    'Author':              { target: 'work',      rel: 'lyricist' },
    'ComposerLyricist':    { target: 'work',      rel: 'writer' },
    'Writer':              { target: 'work',      rel: 'writer' },
    'Arranger':            { target: 'work',      rel: 'arranger' },
    'Producer':            { target: 'recording', rel: 'producer' },
    'Co-Producer':         { target: 'recording', rel: 'producer' },
    'Mixer':               { target: 'recording', rel: 'mix' },
    'MixingEngineer':      { target: 'recording', rel: 'mix' },
    'Engineer':            { target: 'recording', rel: 'engineer' },
    'RecordingEngineer':   { target: 'recording', rel: 'recording' },
    'MasteringEngineer':   { target: 'recording', rel: 'mastering' },
    'Remixer':             { target: 'recording', rel: 'remixer' },
    'Conductor':           { target: 'recording', rel: 'conductor' },
    'MusicPublisher':      { target: 'work',      rel: 'publisher' },
    'MainArtist':          null,
    'FeaturedArtist':      null,
    'AssociatedPerformer': null,
    'StudioPersonnel':     null,
    'Vocals':              null,
};

const QOBUZ_ALBUM_RE = /^https?:\/\/(?:www\.|play\.|open\.)?qobuz\.com\/(?:[a-z]{2}-[a-z]{2}\/)?album\/(?:[^/]+\/)?([a-z0-9]+)\/?(?:[?#]|$)/i;

/**
 * Parse a Qobuz album URL → `{ id, pageUrl }`, or `null`. Accepts the
 * store-page form (`/us-en/album/<slug>/<id>`), the bare `/album/<id>`,
 * and play./open. subdomain links (those carry the id as the last segment).
 */
export function parseQobuzAlbumUrl(url) {
    const m = QOBUZ_ALBUM_RE.exec(url || '');
    if (!m) return null;
    return { id: m[1], pageUrl: `https://www.qobuz.com/us-en/album/x/${m[1]}` };
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

/**
 * Parse one `track__info` credit line into `[{ name, roles: [role…] }]`.
 *
 * Strategy: split on " - " into segments, then split each segment on ", ".
 * Tokens found in `QOBUZ_ROLE_MAP` are roles; everything before the first
 * role token is the name. A segment with no known role token is glued back
 * onto the previous segment's name (handles names containing " - ").
 * Known limitation: a *name* containing ", " followed by a token that
 * happens to be a known role would mis-split — not observed in practice.
 */
export function parseQobuzCreditLine(line) {
    const out = [];
    for (const seg of String(line).split(' - ')) {
        const tokens   = seg.split(',').map(t => t.trim()).filter(Boolean);
        const firstRole = tokens.findIndex(t => Object.prototype.hasOwnProperty.call(QOBUZ_ROLE_MAP, t));
        if (firstRole === -1) {
            // No role token: part of a name containing " - ".
            if (out.length) out[out.length - 1].name += ' - ' + seg.trim();
            continue;
        }
        const name  = tokens.slice(0, firstRole).join(', ');
        const roles = tokens.slice(firstRole).filter(t => Object.prototype.hasOwnProperty.call(QOBUZ_ROLE_MAP, t));
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
    const out = [];
    const re = /<p[^>]*class="[^"]*track__info[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
    let m, i = 0;
    while ((m = re.exec(html)) !== null) {
        const text = decodeEntities(m[1].replace(/<[^>]+>/g, '').trim());
        out.push({ index: ++i, credits: parseQobuzCreditLine(text) });
    }
    return out;
}
