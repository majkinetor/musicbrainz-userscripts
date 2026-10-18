// #779: Presto Music. Everything comes from the product page: the title, the artist line, the format
// bought there, the release date, label and catalogue number, the barcode (ld+json), and the
// tracklist as works with their movements. A product without a tracklist takes the tracks of another
// format of the album, which the page links.
//
// Fixtures, trimmed to the product's header, About and tracklist and the ld+json (no network needed):
//   779-beethoven-quartets.html    Chiaroscuro Quartet, BIS2728 (classical/9959653): Hybrid SACD, two
//                                  works of four movements and the Grosse Fuge, which has none
//   779-organisme.html             Antonio Dayyani, APR162CD (jazz/9851908): a CD of 7 tracks, one
//                                  with a lead vocalist in brackets; links a Vinyl Record
//   779-beethoven-symphonies.html  Ádám Fischer, Naxos 8505251 (classical/8619572): 5 CDs or download
//   779-ida-sand-vinyl.html        Ida Sand, ACT8802-1 (jazz/9885069): a Vinyl Record with no tracklist,
//                                  only the album title; links the CD
//   779-ida-sand-cd.html           its CD, ACT8802-2 (jazz/9885070), with the tracklist but no lengths
import { test, check, sourceOf, until, requireLogin, settled } from '../../../dev/test/harness.mjs';
import { readFile } from 'node:fs/promises';

