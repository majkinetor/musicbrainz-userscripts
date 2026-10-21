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
//   779-ida-sand-cd.html           its CD, ACT8802-2 (jazz/9885070): each track "Ida Sand: <title>", every
//                                  musician listed with an instrument
//   779-lester-young.html          Lester Young with the Oscar Peterson Trio (jazz/8621347): a download;
//                                  composers some linked, some not ("Ira Gershwin, Vernon Duke: …"), and
//                                  "Recorded:" / "Recording Venue:" among the performers
import { test, check, sourceOf, until, requireLogin, settled } from '../../../dev/test/harness.mjs';
import { readFile } from 'node:fs/promises';

test.use({ gm: { name: 'First Contact' }, pageErrors: 'ignore' });   // prestomusic.com's own scripts are not ours
const text = c => c.map(a => a.name + a.join).join('');
const fixture = name => readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('Presto Music: works and movements, format, barcode, and a tracklist from another format', { tag: ['@unit'] }, async ({ page }) => {
  await page.goto('about:blank');
  await page.evaluate(c => (0, eval)(c), await readFile(sourceOf('first_contact'), 'utf8'));
  // `others`: the pages of the other formats, by product number, for a product without a tracklist;
  // `api`: the streaming API's answers ("tracks/9885070"), none for a product that doesn't stream
  const API = JSON.parse(await fixture('779-streaming-api.json'));
  const read = (id, h, others = {}, api = API) => page.evaluate(([id, h, others, api]) => {
    const p = window.__fcTest.providers.find(x => x.id === 'presto');
    const dp = new DOMParser();
    p.page = async url => { const n = (url.match(/\/products\/(\d+)/) || [])[1]; if (!others[n]) throw new Error('no fixture for ' + url); return dp.parseFromString(others[n], 'text/html'); };
    p.call = async (what, code) => { const j = api[`${what}/${code}`]; return j && j.status === 'ok' ? j.payload : null; };
    return h ? p.fetchRelease(id, null, dp.parseFromString(h, 'text/html')) : p.fetchRelease(id);
  }, [id, h, others, api]);

  const q = await read('classical/9959653', await fixture('779-beethoven-quartets.html'));
  const qt = q.mediums[0].tracks;
  check(q.title === 'Beethoven: String Quartets, Op. 59 No. 3, Op. 95 & Op. 133' && text(q.credit) === 'Chiaroscuro Quartet', `title and credit: ${q.title} — ${text(q.credit)}`);
  check(q.mediums.length === 1 && q.mediums[0].format === 'Hybrid SACD' && qt.length === 9, `one Hybrid SACD of 9 tracks: ${q.mediums[0].format}, ${qt.length}`);
  check(qt[0].title === "String Quartet No. 9 in C major, Op. 59 No. 3 'Rasumovsky No. 3': I. Introduzione. Andante con moto – Allegro vivace" && qt[0].lengthMs === 675000, `a movement is "Work: Movement", without the composer: ${qt[0].title} ${qt[0].lengthMs}`);
  check(qt[8].title === 'Grosse Fuge in B flat major, Op. 133' && qt[8].lengthMs === 876000, `a work without movements is one track: ${qt[8].title} ${qt[8].lengthMs}`);
  check(text(qt[0].credit) === 'Chiaroscuro Quartet' && qt[0].credit[0].url === null, `the performer without the role, no Presto link handed off: ${text(qt[0].credit)} ${qt[0].credit[0].url}`);
  check(q.barcode === '7318599927282' && q.date.year === 2026 && q.date.month === 10 && q.date.day === 16, `barcode and date: ${q.barcode} ${JSON.stringify(q.date)}`);
  check(q.labels.length === 1 && q.labels[0].name === 'BIS' && q.labels[0].catno === 'BIS2728', `label and catalogue number: ${JSON.stringify(q.labels)}`);
  check(q.packaging === null && q.country === null && q.urls[0].url === 'https://www.prestomusic.com/classical/products/9959653--beethoven-string-quartets-op-59-no-3-op-95-op-133' && q.urls[0].linkType === 79, `a physical product: no packaging, no country, a mail-order link with its slug (Presto answers 404 without): ${q.packaging} ${q.country} ${JSON.stringify(q.urls)}`);
  check(/^The Chiaroscuro Quartet continues/.test(q.annotation || ''), `About is the annotation: ${(q.annotation || '').slice(0, 40)}`);

  const o = await read('jazz/9851908', await fixture('779-organisme.html'));
  const ot = o.mediums[0].tracks;
  check(text(o.credit) === 'Antonio Dayyani', `the album artist; Kristoffer Jessen (leadvocalist) is a musician's credit, not the artist: ${text(o.credit)}`);
  check(o.mediums[0].format === 'CD' && ot.length === 7 && ot[0].title === 'En lykkelig organisme' && ot[0].lengthMs === 206000, `a CD of 7 tracks: ${o.mediums[0].format} ${ot.length} ${ot[0].title} ${ot[0].lengthMs}`);
  check(text(ot[3].credit) === 'Antonio Dayyani' && text(ot[0].credit) === 'Antonio Dayyani', `a track's artists are its names without a role: ${text(ot[0].credit)} / ${text(ot[3].credit)}`);
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
  // majkinetor: the CD's tracks start with the artist ("Ida Sand: Salt & Sugar") and list every musician
  // with an instrument ("Ida Sand (piano), Ida Sand, Ida Sand (wurlitzer), Ola Gustafsson (guitar), …")
  check(vt[0].title === 'Salt & Sugar' && vt[0].lengthMs === 240000, `the artist leaves the title: ${vt[0].title} ${vt[0].lengthMs}`);
  check(vt.every(t => text(t.credit) === 'Ida Sand') && text(v.credit) === 'Ida Sand', `the musicians with an instrument are no track artists: ${[...new Set(vt.map(t => text(t.credit)))].join(' / ')}`);

  const l = await read('jazz/8621347', await fixture('779-lester-young.html'));
  const lt = l.mediums[0].tracks;
  check(l.mediums[0].format === 'Digital Media' && l.packaging === 'None' && l.urls[0].linkType === 74, `a download: ${l.mediums[0].format} ${l.packaging} ${l.urls[0].linkType}`);
  check(lt.every(t => !/:/.test(t.title)), `no composer left in a title, linked or not: ${lt.filter(t => /:/.test(t.title)).map(t => t.title).join(' / ') || 'none'}`);
  check(lt.some(t => t.title === "I Can't Get Started"), `"Ira Gershwin, Vernon Duke: I Can't Get Started" is "I Can't Get Started": ${lt.map(t => t.title).slice(0, 4).join(' / ')}`);
  check(lt.every(t => t.credit.every(a => !/recorded|venue|kessel|heard|brown/i.test(a.name))), `no "Recorded:", no musician with an instrument among the track artists: ${[...new Set(lt.map(t => text(t.credit)))].join(' / ')}`);
  check(text(l.credit) === 'The Oscar Peterson Trio & Lester Young', `the album: the trio, and Lester Young, whom the tracks name without an instrument: ${text(l.credit)}`);

  // the streaming API: ISRCs on the store's tracks, and the streaming link on a download only
  check(lt.length > 10 && lt.every(t => /^USPR\d{8}$/.test(t.isrc || '')) && lt[0].isrc === 'USPR35252001', `the download's tracks have the app's ISRCs: ${lt.map(t => t.isrc).slice(0, 3).join(' ')}`);
  check(JSON.stringify(l.urls.map(u => u.linkType)) === '[74,980]' && l.urls[1].url === 'https://streaming.prestomusic.com/album/8621347', `a download streams: the store and streaming links: ${JSON.stringify(l.urls)}`);
  check(b.mediums[0].tracks[0].isrc === 'DKBW51900101' && b.mediums[0].tracks.every(t => t.isrc) && b.urls.length === 1 && b.urls[0].linkType === 79, `a CD: the ISRCs, but no streaming link, which is the download's: ${b.mediums[0].tracks[0].isrc} ${JSON.stringify(b.urls)}`);
  check(qt.every(t => t.isrc === null) && q.urls.length === 1, `a product that doesn't stream: no ISRCs, no streaming link: ${JSON.stringify(q.urls)}`);
  check(vt[0].isrc === 'DEA892600067', `the CD's tracks, read from the streaming app, with their ISRCs: ${vt[0].isrc}`);
  const v2 = await read('jazz/9885069', await fixture('779-ida-sand-vinyl.html'), { 9885070: cd }, {});
  check(v2.mediums[0].tracks.length === vt.length && v2.mediums[0].tracks[0].title === 'Salt & Sugar' && v2.tracksFrom.name === 'CD', `the CD's page when the app hasn't the CD: ${v2.mediums[0].tracks.length} ${JSON.stringify(v2.tracksFrom)}`);

  // the streaming app: everything from the API, the barcode from the booklet's file name
  const s = await read('streaming/9888521');
  const st = s.mediums[0].tracks;
  check(s.title === 'Felix Mendelssohn: Songs Without Words' && text(s.credit) === 'Bertrand Chamayou', `title and credit: ${s.title} — ${text(s.credit)}`);
  check(st.length === 48 && st.every(t => /^GBAYC\d{7}$/.test(t.isrc || '') && t.lengthMs) && st[0].title === 'Songs without Words, Book 1 (6), Op. 19b: No. 1, Andante con moto, MWV U86 "Sweet Remembrance"' && st[0].lengthMs === 200000, `48 tracks, each with an ISRC and a length, "Work: Movement" without the composer: ${st.length} ${st[0].title} ${st[0].lengthMs}`);
  check(s.mediums[0].format === 'Digital Media' && s.packaging === 'None' && s.discs === 2 && s.barcode === '0827568019622', `a download of 2 discs, the booklet's barcode: ${s.mediums[0].format} ${s.packaging} ${s.discs} ${s.barcode}`);
  check(JSON.stringify(s.date) === '{"year":2026,"month":10,"day":16}' && s.labels[0].name === 'Erato' && s.labels[0].catno === '2756801961', `date, label, cat. no: ${JSON.stringify(s.date)} ${JSON.stringify(s.labels)}`);
  check(s.url === 'https://streaming.prestomusic.com/album/9888521' && JSON.stringify(s.urls) === JSON.stringify([{ url: s.url, linkType: 980 }, { url: 'https://www.prestomusic.com/classical/products/9888521--felix-mendelssohn-songs-without-words', linkType: 74 }]), `the streaming and store links: ${JSON.stringify(s.urls)}`);
  check(/^“Mendelssohn’s Songs without Words/.test(s.annotation || ''), `About is the annotation: ${(s.annotation || '').slice(0, 40)}`);
  // the same tracks as the store's pages give, from the app
  for (const [code, store] of [['9885070', 'jazz/9885070'], ['8621347', 'jazz/8621347'], ['8619572', 'classical/8619572']]) {
    const a = await read(`streaming/${code}`), w = await read(store, await fixture({ 9885070: '779-ida-sand-cd.html', 8621347: '779-lester-young.html', 8619572: '779-beethoven-symphonies.html' }[code]));
    const at = a.mediums[0].tracks, wt = w.mediums[0].tracks;
    const diff = at.map((t, i) => wt[i] && (t.title !== wt[i].title || text(t.credit) !== text(wt[i].credit) || t.lengthMs !== wt[i].lengthMs) ? `${i + 1}: ${t.title} — ${text(t.credit)} / ${wt[i].title} — ${text(wt[i].credit)}` : null).filter(Boolean);
    check(at.length === wt.length && !diff.length && text(a.credit) === text(w.credit), `${code}: the app's ${at.length} tracks are the store's ${wt.length}: ${diff.slice(0, 3).join(' · ') || 'same'}; ${text(a.credit)} / ${text(w.credit)}`);
  }
  const ida = await read('streaming/9885070');
  check(ida.barcode === '0614427880222' && ida.urls[1].url === 'https://www.prestomusic.com/jazz/products/9885070--i-will-be-right-there', `a 12-digit UPC in the booklet's name, the store link with its slug: ${ida.barcode} ${JSON.stringify(ida.urls)}`);
  const notStreamed = await read('streaming/9885069').then(() => 'imported', e => e.message);
  check(/doesn't stream/.test(notStreamed), `a product that doesn't stream: ${notStreamed}`);
  const bb = await page.evaluate(() => { const p = window.__fcTest.providers.find(x => x.id === 'presto'); return ['https://x.net/0827568019622_W.pdf?Expires=1', 'https://x.net/0827568019623_W.pdf', 'https://x.net/booklet.pdf', null].map(u => p.bookletBarcode(u)); });
  check(JSON.stringify(bb) === '["0827568019622",null,null,null]', `a booklet's barcode only when its check digit holds: ${JSON.stringify(bb)}`);

  const none = await page.evaluate(async h => {
    const p = window.__fcTest.providers.find(x => x.id === 'presto');
    p.page = async () => { throw new Error('refused'); };
    p.call = async () => null;
    try { await p.fetchRelease('jazz/9885069', null, new DOMParser().parseFromString(h, 'text/html')); return 'imported'; } catch (e) { return e.message; }
  }, await fixture('779-ida-sand-vinyl.html'));
  check(/lists no tracks for this release/.test(none), `no tracklist in any format: no import (${none})`);

  const ids = await page.evaluate(() => {
    const p = window.__fcTest.providers.find(x => x.id === 'presto');
    return ['/classical/products/9959653--beethoven', '/jazz/products/9851908--organisme', '/sheet-music/products/123--x', '/classical/artists/6434--x'].map(pathname => p.albumId({ hostname: 'www.prestomusic.com', pathname }))
      .concat(['/album/9888521', '/album/9888521/about', '/artist/4133'].map(pathname => p.albumId({ hostname: 'streaming.prestomusic.com', pathname })));
  });
  check(JSON.stringify(ids) === JSON.stringify(['classical/9959653', 'jazz/9851908', null, null, 'streaming/9888521', 'streaming/9888521', null]), `recordings only: ${JSON.stringify(ids)}`);
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
  check(tracks.every(t => /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(t.isrc || '')), `with the CD's ISRCs, from the streaming app: ${tracks.map(t => t.isrc).slice(0, 3).join(' ')}`);
});

// The streaming app (a single-page app with no bot check): the button, and the album read from its API
test('Presto Music streaming live: the button and the album', { tag: ['@web'] }, async ({ page }) => {
  await page.goto('https://streaming.prestomusic.com/album/9888521', { waitUntil: 'domcontentloaded' });
  await page.evaluate(c => (0, eval)(c), await readFile(sourceOf('first_contact'), 'utf8'));
  await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
  const rel = await page.evaluate(() => { const p = window.__fcTest.providers.find(x => x.id === 'presto'); return p.fetchRelease(p.albumId(location)); });
  const tracks = rel.mediums.flatMap(m => m.tracks);
  check(tracks.length === 48 && tracks.every(t => t.isrc && t.lengthMs), `48 tracks with ISRCs and lengths: ${tracks.length}`);
  const vinyl = await page.evaluate(() => window.__fcTest.providers.find(x => x.id === 'presto').fromStream('9885069').then(() => 'imported', e => e.message));
  check(/doesn't stream/.test(vinyl), `a product that doesn't stream (a 404 that says so): ${vinyl}`);
  check(rel.mediums[0].format === 'Digital Media' && rel.labels[0].catno === '2756801961' && /\/classical\/products\/9888521--/.test((rel.urls[1] || {}).url), `a download, its cat. no and the store link: ${rel.mediums[0].format} ${rel.labels[0].catno} ${JSON.stringify(rel.urls)}`);
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

  // from the streaming app: a download with the streaming and store links, both taken by MusicBrainz
  test('Presto Music streaming: an album seeds the sandbox release editor', { tag: ['@web', '@sandbox', '@login'] }, async ({ page, context, inject }) => {
    await page.goto('https://streaming.prestomusic.com/album/9888521', { waitUntil: 'domcontentloaded' });
    await inject('first_contact', { waitFor: '__fcTest' });
    const go = page.locator('#fc-root .fc-go');
    await go.waitFor({ state: 'visible' });
    const [editor] = await Promise.all([context.waitForEvent('page'), go.click()]);
    await editor.waitForURL(/test\.musicbrainz\.org\/release\/add\?first_contact=/, { timeout: 90_000 });
    const confirm = editor.getByRole('button', { name: 'Continue' });
    if (await confirm.isVisible().catch(() => false)) await Promise.all([editor.waitForNavigation(), confirm.click()]);
    await requireLogin(editor);
    await settled(editor);
    const name = await until(() => editor.locator('#name').inputValue().catch(() => ''), v => /Songs Without Words/.test(v));
    check(/Songs Without Words/.test(name), `release title in the editor: "${name}"`);
    const seedErrors = await editor.evaluate(() => (document.body.innerText.match(/The data you[’']ve seeded contained the following errors[\s\S]{0,400}/) || [''])[0]);
    check(!seedErrors, `MusicBrainz reported no seed errors: ${seedErrors}`);
    const formats = await editor.evaluate(() => [...document.querySelectorAll('select')].map(s => s.selectedOptions[0] && s.selectedOptions[0].textContent.trim()).filter(t => /SACD|CD|Digital/.test(t || '')));
    check(formats.includes('Digital Media'), `the medium is Digital Media: ${JSON.stringify(formats)}`);
    check(await editor.locator('#barcode').inputValue().catch(() => '') === '0827568019622', 'the booklet\'s barcode');
    const links = await editor.evaluate(() => [...document.querySelectorAll('#external-links-editor a[href], #external-links-editor input')].map(e => e.href || e.value).filter(Boolean));
    check(links.some(u => /streaming\.prestomusic\.com\/album\/9888521/.test(u)) && links.some(u => /prestomusic\.com\/classical\/products\/9888521--/.test(u)), `both links: ${JSON.stringify(links)}`);
  });
});
