import { test, check, until, settled, attachShot } from '../../../dev/test/harness.mjs';

// Art Station beside EH throws on this page on main too: not this spec's to fix
test.use({ gm: { name: 'Event Horizon' }, pageErrors: ["reading 'querySelectorAll'"] });

const REL = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';

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

// #847: a release opened on its History has no sidebar on MusicBrainz's page; at its Overview inside EH, Platform
// Check is in the dock all the same, and a click opens its panel for this release, never reloading the page
test('Platform Check opens from the dock after History → Overview', { tag: ['@sandbox'] }, async ({ page, inject }, testInfo) => {
  const REL2 = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';
  await page.goto(`https://test.musicbrainz.org/release/${REL2}/edits`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settled(page);
  await page.evaluate(() => localStorage.setItem('mbu.dockOpen', 'true'));
  await inject('platform_check');
  await inject('event_horizon');
  const on = () => page.evaluate(() => document.documentElement.hasAttribute('data-mbu-dock'));
  if (!(await on())) await page.locator('#eh-launch').click();
  check(await until(on, v => v) === true, 'EH shows');
  await page.evaluate(() => { window.__noReload = 1; });
  check(!(await page.locator('#mb-pc-dock').isVisible()), 'no Platform Check on the History');
  await page.locator(`#app a[href$="/release/${REL2}"]`).first().click();
  check(await until(() => page.evaluate(() => location.pathname), p => p === `/release/${REL2}`) !== null, 'on the overview');
  check(await until(() => page.locator('#mb-pc-dock').isVisible(), v => v) === true, 'Platform Check is in the dock');
  await page.locator('#mb-pc-dock').click();
  check(await until(() => page.locator('.mbu-dock-win #mb-pc-panel').isVisible(), v => v) === true, 'its panel opens');
  check(await until(() => page.locator('#mb-pc-panel [id^="ico-"]').evaluateAll(es => es.filter(e => e.textContent.trim() !== '⚪').length), n => n > 0) > 0, 'it scanned the release');
  check(await page.evaluate(() => window.__noReload) === 1, 'the page did not reload');
  await attachShot(testInfo, page, 'pc-after-history');
});

// #847: Platform Check started on a release page follows the release EH shows next, without a reload
test('Platform Check follows another release shown inside EH', { tag: ['@sandbox'] }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/release/${REL}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settled(page);
  await inject('platform_check');
  await inject('event_horizon');
  const on = () => page.evaluate(() => document.documentElement.hasAttribute('data-mbu-dock'));
  if (!(await on())) await page.locator('#eh-launch').click();
  check(await until(on, v => v) === true, 'EH shows');
  await page.evaluate(() => { window.__noReload = 1; });
  await page.locator('#app a[href*="/artist/"]').first().click();
  check(await until(() => page.evaluate(() => location.pathname), p => p.startsWith('/artist/')) !== null, 'on the artist');
  check(await page.evaluate(() => document.documentElement.hasAttribute('data-mbu-release')) === false, 'no release named on the artist');
  // the artist lists release groups: one that isn't this release's (MusicBrainz's page, hidden, links that one)
  const rg = await until(() => page.evaluate(() => {
    const id = a => (a.getAttribute('href').match(/\/release-group\/([0-9a-f-]{36})$/) || [])[1];
    const own = new Set([...document.querySelectorAll('#page a[href*="/release-group/"]')].map(id));
    return [...document.querySelectorAll('#app a[href*="/release-group/"]')].map(id).find(r => r && !own.has(r)) || null;
  }), v => v);
  check(!!rg, 'another release group on the artist');
  if (!rg) return;
  await page.locator(`#app a[href$="/release-group/${rg}"]`).first().click();
  check(await until(() => page.evaluate(() => location.pathname), p => p.startsWith('/release-group/')) !== null, 'on a release group');
  const other = await until(() => page.locator('#app a[href*="/release/"]').evaluateAll((as, rel) => as.map(a => (a.getAttribute('href').match(/\/release\/([0-9a-f-]{36})$/) || [])[1]).find(id => id && id !== rel) || null, REL), v => v);
  check(!!other, 'another release on the artist');
  if (!other) return;
  await page.locator(`#app a[href$="/release/${other}"]`).first().click();
  check(await until(() => page.evaluate(() => document.documentElement.getAttribute('data-mbu-release')), v => v === other) === other, 'EH names the release it shows');
  check(await until(() => page.locator('#mb-pc-dock').isVisible(), v => v) === true, 'Platform Check is in the dock');
  await page.locator('#mb-pc-dock').click();
  check(await until(() => page.locator('.mbu-dock-win #mb-pc-panel').isVisible(), v => v) === true, 'its panel opens');
  check(await until(() => page.locator('#mb-pc-panel [id^="ico-"]').evaluateAll(es => es.filter(e => e.textContent.trim() !== '⚪').length), n => n > 0) > 0, 'it scanned the release');
  check(await page.evaluate(() => window.__noReload) === 1, 'the page did not reload');
  check(await until(() => page.locator(`#mb-pc-panel a[href$="/release/${other}"]`).count(), n => n > 0) > 0, 'its panel is for the release shown');
  await attachShot(testInfo, page, 'pc-follows');
});
