// Unit: #526 — a release-level extraartist entry with a non-empty `tracks`
// field (e.g. "Guitar, Keyboards" scoped to "1 to 9, 11") is still top-level
// `release.extraartists` data, not a per-track `tracklist[].extraartists`
// entry. With per-track mode OFF, it used to be silently dropped instead of
// becoming a plain release-level credit — live-reported: only "Producer"
// (the one entry with `tracks: ""`) came through, "Guitar, Keyboards" and
// "Saxophone" (both track-scoped) vanished.
// mappers.js → constants.js touches `window` / BroadcastChannel at load; stub
// the bare minimum so the pure mapping logic can run under node.
globalThis.window = globalThis.window || globalThis;
if (typeof globalThis.BroadcastChannel === 'undefined') {
    globalThis.BroadcastChannel = class { postMessage() {} addEventListener() {} removeEventListener() {} close() {} };
}
const { discogsReleaseLevelExtraartists, rolesFromDiscogsArtists } = await import('../src/mappers.js');

let ok = true;
const check = (label, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label); if (!cond) ok = false; };

// verbatim shape from the reported release (discogs.com/release/8257104)
const extraartists = [
    { name: 'Jérémie Moussaid Kerouanton', role: 'Guitar, Keyboards', tracks: '1 to 9, 11', anv: '' },
    { name: 'Jérémie Moussaid Kerouanton', role: 'Producer', tracks: '', anv: '' },
    { name: 'Paul Harris', role: 'Saxophone', tracks: '1, 4, 5, 7, 10 ', anv: '' },
];

// per-track ON: only the untracked entry ("Producer") becomes a plain
// release-level credit — the other two get a proper per-track expansion
// elsewhere (runImport's `releaseLevelTracklistRels`), so they're excluded
// here to avoid a duplicate, unscoped copy.
const onFiltered = discogsReleaseLevelExtraartists(extraartists, true);
check('per-track ON: only the untracked entry passes through', onFiltered.length === 1 && onFiltered[0].role === 'Producer');
const onRoles = rolesFromDiscogsArtists(onFiltered);
check('per-track ON: exactly 1 release-level role', onRoles.length === 1);

// per-track OFF: ALL extraartists become release-level credits (track
// scoping lost, but nothing silently dropped) — "Guitar, Keyboards" (2
// roles) + "Producer" (1) + "Saxophone" (1) = 4 individual role entries.
const offFiltered = discogsReleaseLevelExtraartists(extraartists, false);
check('per-track OFF: nothing is filtered out', offFiltered.length === 3);
const offRoles = rolesFromDiscogsArtists(offFiltered);
console.log('per-track OFF roles:', JSON.stringify(offRoles.map(r => ({ linkType: r.linkType, instrument: r.attributes?.[0]?.value, artist: r.artist && r.artist.name }))));
check('per-track OFF: 4 individual role entries (2 + 1 + 1)', offRoles.length === 4);
check('  includes the track-scoped "Guitar" instrument credit', offRoles.some(r => r.linkType === 'instrument' && r.attributes?.[0]?.value === 'guitar' && r.artist.name.includes('Kerouanton')));
check('  includes the track-scoped "Keyboards" instrument credit', offRoles.some(r => r.linkType === 'instrument' && r.attributes?.[0]?.value === 'keyboard' && r.artist.name.includes('Kerouanton')));
check('  includes the track-scoped "Saxophone" instrument credit', offRoles.some(r => r.linkType === 'instrument' && r.attributes?.[0]?.value === 'saxophone' && r.artist.name === 'Paul Harris'));
check('  still includes the untracked "Producer" credit', offRoles.some(r => r.linkType === 'producer'));

process.exit(ok ? 0 : 1);
