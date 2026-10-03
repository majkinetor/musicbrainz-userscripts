// #669: 7digital, through its catalogue API with the key its web store ships (no login):
//   the barcode   602508436901 (KIWANUKA): 7digital stores it as 00602508436901, so only the
//                 14-digit form finds it → release 10569454, 14 tracks, 2019, Polydor Records
//   the search    "Daft Punk Random Access Memories", no barcode → release 2726546, 13 tracks
//   the link      uk.7digital.com/…/kiwanuka-10569454 → found again by search, with its barcode
//   a stale key   is refused (401) and replaced by the one in the store's app.js
//   no album      Mocky's "Music Will Explain" isn't on 7digital: nothing is picked
// On the sandbox, a release page, so the script and its hook are in; nothing is added.
import { test, check } from '../../../dev/test/harness.mjs';
import { openPc } from './pc.mjs';

test.use({ gm: { name: 'Platform Check' } });
const RELEASE = 'ec116461-5b0d-4c98-bb44-a4de5de63076';   // any sandbox release: the page only hosts the script
const KIWANUKA = 'https://uk.7digital.com/artist/michael-kiwanuka/release/kiwanuka-10569454';

test('7digital: found by barcode in any GTIN form, by search, and from a link; a refused key is replaced', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  await openPc(page, inject, { release: RELEASE, settle: false });
  await page.waitForFunction(() => !!window.__pcTest669, null, { timeout: 30000 });

  const r = await page.evaluate(async KIWANUKA => {
    const S = window.__pcTest669, out = {};
    const scan = async (mbid, a) => { await S.scanSevendigital({ mbid, isVariousArtists: false, barcode: '', ...a }); return S.cacheGet(mbid, 'sevendigital'); };
    out.barcode = await scan('test-669-barcode', { artist: 'Michael Kiwanuka', album: 'KIWANUKA', mbTracks: 14, barcode: '602508436901' });
    out.search = await scan('test-669-search', { artist: 'Daft Punk', album: 'Random Access Memories', mbTracks: 13 });
    out.link = await scan('test-669-link', { artist: 'Michael Kiwanuka', album: 'KIWANUKA', mbTracks: 14, existingUrl: KIWANUKA });
    S.setSdKey('refused0key');
    out.staleKey = await scan('test-669-stale', { artist: 'Yumi Zouma', album: 'No Love Lost to Kindness', mbTracks: 12, barcode: '067003181754' });
    out.key = await S.sdKey();
    out.none = await scan('test-669-none', { artist: 'Mocky', album: 'Music Will Explain (Choir Music Vol. 1)', mbTracks: 10, barcode: '659457250430' });
    out.refs = [KIWANUKA, 'https://www.7digital.com/artist/x/release/now-118-50739681?partner=1', 'https://us.7digital.com/artist/daft-punk'].map(S.sdRef);
    return out;
  }, KIWANUKA);
  console.log(JSON.stringify(r, null, 1));
  const b = r.barcode || {};
  check(b.url === KIWANUKA && b.source === 'barcode' && b.barcode === '00602508436901', `the barcode finds KIWANUKA in its 14-digit form (${JSON.stringify(b)})`);
  check(b.tracks === 14 && b.year === '2019' && b.label === 'Polydor Records', `…with its track count, year and label`);
  check(r.search && /\/release\/random-access-memories-2726546$/.test(r.search.url || '') && r.search.tracks === 13, `artist and title find Random Access Memories (${JSON.stringify(r.search)})`);
  check(r.link && r.link.url === KIWANUKA && r.link.source === 'MB rels' && r.link.barcode === '00602508436901', `a linked release is read by search (${JSON.stringify(r.link)})`);
  check(r.staleKey && /no-love-lost-to-kindness-58796129$/.test(r.staleKey.url || '') && r.key !== 'refused0key', `a refused key is replaced (${r.key}) and the lookup goes on`);
  check(r.none && r.none.url === null, `an album 7digital lacks: nothing is picked (${JSON.stringify(r.none)})`);
  check(JSON.stringify(r.refs) === JSON.stringify([{ id: '10569454', country: 'GB' }, { id: '50739681', country: null }, null]), `release links only, with their store's country (${JSON.stringify(r.refs)})`);
});
