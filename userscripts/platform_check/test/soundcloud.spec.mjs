// SoundCloud as a link-derived provider (#439), and what it trusts (#527).
//
// #439: a release's SoundCloud SET link is fetched from the anonymous api-v2, which gives
//       the set's barcode (upc_or_ean), track count and label; a single-track release's
//       link to a bare TRACK is recognised as its SoundCloud link, with one track.
// #527 (majkinetor): "Platform Check picks a random Soundcloud URL from the recordings of
//       a release with 11 tracks." A bare-track URL on a multi-track release is not the
//       release's own link: it is not trusted as one, and a search runs instead.
//
// test.musicbrainz.org (copies of the releases), with production's data and SoundCloud's
// answers replayed from fixtures/ws-439*.json.gz, ws-527.json.gz (RECORD_WS=1 re-records).
import { test, check } from '../../../dev/test/harness.mjs';
import { openPc, row, cached } from './pc.mjs';

test.use({ gm: { name: 'Platform Check' } });
const KAWAIITRAP = 'ec2449a8-3dc5-461c-80a1-e43d96345613';   // 10 tracks, links a SoundCloud set
const ICE_PUNCH = '6e569b63-124b-47a6-ba2f-e8af96d2d1bc';    // 1 track, links a SoundCloud track
const SC_SET = 'https://soundcloud.com/cltxx/sets/reincarnate-4';   // a set with upc_or_ean 8058365652237
const SC_TRACK = 'https://soundcloud.com/ace-uzumakii/ice-punch-w-lil-pokedexxx-prod-gyptxvn-honk';

test('#439: a SoundCloud set gives its barcode, track count and label', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  const ws = await openPc(page, inject, { release: KAWAIITRAP, links: { drop: /soundcloud\.com/, add: [SC_SET] }, replay: new URL('./fixtures/ws-439-set.json.gz', import.meta.url) });
  const c = await cached(page, 'soundcloud');
  check((await row(page, 'soundcloud')).exists, 'the SoundCloud row is on the panel');
  check(c && /soundcloud\.com\/cltxx\/sets\/reincarnate-4/.test(c.url || ''), `the set link is the release's SoundCloud link (${c && c.url})`);
  check(c && c.barcode === '8058365652237', `its barcode, from upc_or_ean (${c && c.barcode})`);
  check(c && c.tracks === 3, `its track count (${c && c.tracks})`);
  check(c && c.label === 'Blacklapse Records', `its label, from publisher_metadata (${c && c.label})`);
  await ws.done();
});

test('#439: a single-track release links a bare track', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  const ws = await openPc(page, inject, { release: ICE_PUNCH, replay: new URL('./fixtures/ws-439-track.json.gz', import.meta.url) });
  const c = await cached(page, 'soundcloud');
  check(c && c.url && c.url.includes('ice-punch-w-lil-pokedexxx'), `the track URL is the release's SoundCloud link (${c && c.url})`);
  check(c && c.tracks === 1, `with one track (${c && c.tracks})`);
  check(c && c.source === 'MB rels', `taken from the release's links (${c && c.source})`);
  await ws.done();
});

test('#527: a bare-track URL on a multi-track release is not trusted as its link', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  const ws = await openPc(page, inject, { release: KAWAIITRAP, links: { drop: /soundcloud\.com/, add: [SC_TRACK] }, replay: new URL('./fixtures/ws-527.json.gz', import.meta.url) });
  const c = await cached(page, 'soundcloud');
  check(c && c.url !== SC_TRACK, `the one-track URL is not taken as the 10-track release's (${c && c.url})`);
  check(c && c.source === 'search', `a search runs instead of trusting it (source: ${c && c.source})`);
  check(c && /\/sets\/ace-uzumakii-kawaiitrap/.test(c.url || '') && c.tracks === 10, `…and finds the release's own set (${c && c.url}, ${c && c.tracks} tracks)`);
  await ws.done();
});
