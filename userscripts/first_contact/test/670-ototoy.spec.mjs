// #670: Ototoy. Everything comes from the album page itself: the title, the album artist with their
// page, "DISC n" rows, each track's title, length and linked artists, the original release date, the
// label with its page, and the album info. No barcode, ISRCs or type.
//
// Fixtures, trimmed to the album block, the tracklist and the album info (no network needed):
//   670-science-fiction.html  宇多田ヒカル, SCIENCE FICTION (hi-res, p/2062395): 2 discs of 12 and 14,
//                             released 2024-04-09 on Ototoy, originally 2024-04-10, Universal Music LLC
//   670-freedom.html          クリオネP, FREEDOM (p/3680752): 14 tracks, each "(feat. …)" with its artists linked
import { test, check, sourceOf } from '../../../dev/test/harness.mjs';
import { readFile } from 'node:fs/promises';

test.use({ gm: { name: 'First Contact' } });
const text = c => c.map(a => a.name + a.join).join('');
const fixture = name => readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('Ototoy: an album page, with discs, track artists and the original release date', { tag: ['@unit'] }, async ({ page }) => {
  await page.goto('about:blank');
  await page.evaluate(c => (0, eval)(c), await readFile(sourceOf('first_contact'), 'utf8'));
  const read = (id, h) => page.evaluate(([id, h]) => window.__fcTest.providers.find(p => p.id === 'ototoy').fetchRelease(id, null, new DOMParser().parseFromString(h, 'text/html')), [id, h]);

  const sf = await read('2062395', await fixture('670-science-fiction.html'));
  check(sf.title === 'SCIENCE FICTION' && text(sf.credit) === '宇多田ヒカル' && sf.credit[0].url === 'https://ototoy.jp/_/default/a/536', `title and credit, the artist linked: ${sf.title} — ${text(sf.credit)} ${sf.credit[0].url}`);
  check(sf.mediums.length === 2 && sf.mediums[0].tracks.length === 12 && sf.mediums[1].tracks.length === 14, `two discs, 12 + 14 (${sf.mediums.map(m => m.tracks.length).join(' + ')})`);
  check(sf.mediums[0].tracks[0].title === 'Addicted To You (Re-Recording)' && sf.mediums[0].tracks[0].lengthMs === 268000, `the first track and its length: ${JSON.stringify(sf.mediums[0].tracks[0])}`);
  check(sf.date.year === 2024 && sf.date.month === 4 && sf.date.day === 10, `the original release date, not Ototoy's listing date: ${JSON.stringify(sf.date)}`);
  check(sf.labels.length === 1 && sf.labels[0].name === 'Universal Music LLC' && sf.labels[0].url === 'https://ototoy.jp/labels/268146', `label: ${JSON.stringify(sf.labels)}`);
  check(sf.barcode === null && sf.types.length === 0 && sf.country === 'JP', `no barcode, the type guessed later, Japan: ${sf.barcode} ${JSON.stringify(sf.types)} ${sf.country}`);
  check(/^1998年12月9日リリース/.test(sf.annotation || ''), `the album info is the annotation: ${(sf.annotation || '').slice(0, 30)}`);
  check(sf.urls.length === 1 && sf.urls[0].url === 'https://ototoy.jp/_/default/p/2062395' && sf.urls[0].linkType === 74, `link: ${JSON.stringify(sf.urls)}`);

  const fr = await read('3680752', await fixture('670-freedom.html'));
  const tracks = fr.mediums.flatMap(m => m.tracks);
  check(tracks.length === 14 && fr.mediums.length === 1, `FREEDOM: 14 tracks on one medium (${tracks.length})`);
  check(tracks[0].title === 'メリーゴーランド' && text(tracks[0].credit) === 'クリオネP feat. IA' && tracks[0].credit[1].url === 'https://ototoy.jp/_/default/a/160144', `"(feat. IA)" leaves the title for the credit, IA linked: ${tracks[0].title} — ${text(tracks[0].credit)}`);
  check(text(tracks[2].credit) === 'クリオネP feat. IA & 重音テト', `two featured artists: ${text(tracks[2].credit)}`);

  const ids = await page.evaluate(() => {
    const o = window.__fcTest.providers.find(p => p.id === 'ototoy');
    return { ids: ['/_/default/p/2062395', '/_/default/p/2062395/', '/_/default/a/536', '/labels/268146'].map(pathname => o.albumId({ pathname })),
      titles: ['Live Archives Disc2(24bit/44.1kHz)', 'Album (dsd+mp3)', 'Song (feat. IA)', 'Kid A (Remastered)'].map(t => t.replace(o.FORMAT, '')) };
  });
  check(JSON.stringify(ids.ids) === JSON.stringify(['2062395', '2062395', null, null]), `album pages only: ${JSON.stringify(ids.ids)}`);
  check(JSON.stringify(ids.titles) === JSON.stringify(['Live Archives Disc2', 'Album', 'Song (feat. IA)', 'Kid A (Remastered)']), `the sold format leaves the title, nothing else does: ${JSON.stringify(ids.titles)}`);
});
