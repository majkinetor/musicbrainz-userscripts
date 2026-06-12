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
export function buildEditNote(discogsUrl, opts, extraLines) {
    const s = GM_info.script;
    // Strip the query string AND location.hash before stripping the
    // /edit-relationships suffix: on a seeded edit page the URL carries a huge
    // `#seed-urls-v1=…` fragment (and the old `$`-anchored replace never fired,
    // so the whole fragment leaked into the note — issue #174). Same cleanup on
    // the Discogs URL so neither line carries tracking noise.
    const mbUrl = location.href.split(/[?#]/)[0].replace(/\/edit-relationships$/, '');
    const homepage = s.homepageURL || s.homepage || 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/discogs_credits/README.md';
    const header = s.name + ' v' + s.version + ' by ' + s.author + ' - ' + homepage;
    const lines = [
        header,
        '',
        'Release URL: ' + mbUrl,
        'Discogs URL: ' + String(discogsUrl || '').split(/[?#]/)[0],
    ];
    if (opts) lines.push('Options: ' + opts);
    if (extraLines) lines.push(...(Array.isArray(extraLines) ? extraLines : [extraLines]));
    return lines.join('\n');
}

/**
 * Merge our edit note onto whatever is already in the edit-note field instead
 * of clobbering it — other scripts (Harmony seeder, Seed-URLs, …) set their own
 * note first and we were overwriting it (issue #174). Our block is APPENDED
 * after the existing text with one empty line between them.
 *
 * A previously-appended block authored by THIS script is dropped first, so
 * re-running an import in the same session refreshes our note rather than
 * stacking a second copy. Our block always begins at our header line and runs
 * to the end (we append last), so truncating from that header is sufficient.
 */
export function combineEditNote(existingNote, ourNote) {
    const headerPrefix = GM_info.script.name + ' v';
    let base = String(existingNote || '');
    const lines = base.split('\n');
    const ourIdx = lines.findIndex(l => l.startsWith(headerPrefix));
    if (ourIdx !== -1) base = lines.slice(0, ourIdx).join('\n');
    base = base.replace(/\s+$/, '');
    return base ? base + '\n\n' + ourNote : ourNote;
}
