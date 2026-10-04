// #674: on a release that has no barcode, the barcodes the matched platforms report are
// offered from a button next to ↻; picking one is the same as pasting it (#673).
//
// The browser specs run on test.musicbrainz.org; Deezer is the only platform on, and answers
// from the spec: its search finds whatever it is asked for, with a barcode of its own.
import { test, check, until, answerGm, loadFunctions, functionSource } from '../../../dev/test/harness.mjs';
import { openPc, row } from './pc.mjs';

const BARE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';   // no barcode on the sandbox
const RAM = 'ec116461-5b0d-4c98-bb44-a4de5de63076';    // barcode 886443984059
const CODE = '5099750442227';
const ONLY_DEEZER = Object.fromEntries(['discogs', 'bandcamp', 'spotify', 'apple', 'tidal', 'ytmusic', 'amazonmusic', 'qobuz', 'beatport', 'volumo', 'hdtracks', 'sevendigital', 'soundcloud', 'audiomack'].map(p => [`pc:prov_${p}`, false]));

// format confidence off: the sandbox release is a CD, and Deezer is digital
test.use({ gm: { name: 'Platform Check', values: { ...ONLY_DEEZER, 'pc:respect-format': false } } });

const scans = page => page.evaluate(() => (document.getElementById('mb-finder-log-panel')?.textContent.match(/All scans completed/g) || []).length);
const button = page => page.evaluate(() => { const b = document.getElementById('mb-found-bc'); return { shown: getComputedStyle(b).display !== 'none', text: b.textContent.trim(), title: b.title }; });

// Deezer's search finds the album asked for, by the artist asked for, with nb_tracks tracks
function deezer(context, state) {
  answerGm(context, ({ url }) => {
    if (!/api\.deezer\.com/.test(url)) return null;
    const album = { id: 1, link: 'https://www.deezer.com/album/1', upc: CODE, release_date: '2020-01-01', label: 'L', nb_tracks: state.tracks };
    const q = decodeURIComponent((url.match(/[?&]q=([^&]*)/) || [])[1] || '');
    if (url.includes('/search/album')) {
      if (!state.tracks) return { status: 200, body: '{"data":[],"total":0}' };
      const artist = (q.match(/artist:"([^"]*)"/) || [])[1] || '', title = (q.match(/album:"([^"]*)"/) || [])[1] || '';
      state.title = title;
      return { status: 200, body: JSON.stringify({ data: [{ ...album, title, artist: { name: artist } }], total: 1 }) };
    }
    if (url.includes(`album/upc:${CODE}`) || /album\/1$/.test(url)) return { status: 200, body: JSON.stringify({ ...album, title: state.title || 'Found' }) };
    return { status: 200, body: '{"error":{"type":"DataException","message":"no data","code":800}}' };
  });
}

test('the barcodes the platforms report are offered, and picking one uses it', { tag: ['@sandbox'] }, async ({ page, inject, context }) => {
  const state = { tracks: 0 };
  deezer(context, state);
  await openPc(page, inject, { release: BARE });
  check(!(await button(page)).shown, 'nothing found, nothing offered');

  // ↻ with Deezer finding the release by its text search
  state.tracks = Number(await page.textContent('#mb-mb-tracks'));
  await page.click('#mb-refresh-btn');
  await until(() => scans(page), n => n >= 2, { timeout: 60000 });
  check((await row(page, 'deezer')).url.includes('/album/1'), 'Deezer finds the release by searching');
  const b = await button(page);
  check(b.shown && b.text === '1' && b.title.includes(`Deezer reports ${CODE}`), `the header offers its barcode (${JSON.stringify(b)})`);

  await page.click('#mb-found-bc');
  const pop = await page.evaluate(() => [...document.querySelectorAll('#pc-bc-pop .pc-bc-opt')].map(o => ({ code: o.dataset.code, text: o.textContent.replace(/\s+/g, ' ').trim() })));
  check(pop.length === 1 && pop[0].code === CODE && /Deezer/.test(pop[0].text), `the list has it, with who reports it (${JSON.stringify(pop)})`);
  check(/digital: this release is physical/.test(pop[0].text), 'a digital barcode on a CD is flagged');
  await page.click('#mb-found-bc');
  check(!(await page.$('#pc-bc-pop')), 'the button closes the list again');

  await page.click('#mb-found-bc');
  await page.click(`#pc-bc-pop .pc-bc-opt[data-code="${CODE}"]`);
  await until(() => scans(page), n => n >= 3, { timeout: 60000 });
  const after = await page.evaluate(rel => ({ pasted: localStorage.getItem('pc:pasted-barcode:' + rel), chip: document.getElementById('mb-pasted-bc').textContent, pop: !!document.getElementById('pc-bc-pop') }), BARE);
  check(after.pasted === CODE && after.chip.includes(CODE) && !after.pop, `picked: in use as if pasted (${JSON.stringify(after)})`);
  check(!(await button(page)).shown, 'the button gives way to the pasted barcode');

  // × on the pasted barcode: it is offered again
  await page.click('#mb-pasted-bc');
  await until(() => scans(page), n => n >= 4, { timeout: 60000 });
  check((await button(page)).shown, 'removed: offered again');
  await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('pc:')).forEach(k => localStorage.removeItem(k)));
});

test('a release with a barcode is offered none', { tag: ['@sandbox'] }, async ({ page, inject, context }) => {
  const state = { tracks: 0 };
  deezer(context, state);
  await openPc(page, inject, { release: RAM });
  state.tracks = Number(await page.textContent('#mb-mb-tracks'));
  await page.click('#mb-refresh-btn');
  await until(() => scans(page), n => n >= 2, { timeout: 60000 });
  check((await row(page, 'deezer')).url.includes('/album/1'), 'Deezer finds it, with another barcode');
  check(!(await button(page)).shown, 'no button');
  await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('pc:')).forEach(k => localStorage.removeItem(k)));
});

test('found barcodes are grouped, and ordered by format and count', { tag: '@unit' }, async () => {
  const src = await functionSource('platform_check', ['normBarcode', 'formatCategories', 'remoteFormatCategories', 'DIGITAL_ONLY_PROVIDERS', 'pcFoundBarcodes']);
  const run = (mbFormat, found) => new Function('MB_FORMAT', 'PROVIDER_ORDER', 'PC_FOUND_BC', src + '\nreturn pcFoundBarcodes();')(
    mbFormat, ['discogs', 'bandcamp', 'apple', 'deezer', 'qobuz'], new Map(Object.entries(found)));
  const found = {
    discogs: { code: '026245106325', format: 'CD' },
    apple: { code: '0886443927087', format: null },
    deezer: { code: '886443927087', format: null },
    qobuz: { code: '0886443927087', format: null },
  };
  const cd = run('CD', found);
  check(cd.length === 2, `UPC-A and EAN-13 are one barcode (${cd.length})`);
  check(cd[0].code === '026245106325' && cd[0].format === 'same', `on a CD, the CD's barcode first (${JSON.stringify(cd[0])})`);
  check(cd[1].platforms.join() === 'apple,deezer,qobuz' && cd[1].format === 'other' && cd[1].kinds.join() === 'digital', `then the digital one, with its three platforms (${JSON.stringify(cd[1])})`);
  const dig = run('Digital Media', found);
  check(dig[0].platforms.length === 3 && dig[0].format === 'same', 'on a digital release, the digital one first');
  const none = run(null, found);
  check(none[0].platforms.length === 3 && none.every(c => c.format === 'unknown'), 'no format: the most reported first');
});
