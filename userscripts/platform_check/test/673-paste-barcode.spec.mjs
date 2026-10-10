// #673: a barcode pasted on a release that has none. The platforms are searched and checked
// with it as if it were the release's, a link added from the panel takes it along to the
// release editor, which fills it in; on a release with a barcode, a paste is refused.
//
// The browser specs run on test.musicbrainz.org; Deezer is the only platform on, and answers
// from the spec.
import { test, check, until, requireLogin, answerGm, loadFunctions, functionSource } from '../../../dev/test/harness.mjs';
import { openPc, row, logText } from './pc.mjs';

const BARE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';   // no barcode on the sandbox
const RAM = 'ec116461-5b0d-4c98-bb44-a4de5de63076';    // barcode 886443984059
const CODE = '5099750442227';
const ONLY_DEEZER = Object.fromEntries(['discogs', 'bandcamp', 'spotify', 'apple', 'tidal', 'ytmusic', 'amazonmusic', 'qobuz', 'beatport', 'volumo', 'hdtracks', 'sevendigital', 'soundcloud', 'audiomack'].map(p => [`pc:prov_${p}`, false]));

// format confidence off: the sandbox release is a CD, and Deezer is digital
test.use({ gm: { name: 'Platform Check', values: { ...ONLY_DEEZER, 'pc:respect-format': false } } });

const paste = (page, text) => page.evaluate(text => {
  const dt = new DataTransfer(); dt.setData('text/plain', text);
  document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}, text);
const scans = page => page.evaluate(() => (window.__pcLog ? window.__pcLog.messages().filter(m => /All scans completed/.test(m)) : []).length);
const toast = page => page.evaluate(() => { const t = document.getElementById('mbu-toast'); return t && /mbu-toast-on/.test(t.className) ? { text: t.textContent, cls: t.className } : null; });

test('a pasted barcode finds the release, and goes in with the links', { tag: ['@sandbox'] }, async ({ page, inject, context }) => {
  let tracks = 0;
  const deezer = { id: 1, title: 'Pasted', link: 'https://www.deezer.com/album/1', upc: CODE, release_date: '2020-01-01', label: 'L' };
  answerGm(context, ({ url }) => {
    if (!/api\.deezer\.com/.test(url)) return null;
    if (url.includes(`album/upc:${CODE}`)) return { status: 200, body: JSON.stringify(deezer) };
    if (/album\/1$/.test(url)) return { status: 200, body: JSON.stringify({ ...deezer, nb_tracks: tracks }) };
    return { status: 200, body: '{"error":{"type":"DataException","message":"no data","code":800}}' };
  });
  await openPc(page, inject, { release: BARE });
  tracks = Number(await page.textContent('#mb-mb-tracks'));
  check(!(await row(page, 'deezer')).url.includes('/album/1'), 'without a barcode, Deezer finds nothing');

  await paste(page, ' 5099750 442227 ');
  check(/Barcode 5099750442227/.test((await toast(page))?.text || ''), `it says so (${JSON.stringify(await toast(page))})`);
  await until(() => scans(page), n => n >= 2, { timeout: 60000 });
  const d = await row(page, 'deezer');
  const log = await logText(page);
  check(d.url.includes('/album/1') && d.icon === '✓', `Deezer is found by the pasted barcode, a match (${d.url}, ${d.icon})`);
  check(/Using the pasted barcode 5099750442227/.test(log) && /Barcode 5099750442227 → https:\/\/www\.deezer\.com\/album\/1/.test(log), 'the log says which barcode it used');
  check(!/pc-barcode-diff/.test(d.cls), 'the match is not marked as a different barcode');
  const chip = await page.evaluate(() => { const c = document.getElementById('mb-pasted-bc'); return { shown: getComputedStyle(c).display !== 'none', text: c.textContent }; });
  check(chip.shown && chip.text.includes(CODE), `the header shows the pasted barcode (${JSON.stringify(chip)})`);

  // reload: still in use
  await page.reload({ waitUntil: 'domcontentloaded' });
  await inject('platform_check');
  await until(() => scans(page), n => n >= 1, { timeout: 60000 });
  check(/Using the pasted barcode 5099750442227/.test(await logText(page)), 'kept across a reload');

  // + queues the barcode with the link; the editor tab it opens is closed unseen
  context.once('page', p => p.close().catch(() => {}));
  await page.click('#mb-inject-btn');
  const queued = await until(() => page.evaluate(rel => ({ link: localStorage.getItem('pc:pending:' + rel), barcode: localStorage.getItem('pc:pending-barcode:' + rel) }), BARE), q => q.link);
  check(/deezer\.com\/album\/1/.test(queued.link || '') && queued.barcode === CODE, `+ queues the barcode with the link (${JSON.stringify(queued)})`);

  // × on the chip: back to the release as it is
  await page.click('#mb-pasted-bc');
  await until(() => scans(page), n => n >= 2, { timeout: 60000 });
  const after = await page.evaluate(rel => ({ pasted: localStorage.getItem('pc:pasted-barcode:' + rel), queued: localStorage.getItem('pc:pending-barcode:' + rel), shown: getComputedStyle(document.getElementById('mb-pasted-bc')).display !== 'none' }), BARE);
  check(!after.pasted && !after.queued && !after.shown, `removed (${JSON.stringify(after)})`);
  check(!(await row(page, 'deezer')).url.includes('/album/1'), '…and the scan runs without it');
  await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('pc:')).forEach(k => localStorage.removeItem(k)));
});

