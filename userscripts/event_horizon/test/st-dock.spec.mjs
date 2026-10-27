import { test, check, until, settled, attachShot } from '../../../dev/test/harness.mjs';

// Art Station beside EH throws on this page on main too: not this spec's to fix
test.use({ gm: { name: 'Event Horizon' }, pageErrors: ["reading 'querySelectorAll'"] });

const REL = '0a0d6d1b-8a4b-4ab4-9de3-9f4a5c5b8a6e';

// #847: while EH shows, the other scripts' corner launchers fold behind String Theory's dock
test('the corner launchers fold behind the dock while EH shows', { tag: ['@sandbox'] }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/release/54b7bca2-7ed6-4484-bdd3-fe35a3f33dda', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settled(page);
  await inject('mission_control');
  await inject('art_station');
  await inject('fusion');
  await inject('event_horizon');
  const on = () => page.evaluate(() => document.documentElement.hasAttribute('data-mbu-dock'));
  if (!(await on())) await page.locator('#eh-launch').click();
  check(await until(on, v => v) === true, 'EH turns the dock on');
  check(await page.locator('#mbu-dock').isVisible(), 'the dock shows');
  check(await page.locator('#eh-launch').isVisible(), 'EH\'s own switch stays out of it');
  check(!(await page.locator('#mc-launch').isVisible()), 'Mission Control folds in');
  check(!(await page.locator('#as-switch').isVisible()), 'Art Station is hidden');
  await page.locator('#mbu-dock').click();
  check(await page.locator('#mc-launch').isVisible(), 'a click unrolls it');
  check(await page.evaluate(() => localStorage.getItem('mbu.dockOpen')) === 'true', 'and it is remembered');
  check(!(await page.locator('#as-switch').isVisible()), 'Art Station stays hidden');
  const mc = await page.locator('#mc-launch').boundingBox(), dock = await page.locator('#mbu-dock').boundingBox();
  check(mc.y + mc.height <= dock.y, 'above the dock');
  await attachShot(testInfo, page, 'dock-open');
  await page.evaluate(() => { localStorage.setItem('mbu.cornerFlow', '"row"'); });
  await page.locator('#mbu-dock').click(); await page.locator('#mbu-dock').click();
  await attachShot(testInfo, page, 'dock-row');
  await page.evaluate(() => { localStorage.removeItem('mbu.cornerFlow'); });
  await page.locator('#eh-launch').click();
  check(await until(on, v => !v) === false, 'EH off turns the dock off');
});
