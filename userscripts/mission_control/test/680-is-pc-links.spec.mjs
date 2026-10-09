// #680 Mission Control: an album link selected in Platform Check's card is not on the release
// yet, but ISRC Scout is probed with it, so its recording links show before Execute adds it.
// The sandbox copy of "Discret Lounge" has no Bandcamp link; a stand-in for Platform Check
// offers the album as withheld (as PC did on production), and ticking it brings the five
// Bandcamp track links into the matrix. A found link opens on click and toggles on right-click. Read only: nothing is submitted.
// Bandcamp answers a request from the harness with its "Client Challenge" page, so the album
// page is a recording (RECORD_WS=fresh to make it again).
import { test, check, until, replayWs } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'd5ecc3bf-98df-4e2d-8b33-ed48dbf30391';   // sandbox copy of "Discret Lounge" (dev/test/sandbox-copies.json)
const ALBUM = 'https://fingersinthenoise.bandcamp.com/album/discret-lounge-june-2011';

test('#680: a selected Bandcamp album gives ISRC Scout its track links', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  const ws = await replayWs(page, new URL('./fixtures/bandcamp-discret-lounge.json.gz', import.meta.url), { paths: /(?!)/, web: /(^|\.)bandcamp\.com$/ });
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await inject('isrc_scout', { waitFor: '__isTest680' });
  // the stand-in PC: answers each probe with the album, withheld, and records what IS was asked
  await page.evaluate(([release, album]) => {
    window.__isAsked = [];
    const send = (type, d) => document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(d) }));
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      if (d.only.includes('is')) window.__isAsked.push(d.links);
      if (d.only.includes('pc')) setTimeout(() => send('mc:findings', { id: 'pc', run: d.run, release, findings: [{ key: 'bandcamp', platform: 'bandcamp', name: 'Bandcamp', url: album, state: 'withheld', why: 'barcode not confirmed' }] }), 50);
    });
    send('mc:provider', { id: 'pc', name: 'Platform Check', version: 1, release, capabilities: ['probe', 'apply'] });
  }, [RELEASE, ALBUM]);

  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  const pcRow = page.locator('#mc-root [data-card="pc"] .mc-pick');
  await pcRow.first().waitFor();
  await page.waitForFunction(() => /\b(add|ok)\b/.test(document.querySelector('#mc-root .mc-step[data-step="is"]').className), null, { timeout: 120_000 });
  const linkCells = () => page.locator('#mc-root .mc-tbl td[data-col="links"]').allTextContents();
  check(!(await linkCells()).some(c => /bandcamp/i.test(c)), 'no Bandcamp track links before the album is selected');
  check(JSON.stringify(await page.evaluate(() => window.__isAsked)) === '[[]]', 'the first probe asks IS with no album links');

  await pcRow.first().click();
  const asked = await until(() => page.evaluate(() => window.__isAsked), a => a.length === 2, { timeout: 5000 });
  check(JSON.stringify(asked[1]) === JSON.stringify([ALBUM]), `ticking it asks IS again, with the album (${JSON.stringify(asked)})`);
  const bc = await until(async () => (await page.locator('#mc-root .mc-tbl td[data-col="links"] .mc-lnk[title*="bandcamp.com/track/"]').count()), n => n >= 5, { timeout: 120_000 });
  const tracks = await page.locator('#mc-root .mc-tbl tbody tr[data-i]').count();
  check(bc === tracks, `every track gets its Bandcamp link (${bc} of ${tracks})`);
  check(!(await page.evaluate(() => window.__isTest680 && window.__isTest680.release && window.__isTest680.release().bandcampUrl)), "IS's own release load keeps no Bandcamp link it doesn't have");

  // a found link opens on click and is taken in or left out on right-click
  const lnk = page.locator('#mc-root .mc-tbl td[data-col="links"] .mc-lnk[title*="bandcamp.com/track/"]').first();
  const was = await lnk.evaluate(el => el.classList.contains('on'));
  const [popup] = await Promise.all([page.waitForEvent('popup'), lnk.click()]);
  check(/bandcamp\.com\/track\//.test(popup.url()), `left-click opens the track link (${popup.url()})`);
  await popup.close();
  check(await lnk.evaluate(el => el.classList.contains('on')) === was, 'left-click leaves the pick as it was');
  await lnk.click({ button: 'right' });
  check(await lnk.evaluate(el => el.classList.contains('on')) === !was, 'right-click toggles it');
  await lnk.click({ button: 'right' });
  check(await lnk.evaluate(el => el.classList.contains('on')) === was, 'a second right-click toggles it back');

  // unticking takes them away again
  await pcRow.first().click();
  const gone = await until(async () => (await page.locator('#mc-root .mc-tbl td[data-col="links"] .mc-lnk[title*="bandcamp.com/track/"]').count()), n => n === 0, { timeout: 120_000 });
  check(gone === 0, `unticking the album drops its track links (${gone} left)`);
  await page.screenshot({ path: 'test-results/mc-680-is-pc-links.png' });
  await ws.done();
});