test.use({ gm: { name: 'First Contact' }, pageErrors: 'ignore' });   // prestomusic.com's own scripts are not ours
const text = c => c.map(a => a.name + a.join).join('');
const fixture = name => readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('Presto Music: works and movements, format, barcode, and a tracklist from another format', { tag: ['@unit'] }, async ({ page }) => {
  await page.goto('about:blank');
  await page.evaluate(c => (0, eval)(c), await readFile(sourceOf('first_contact'), 'utf8'));
  // `others`: the pages of the other formats, by product number, for a product without a tracklist
  const read = (id, h, others = {}) => page.evaluate(([id, h, others]) => {
    const p = window.__fcTest.providers.find(x => x.id === 'presto');
    const dp = new DOMParser();
    p.page = async url => { const n = (url.match(/\/products\/(\d+)/) || [])[1]; if (!others[n]) throw new Error('no fixture for ' + url); return dp.parseFromString(others[n], 'text/html'); };
    return p.fetchRelease(id, null, dp.parseFromString(h, 'text/html'));
  }, [id, h, others]);

  const q = await read('classical/9959653', await fixture('779-beethoven-quartets.html'));
  const qt = q.mediums[0].tracks;
  check(q.title === 'Beethoven: String Quartets, Op. 59 No. 3, Op. 95 & Op. 133' && text(q.credit) === 'Chiaroscuro Quartet', `title and credit: ${q.title} — ${text(q.credit)}`);
  check(q.mediums.length === 1 && q.mediums[0].format === 'Hybrid SACD' && qt.length === 9, `one Hybrid SACD of 9 tracks: ${q.mediums[0].format}, ${qt.length}`);
  check(qt[0].title === "String Quartet No. 9 in C major, Op. 59 No. 3 'Rasumovsky No. 3': I. Introduzione. Andante con moto – Allegro vivace" && qt[0].lengthMs === 675000, `a movement is "Work: Movement", without the composer: ${qt[0].title} ${qt[0].lengthMs}`);
  check(qt[8].title === 'Grosse Fuge in B flat major, Op. 133' && qt[8].lengthMs === 876000, `a work without movements is one track: ${qt[8].title} ${qt[8].lengthMs}`);
  check(text(qt[0].credit) === 'Chiaroscuro Quartet' && qt[0].credit[0].url === null, `the performer without the role, no Presto link handed off: ${text(qt[0].credit)} ${qt[0].credit[0].url}`);
  check(q.barcode === '7318599927282' && q.date.year === 2026 && q.date.month === 10 && q.date.day === 16, `barcode and date: ${q.barcode} ${JSON.stringify(q.date)}`);
  check(q.labels.length === 1 && q.labels[0].name === 'BIS' && q.labels[0].catno === 'BIS2728', `label and catalogue number: ${JSON.stringify(q.labels)}`);
  check(q.packaging === null && q.country === null && q.urls[0].url === 'https://www.prestomusic.com/classical/products/9959653' && q.urls[0].linkType === 79, `a physical product: no packaging, no country, a mail-order link: ${q.packaging} ${q.country} ${JSON.stringify(q.urls)}`);
  check(/^The Chiaroscuro Quartet continues/.test(q.annotation || ''), `About is the annotation: ${(q.annotation || '').slice(0, 40)}`);

  const o = await read('jazz/9851908', await fixture('779-organisme.html'));
  const ot = o.mediums[0].tracks;
  check(text(o.credit) === 'Antonio Dayyani & Kristoffer Jessen' && !o.credit[1].url, `two album artists, the role gone: ${text(o.credit)}`);
  check(o.mediums[0].format === 'CD' && ot.length === 7 && ot[0].title === 'En lykkelig organisme' && ot[0].lengthMs === 206000, `a CD of 7 tracks: ${o.mediums[0].format} ${ot.length} ${ot[0].title} ${ot[0].lengthMs}`);
  check(text(ot[3].credit) === 'Antonio Dayyani & Kristoffer Jessen' && text(ot[0].credit) === 'Antonio Dayyani', `each track's own performers: ${text(ot[0].credit)} / ${text(ot[3].credit)}`);
  check(o.barcode === '5709498116228' && !o.tracksFrom && o.discs === 1, `barcode, its own tracklist: ${o.barcode} ${JSON.stringify(o.tracksFrom)}`);

  const b = await read('classical/8619572', await fixture('779-beethoven-symphonies.html'));
  check(b.mediums.length === 1 && b.mediums[0].format === 'CD' && b.discs === 5 && b.mediums[0].tracks.length === 37, `5 CDs: one CD medium of 37 tracks, 5 discs noted: ${b.mediums[0].format} ${b.discs} ${b.mediums[0].tracks.length}`);
  check(b.barcode === '0747313525133' && b.labels[0].name === 'Naxos' && b.date.year === 2019 && b.date.month === 7, `barcode, label, date: ${b.barcode} ${b.labels[0].name} ${JSON.stringify(b.date)}`);

  const cd = await fixture('779-ida-sand-cd.html');
  const v = await read('jazz/9885069', await fixture('779-ida-sand-vinyl.html'), { 9885070: cd });
  const vt = v.mediums[0].tracks;
  check(v.mediums[0].format === 'Vinyl' && v.barcode === '0614427880215' && v.labels[0].catno === 'ACT8802-1', `the vinyl's own format, barcode and catalogue number: ${v.mediums[0].format} ${v.barcode} ${v.labels[0].catno}`);
  check(vt.length > 1 && v.tracksFrom && v.tracksFrom.url === 'https://www.prestomusic.com/jazz/products/9885070--i-will-be-right-there' && v.tracksFrom.name === 'CD', `the tracks are the CD's: ${vt.length} from ${JSON.stringify(v.tracksFrom)}`);
  check(!vt.some(t => t.title === 'I Will Be Right There' && vt.length === 1), 'the album title alone is not taken as a track');

  const none = await page.evaluate(async h => {
    const p = window.__fcTest.providers.find(x => x.id === 'presto');
    p.page = async () => { throw new Error('refused'); };
    try { await p.fetchRelease('jazz/9885069', null, new DOMParser().parseFromString(h, 'text/html')); return 'imported'; } catch (e) { return e.message; }
  }, await fixture('779-ida-sand-vinyl.html'));
  check(/lists no tracks for this release/.test(none), `no tracklist in any format: no import (${none})`);

  const ids = await page.evaluate(() => {
    const p = window.__fcTest.providers.find(x => x.id === 'presto');
    return ['/classical/products/9959653--beethoven', '/jazz/products/9851908--organisme', '/sheet-music/products/123--x', '/classical/artists/6434--x'].map(pathname => p.albumId({ pathname }));
  });
  check(JSON.stringify(ids) === JSON.stringify(['classical/9959653', 'jazz/9851908', null, null]), `recordings only: ${JSON.stringify(ids)}`);
});

