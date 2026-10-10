// #709: PC's Mission Control finding carries the platform's track count and format, and its why
// gives every reason against the link, a different track count first: "10 tracks, the release
// has 13 · barcode not confirmed", where it used to say only "barcode not confirmed". The
// reasons that say it is another release are in mismatch, which MC marks and take all in skips.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Platform Check', values: { 'pc:barcode-mode': 'strict' } } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // sandbox copy of "Bad Boys!" (dev/test/sandbox-copies.json)

test('#709: the MC finding says the track count and format', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('platform_check', { waitFor: '__pcTest680' });
  await page.evaluate(() => window.__pcTest680.pcScan());
  const r = await page.evaluate(mbid => {
    const t = window.__pcTest680, n = parseInt(t.mbDataGet(mbid).mbTracks, 10);
    // a streaming album with fewer tracks and no barcode, one with the same count, and a vinyl and
    // a digital Bandcamp album, each with the right count
    t.cacheSet(mbid, 'ytmusic', { url: 'https://music.youtube.com/playlist?list=OLAK5uy_x', tracks: n - 3, source: 'search', barcode: null });
    t.cacheSet(mbid, 'amazonmusic', { url: 'https://music.amazon.com/albums/B000TETKHQ', tracks: n, source: 'search', barcode: null });
    t.cacheSet(mbid, 'bandcamp', { url: 'https://x.bandcamp.com/album/y', tracks: n, format: 'Vinyl', source: 'search', barcode: null });
    const vinyl = t.pcMcFinding('bandcamp');
    t.cacheSet(mbid, 'bandcamp', { url: 'https://x.bandcamp.com/album/y', tracks: n, format: 'Digital', source: 'search', barcode: null });
    return { n, fmt: t.mbFormat(), yt: t.pcMcFinding('ytmusic'), am: t.pcMcFinding('amazonmusic'), vinyl, digital: t.pcMcFinding('bandcamp') };
  }, RELEASE);
  console.log(JSON.stringify(r, null, 1));
  check(r.fmt === 'CD', `the sandbox release is a CD (${r.fmt})`);
  const short = `${r.n - 3} tracks, the release has ${r.n}`, dig = 'Digital, the release is CD', bc = 'barcode not confirmed';
  check(r.yt.state === 'withheld' && r.yt.tracks === r.n - 3 && r.yt.mbTracks === r.n, 'YouTube Music carries its track count and the release\'s');
  check(r.yt.why === [short, dig, bc].join(' · ') && r.yt.mismatch.join() === [short, dig].join(), `its why leads with the track count, then the format (${r.yt.why})`);
  check(r.am.why === [dig, bc].join(' · ') && r.am.mismatch.join() === dig, `a matching track count adds nothing (${r.am.why})`);
  check(r.vinyl.format === 'Vinyl' && r.vinyl.why === bc && !r.vinyl.mismatch, `vinyl on a CD is physical too: no mismatch (${r.vinyl.why})`);
  check(r.digital.mismatch.join() === dig && r.digital.why === [dig, bc].join(' · '), `a digital Bandcamp album on a CD says so once, not again as "format not confirmed" (${r.digital.why})`);
});
