import { test, check, until, settled, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'String Theory' }, pageErrors: ["reading 'querySelectorAll'"] });

const REL = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';

// #847: a tab loaded on a page Platform Check isn't for (an artist) never started it; it starts on a release Event
// Horizon shows there, without a reload
test('Platform Check starts on a release EH shows in a tab loaded elsewhere', { tag: ['@sandbox'] }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/release/${REL}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settled(page);
  const artist = await page.locator('#content a[href*="/artist/"]').first().getAttribute('href');
  await page.goto(new URL(artist, page.url()).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settled(page);
  await page.evaluate(() => localStorage.setItem('mbu.dockOpen', 'true'));
  await inject('string_theory');
  const on = () => page.evaluate(() => document.documentElement.hasAttribute('data-mbu-dock'));
  if (!(await until(on, v => v, 8000))) await page.locator('#eh-launch').click();
  check(await until(on, v => v) === true, 'EH shows');
  check(!(await page.locator('#mb-pc-dock').count()), 'no Platform Check on the artist');
  await page.evaluate(() => { window.__noReload = 1; });
  await page.locator('#app a[href*="/release-group/"]').first().click();
  check(await until(() => page.evaluate(() => location.pathname), p => p.startsWith('/release-group/')) !== null, 'on a release group');
  check(await until(() => page.locator('#falcon-launcher').count(), n => n > 0) > 0, 'Falcon on the release group');
  await page.locator('#app a[href*="/release/"]:not([href*="/add"])').first().click();
  check(await until(() => page.evaluate(() => location.pathname), p => /^\/release\/[0-9a-f-]{36}$/.test(p)) !== null, 'on a release');
  check(await until(() => page.locator('#mb-pc-dock').isVisible(), v => v) === true, 'Platform Check is in the dock');
  check(await until(() => page.locator('#ii-dock').isVisible(), v => v) === true, 'ISRC Scout is in the dock');
  await page.locator('#mb-pc-dock').click();
  check(await until(() => page.locator('.mbu-dock-win #mb-pc-panel').isVisible(), v => v) === true, 'its panel opens');
  check(await until(() => page.locator('#mb-pc-panel [id^="ico-"]').evaluateAll(es => es.filter(e => e.textContent.trim() !== '⚪').length), n => n > 0, 40000) > 0, 'it scanned the release');
  check(await page.evaluate(() => window.__noReload) === 1, 'the page did not reload');
  await attachShot(testInfo, page, 'late-start');
});
