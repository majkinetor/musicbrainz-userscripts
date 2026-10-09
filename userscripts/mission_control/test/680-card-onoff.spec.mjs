// #680: a card's own icon in its header switches it on and off. An off card folds to its header, and
// Execute leaves out what is selected in it, and so does its count. For this page only: nothing is
// saved. Stand-in PC and AS answer the probe with one selected finding each and record what is applied.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // any sandbox release: the findings are the stand-ins'

test('#680: a card switched off is left out of Execute', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    window.__applied = [];
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => {
        send('mc:findings', { id: 'pc', run: d.run, findings: [{ key: 'deezer', name: 'Deezer', url: 'https://www.deezer.com/album/1', state: 'new' }] });
        send('mc:findings', { id: 'as', run: d.run, findings: [{ key: 'discogs', name: 'Discogs', url: 'https://www.discogs.com/release/1', state: 'new' }] });
      }, 50);
    });
    document.addEventListener('mc:apply', e => {
      const d = JSON.parse(e.detail);
      window.__applied.push(d.id);
      setTimeout(() => send('mc:applied', { id: d.id, run: d.run, ok: true, sent: 0, note: 'dry run' }), 20);
    });
    ['pc', 'as'].forEach(id => send('mc:provider', { id, name: id, version: 1, capabilities: ['probe', 'apply'] }));
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root [data-card="as"] .mc-line');
  const exec = page.locator('#mc-root [data-act="exec"]');
  check(await exec.textContent() === 'Execute (2)', `both cards count (${await exec.textContent()})`);

  const sw = id => page.locator(`#mc-root .mc-sect[data-sect="${id}"] .mc-sect-h .mc-icsw`);
  check(await page.locator('#mc-root .mc-sect-h .mc-icsw').count() === 4, "every card's icon is its switch: tracks, links, cover art, release credits");
  check(await sw('pc').getAttribute('aria-pressed') === 'true', 'on to begin with');
  await sw('pc').locator('.ic').click();   // the icon
  check(await sw('pc').getAttribute('aria-pressed') === 'false' && /Left out/.test(await sw('pc').getAttribute('title')), 'a click on the icon switches it off, and its tooltip says so');
  check(!(await page.locator('#mc-root [data-card="pc"]').isVisible()) && await page.locator('#mc-root .mc-sect[data-sect="pc"] .mc-sect-h').isVisible(), 'the off card is folded to its header');
  check(await exec.textContent() === 'Execute (1)', `its tick leaves the count (${await exec.textContent()})`);
  await page.screenshot({ path: 'test-results/mc-680-card-onoff.png' });

  await page.evaluate(() => window.__mcTest.execute(true));
  check(JSON.stringify(await page.evaluate(() => window.__applied)) === '["as"]', `Execute applies only the card that is on (${JSON.stringify(await page.evaluate(() => window.__applied))})`);
  check(JSON.stringify((await page.evaluate(() => window.__mcTest.picked())).pc) === '["deezer"]', 'the off card keeps its tick, for when it is switched on again');
  const saved = await page.evaluate(() => JSON.stringify(window.__mcTest.settings()));
  check(!/pc|off/.test(saved.replace(/"(fusion|ch)":"\w+",?/g, '')), `nothing about it is saved (${saved})`);

  await sw('pc').locator('.t').click();   // the title: icon and title are one switch
  check(await page.locator('#mc-root [data-card="pc"]').isVisible() && await exec.textContent() === 'Execute (2)', 'on again: unfolded, and counted');
  await sw('tracks').click();
  check(!(await page.locator('#mc-root .mc-tbl').isVisible()), 'Tracks can be switched off too');
});
