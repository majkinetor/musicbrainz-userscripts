// Pure-node tests for the source parsers (no browser, no GM).
// Run: node test/sources-parse.mjs
import assert from 'node:assert/strict';
import { parseQobuzCreditLine, extractQobuzCredits, parseQobuzAlbumUrl, decodeEntities } from '../src/sources/qobuz.js';
import { parseTidalAlbumUrl, TIDAL_ROLE_MAP } from '../src/sources/tidal.js';

// ── Qobuz credit line (verbatim from album vft3hpnx5c3lc, track 1) ──────────
const line1 = 'Copyright Control, MusicPublisher - Kwadwo Donkoh, Producer - Wulomei, MainArtist - Nii Tei Ashitey, Composer, Lyricist';
assert.deepEqual(parseQobuzCreditLine(line1), [
    { name: 'Copyright Control', roles: ['MusicPublisher'] },
    { name: 'Kwadwo Donkoh',     roles: ['Producer'] },
    { name: 'Wulomei',           roles: ['MainArtist'] },
    { name: 'Nii Tei Ashitey',   roles: ['Composer', 'Lyricist'] },
]);

// Multiple people sharing roles (track 5 shape)
const line2 = 'Pal Akalonu, Composer, Lyricist, Producer - Ralph Amarabem, Composer, Lyricist';
assert.deepEqual(parseQobuzCreditLine(line2), [
    { name: 'Pal Akalonu',    roles: ['Composer', 'Lyricist', 'Producer'] },
    { name: 'Ralph Amarabem', roles: ['Composer', 'Lyricist'] },
]);

// Entity decoding (track 2: Conjunto Ana N'gola arrives as N&#039;gola)
assert.equal(decodeEntities('Conjunto Ana N&#039;gola &amp; Co'), "Conjunto Ana N'gola & Co");

// HTML extraction
const html = '<div><p class="track__info">A, Composer - B, Producer</p><p class="track__info">C, Lyricist</p></div>';
const tracks = extractQobuzCredits(html);
assert.equal(tracks.length, 2);
assert.deepEqual(tracks[0].credits, [
    { name: 'A', roles: ['Composer'] },
    { name: 'B', roles: ['Producer'] },
]);
assert.equal(tracks[1].index, 2);

// ── URL parsers ──────────────────────────────────────────────────────────────
assert.equal(parseQobuzAlbumUrl('https://www.qobuz.com/us-en/album/walatu-walasa-wulomei/vft3hpnx5c3lc').id, 'vft3hpnx5c3lc');
assert.equal(parseQobuzAlbumUrl('https://open.qobuz.com/album/vft3hpnx5c3lc').id, 'vft3hpnx5c3lc');
assert.equal(parseQobuzAlbumUrl('https://www.qobuz.com/us-en/interpreter/wulomei'), null);

assert.deepEqual(parseTidalAlbumUrl('https://tidal.com/album/427731309'),
    { id: '427731309', creditsUrl: 'https://tidal.com/album/427731309/credits' });
assert.equal(parseTidalAlbumUrl('https://listen.tidal.com/album/427731309/credits').id, '427731309');
assert.equal(parseTidalAlbumUrl('https://tidal.com/browse/album/427731309').id, '427731309');
assert.equal(parseTidalAlbumUrl('https://tidal.com/artist/6220117'), null);

// Role map sanity: every mapped Tidal role targets work or recording
for (const [role, plan] of Object.entries(TIDAL_ROLE_MAP))
    assert.ok(['work', 'recording'].includes(plan.target), role);

console.log('sources-parse: all assertions passed');
