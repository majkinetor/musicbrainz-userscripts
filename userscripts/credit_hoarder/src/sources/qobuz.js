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
            for (const role of credit.roles) {
                if (role === 'MusicPublisher') {
                    if (!/^copyright control$/i.test(credit.name)) skipped.push(`track ${track.position}: MusicPublisher — ${credit.name}`);
                    continue;
                }
                const plan = QOBUZ_ROLE_MAP[role];
                if (!plan) continue;   // MainArtist & friends — never imported
                tracklistRels.push({
                    linkType:   plan.rel,
                    entityType: 'artist',
                    attributes: [],
                    artist: { name: credit.name, anv: '', resource_url: '' },
                    track,
                });
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
