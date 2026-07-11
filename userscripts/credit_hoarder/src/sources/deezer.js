// Deezer source — pure helpers (no GM, no engine imports).
//
// Deezer's public JSON API (`api.deezer.com/track/<id>`) exposes only the Main /
// Featured *artists* — no songwriter credits (confirmed in the #193 survey). But
// the **album page HTML** (`https://www.deezer.com/us/album/<id>`) server-renders
// a per-track "Composers" line in the tracklist datagrid:
//
//   <tr class="song" … itemid="/us/track/117243748">
//       … <span class="number" data-target="position">02</span> …
//   <tr class="contributors" id="naboo_datagrid_contributors_117243748">
//       <div … data-target="contributors">Composers: E. Davis</div>
//
// So a single unauthenticated cross-origin GM_xmlhttpRequest is enough — no tab,
// no token — exactly like the Qobuz store-page scrape. Deezer exposes **names
// only** (no artist ids/links) and **only the composer role** — comma-separated
// for co-writers ("S. Manning, A. Lawrence"), "No Info" when absent — so every
// credit resolves name-based (MB search + the review table), the Qobuz shape.
// Verified on album 12166410 (Soul Jazz *Calypso*): 19/19 track lines parsed.

/** Minimal HTML-entity decode for the entities Deezer pages emit (numeric refs,
 *  `&amp;`, `&#039;`, …). Kept local so this source has no engine imports. */
