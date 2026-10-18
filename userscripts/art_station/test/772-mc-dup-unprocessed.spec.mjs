// #772: a cover entered lately has no thumbnail yet (the archive makes them later), so its fingerprint failed and
// Mission Control offered the same store image again on the next probe. Art Station now fingerprints the original then.
//
// The release is linked to a Discogs release whose back is already in the archive (the real store, so @web); every
// thumbnail is made to miss here, as a just-entered cover's does. Read-only: nothing is applied.
import { test, check, until, requireLogin, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Art Station' } });

const REL = '1c0d1707-e032-48a4-acd8-dbaac77be17f';   // Journey Inwards, linked to discogs.com/release/1118432, with its back
const noThumbs = code => code.replace('hashOf(thumb(x.id, 250))', 'hashOf(thumb(x.id, 250) + "-missing")');

test('#772: a store image already in the archive is marked so while its thumbnail is not made yet', { tag: ['@sandbox', '@login', '@web'] }, async ({ page, inject }) => {
  test.setTimeout(240_000);
  await page.goto(`${SANDBOX}/release/${REL}`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await inject('art_station');
  await page.evaluate(() => {
    window.__f = null;
    document.addEventListener('mc:findings', e => { window.__f = JSON.parse(e.detail); });
    document.dispatchEvent(new CustomEvent('mc:probe', { detail: JSON.stringify({ run: 1 }) }));
  });
  const fr = await until(() => page.frames().find(f => /mc_frame=/.test(f.url())) || null, Boolean, { timeout: 60000 });
  check(fr, 'the frame opens');
  await fr.waitForLoadState('domcontentloaded');
  await inject('art_station', { target: fr, transform: noThumbs });
  await page.waitForFunction(() => window.__f, null, { timeout: 150_000, polling: 500 });
  const extras = await until(() => fr.evaluate(() => window.__asTest.mc.model().filter(x => x._mcPool && x._mcKey).map(x => [x._mcKey, x._mcDup || ''])), v => v.length > 0);
  console.log('offered', JSON.stringify(extras));
  const back = extras.find(e => e[0] === 'Discogs#2');
  check(back, `the back is offered (${JSON.stringify(extras)})`);
  check(/^in archive/.test(back[1]), `the back is marked as in the archive (${back[1] || 'not marked'})`);
});
