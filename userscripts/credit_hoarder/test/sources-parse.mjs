// Pure-node tests for the source parsers (no browser, no GM).
// Run: node test/sources-parse.mjs
import assert from 'node:assert/strict';
import { parseQobuzCreditLine, extractQobuzCredits, parseQobuzAlbumUrl, decodeEntities, qobuzToEngine, extractQobuzAlbumInfo } from '../src/sources/qobuz.js';
import { parseTidalAlbumUrl, parseTidalArtistUrl, tidalToEngine, tidalReleaseArtists, TIDAL_ROLE_MAP } from '../src/sources/tidal.js';
import { parseSourceEntityUrl } from '../src/sources/registry.js';

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

// HTML extraction — anchored to the page's real track-number markers.
// Reproduces the live-test trap: empty duplicate track__info elements
// (responsive layout) must NOT shift positions, and `track__infos`-class
// decoys must not match.
const html = [
    '<button id="popinAddToCartBtnPlayerTrack1">…</button>',
    '<p class="track__info">A, Composer - B, Producer</p>',
    '<p class="track__info"></p>',                                   // empty duplicate
    '<div class="track__infos">decoy, Composer</div>',               // class decoy
    '<button id="popinAddToCartBtnPlayerTrack2">…</button>',
    '<p class="track__info"> </p>',                                  // empty first…
    '<p class="track__info track__info--mobile">C, Lyricist</p>',    // …real one second
].join('\n');
const tracks = extractQobuzCredits(html);
assert.equal(tracks.length, 2);
assert.deepEqual(tracks[0], { index: 1, credits: [
    { name: 'A', roles: ['Composer'] },
    { name: 'B', roles: ['Producer'] },
] });
assert.deepEqual(tracks[1], { index: 2, credits: [{ name: 'C', roles: ['Lyricist'] }] });

// ── URL parsers ──────────────────────────────────────────────────────────────
// Store URLs keep their own slug; slug-less forms synthesize a wrong-slug
// store URL (Qobuz redirects it to the canonical page — verified live).
assert.deepEqual(parseQobuzAlbumUrl('https://www.qobuz.com/us-en/album/walatu-walasa-wulomei/vft3hpnx5c3lc'),
    { id: 'vft3hpnx5c3lc', pageUrl: 'https://www.qobuz.com/us-en/album/walatu-walasa-wulomei/vft3hpnx5c3lc' });
assert.deepEqual(parseQobuzAlbumUrl('https://open.qobuz.com/album/vft3hpnx5c3lc'),
    { id: 'vft3hpnx5c3lc', pageUrl: 'https://www.qobuz.com/us-en/album/x/vft3hpnx5c3lc' });
assert.equal(parseQobuzAlbumUrl('//open.qobuz.com/album/vft3hpnx5c3lc').id, 'vft3hpnx5c3lc');   // MB protocol-relative
assert.equal(parseQobuzAlbumUrl('https://www.qobuz.com/us-en/interpreter/wulomei'), null);

assert.deepEqual(parseTidalAlbumUrl('https://tidal.com/album/427731309'),
    { id: '427731309', creditsUrl: 'https://tidal.com/album/427731309/credits' });
assert.equal(parseTidalAlbumUrl('https://listen.tidal.com/album/427731309/credits').id, '427731309');
assert.equal(parseTidalAlbumUrl('https://tidal.com/browse/album/427731309').id, '427731309');
// MB rel hrefs are protocol-relative — the live-test regression (#193)
assert.equal(parseTidalAlbumUrl('//tidal.com/album/427731309').id, '427731309');
assert.equal(parseTidalArtistUrl('//tidal.com/artist/6220117').key, 'tidal-artist/6220117');
assert.equal(parseTidalAlbumUrl('https://tidal.com/artist/6220117'), null);

// Role map sanity: every mapped Tidal role targets work or recording
for (const [role, plan] of Object.entries(TIDAL_ROLE_MAP))
    assert.ok(['work', 'recording'].includes(plan.target), role);

// ── Tidal artist URL → entity-cache key (registry seam) ─────────────────────
assert.deepEqual(parseTidalArtistUrl('https://tidal.com/artist/33321484'),
    { id: '33321484', key: 'tidal-artist/33321484', cleanUrl: 'https://tidal.com/artist/33321484' });
assert.equal(parseTidalArtistUrl('https://listen.tidal.com/artist/6220117').key, 'tidal-artist/6220117');
assert.equal(parseTidalArtistUrl('https://tidal.com/album/427731309'), null);
// registry: Discogs keys keep their legacy form, Tidal keys are prefixed
assert.equal(parseSourceEntityUrl('https://api.discogs.com/artists/123').key, 'artist/123');
assert.equal(parseSourceEntityUrl('https://tidal.com/artist/123').key, 'tidal-artist/123');
assert.equal(parseSourceEntityUrl(''), null);

