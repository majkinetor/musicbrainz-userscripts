// #740: the catalog numbers the platforms give sit in their barcode lanes, beside the barcode, each a toggle of its
// own. A barcode lane is one release, so it shows one per label; the empty-barcode lane may show several. Only the
// release's own lane's starts taken in (PC sends it new), take all in takes a lane's links and never its catalog
// numbers, and a label has one catalog number, so taking one in leaves the label's others out. A stand-in PC answers.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // any sandbox release: the findings are the stand-in's
const L = '25364892-b3e9-4692-bcbe-018fc26b9256';

test('#740: catalog numbers in the barcode lanes', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(L => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    const cat = (code, barcodes, state, platforms) => ({ key: `catno:${L}:${code}`, kind: 'catno', name: 'Cat. no.', code, label: { mbid: L, name: 'Artoffact Records' }, barcodes, platforms, state, why: 'from ' + platforms.join(', ') });
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => send('mc:findings', { id: 'pc', run: d.run, barcode: '628070635924', findings: [
        cat('AOF 146', ['628070635924'], 'new', ['Beatport (linked)', 'Discogs']),
        cat('AOF 146CD', ['628070635931'], 'unsure', ['Qobuz']),
        cat('DIG 146', [''], 'unsure', ['Spotify']), cat('XYZ 1', [''], 'unsure', ['Apple Music']),
        { key: 'beatport', name: 'Beatport', url: 'https://www.beatport.com/release/x/1', state: 'new', barcode: '628070635924' },
        { key: 'discogs', name: 'Discogs', url: 'https://www.discogs.com/release/1', state: 'new', barcode: '628070635924' },
        { key: 'bandcamp', name: 'Bandcamp', url: 'https://x.bandcamp.com/album/y', state: 'new', barcode: '628070635924' },
        { key: 'qobuz', name: 'Qobuz', url: 'https://www.qobuz.com/album/x/1', state: 'withheld', barcode: '628070635931', why: 'barcode differs' },
        { key: 'spotify', name: 'Spotify', url: 'https://open.spotify.com/album/1', state: 'new' },
        { key: 'apple', name: 'Apple Music', url: 'https://music.apple.com/album/1', state: 'new' }] }), 50);
    });
    send('mc:provider', { id: 'pc', name: 'Platform Check', version: 1, capabilities: ['probe', 'apply'] });
  }, L);
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root [data-card="pc"] .mc-cat');

  const card = page.locator('#mc-root [data-card="pc"]');
  const lanes = await card.locator('.mc-bcl').evaluateAll(ls => ls.map(l => ({ bc: (l.querySelector('.mc-bc b') || {}).textContent || '', cats: [...l.querySelectorAll('.mc-cat')].map(c => c.textContent.replace('✓ ', '') + (c.classList.contains('on') ? '+' : '')) })));
  console.log(JSON.stringify(lanes));
  check(JSON.stringify(lanes) === JSON.stringify([{ bc: '628070635924', cats: ['AOF 146+'] }, { bc: '628070635931', cats: ['AOF 146CD'] }, { bc: '', cats: ['DIG 146', 'XYZ 1'] }]),
    'each lane shows its catalog numbers beside its barcode; only the release\'s own lane\'s starts taken in');
  check(await card.locator('.mc-line:has(.mc-bcn)').count() === 0, 'a platform\'s catalog number is no row of its own');
  await page.locator('#mc-root .mc-sect:has([data-card="pc"])').screenshot({ path: 'test-results/mc-740-catno-chips.png' });

  // take all in on the empty lane: its links, not its catalog numbers
  const pk = () => page.evaluate(() => window.__mcTest.picked().pc.filter(k => k.startsWith('catno:')).map(k => k.split(':').pop()).sort());
  await page.evaluate(() => { const st = window.__mcTest.picked().pc; return st; });
  const emptyAll = card.locator('.mc-bcl[data-lane=""] [data-act="lane-all"]');
  if (await emptyAll.count()) { await emptyAll.click(); await emptyAll.click(); }
  check(JSON.stringify(await pk()) === JSON.stringify(['AOF 146']), `take all in leaves the empty lane's catalog numbers alone (${await pk()})`);

  // one per label
  await card.locator('.mc-cat:text("DIG 146")').click();
  check(JSON.stringify(await pk()) === JSON.stringify(['DIG 146']), `taking DIG 146 in leaves AOF 146 out (${await pk()})`);
  await card.locator('.mc-cat:text("DIG 146")').click();
  check((await pk()).length === 0, 'a second click leaves it out');
  check(await card.locator('.mc-bcl.open').count() === 0, 'a click on a catalog number doesn\'t open its lane');
});
