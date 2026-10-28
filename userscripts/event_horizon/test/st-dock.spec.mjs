import { test, check, until, settled, attachShot } from '../../../dev/test/harness.mjs';

// Art Station beside EH throws on this page on main too: not this spec's to fix
test.use({ gm: { name: 'Event Horizon' }, pageErrors: ["reading 'querySelectorAll'"] });

const REL = '0a0d6d1b-8a4b-4ab4-9de3-9f4a5c5b8a6e';

// #847: while EH shows, the other scripts' corner launchers fold behind String Theory's dock
test('the corner launchers fold behind the dock while EH shows', { tag: ['@sandbox'] }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/release/54b7bca2-7ed6-4484-bdd3-fe35a3f33dda', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settled(page);
  await page.evaluate(() => localStorage.removeItem('mbu.dockOpen'));   // folded, whatever an earlier run left
  await inject('mission_control');
  await inject('art_station');
  await inject('fusion');
  await inject('platform_check');
  await inject('isrc_scout');
  await inject('event_horizon');
  const on = () => page.evaluate(() => document.documentElement.hasAttribute('data-mbu-dock'));
  if (!(await on())) await page.locator('#eh-launch').click();
  check(await until(on, v => v) === true, 'EH turns the dock on');
  check(await page.locator('#mbu-dock').isVisible(), 'the dock shows');
  check(!(await page.locator('#eh-launch').isVisible()), 'EH switch folds in too');
  check(!(await page.locator('#mc-launch').isVisible()), 'Mission Control folds in');
  check(!(await page.locator('#as-switch').isVisible()), 'Art Station is hidden');
  await page.locator('#mbu-dock').click();
  check(await page.locator('#mc-launch').isVisible(), 'a click unrolls it');
  check(await page.evaluate(() => localStorage.getItem('mbu.dockOpen')) === 'true', 'and it is remembered');
  check(await page.locator('#ii-dock').isVisible() && await page.locator('#mb-pc-dock').isVisible(), 'ISRC Scout and Platform Check are in it');
  await page.locator('#mb-pc-dock').click();
  check(await page.locator('.mbu-dock-win #mb-pc-panel').isVisible(), 'Platform Check opens its panel in a window');
  const onTop = sel => page.evaluate(sel => { const w = document.querySelector(sel); w.style.pointerEvents = 'auto'; const r = w.getBoundingClientRect(), out = [];
    for (const el of document.querySelectorAll('.mbu-dock-item,#mbu-dock')) { const b = el.getBoundingClientRect(), x = b.x + b.width / 2, y = b.y + b.height / 2;
      if (b.width && x > r.left && x < r.right && y > r.top && y < r.bottom) { const h = document.elementFromPoint(x, y); if (!w.contains(h)) out.push(el.id || el.className); } }
    w.style.pointerEvents = ''; return out.join(' '); }, sel);
  check(await onTop('.mbu-dock-win') === '', 'no dock icon draws over its window');
  await attachShot(testInfo, page, 'dock-pc');
  await page.keyboard.press('Escape');
  check(!(await page.locator('.mbu-dock-win').isVisible()), 'Escape closes it');
  await page.locator('#ii-dock').click();
  check(await until(() => page.locator('#ii-modal').isVisible(), v => v) === true, 'ISRC Scout opens its editor');
  await page.keyboard.press('Escape');
  check(!(await page.locator('#as-switch').isVisible()), 'Art Station stays hidden');
  const mc = await page.locator('#mc-launch').boundingBox(), dock = await page.locator('#mbu-dock').boundingBox();
  check(mc.y + mc.height <= dock.y, 'above the dock');
  await page.mouse.move(10, 10);
  await attachShot(testInfo, page, 'dock-open');
  // no names beside the entries, only a state where one has it: ISRC Scout's count
  check(await page.locator('#mb-pc-dock').evaluate(e => getComputedStyle(e, '::after').content).then(c => !/Platform/.test(c)), 'Platform Check shows no name');
  check(await until(() => page.locator('#ii-dock').evaluate(e => getComputedStyle(e, '::after').content), c => /\d|\u2713/.test(c)) !== null, 'ISRC Scout shows its count');
  await page.locator('#ii-dock').hover();
  check(await until(() => page.locator('#mbu-tip').innerText().catch(() => ''), t => /ISRCs/.test(t)) !== null, 'its hover card names the ISRCs');
  check(await onTop('#mbu-tip') === '', 'no dock icon draws over the card');
  await page.mouse.move(10, 10);
  await page.evaluate(() => { localStorage.setItem('mbu.cornerFlow', '"row"'); });
  await page.locator('#mbu-dock').click(); await page.locator('#mbu-dock').click();
  await attachShot(testInfo, page, 'dock-row');
  check(await page.locator('#ii-dock').evaluate(e => getComputedStyle(e, '::after').bottom) !== 'auto', 'its count goes over the icon in a row');
  await page.evaluate(() => { localStorage.removeItem('mbu.cornerFlow'); });
  // to the artist inside EH: Mission Control runs on release pages only, and stays behind
  await page.locator('#app a[href*="/artist/"]').first().click();
  check(await until(() => page.evaluate(() => location.pathname), p => p.startsWith('/artist/')) !== null, 'on the artist');
  check(await until(() => page.locator('#mc-launch').isVisible(), v => !v) === false, 'Mission Control is gone from the artist');
  await page.locator('#eh-launch').click();
  check(await until(on, v => !v) === false, 'EH off turns the dock off');
});