export function decodeEntities(s) {
    return String(s)
        .replace(/&#(\d+);/g,         (_, n) => String.fromCodePoint(+n))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
        .replace(/&#039;/g, "'").replace(/&apos;/g, "'");
}

/** Deezer contributor label → MB relationship plan. Only "Composers" is seen in
 *  the datagrid today; the others are best-effort in case Deezer ever emits them.
 *  `rel` is the MB link-type name — the engine derives work-vs-recording from it
 *  (composer/lyricist/writer target the work; producer targets the recording). */
export const DEEZER_LABEL_MAP = {
    'Composers': { rel: 'composer' },
    'Composer':  { rel: 'composer' },
    'Authors':   { rel: 'lyricist' },
    'Author':    { rel: 'lyricist' },
    'Writers':   { rel: 'writer' },
    'Writer':    { rel: 'writer' },
    'Producers': { rel: 'producer' },
    'Producer':  { rel: 'producer' },
};

const DEEZER_ALBUM_RE = /^(?:https?:)?\/\/(?:www\.)?deezer\.com\/(?:[a-z]{2}\/)?album\/(\d+)/i;

/**
 * Parse a Deezer album URL → `{ id, pageUrl }`, or `null`. Accepts the
 * locale-less form MB usually stores (`deezer.com/album/<id>`), any 2-letter
 * locale (`/us/`, `/en/`, `/fr/`…), and protocol-relative hrefs.
 *
 * `pageUrl` is always synthesized as the `/us/` store page: it server-renders
 * the English "Composers" label the parser keys on, regardless of the stored
 * locale.
 */
export function parseDeezerAlbumUrl(url) {
    const m = DEEZER_ALBUM_RE.exec(url || '');
    return m ? { id: m[1], pageUrl: `https://www.deezer.com/us/album/${m[1]}` } : null;
}

/** "No Info" (case-insensitive) is Deezer's placeholder for "no credit". */
const DEEZER_NO_INFO_RE = /^\s*no\s*info\s*$/i;

/**
 * Parse one contributors line into `[{ name, roles: [rel…] }]`. A line is one or
 * more `Label: names` groups joined by ` / ` — e.g. a single `Composers: E. Davis`,
 * or `Writer: Raúl Marrugo / Composers: Raúl Marrugo` (#401). Each label maps to an
 * MB rel via `DEEZER_LABEL_MAP`; names within a group are separated by a comma OR
 * ` - ` (space-hyphen-space, so hyphenated names like "Malcolm-Marx" stay intact) —
 * e.g. `Composers: Ben Malone - Alya Malcolm-Marx - Harry Parsons`. Credits are keyed
 * by name, so a person listed under several labels (Writer *and* Composer) yields ONE
 * entry with both roles. Unknown labels and "No Info" placeholders are dropped.
 */
export function parseDeezerCreditLine(line) {
    const text = decodeEntities(String(line)).trim();
    const byName = new Map();   // name → ordered, de-duped rel list
    for (const group of text.split(' / ')) {
        const m = /^([^:]+):\s*(.*)$/.exec(group.trim());
        if (!m) continue;
        const plan = DEEZER_LABEL_MAP[m[1].trim()];
        if (!plan) continue;
        for (const raw of m[2].split(/\s*,\s*|\s+-\s+/)) {
            const name = raw.trim();
            if (!name || DEEZER_NO_INFO_RE.test(name)) continue;
            if (!byName.has(name)) byName.set(name, []);
            const roles = byName.get(name);
            if (!roles.includes(plan.rel)) roles.push(plan.rel);
        }
    }
    return [...byName].map(([name, roles]) => ({ name, roles }));
}

/**
 * Extract per-track credits from raw album-page HTML.
 * Returns `[{ index, credits: [{ name, roles }] }]`, one entry per track that
 * has ≥1 credit, in track-number order.
 *
 * Anchored by **track id**, not element order: each contributors row carries
 * `id="naboo_datagrid_contributors_<trackId>"` and the matching song row carries
 * `itemid="/us/track/<trackId>"` + `data-target="position">NN`. We map trackId →
 * position from the song rows, then join the contributors line onto that
 * position — so responsive-duplicate or reordered rows can't shift a credit onto
 * the wrong track.
 */
export function extractDeezerCredits(html) {
    const posByTrack = new Map();   // trackId → track position (int)
    const posRe = /itemid="\/[a-z]{2}\/track\/(\d+)"[\s\S]{0,600}?data-target="position">\s*(\d+)/gi;
    let pm;
    while ((pm = posRe.exec(html)) !== null) {
        const id = pm[1];
        if (!posByTrack.has(id)) posByTrack.set(id, parseInt(pm[2], 10));
    }
    const out = [];
    const credRe = /naboo_datagrid_contributors_(\d+)"[\s\S]{0,400}?data-target="contributors">([^<]*)</gi;
    let cm;
    while ((cm = credRe.exec(html)) !== null) {
        const id = cm[1];
        const pos = posByTrack.get(id);
        if (!pos) continue;                                  // credits row with no matching track
        const credits = parseDeezerCreditLine(cm[2]);
        if (credits.length) out.push({ index: pos, credits });
    }
    return out.sort((a, b) => a.index - b.index);
}

/** Album title from the store page, for the diagnostic log (og:title is the bare
 *  album name — verified). */
export function extractDeezerAlbumInfo(html) {
    const og = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] || '';
    return decodeEntities(og);
}

/**
 * Map parsed Deezer credits to the engine's tracklist-relationship shape (same
 * contract as `qobuzToEngine`). Deezer exposes names only — every credit goes
 * through name search + review (`resource_url: ''`).
 */
export function deezerToEngine(parsedTracks) {
    const tracklistRels = [];
    const tracklist = [];
    const skipped = [];
    for (const t of parsedTracks) {
        const track = { position: String(t.index), title: '', type_: 'track' };
        tracklist.push(track);
        for (const credit of t.credits) {
            for (const rel of credit.roles) {
                tracklistRels.push({
                    linkType:   rel,
                    entityType: 'artist',
                    attributes: [],
                    artist:     { name: credit.name, anv: '', resource_url: '' },
                    track,
                });
            }
        }
    }
    return { tracklistRels, tracklist, skipped };
}

/** Fetch the album page HTML cross-origin via GM_xmlhttpRequest
 *  (musicbrainz.org → www.deezer.com; `@connect deezer.com`). */
export function fetchDeezerAlbumPage(pageUrl) {
    return new Promise((resolve, reject) => {
        if (typeof GM_xmlhttpRequest !== 'function') { reject(new Error('GM_xmlhttpRequest unavailable')); return; }
        GM_xmlhttpRequest({
            method: 'GET',
            url: pageUrl,
            headers: { 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.8' },
            timeout: 20000,
            onload: r => (r.status >= 200 && r.status < 400 && r.responseText)
                ? resolve(r.responseText)
                : reject(new Error(`Deezer page returned ${r.status}`)),
            onerror:   () => reject(new Error('Deezer page fetch failed (network)')),
            ontimeout: () => reject(new Error('Deezer page fetch timed out')),
        });
    });
}
