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
  await page.keyboard.press('Escape');
  check(await until(() => page.locator('#mc-launch').count(), n => n > 0) > 0, 'Mission Control is in the dock');
  await page.locator('#mc-launch').click({ force: true });
  const ttl = await until(() => page.locator('#mc-root .mc-ttl').textContent().catch(() => ''), t => !!(t && t.trim()), 30000);
  const shown = await page.locator('#app h1').first().textContent();
  check(!!ttl && shown.includes(ttl.trim()), 'Mission Control opens on the release shown: ' + ttl + ' / ' + shown);
  check(await page.evaluate(() => window.__noReload) === 1, 'the page did not reload');
  await attachShot(testInfo, page, 'late-start');
});

// #847: a tab loaded on one release, another one shown inside Event Horizon: Mission Control and ISRC Scout follow it, no reload
test('Mission Control and ISRC Scout follow another release EH shows', { tag: ['@sandbox'] }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/release/${REL}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settled(page);
  await page.evaluate(() => localStorage.setItem('mbu.dockOpen', 'true'));
  await inject('string_theory');
  const on = () => page.evaluate(() => document.documentElement.hasAttribute('data-mbu-dock'));
  if (!(await until(on, v => v, 8000))) await page.locator('#eh-launch').click();
  check(await until(on, v => v) === true, 'EH shows');
  await page.evaluate(() => { window.__noReload = 1; });
  const rg = await page.locator('#app a[href*="/release-group/"]').first().getAttribute('href');
  await page.locator('#app a[href*="/artist/"]').first().click();
  check(await until(() => page.evaluate(() => location.pathname), p => p.startsWith('/artist/')) !== null, 'on the artist');
  const otherRg = page.locator(`#app a[href*="/release-group/"]:not([href*="${rg.split('/').pop()}"])`).first();
  check(await until(() => otherRg.count(), n => n > 0) > 0, 'the artist has another release group');
  await otherRg.click();
  check(await until(() => page.evaluate(() => location.pathname), p => p.startsWith('/release-group/')) !== null, 'on another release group');
  await page.locator('#app a[href*="/release/"]:not([href*="/add"])').first().click();
  const id = await until(() => page.evaluate(() => (location.pathname.match(/^\/release\/([0-9a-f-]{36})$/) || [])[1]), v => !!v && v !== REL);
  check(!!id, 'on another release');
  check(await until(() => page.evaluate(() => document.documentElement.getAttribute('data-mbu-release')), v => v === id) === id, 'EH marks it');
  await page.locator('#mc-launch').click({ force: true });
  const ttl = await until(() => page.locator('#mc-root .mc-ttl').textContent().catch(() => ''), t => !!(t && t.trim()), 30000);
  const shown = await page.locator('#app h1').first().textContent();
  check(!!ttl && shown.includes(ttl.trim()), 'Mission Control opens on the release shown: ' + ttl + ' / ' + shown);
  await page.keyboard.press('Escape');
  check(await until(() => page.locator('#mc-root').count(), n => n === 0) === 0, 'Mission Control closes');
  await page.locator('#ii-dock').click({ force: true });
  check(await until(() => page.locator('#ii-modal.open').isVisible(), v => v) === true, 'ISRC Scout opens');
  check(await until(() => page.evaluate(() => document.querySelector('#ii-modal').textContent), t => t.includes(shown.trim().split('\n')[0].trim().slice(0, 12)), 30000) !== null, 'on the release shown');
  check(await page.evaluate(() => window.__noReload) === 1, 'the page did not reload');
  await attachShot(testInfo, page, 'follow');
});
