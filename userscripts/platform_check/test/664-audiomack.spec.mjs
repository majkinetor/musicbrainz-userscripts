// #664: Audiomack, through its signed API (the web player's public consumer key, no login):
//   the album   burna-boy/album/no-sign-of-weakness-6579609: 16 songs, barcode 075679623539, 2025,
//               ℗ "Spaceship/ Bad Habit/ Atlantic Records"
//   a song      burna-boy/song/tatata-feat-travis-scott-2564133: one song, barcode 075679620514
//   the search  "Burna Boy No Sign of Weakness" → several uploads of the album, the 6579609 one among them
//   the lookup  with no link, picks that upload by its barcode over the other copies
// On the sandbox, a release page, so the script and its hook are in; nothing is added.
import { test, check } from '../../../dev/test/harness.mjs';
import { openPc } from './pc.mjs';

test.use({ gm: { name: 'Platform Check' } });
const RELEASE = 'ec116461-5b0d-4c98-bb44-a4de5de63076';   // any sandbox release: the page only hosts the script

test('Audiomack: signed calls read an album and a song, with their barcodes; search finds the album', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  await openPc(page, inject, { release: RELEASE, settle: false });
  await page.waitForFunction(() => !!window.__pcTest664, null, { timeout: 30000 });

  const r = await page.evaluate(async () => {
    const A = window.__pcTest664, out = {};
    out.album = await A.fetchAudiomack('https://audiomack.com/burna-boy/album/no-sign-of-weakness-6579609');
    out.song = await A.fetchAudiomack('https://www.audiomack.com/burna-boy/song/tatata-feat-travis-scott-2564133?x=1');
    const s = await A.audiomackGet('search', { q: 'Burna Boy No Sign of Weakness', show: 'albums', limit: '10' });
    out.search = (s.results || []).map(h => `${h.uploader && h.uploader.url_slug}/${h.url_slug}`);
    out.ref = A.audiomackRef('https://audiomack.com/burna-boy');
    // the whole lookup, with no MB link: the upload carrying MB's barcode wins over the other copies
    await A.scanAudiomack({ artist: 'Burna Boy', album: 'No Sign of Weakness', mbTracks: 16, mbid: 'test-664-scan', isVariousArtists: false, barcode: '075679623539' });
    out.scan = A.cacheGet('test-664-scan', 'audiomack');
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  const a = r.album || {};
  check(a.tracks === 16 && a.barcode === '075679623539' && a.year === '2025', `the album: 16 songs, its barcode, 2025 (${JSON.stringify(a)})`);
  check(a.label === 'Spaceship/ Bad Habit/ Atlantic Records', `the label, from the ℗ line (${a.label})`);
  check(a.url === 'https://audiomack.com/burna-boy/album/no-sign-of-weakness-6579609', `…and its link (${a.url})`);
  check(r.song && r.song.tracks === 1 && r.song.barcode === '075679620514', `a song is one track, with its own barcode (${JSON.stringify(r.song)})`);
  check(r.search.includes('burna-boy/no-sign-of-weakness-6579609'), `the search finds the album (${r.search.join(', ')})`);
  check(r.scan && r.scan.url === 'https://audiomack.com/burna-boy/album/no-sign-of-weakness-6579609' && r.scan.barcode === '075679623539', `found by search, the copy with MB's barcode (${JSON.stringify(r.scan)})`);
  check(r.ref === null, `an artist page is no release`);
});
