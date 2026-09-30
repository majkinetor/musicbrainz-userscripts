// #639 (oblaka on Discord, majkinetor): YouTube Music, looked up by barcode and by name.
// Against the live API YouTube Music's web player uses, anonymously:
//   886443927087  Random Access Memories: the barcode, searched with the albums filter, finds
//                 the album; its page gives 13 songs, 2013, Daft Punk and its playlist link
//   the link      that playlist link leads back to the same album (an MB link is read this way)
//   Bonobo        artist + album with the albums filter: Migration, first
//   817231012890  Moderat's III (Deluxe Edition): the barcode finds another edition, which
//                 the track count and title must catch — a candidate is never a match by itself
// On the sandbox, a release page, so the script and its hook are in; nothing is added.
import { test, check } from '../../../dev/test/harness.mjs';
import { openPc } from './pc.mjs';

test.use({ gm: { name: 'Platform Check' } });
const RELEASE = 'ec116461-5b0d-4c98-bb44-a4de5de63076';   // any sandbox release: the page only hosts the script

test('YouTube Music: an album by barcode and by name, read from its page, and a sibling edition caught', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  await openPc(page, inject, { release: RELEASE, settle: false });
  await page.waitForFunction(() => !!window.__pcTest639, null, { timeout: 30000 });

  const r = await page.evaluate(async () => {
    const Y = window.__pcTest639, out = {};
    const search = async q => Y.ytmAlbumResults(await Y.ytmCall('search', { query: q, params: Y.YTM_ALBUMS_FILTER }));

    const ram = await search('886443927087');
    out.barcode = ram[0] || null;
    out.album = ram[0] ? await Y.fetchYtmAlbum(ram[0].id) : null;
    out.back = out.album ? await Y.ytmAlbumIdOf(out.album.url) : null;

    out.byName = (await search('Bonobo Migration'))[0] || null;

    const moderat = await search('817231012890');
    out.sibling = moderat[0] ? await Y.fetchYtmAlbum(moderat[0].id) : null;
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  check(r.barcode && r.barcode.title === 'Random Access Memories' && /Daft Punk/.test(r.barcode.artist) && /^MPREb_/.test(r.barcode.id), `886443927087 → Random Access Memories by Daft Punk, first (${JSON.stringify(r.barcode)})`);
  check(r.album && r.album.tracks === 13 && r.album.year === '2013' && r.album.artist === 'Daft Punk', `its page: 13 songs, 2013, Daft Punk (${JSON.stringify(r.album)})`);
  check(r.album && /^https:\/\/music\.youtube\.com\/playlist\?list=OLAK5uy_[\w-]+$/.test(r.album.url), `…and its playlist link (${r.album && r.album.url})`);
  check(r.back === r.barcode.id, `the playlist link leads back to the same album (${r.back})`);
  check(r.byName && r.byName.title === 'Migration' && r.byName.artist === 'Bonobo' && r.byName.year === '2017', `"Bonobo Migration" → Migration (2017), first (${JSON.stringify(r.byName)})`);
  check(r.sibling && r.sibling.title !== 'III (Deluxe Edition)', `817231012890 lands on another edition ("${r.sibling && r.sibling.title}", ${r.sibling && r.sibling.tracks} songs) — which is why every candidate is verified`);
});