// The live page: the button, and a vinyl without a tracklist that reads its CD's over the network
// with the page's own Cloudflare pass. Cloudflare challenges the headless test browser (the spec is then
// skipped): run it with --headed.
test('Presto Music live: the button, and a vinyl taking its CD\'s tracklist', { tag: ['@web'] }, async ({ page }) => {
  await page.goto('https://www.prestomusic.com/jazz/products/9885069--i-will-be-right-there', { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 20 && /just a moment/i.test(await page.title()); i++) await page.waitForTimeout(1000);
  test.skip(/just a moment/i.test(await page.title()), 'Cloudflare challenged the test browser');
  await page.evaluate(c => (0, eval)(c), await readFile(sourceOf('first_contact'), 'utf8'));
  await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
  check(await page.locator('#fc-root .fc-cons').isHidden(), 'no Consolidate button: Presto is not in Mission Control');
  const rel = await page.evaluate(() => { const p = window.__fcTest.providers.find(x => x.id === 'presto'); return p.fetchRelease(p.albumId(location)); });
  const tracks = rel.mediums.flatMap(m => m.tracks);
  check(rel.mediums[0].format === 'Vinyl' && rel.barcode === '0614427880215', `the vinyl's format and barcode: ${rel.mediums[0].format} ${rel.barcode}`);
  check(tracks.length > 1 && rel.tracksFrom && /\/products\/9885070/.test(rel.tracksFrom.url), `the CD's ${tracks.length} tracks: ${JSON.stringify(rel.tracksFrom)}`);
});

// The round trip on the sandbox: MusicBrainz takes Presto's format (Hybrid SACD) and the mail-order
// link without a seed error. Headed only, as above.
test.describe('round trip', () => {
  test.use({ gm: { name: 'First Contact', persist: 'tabs', values: { 'fc.settings': { server: 'test.musicbrainz.org', archive: false } } }, pageErrors: 'ignore' });
  test('Presto Music: an SACD seeds the sandbox release editor', { tag: ['@web', '@sandbox', '@login'] }, async ({ page, context, inject }) => {
    await page.goto('https://www.prestomusic.com/classical/products/9959653--beethoven-string-quartets-op-59-no-3-op-95-op-133', { waitUntil: 'domcontentloaded' });
    for (let i = 0; i < 20 && /just a moment/i.test(await page.title()); i++) await page.waitForTimeout(1000);
    test.skip(/just a moment/i.test(await page.title()), 'Cloudflare challenged the test browser');
    await inject('first_contact', { waitFor: '__fcTest' });
    const go = page.locator('#fc-root .fc-go');
    await go.waitFor({ state: 'visible' });
    const [editor] = await Promise.all([context.waitForEvent('page'), go.click()]);
    await editor.waitForURL(/test\.musicbrainz\.org\/release\/add\?first_contact=/, { timeout: 90_000 });
    const confirm = editor.getByRole('button', { name: 'Continue' });
    if (await confirm.isVisible().catch(() => false)) await Promise.all([editor.waitForNavigation(), confirm.click()]);
    await requireLogin(editor);
    await settled(editor);
    const name = await until(() => editor.locator('#name').inputValue().catch(() => ''), v => /^Beethoven: String Quartets/.test(v));
    check(/^Beethoven: String Quartets/.test(name), `release title in the editor: "${name}"`);
    const seedErrors = await editor.evaluate(() => (document.body.innerText.match(/The data you[’']ve seeded contained the following errors[\s\S]{0,400}/) || [''])[0]);
    check(!seedErrors, `MusicBrainz reported no seed errors: ${seedErrors}`);
    const formats = await editor.evaluate(() => [...document.querySelectorAll('select')].map(s => s.selectedOptions[0] && s.selectedOptions[0].textContent.trim()).filter(t => /SACD|CD|Digital/.test(t || '')));
    check(formats.includes('Hybrid SACD'), `the medium is a Hybrid SACD: ${JSON.stringify(formats)}`);
    const barcode = await editor.locator('#barcode').inputValue().catch(() => '');
    check(barcode === '7318599927282', `barcode: ${barcode}`);
  });
});
