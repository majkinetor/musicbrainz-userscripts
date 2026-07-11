// Pure-node tests for the Deezer source parser (#401). No browser, no GM.
// deezer.js is self-contained (no engine imports), so it loads statically; the
// one registry check is loaded dynamically behind a window shim.
// Run: node test/deezer-parse.mjs
import assert from 'node:assert/strict';
import {
    parseDeezerCreditLine, extractDeezerCredits, extractDeezerAlbumInfo,
    parseDeezerAlbumUrl, deezerToEngine, decodeEntities,
} from '../src/sources/deezer.js';

// ── credit line: "Composers: <names>" → composer role, comma-split, "No Info" → none
assert.deepEqual(parseDeezerCreditLine('Composers: E. Davis'), [{ name: 'E. Davis', roles: ['composer'] }]);
assert.deepEqual(parseDeezerCreditLine('Composers: S. Manning, A. Lawrence'), [
    { name: 'S. Manning', roles: ['composer'] },
    { name: 'A. Lawrence', roles: ['composer'] },
]);
assert.deepEqual(parseDeezerCreditLine('Composers: No Info'), []);   // placeholder → no credit
assert.deepEqual(parseDeezerCreditLine('Composers:  '), []);         // empty → none
assert.deepEqual(parseDeezerCreditLine('Unmapped: Someone'), []);    // unknown label → dropped
assert.deepEqual(parseDeezerCreditLine('Producers: Someone'), [{ name: 'Someone', roles: ['producer'] }]); // best-effort other label

// entity decode
assert.equal(decodeEntities('Beyonc&#039; &amp; Co'), "Beyonc' & Co");
assert.deepEqual(parseDeezerCreditLine('Composers: Beyonc&#039;'), [{ name: "Beyonc'", roles: ['composer'] }]);

// ── HTML extraction — anchored by track id (contributors id === song itemid),
// so a "No Info" track and a reordered/duplicate row can't shift a credit.
const html = [
    '<tr class="song" itemid="/us/track/100"><span class="number" data-target="position">01</span></tr>',
    '<tr class="contributors" id="naboo_datagrid_contributors_100"><div data-target="contributors">Composers: No Info</div></tr>',
    '<tr class="song" itemid="/us/track/200"><span class="number" data-target="position">02</span></tr>',
    '<tr class="contributors" id="naboo_datagrid_contributors_200"><div data-target="contributors">Composers: E. Davis</div></tr>',
    '<tr class="song" itemid="/us/track/300"><span class="number" data-target="position">03</span></tr>',
    '<tr class="contributors" id="naboo_datagrid_contributors_300"><div data-target="contributors">Composers: S. Manning, A. Lawrence</div></tr>',
].join('\n');
const tracks = extractDeezerCredits(html);
assert.equal(tracks.length, 2);   // track 1 (No Info) excluded
assert.deepEqual(tracks[0], { index: 2, credits: [{ name: 'E. Davis', roles: ['composer'] }] });
assert.deepEqual(tracks[1], { index: 3, credits: [
    { name: 'S. Manning', roles: ['composer'] },
    { name: 'A. Lawrence', roles: ['composer'] },
] });

// a contributors row with no matching song row (id absent) is skipped, not mis-indexed
assert.deepEqual(extractDeezerCredits(
    '<tr class="contributors" id="naboo_datagrid_contributors_999"><div data-target="contributors">Composers: Ghost</div></tr>',
), []);

// og:title → album info
assert.equal(extractDeezerAlbumInfo('<meta property="og:title" content="Calypso"/>'), 'Calypso');

// ── URL parser: locale-less, any 2-letter locale, protocol-relative → /us/ page
assert.deepEqual(parseDeezerAlbumUrl('https://www.deezer.com/album/12166410'),
    { id: '12166410', pageUrl: 'https://www.deezer.com/us/album/12166410' });
assert.equal(parseDeezerAlbumUrl('//deezer.com/fr/album/12166410').pageUrl, 'https://www.deezer.com/us/album/12166410');
assert.equal(parseDeezerAlbumUrl('https://deezer.com/en/album/999').id, '999');
assert.equal(parseDeezerAlbumUrl('https://www.deezer.com/us/artist/123'), null);
assert.equal(parseDeezerAlbumUrl('https://example.com/album/1'), null);

// ── deezerToEngine: parsed credits → engine tracklist-rel shape (names only)
const eng = deezerToEngine([
    { index: 2, credits: [{ name: 'E. Davis', roles: ['composer'] }] },
    { index: 10, credits: [{ name: 'S. Manning', roles: ['composer'] }, { name: 'A. Lawrence', roles: ['composer'] }] },
]);
assert.deepEqual(eng.tracklist, [
    { position: '2', title: '', type_: 'track' },
    { position: '10', title: '', type_: 'track' },
]);
assert.deepEqual(eng.tracklistRels.map(r => [r.track.position, r.linkType, r.artist.name]), [
    ['2', 'composer', 'E. Davis'],
    ['10', 'composer', 'S. Manning'],
    ['10', 'composer', 'A. Lawrence'],
]);
assert.ok(eng.tracklistRels.every(r => r.artist.resource_url === '' && r.entityType === 'artist'));

console.log('deezer-parse: all assertions passed');
