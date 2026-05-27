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
    const mbUrl = location.href.replace(/\/edit-relationships$/, '');
    const homepage = s.homepageURL || s.homepage || 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/discogs_credits/README.md';
    const header = s.name + ' v' + s.version + ' by ' + s.author + ' - ' + homepage;
    const lines = [
        header,
        '',
        'Release URL: ' + mbUrl,
        'Discogs URL: ' + discogsUrl,
    ];
    if (opts) lines.push('Options: ' + opts);
    if (extraLines) lines.push(...(Array.isArray(extraLines) ? extraLines : [extraLines]));
    return lines.join('\n');
}
