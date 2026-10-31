import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// MusicBrainz's numbered pager gives way to the standard foot: Load more brings the next page in under the rows
const rows = page => page.locator('#app .sr-t tbody tr').count();
const foot = (page, k) => page.locator(`#app [data-lm="${k}"]`);

test('a search loads its next page under the rows, by Load more', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/search?query=love&type=artist&method=indexed');
  await inject('event_horizon');
  const n0 = await until(() => rows(page), n => n >= 25);
  check(n0 === 25, 'the first page shows 25 rows: ' + n0);
  check(await page.locator('#app .pagination, #app .sr-pg').count() === 0, 'no numbered pager');
  check(await until(() => foot(page, 'sr').count(), n => n === 1) === 1, 'the Load more foot shows');
  check(/^25 of [\d,]+$/.test(await foot(page, 'sr').locator('span').first().textContent()), 'the foot says how many of how many');
  await page.click('#app [data-lmgo="sr"]');
  const n1 = await until(() => rows(page), n => n >= 50);
  check(n1 === 50, 'Load more adds the next 25: ' + n1);
  check(await page.locator('#app [data-lm="sr"]').getAttribute('data-lmn') === '50', 'the foot counts them');
  await attachShot(testInfo, page, 'search');
});

test('a tag page loads its next page into its cards, by Load more', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/tag/rock/artist');
  await inject('event_horizon');
  const items = () => page.locator('#app .tgx-l li').count();
  const n0 = await until(items, n => n > 0);
  check(n0 > 0, 'the tag page lists its artists: ' + n0);
  check(await page.locator('#app .tgx-pg, #app [data-tgxpg]').count() === 0, 'no numbered pager');
  check(await until(() => foot(page, 'tgx').count(), n => n === 1) === 1, 'the Load more foot shows');
  await page.click('#app [data-lmgo="tgx"]');
  const n1 = await until(items, n => n > n0);
  check(n1 > n0, `Load more adds the next page: ${n0} → ${n1}`);
  await attachShot(testInfo, page, 'tag');
});
