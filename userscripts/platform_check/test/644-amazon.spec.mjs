// #644: Amazon Music, looked up by name. Against the live API Amazon Music's web player uses, as a
// guest (no login):
//   the search   "Daft Punk Random Access Memories" → the albums, with their ids and years; two
//                editions carry the plain title (B00CRMWMZ0 and B07VPL71Z8)
//   the page     B00CRMWMZ0: 13 songs, Daft Punk, May 17 2013, "Album"
//   Bonobo       "Bonobo Migration" → Migration (2017), first
//   a barcode    886443927087 finds no album: Amazon Music has no barcode search, which is why
//                the row is found by name only
// On the sandbox, a release page, so the script and its hook are in; nothing is added.
import { test, check } from '../../../dev/test/harness.mjs';
import { openPc } from './pc.mjs';

test.use({ gm: { name: 'Platform Check' } });
const RELEASE = 'ec116461-5b0d-4c98-bb44-a4de5de63076';   // any sandbox release: the page only hosts the script

test('Amazon Music: albums by name, read from their page; a barcode finds nothing', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  await openPc(page, inject, { release: RELEASE, settle: false });
  await page.waitForFunction(() => !!window.__pcTest644, null, { timeout: 30000 });

  const r = await page.evaluate(async () => {
    const A = window.__pcTest644, out = {};
    const search = async q => A.amzAlbumResults(await A.amzCall('showSearch', {
      filter: JSON.stringify({ IsLibrary: ['false'] }),
      keyword: JSON.stringify({ interface: 'Web.TemplatesInterface.v1_0.Touch.SearchTemplateInterface.SearchKeywordClientInformation', keyword: q }),
      suggestedKeyword: q, userHash: JSON.stringify({ level: 'LIBRARY_MEMBER' }),
    }));
    out.ram = await search('Daft Punk Random Access Memories');
    out.album = await A.fetchAmzAlbum('B00CRMWMZ0');
    out.byName = (await search('Bonobo Migration'))[0] || null;
    out.barcode = await search('886443927087');
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  const plain = r.ram.filter(a => a.title === 'Random Access Memories' && a.artist === 'Daft Punk').map(a => a.id);
  check(plain.includes('B00CRMWMZ0') && plain.length >= 2, `the search finds Random Access Memories, in more than one edition (${plain.join(', ')})`);
  check(r.ram.every(a => /^[A-Z0-9]{10}$/.test(a.id)) && r.ram.some(a => a.year === '2013'), `each with its id, and its year (${JSON.stringify(r.ram.slice(0, 3))})`);
  check(r.album && r.album.tracks === 13 && r.album.artist === 'Daft Punk' && r.album.year === '2013' && r.album.title === 'Random Access Memories', `its page: 13 songs, Daft Punk, 2013 (${JSON.stringify(r.album)})`);
  check(r.album && /Columbia Records/.test(r.album.label || '') && !/^\(P\)|2013/.test(r.album.label), `the label, from the page's ℗ line without its year (${r.album && r.album.label})`);
  check(r.album && r.album.url === 'https://music.amazon.com/albums/B00CRMWMZ0', `…and its link (${r.album && r.album.url})`);
  check(r.byName && r.byName.title === 'Migration' && r.byName.artist === 'Bonobo', `"Bonobo Migration" → Migration, first (${JSON.stringify(r.byName)})`);
  check(!r.barcode.some(a => /Random Access Memories/.test(a.title)), `a barcode finds no album (${r.barcode.length} unrelated)`);
});
