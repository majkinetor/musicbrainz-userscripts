import { test, check, until, settled, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' }, profile: 'fresh' });

// Voodoo Funk: Discogs is current, the homepage voodoofunk.com has ended on MusicBrainz
const LABEL = '93b9dc27-dc74-4a5a-91f5-98951610366f';
const MB = 'https://musicbrainz.org';

test('ended links: out of the header into a menu, greyed on Relationships, with the link\'s URL page', async ({ page, inject }, testInfo) => {
  await page.goto(`${MB}/label/${LABEL}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settled(page);
  await inject('event_horizon');
  const more = page.locator('#app .rl-end > button');
  check(await until(() => more.count(), n => n > 0) > 0, 'the header has a +N ended control');
  check(/\+1 ended/.test(await more.first().textContent()), 'counting the one ended link');
  check(!(await page.locator('#app .rl-one > a[href*="voodoofunk"]').count()), 'the ended homepage is not among the icons');
  await more.first().click();
  check(await page.locator('#app .rl-end .pop a.row[href*="voodoofunk"]').isVisible(), 'its menu lists the ended homepage');
  await attachShot(testInfo, page.locator('#app .rl-end').first(), 'header-ended');

  await page.goto(`${MB}/label/${LABEL}/relationships`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settled(page);
  await inject('event_horizon');
  const chip = page.locator('#app .uchip.end[href*="voodoofunk"]');
  check(await until(() => chip.count(), n => n > 0) > 0, 'the ended chip is greyed');
  check(await page.locator('#app .uchip.end + .end-pill').count() > 0, 'with an ended pill');
  const info = page.locator('#app a.u-info').first();
  check(await info.count() > 0, 'a link has its info');
  const href = await info.getAttribute('href');
  check(/\/url\/[0-9a-f-]{36}$/.test(href || ''), 'info leads to the URL page: ' + href);
  await attachShot(testInfo, page.locator('#app .card', { has: page.locator('.uchip.end') }).first(), 'relationships-ended');

  await info.click();
  check(await until(() => page.locator('#app .kick, #app [class*=kick]').first().textContent().catch(() => ''), t => /URL/.test(t)), 'the URL page opens in EH');
  check(await until(() => page.locator('#app .rls a[href*="/label/"]').count(), n => n > 0) > 0, 'listing the label it belongs to');
  await attachShot(testInfo, page.locator('#app'), 'url-page');
});
