import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test('the home page shows search, Add, You and the tab icon', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/');
  await inject('event_horizon');
  const secs = await until(() => page.evaluate(() => [...document.querySelectorAll('#app>section.sec')].map(x => x.id)), v => v.length >= 2);
  check(['s-hme', 's-hrec'].every(x => secs.includes(x)), 'the home sections: ' + secs.join(', '));
  check(await page.locator('.hm-srch input[name=query]').count() === 1, 'the search box shows');
  check(await page.locator('.hm-add a[href$="/release/add"]').count() === 1, 'Add release links to the release editor');
  check(await page.locator('.hm-adv select[name=method]').count() === 1, 'advanced search carries the search method');
  if (await page.locator('.hm-pf').count()) check(await until(() => page.locator('.hm-st').count(), n => n === 4) === 4, 'the profile card fills in its edit totals');
  check(await page.evaluate(() => !!document.getElementById('eh-icon')), 'the tab shows Event Horizon\'s icon');
  await attachShot(testInfo, page, 'home');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT, fullPage: true });
});

test('an artist page leads back to the home page', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/artist/89ad4ac3-39f7-470e-963a-56509c546377');
  await inject('event_horizon');
  const home = page.locator('.kicker a.eh-home');
  check(await until(() => home.count(), n => n === 1) === 1, 'the home icon shows right of search');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace('.png', '-artist.png'), clip: { x: 0, y: 0, width: 1600, height: 300 } });
  await home.click();
  check(await until(() => page.locator('.hm-add').count(), n => n === 1) === 1, 'clicking it opens the home page');
  const kind = page.locator('.hm-rec .hm-r .hm-rk').first();
  check(await until(() => kind.count(), n => n === 1) === 1 && await kind.getAttribute('data-tip') === 'Artist', 'recently opened marks the artist with its icon, named in its tooltip');
  check(await kind.locator('svg').count() === 1, 'the kind is an icon, not a word');
  if (process.env.EH_SHOT) await page.locator('#s-hrec').screenshot({ path: process.env.EH_SHOT.replace('.png', '-recent.png') });
});
