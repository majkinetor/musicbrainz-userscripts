// #650: the Discogs provider, from the public API.
//
// Fixtures:
//   4570366  Daft Punk, "Random Access Memories", 2×LP: sides A–D become two 12" Vinyl mediums (6 + 7)
//            numbered A1…; Columbia listed twice with its catalog number written two ways.
//   4078875  "De Maxx Long Player 25", Various, 2×CD compilation: medium headings, track artists
//            joined with "Feat.", an artist credited under another name (DJ Fresh for Fresh).
//
// The provider runs on a sandbox page (the Discogs site itself may challenge a headless
// browser); the vinyl one is then seeded into the sandbox release editor, which must take it
// without a seed error.
import { test, check, until, requireLogin, settled, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'First Contact' } });

async function read(page, inject, id) {
  await page.goto(SANDBOX + '/', { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  return page.evaluate(async id => {
    const dc = window.__fcTest.providers.find(p => p.id === 'discogs');
    return dc.fetchRelease(id);
  }, id);
}
const text = c => c.map(a => a.name + a.join).join('');

test('a 2×LP: sides become two 12" vinyl mediums, labels kept once, seeded without errors', { tag: ['@web', '@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
  const rel = await read(page, inject, '4570366');
  check(rel.title === 'Random Access Memories' && text(rel.credit) === 'Daft Punk', `title and credit: ${rel.title} — ${text(rel.credit)}`);
  check(rel.credit[0].url === 'https://www.discogs.com/artist/1289', `artist link: ${rel.credit[0].url}`);
  check(rel.mediums.length === 2 && rel.mediums.every(m => m.format === '12" Vinyl'), `two 12" vinyl mediums: ${rel.mediums.map(m => m.format)}`);
  check(rel.mediums.map(m => m.tracks.length).join() === '6,7', `6 + 7 tracks: ${rel.mediums.map(m => m.tracks.length)}`);
  check(rel.mediums[0].tracks[0].number === 'A1' && rel.mediums[1].tracks[0].number === 'C1', `vinyl numbers: ${rel.mediums[0].tracks[0].number}, ${rel.mediums[1].tracks[0].number}`);
  check(rel.labels.length === 2 && rel.labels[0].name === 'Columbia' && rel.labels[1].name === 'Sony Music', `Columbia once, then Sony Music: ${JSON.stringify(rel.labels.map(l => l.name + ' ' + l.catno))}`);
  check(rel.labels[0].url === 'https://www.discogs.com/label/1866', 'labels carry their Discogs link');
  check(rel.barcode === '888837168618', `barcode: ${rel.barcode}`);
  check(rel.country === null, `"UK, Europe & US" is no single country: ${rel.country}`);
  check(rel.types.join() === 'Album' && rel.date.year === 2013 && rel.date.month === 5 && rel.date.day === 17, `type and date: ${rel.types} ${JSON.stringify(rel.date)}`);
  check(rel.urls[0].url === 'https://www.discogs.com/release/4570366' && rel.urls[0].linkType === 76, `link: ${JSON.stringify(rel.urls)}`);

  // the sandbox's release editor takes the seed (same-origin POST, as the seeding form makes it)
  await requireLogin(page);
  const params = await page.evaluate(rel => window.__fcTest.seedParams(rel, 'First Contact spec'), rel);
  await page.evaluate(params => {
    const f = document.createElement('form'); f.method = 'POST'; f.action = '/release/add'; f.style.display = 'none';
    for (const [k, v] of params) { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; f.appendChild(i); }
    document.body.appendChild(f); f.submit();
  }, params);
  await page.waitForURL(/\/release\/add/, { timeout: 60000 });
  await settled(page);
  const name = await until(() => page.locator('#name').inputValue().catch(() => ''), v => v === 'Random Access Memories');
  check(name === 'Random Access Memories', `the editor has the title (${name})`);
  const errs = await page.evaluate(() => (document.body.innerText.match(/The data you[’']ve seeded contained the following errors[\s\S]{0,400}/) || [''])[0]);
  check(!errs, `no seed errors: ${errs}`);
  const model = await page.evaluate(() => {
    const r = window.MB.releaseEditor.rootField.release();
    return { mediums: r.mediums().map(m => ({ fmt: m.formatID && m.formatID(), n: m.tracks().length, first: m.tracks()[0] && m.tracks()[0].number() })), labels: r.labels().map(l => l.catalogNumber()) };
  });
  console.log(JSON.stringify(model));
  check(model.mediums.length === 2 && model.mediums.map(m => m.n).join() === '6,7', `the editor has two mediums, 6 + 7 (${JSON.stringify(model.mediums)})`);
  check(model.mediums[0].first === 'A1', `…numbered A1… (${model.mediums[0].first})`);
});

test('a Various 2×CD compilation: headings, Feat. joins, credited names', { tag: ['@web'] }, async ({ page, inject }) => {
  const rel = await read(page, inject, '4078875');
  check(text(rel.credit) === 'Various Artists' && rel.credit[0].mbid === '89ad4ac3-39f7-470e-963a-56509c546377', `VA credit: ${text(rel.credit)}`);
  check(rel.types.join() === 'Album,Compilation', `types: ${rel.types}`);
  check(rel.country === 'BE' && rel.barcode === '5414165057543', `country and barcode: ${rel.country} ${rel.barcode}`);
  check(rel.mediums.length === 2 && rel.mediums.every(m => m.format === 'CD'), `two CDs: ${rel.mediums.map(m => m.format)}`);
  check(rel.mediums[0].name === 'Routine' && rel.mediums[1].name === 'Lost Classics', `medium titles from the headings: ${rel.mediums.map(m => m.name)}`);
  const t1 = rel.mediums[0].tracks[0], t3 = rel.mediums[0].tracks[2];
  check(text(t1.credit) === 'Netsky feat. Billie', `Feat. join: ${text(t1.credit)}`);
  check(t1.credit[1].artistName === 'Billie' && t1.credit[1].url === 'https://www.discogs.com/artist/' + t1.credit[1].url.split('/').pop(), `"Billie (7)" loses its number: ${t1.credit[1].artistName}`);
  check(t3.credit[0].name === 'DJ Fresh' && t3.credit[0].artistName === 'Fresh', `credited name kept apart from the artist: ${t3.credit[0].name} / ${t3.credit[0].artistName}`);
  check(rel.mediums.every(m => m.tracks.every(t => !t.number)), 'CD tracks keep plain numbers');
  // the release page is recognised in every form Discogs links it (the site itself challenges a headless browser)
  const ids = await page.evaluate(() => {
    const dc = window.__fcTest.providers.find(p => p.id === 'discogs');
    return ['/release/4570366-Daft-Punk-Random-Access-Memories', '/release/4570366', '/de/release/4570366-x', '/master/556257-x', '/artist/1289-Daft-Punk', '/release/4570366-x/image/123'].map(pathname => dc.albumId({ pathname }));
  });
  check(JSON.stringify(ids) === JSON.stringify(['4570366', '4570366', '4570366', null, null, null]), `release pages only: ${JSON.stringify(ids)}`);
});
