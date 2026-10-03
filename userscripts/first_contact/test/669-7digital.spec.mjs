// #669: 7digital. The release page gives the title, the release artist with their page, the label and
// the tracklist (each track's id, title and length); 7digital's catalogue API, with the key its web
// store ships, gives the barcode, type, date, discs and each track's ISRC, found by search.
//
// Fixture: fixtures/669-kiwanuka.html, the uk.7digital.com page of Michael Kiwanuka's KIWANUKA
// (release 10569454), trimmed to the release block, its tracklist and the ℗ / © lines below it, with
// a digital booklet's row added to the tracklist, as on Origins (Deluxe): a live release page asks a
// headless browser to prove it is human. The API answers live. 7digital stores its barcode as
// 00602508436901; the release date is 23 July 2020, which the API writes as 2020-07-22T23:00:00Z.
import { test, check, sourceOf } from '../../../dev/test/harness.mjs';
import { readFile } from 'node:fs/promises';

test.use({ gm: { name: 'First Contact' } });
const text = c => c.map(a => a.name + a.join).join('');
const PATH = '/artist/michael-kiwanuka/release/kiwanuka-10569454';

test('7digital: the page and the API, with ISRCs, barcode, type and date; a refused key is replaced', { tag: ['@web'] }, async ({ page }) => {
  await page.goto('about:blank');
  await page.evaluate(c => (0, eval)(c), await readFile(sourceOf('first_contact'), 'utf8'));
  const html = await readFile(new URL('./fixtures/669-kiwanuka.html', import.meta.url), 'utf8');
  const r = await page.evaluate(async ([path, h]) => {
    const sd = window.__fcTest.providers.find(p => p.id === 'sevendigital');
    sd.key = 'refused0key';
    const rel = await sd.fetchRelease(path, null, new DOMParser().parseFromString(h, 'text/html'));
    const ids = [path, '/artist/x/release/now-thats-what-i-call-music-118-50739681/', '/artist/michael-kiwanuka', '/search'].map(pathname => sd.albumId({ pathname }));
    const hosts = ['uk.7digital.com', 'us.7digital.com', 'www.7digital.com', 'shop.example.com'].map(h => sd.host.test(h));
    const names = [['Jax Jones & Zoe Wees', ''], ['MEDUZA;OneRepublic;Leony', ''], ['Calvin Harris x Rag\'n\'Bone Man', ''], ['Simon & Garfunkel', 'Simon & Garfunkel']].map(([l, own]) => sd.names(l, own));
    return { rel, ids, hosts, names, key: sd.key };
  }, [PATH, html]);
  const rel = r.rel, tracks = rel.mediums.flatMap(m => m.tracks);
  check(rel.title === 'KIWANUKA' && text(rel.credit) === 'Michael Kiwanuka' && rel.credit[0].url === 'https://uk.7digital.com/artist/michael-kiwanuka', `title and credit, the artist linked: ${rel.title} — ${text(rel.credit)} ${rel.credit[0].url}`);
  check(rel.barcode === '0602508436901', `the barcode, as an EAN-13: ${rel.barcode}`);
  check(rel.types[0] === 'Album' && rel.labels.length === 1 && rel.labels[0].name === 'Polydor Records', `type and label: ${JSON.stringify(rel.types)} ${JSON.stringify(rel.labels)}`);
  check(rel.date.year === 2020 && rel.date.month === 7 && rel.date.day === 23, `the date is the store's day, not UTC's: ${JSON.stringify(rel.date)}`);
  check(rel.mediums.length === 1 && tracks.length === 14 && tracks.every(t => /^GBUM719\d{5}$/.test(t.isrc || '') && t.lengthMs > 0), `14 tracks, each with its ISRC and length; the booklet is not one (${tracks.length})`);
  check(tracks[7].title === 'Hero (Intro)' && tracks[8].title === 'Hero' && tracks[8].isrc === 'GBUM71903002', `"Hero (Intro)" and "Hero" each get their own ISRC (${tracks[7].isrc}, ${tracks[8].isrc})`);
  check(rel.annotation === '℗ 2019 Polydor Limited\n© 2019 Polydor Limited', `the ℗ and © lines are the annotation: ${JSON.stringify(rel.annotation)}`);
  check(rel.urls.length === 1 && rel.urls[0].url === 'https://uk.7digital.com' + PATH && rel.urls[0].linkType === 74, `link: ${JSON.stringify(rel.urls)}`);
  check(r.key !== 'refused0key', `the refused key was replaced (${r.key})`);
  check(JSON.stringify(r.ids) === JSON.stringify([PATH, '/artist/x/release/now-thats-what-i-call-music-118-50739681', null, null]), `release pages only: ${JSON.stringify(r.ids)}`);
  check(JSON.stringify(r.hosts) === '[true,true,true,false]', `7digital's stores: ${JSON.stringify(r.hosts)}`);
  check(JSON.stringify(r.names) === JSON.stringify([['Jax Jones', 'Zoe Wees'], ['MEDUZA', 'OneRepublic', 'Leony'], ['Calvin Harris', 'Rag\'n\'Bone Man'], ['Simon & Garfunkel']]), `artist lines split, the release's own artist kept whole: ${JSON.stringify(r.names)}`);
});