// ── tidalToEngine: harvest → engine tracklist-rel shape ─────────────────────
const harvest = [
    { num: '1', title: 'Takoradi', tidalTrackId: '427731312', credits: [
        { role: 'Producer',        names: [{ name: 'Kwadwo Donkoh', tidalId: '6220117' }] },
        { role: 'Composer',        names: [{ name: 'Nii Tei Ashitey', tidalId: '33321484' }] },
        { role: 'Lyricist',        names: [{ name: 'Nii Tei Ashitey', tidalId: '33321484' }] },
        { role: 'Music Publisher', names: [{ name: 'Copyright Control', tidalId: '15780' }] },
    ] },
    { num: '2', title: 'Puxa Odette', tidalTrackId: '427731313', credits: [
        { role: 'Music Publisher', names: [{ name: 'Mavuthela Music Co.', tidalId: null }] },
        { role: 'Producer',        names: [{ name: 'No Tidal Page', tidalId: null }] },
    ] },
];
const eng = tidalToEngine(harvest);
assert.equal(eng.multiVolume, false);
assert.deepEqual(eng.tracklist, [
    { position: '1', title: 'Takoradi', type_: 'track' },
    { position: '2', title: 'Puxa Odette', type_: 'track' },
]);
// Copyright Control publisher dropped entirely; real publisher → label→work
// "publishing" rel (label-entity resolution), nothing skipped.
assert.equal(eng.skipped.length, 0);
assert.equal(eng.tracklistRels.length, 5); // producer+composer+lyricist (t1) + publishing+producer (t2)
const prod = eng.tracklistRels[0];
assert.equal(prod.linkType, 'producer');
assert.equal(prod.entityType, 'artist');
assert.deepEqual(prod.attributes, []);
assert.equal(prod.artist.resource_url, 'https://tidal.com/artist/6220117');
assert.equal(prod.track.position, '1');
// Music publisher → label→work "publishing", resolved by name (no URL)
const pub = eng.tracklistRels.find(r => r.linkType === 'publishing');
assert.equal(pub.entityType, 'label');
assert.equal(pub.artist.entityType, 'label');
assert.equal(pub.artist.name, 'Mavuthela Music Co.');
assert.equal(pub.artist.resource_url, '');
assert.equal(pub.track.position, '2');
// unlinked credit → empty resource_url (name-search path), never undefined
const unlinked = eng.tracklistRels.find(r => r.artist.name === 'No Tidal Page');
assert.equal(unlinked.linkType, 'producer');
assert.equal(unlinked.artist.resource_url, '');
// multi-volume detection: repeated track numbers
assert.equal(tidalToEngine([
    { num: '1', title: 'a', credits: [] },
    { num: '1', title: 'b', credits: [] },
]).multiVolume, true);

// ── tidalReleaseArtists: Info-tab release-level credits → engine shapes ──────
const relRes = tidalReleaseArtists([
    { role: 'Producer',          names: [{ name: 'Ron Saint Germain', tidalId: '14254072' }] },
    { role: 'Assistant Engineer',names: [{ name: 'Jen Monnar', tidalId: null }] },
    { role: 'Vocals (Background)', names: [{ name: 'Keziah Jones', tidalId: '22' }] },
    { role: 'Music Publisher',   names: [{ name: 'Big Publishing House', tidalId: null }, { name: 'Copyright Control', tidalId: '15780' }] },
    { role: 'Primary Artist',    names: [{ name: 'Keziah Jones', tidalId: '22' }] },
    { role: 'Record Label',      names: [{ name: 'Because Music' }] },
]);
// Publisher → pre-formed label→work rel (Copyright Control filtered out)
assert.equal(relRes.publishers.length, 1);
assert.equal(relRes.publishers[0].linkType, 'publishing');
assert.equal(relRes.publishers[0].entityType, 'label');
assert.equal(relRes.publishers[0].artist.name, 'Big Publishing House');
assert.equal(relRes.publishers[0].track, undefined); // release-level → all works
// Artist credits bridged to Discogs role strings (mapped by the caller)
const byRole = Object.fromEntries(relRes.artists.map(a => [a.tidalRole, a]));
assert.equal(byRole['Producer'].role, 'Producer');
assert.equal(byRole['Assistant Engineer'].role, 'Engineer');
assert.equal(byRole['Assistant Engineer'].assistant, true);
assert.equal(byRole['Vocals (Background)'].role, 'Backing Vocals');
// Non-artist roles dropped + reported
assert.ok(relRes.skipped.some(s => /Primary Artist/.test(s)));
assert.ok(relRes.skipped.some(s => /Record Label/.test(s)));

// ── qobuzToEngine: parsed page credits → engine tracklist-rel shape ─────────
const qEng = qobuzToEngine([
    { index: 1, credits: [
        { name: 'Copyright Control', roles: ['MusicPublisher'] },
        { name: 'Kwadwo Donkoh',     roles: ['Producer'] },
        { name: 'Wulomei',           roles: ['MainArtist'] },
        { name: 'Nii Tei Ashitey',   roles: ['Composer', 'Lyricist'] },
    ] },
    { index: 2, credits: [
        { name: 'Mavuthela Music Co.', roles: ['MusicPublisher'] },
        { name: 'Some Engineer',       roles: ['Engineer', 'Mixer'] },
    ] },
]);
assert.deepEqual(qEng.tracklist, [
    { position: '1', title: '', type_: 'track' },
    { position: '2', title: '', type_: 'track' },
]);
// Copyright Control dropped; real publisher → skipped; MainArtist silent
assert.equal(qEng.skipped.length, 1);
assert.match(qEng.skipped[0], /Mavuthela/);
assert.deepEqual(qEng.tracklistRels.map(r => [r.track.position, r.linkType, r.artist.name]), [
    ['1', 'producer', 'Kwadwo Donkoh'],
    ['1', 'composer', 'Nii Tei Ashitey'],
    ['1', 'lyricist', 'Nii Tei Ashitey'],
    ['2', 'engineer', 'Some Engineer'],
    ['2', 'mix',      'Some Engineer'],
]);
assert.ok(qEng.tracklistRels.every(r => r.artist.resource_url === '' && r.entityType === 'artist'));

// og:title → album info
assert.equal(extractQobuzAlbumInfo('<meta property="og:title" content="Walatu Walasa, Wulomei - Qobuz"/>'),
    'Walatu Walasa, Wulomei');

console.log('sources-parse: all assertions passed');
