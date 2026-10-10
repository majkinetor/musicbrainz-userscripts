// #709: a release without a barcode can get one from Mission Control. PC sends each barcode the
// platforms report (kind 'barcode'): they are rows at the top of the Release section, the one PC
// is sure of (reported by a link the release has) taken in. A release has one barcode, so taking
// another in leaves the first out. Once Falcon is done, the row reads added. A stand-in PC answers.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // any sandbox release: the findings are the stand-in's

test('#709: barcode rows lead the Release section, one taken in at a time', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => send('mc:findings', { id: 'pc', run: d.run, barcode: null, findings: [
        { key: 'barcode:5099902940729', kind: 'barcode', name: 'Barcode', code: '5099902940729', state: 'new', why: 'from Discogs (linked)', platforms: ['discogs'] },
        { key: 'barcode:012345678905', kind: 'barcode', name: 'Barcode', code: '012345678905', state: 'unsure', why: 'from Deezer', platforms: ['deezer'] },
        { key: 'discogs', name: 'Discogs', url: 'https://www.discogs.com/release/349958', state: 'linked', barcode: '5099902940729' },
        { key: 'deezer', name: 'Deezer', url: 'https://www.deezer.com/album/1', state: 'withheld', why: 'barcode 012345678905 differs from the release\'s', barcode: '012345678905' }] }), 50);
    });
    send('mc:provider', { id: 'pc', name: 'Platform Check', version: 1, capabilities: ['probe', 'apply'] });
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root [data-card="pc"] .mc-line');

  const card = page.locator('#mc-root [data-card="pc"]');
  const first = await card.evaluate(c => { const sub = c.querySelector('.mc-sub[data-sub="release"]'); const n = sub && sub.nextElementSibling; return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; });
  check(/^✓?\s*Barcode 5099902940729/.test(first), `the barcode leads the Release section (${first})`);
  const bc = await card.locator('.mc-line:has(.mc-bcn)').evaluateAll(ls => ls.map(l => ({ code: l.querySelector('.mc-bcn').textContent, on: l.classList.contains('on'), why: (l.querySelector('div.s') || {}).textContent, svg: !!l.querySelector('.mc-pico svg') })));
  console.log(JSON.stringify(bc));
  check(bc.length === 2 && bc[0].on && !bc[1].on, 'two barcode rows; the sure one is taken in');
  check(bc[0].why === 'from Discogs (linked)' && bc.every(b => b.svg), 'each says where it is from, with a barcode icon');
  check(await card.locator('.mc-bcl .mc-ti[data-key^="barcode:"]').count() === 0, 'the barcodes are not in the lanes');

  // taking the other in leaves the first out
  await card.locator('.mc-line:has(.mc-bcn:text("012345678905"))').click();
  let pk = (await page.evaluate(() => window.__mcTest.picked().pc)).filter(k => k.startsWith('barcode:'));
  check(pk.join() === 'barcode:012345678905', `one barcode at a time (${pk})`);
  await card.locator('.mc-line:has(.mc-bcn:text("012345678905"))').click();
  pk = (await page.evaluate(() => window.__mcTest.picked().pc)).filter(k => k.startsWith('barcode:'));
  check(pk.length === 0, 'and a second click leaves it out');
  check((await page.locator('#mc-root [data-act="exec"]').textContent()) === 'Execute', 'nothing to execute then');
  await card.locator('.mc-line:has(.mc-bcn:text("5099902940729"))').click();
  check((await page.locator('#mc-root [data-act="exec"]').textContent()) === 'Execute (1)', 'the barcode counts as one change');
  await page.locator('#mc-root .mc-sect:has([data-card="pc"])').screenshot({ path: 'test-results/mc-709-barcode-rows.png' });
});
