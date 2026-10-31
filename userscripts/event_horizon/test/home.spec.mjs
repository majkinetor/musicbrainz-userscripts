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

test('the home page floats a Sections button above the dock', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/');
  await inject('event_horizon');
  const fab = page.locator('#eh-secfab');
  check(await until(() => fab.count(), n => n === 1) === 1, 'the Sections button shows');
  const at = () => page.evaluate(() => { const f = document.getElementById('eh-secfab').getBoundingClientRect(), d = document.getElementById('mbu-dock'), r = d && d.getBoundingClientRect(); return { f: [f.left, f.right, f.bottom], d: r && [r.left, r.right, r.top] }; });
  const p = await until(at, v => !v.d || Math.abs(v.f[0] - v.d[0]) < 2);
  if (p.d) check(Math.abs(p.f[0] - p.d[0]) < 2 && p.f[2] <= p.d[2] - 4, 'it stands over the dock, not on it: ' + JSON.stringify(p));
  await fab.click();
  const rail = page.locator('#eh-rail.open');
  check(await until(() => rail.count(), n => n === 1) === 1, 'clicking it opens the sections menu');
  const up = await page.evaluate(() => document.getElementById('eh-rail').getBoundingClientRect().bottom <= document.getElementById('eh-secfab').getBoundingClientRect().top);
  check(up, 'the menu opens upward, above the button');
  await page.locator('#eh-rail .rr[data-sec] .eye').first().click();
  check(await until(() => rail.count(), n => n === 1) === 1, 'hiding a section keeps the menu open');
  await page.locator('#eh-rail .rr[data-sec] .eye').first().click();
  await attachShot(testInfo, page, 'home-sections');
  await page.keyboard.press('Escape');
  await page.goto('https://test.musicbrainz.org/artist/89ad4ac3-39f7-470e-963a-56509c546377');
  await inject('event_horizon');
  check(await until(() => page.locator('.kicker [data-ehsec]').count(), n => n === 1) === 1, 'an artist page keeps its Sections button in the header');
  check(await page.locator('#eh-secfab').count() === 0, 'and floats none');
});