test('a release with a barcode refuses a pasted one; a paste into a field is left alone', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await openPc(page, inject, { release: RAM });
  const before = await scans(page);
  await paste(page, CODE);
  const t = await until(() => toast(page), Boolean);
  check(/already has a barcode \(886443984059\)/.test(t?.text || '') && /mbu-toast-error/.test(t?.cls || ''), `an error toast (${JSON.stringify(t)})`);
  check(!(await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('pc:pasted-barcode:')))), 'nothing is kept');
  // typed into a field: not ours
  const left = await page.evaluate(code => {
    const i = document.createElement('input'); document.body.appendChild(i);
    const dt = new DataTransfer(); dt.setData('text/plain', code);
    const e = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    i.dispatchEvent(e); i.remove(); return !e.defaultPrevented;
  }, CODE);
  check(left, 'a paste into a field goes through');
  check(await scans(page) === before, 'no rescan');
});

test('the release editor fills in the queued barcode', { tag: ['@sandbox', '@login'] }, async ({ page }) => {
  await page.goto(`https://test.musicbrainz.org/release/${BARE}/edit`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await page.waitForSelector('#barcode');
  await page.evaluate(([rel, code]) => localStorage.setItem('pc:pending-barcode:' + rel, code), [BARE, CODE]);
  const src = await functionSource('platform_check', ['pcWaitFor', 'pcMark', 'pcT0', 'pcFillBarcode', 'pcFillBarcodeField']);
  const got = await page.evaluate(([src, rel]) => new Function('PC_CHANNEL', src + '; return pcFillBarcode;')(null)(rel), [src, BARE]);
  check(got === CODE, `it reports the barcode (${got})`);
  check(await page.inputValue('#barcode') === CODE, 'the field has it');
  check(!(await page.evaluate(rel => localStorage.getItem('pc:pending-barcode:' + rel), BARE)), 'the queue is consumed');
  // MusicBrainz's own model took it: its bubble checks the barcode
  await page.focus('#barcode');
  const bubble = await until(() => page.evaluate(() => [...document.querySelectorAll('.bubble')].map(b => b.innerText).find(t => /you entered is a valid/i.test(t)) || null), Boolean, { timeout: 10000 });
  check(/valid EAN/i.test(bubble || ''), `MusicBrainz checks it (${bubble})`);
});

test('a pasted barcode is read and noted', { tag: '@unit' }, async () => {
  const { pcBarcodeOf, pcGtinValid } = await loadFunctions('platform_check', ['pcBarcodeOf', 'pcGtinValid']);
  check(pcBarcodeOf('886443984059') === '886443984059', 'a UPC-A');
  check(pcBarcodeOf(' 0 602508 146107\n') === '0602508146107', 'an EAN-13 with spaces, trimmed');
  check(pcBarcodeOf('5-099750-442227') === '5099750442227', 'dashes are dropped');
  check(pcBarcodeOf('96385074') === '96385074', 'an EAN-8');
  check(pcBarcodeOf('00602508146107') === '00602508146107', 'a GTIN-14');
  for (const t of ['12345', '1234567890', '123456789012345', 'https://example.com/886443984059', 'cat 886443984059', '', null])
    check(pcBarcodeOf(t) === null, `not a barcode: ${JSON.stringify(t)}`);
  check(pcGtinValid('886443984059') && pcGtinValid('0602508146107') && pcGtinValid('96385074'), 'valid check digits');
  check(!pcGtinValid('886443984058'), 'a wrong check digit');

  // its GM storage and URL identity stubbed: the settings at their defaults, URLs compared as given
  const pcEditNote = new Function('GM_getValue', 'pcSameUrl', await functionSource('platform_check', ['pcEditNote']) + '\nreturn pcEditNote;')((k, d) => d, (a, b) => a === b);
  const note = pcEditNote(['https://www.deezer.com/album/1'], {}, '886443984059');
  check(/Added barcode 886443984059/.test(note) && /Added 1 external link:\nhttps:\/\/www\.deezer\.com\/album\/1/.test(note), `the note names the barcode and the links:\n${note}`);
  check(!/barcode \d/.test(pcEditNote(['https://www.deezer.com/album/1'], {})), 'no barcode, no barcode line');
});
