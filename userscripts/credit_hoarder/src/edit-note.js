// MusicBrainz edit-note builder. Renders the "this edit was made by …"
// preamble + URLs + options summary that the import bar drops into the
// release's edit-note input at import start.

/**
 * Build the edit-note text.
 *
 *   @param {string} discogsUrl — the source Discogs URL the import was triggered with.
 *   @param {string|null} opts — the "Options: …" line (e.g. "Apply to tracks, Create works"),
 *                               or null/empty to omit.
 *   @param {string|string[]} extraLines — extra trailing lines appended verbatim.
 *
 * The header line carries the script name, version, author, and homepage URL.
 * Homepage resolution: `GM_info.script.homepageURL` (Greasemonkey / Violentmonkey)
 * → `GM_info.script.homepage` (Tampermonkey) → hard-coded GitHub URL fallback
 * (keeps `@homepageURL` in `src/meta.txt` in sync; never let "undefined"
 * appear in an edit note — issue #7).
 */
export function buildEditNote(sourceUrl, opts, extraLines) {
    const s = GM_info.script;
    // Strip the query string AND location.hash before stripping the
    // /edit-relationships suffix: on a seeded edit page the URL carries a huge
    // `#seed-urls-v1=…` fragment (and the old `$`-anchored replace never fired,
    // so the whole fragment leaked into the note — issue #174). Same cleanup on
    // the source URL so neither line carries tracking noise.
    const mbUrl = location.href.split(/[?#]/)[0].replace(/\/edit-relationships$/, '');
    const homepage = s.homepageURL || s.homepage || 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/credit_hoarder/README.md';
    const header = s.name + ' v' + s.version + ' by ' + s.author + ' - ' + homepage;
    // Label the source line by what the URL actually is (#193 — multi-source).
    const cleanSource = String(sourceUrl || '').split(/[?#]/)[0];
    const sourceName = /tidal\.com/i.test(cleanSource) ? 'Tidal'
                     : /qobuz\.com/i.test(cleanSource) ? 'Qobuz'
                     : 'Discogs';
    const lines = [
        header,
        '',
        'Release URL: ' + mbUrl,
        // No source URL → the title-derived "Titles" source (#271): credits come
        // from the release's own track titles, not an external page.
        cleanSource ? sourceName + ' URL: ' + cleanSource : 'Source: track titles',
    ];
    if (opts) lines.push('Options: ' + opts);
    if (extraLines) lines.push(...(Array.isArray(extraLines) ? extraLines : [extraLines]));
    return lines.join('\n');
}

/**
 * Edit note for a NEW entity (artist / label / place …) the script creates from
 * a source credit during an import. Same attribution header as `buildEditNote`,
 * plus the source URL the entity came from and the release it was imported onto,
 * so the auto-created entity carries a proper, traceable note.
 */
export function buildCreateNote(action = 'Created the entity') {
    const s = GM_info.script;
    const homepage = s.homepageURL || s.homepage || 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/credit_hoarder/README.md';
    const header = s.name + ' v' + s.version + ' by ' + s.author + ' - ' + homepage;
    const mbUrl = location.href.split(/[?#]/)[0].replace(/\/edit(-relationships)?$/, '');
    return header + '\n\n' + action + ' while importing credits onto ' + mbUrl;
}

// Split a note into our part vs anything that preceded it (another script's
// note). Our part is `header`, the shared `Release URL:` line, and `body` — the
// stacked per-source blocks below it. Returns null when our header isn't found.
function splitOurNote(note) {
    const headerPrefix = GM_info.script.name + ' v';
    const lines = String(note || '').split('\n');
    const idx = lines.findIndex(l => l.startsWith(headerPrefix));
    if (idx === -1) return null;
    const pre = lines.slice(0, idx).join('\n').replace(/\s+$/, '');
    const our = lines.slice(idx);
    const relIdx = our.findIndex(l => /^Release URL:/i.test(l));
    return {
        pre,
        header: our[0],
        releaseLine: relIdx !== -1 ? our[relIdx] : '',
        body: (relIdx !== -1 ? our.slice(relIdx + 1) : our.slice(1)).join('\n').trim(),
    };
}

// Which source a stacked block belongs to, from its first line:
//   "Discogs URL: …" / "Tidal URL: …" / "Qobuz URL: …" → that provider
//   "Source: track titles"                              → Titles (#271)
function blockSourceKey(block) {
    const first = (String(block).split('\n')[0] || '').trim();
    const m = first.match(/^([A-Za-z][A-Za-z ]*?)\s+URL:/);
    if (m) return m[1].trim().toLowerCase();
    if (/^Source:\s*track titles/i.test(first)) return 'titles';
    return first.toLowerCase();
}

/**
 * Merge our edit note onto whatever is already in the edit-note field.
 *
 *  - Never clobbers another script's note (Harmony seeder, Seed-URLs, …): that
 *    text is preserved ahead of our block (issue #174).
 *  - #272: multiple sources can run in one session, and the final submit applies
 *    every staged edit with this one note — so each source's block STACKS under a
 *    single shared header + `Release URL:` line, newest on top, **one block per
 *    source** (re-running a source replaces its block rather than piling up).
 *    Each block keeps its own per-run stats, so they never sum into a misleading
 *    total — Discogs "10 added", Tidal "2 added, 4 already added this session".
 */
export function combineEditNote(existingNote, ourNote) {
    const fresh = splitOurNote(ourNote);
    if (!fresh) return ourNote;   // ourNote always carries our header — defensive
    const newKey = blockSourceKey(fresh.body);

    const prev = splitOurNote(existingNote);
    const keptBlocks = prev
        ? prev.body.split(/\n\n+/).map(b => b.trim()).filter(Boolean).filter(b => blockSourceKey(b) !== newKey)
        : [];
    const stacked = [fresh.body, ...keptBlocks].join('\n\n');
    const ourBlock = `${fresh.header}\n\n${fresh.releaseLine}\n${stacked}`;

    const pre = prev ? prev.pre : String(existingNote || '').replace(/\s+$/, '');
    return pre ? `${pre}\n\n${ourBlock}` : ourBlock;
}
