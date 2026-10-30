// #768 (chaban-mb): "PC has configuration to choose used Providers but ISRC Scout doesn't. It
// always tries all supported providers." majkinetor: Scout keeps its own switches, and "maybe this
// deserves redoing entire scout config which is now inline with window but could be the same as
// with other scripts".
//
// test.musicbrainz.org: the settings open as a window over the editor, its Platforms view switches
// a platform off (its import button goes, Match skips it) and SoundExchange's search goes with it.
import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });

test('the settings window, and a platform switched off leaves the editor', { tag: ['@sandbox'] }, async ({ page, inject }, info) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await openScout(page, inject, { release: '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda' });   // links its albums (680-match)
  await page.click('#ii-setup-toggle');
  const win = await page.evaluate(() => {
    const p = document.getElementById('ii-setup-pane'), r = p.getBoundingClientRect(), m = document.getElementById('ii-modal').getBoundingClientRect();
    return { open: p.classList.contains('open'), pos: getComputedStyle(p).position, w: r.width, inside: r.right <= m.right && r.top >= m.top, secs: [...p.querySelectorAll('.ii-cfg-sec')].map(x => x.textContent.trim()) };
  });
  console.log('window: ' + JSON.stringify(win));
  check(win.open && win.pos === 'absolute' && win.w > 300 && win.inside, 'the settings open as a window over the editor');
  check(['MusicBrainz', 'Imports', 'Submitting', 'Release page'].every(x => win.secs.includes(x)), `its sections (${win.secs.join(', ')})`);
  await attachShot(info, page.locator('#ii-setup-pane'), 'settings');
  check(await page.isChecked('#ii-cache-enabled') && await page.inputValue('#ii-cache-days') === '7', 'Match caching defaults to seven days');
  await page.locator('#ii-cache-days').fill('3');
  await page.locator('#ii-cache-days').press('Tab');
  await page.locator('#ii-cache-enabled').uncheck();
  check(await page.evaluate(() => GM_getValue('ii:match_cache_days') === 3 && GM_getValue('ii:match_cache_enabled') === false), 'the cache duration and switch are saved');
  await page.locator('#ii-cache-enabled').check();

  await page.click('#ii-cfg-to-platforms');
  check(await page.evaluate(() => document.getElementById('ii-cfg-main').hidden && !document.getElementById('ii-cfg-platforms').hidden), 'Platforms opens its own view');
  const n = await page.evaluate(() => document.querySelectorAll('#ii-plat-grid input[data-platform]').length);
  check(n === 16 && await page.evaluate(() => [...document.querySelectorAll('#ii-plat-grid input')].every(i => i.checked)), `16 platforms, all on by default (${n})`);
  await attachShot(info, page.locator('#ii-setup-pane'), 'platforms');

  // the release's import buttons, before: one that shows is switched off
  const shownBtn = () => page.evaluate(() => [...document.querySelectorAll('#ii-modal button.ii-tbtn[id$="-all"]')].filter(b => b.style.display !== 'none' && /^ii-[a-z]{2}-all$/.test(b.id) && b.id !== 'ii-sx-all').map(b => b.id));
  const before = await shownBtn();
  console.log('import buttons: ' + before.join(', '));
  const CODE = { 'ii-dz-all': 'deezer', 'ii-sp-all': 'spotify', 'ii-bp-all': 'beatport', 'ii-td-all': 'tidal', 'ii-vo-all': 'volumo', 'ii-hd-all': 'hdtracks', 'ii-qz-all': 'qobuz', 'ii-am-all': 'apple', 'ii-sc-all': 'soundcloud', 'ii-ak-all': 'audiomack', 'ii-sd-all': 'sevendigital' };
  const victim = before.find(id => CODE[id]);
  try {
    if (victim) {
      await page.click(`#ii-plat-grid input[data-platform="${CODE[victim]}"]`);
      check((await until(shownBtn, b => !b.includes(victim))).indexOf(victim) < 0, `switching ${CODE[victim]} off hides its import button`);
    } else check(false, 'the release shows an import button to switch off');
    await page.click('#ii-plat-grid input[data-platform="soundexchange"]');
    check(await until(() => page.evaluate(() => getComputedStyle(document.getElementById('ii-sx-group')).display), d => d === 'none') === 'none', 'switching SoundExchange off hides its search');
    check(/of 16 on/.test(await page.evaluate(() => document.getElementById('ii-cfg-platforms-n').textContent)), 'the count says how many are on');
    // a click outside closes the window, and doesn't press what it lands on
    await page.mouse.click(200, 500);
    check(await until(() => page.evaluate(() => !document.getElementById('ii-setup-pane').classList.contains('open'))), 'a click outside closes it');
    // kept: a reload keeps it off
    const stored = await page.evaluate(() => window.__isrcScoutTestStore.store.get('platform_soundexchange', true));
    check(stored === false, 'the switch is stored');
  } finally {
    await page.evaluate(names => { const s = window.__isrcScoutTestStore.store; names.forEach(k => s.del('platform_' + k)); }, ['soundexchange', ...Object.values(CODE)]);
  }
});
