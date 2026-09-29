// #627 (chaban-mb): Apple from Apple Music's own catalogue (amp-api) instead of the iTunes
// Search API. Against the live API, the cases the issue and the verdict named:
//   808391067776   both APIs list two albums, the wrong one first; only amp-api says which is
//                  which (its UPC), and the pick is the album whose UPC it is
//   853435003333   iTunes counted 20 tracks (a digital booklet); amp-api has the 19 songs
//   3615938016152  11 tracks, one a music video: the count is the 10 songs
//   the token      a rotated (refused) token is replaced, once, and the read goes through
// On the sandbox, a release page, so the script and its hook are in; Apple is read, nothing else.
import { test, check, answerGm } from '../../../dev/test/harness.mjs';
import { openPc } from './pc.mjs';

test.use({ gm: { name: 'Platform Check' } });
const RELEASE = 'ec116461-5b0d-4c98-bb44-a4de5de63076';   // any sandbox release: the page only hosts the script

test('Apple: the album whose UPC it is, songs only, and a refused token replaced', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  await openPc(page, inject, { release: RELEASE, settle: false });
  await page.waitForFunction(() => !!window.__pcTest627, null, { timeout: 30000 });

  const r = await page.evaluate(async () => {
    const A = window.__pcTest627, out = {};
    const byUpc = async upc => (await A.appleAmp(`us/albums?filter[upc]=${upc}`)).data || [];

    const coll = await byUpc('808391067776');
    out.collision = { listed: coll.map(a => a.attributes.upc), picked: (A.applePickByUpc(coll, '808391067776') || { attributes: {} }).attributes.upc };

    const deluxe = A.applePickByUpc(await byUpc('853435003333'), '853435003333');
    out.booklet = deluxe && A.appleAlbumMeta(deluxe);

    const robot = A.applePickByUpc(await byUpc('3615938016152'), '3615938016152');
    out.video = robot && A.appleAlbumMeta(robot);

    out.storefront = [A.appleStorefront('https://music.apple.com/de/album/x/123'), A.appleStorefront(null)];
    return out;
  });
  // a refused token. Live, Apple's own session cookies carry a read whatever the token says, so a
  // refusal can't be had on demand: the stale token's read is answered 401 here, as Apple does without them
  answerGm(page.context(), o => /amp-api.music.apple.com/.test(o.url) && /Bearer eyJx{20}/.test((o.headers || {}).Authorization || '') ? { status: 401, body: '' } : null);
  r.token = await page.evaluate(async () => {
    const A = window.__pcTest627;
      // a refused token: the next read fetches a new one and goes through
      const bad = 'eyJ' + 'x'.repeat(120);
      A.setAppleToken(bad);
      localStorage.setItem('mbtools:apple-token', JSON.stringify({ t: bad, at: Date.now() }));
      const again = await A.appleAmp('us/albums/626937421').then(j => j.data || []).catch(e => ({ err: e.message }));   // a URL not read yet
      return { ok: Array.isArray(again) && again.length > 0, fresh: JSON.parse(localStorage.getItem('mbtools:apple-token')).t.slice(0, 8) };

    });
  console.log(JSON.stringify(r, null, 1));
  check(r.collision.listed.length >= 2 && r.collision.listed[0] !== '808391067776', `808391067776: Apple lists another album first (${r.collision.listed.join(', ')})`);
  check(r.collision.picked === '808391067776', `…and the pick is the album with that UPC (${r.collision.picked})`);
  check(r.booklet && r.booklet.tracks === 19 && r.booklet.barcode === '853435003333', `853435003333: 19 tracks, not the 20 iTunes counted, with its UPC (${JSON.stringify(r.booklet)})`);
  check(r.video && r.video.tracks === 10 && /1 video\(s\) left out/.test(r.video.tracksNote), `3615938016152: the 10 songs, the video left out (${JSON.stringify(r.video)})`);
  check(r.token.ok && r.token.fresh !== 'eyJxxxxx', `a refused token is replaced and the read goes through (${JSON.stringify(r.token)})`);
  check(r.storefront[0] === 'de' && r.storefront[1] === 'us', `the storefront comes from the release's link, else us (${r.storefront})`);
});
