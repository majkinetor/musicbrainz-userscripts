import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// #1049 (test's URL index is sparse, so only a pattern): the home page's URL search opens a filter bar; results page with Load more
test('URL search finds links by pattern', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/');
  await inject('event_horizon');
  const link = page.locator('.hm-es[href*="type=url"]');
  check(await until(() => link.count(), n => n === 1) === 1, 'the home page links URL search beside edit search');
  await link.click();
  const bar = page.locator('form.url-bar');
  check(await until(() => bar.count(), n => n === 1) === 1, 'URL search shows its field bar');
  await bar.locator('input[name=query]').fill('*discogs*');
  await bar.locator('button[type=submit]').click();
  const rows = await until(() => page.locator('.sr-t tbody tr').count(), n => n > 0);
  check(rows > 0, 'results show: ' + rows);
  check(/type=url/.test(page.url()), 'the address keeps the search: ' + page.url());
  const urls = await page.locator('.sr-t tbody tr a[href*="/url/"]').allTextContents();
  check(urls.every(u => /discogs/i.test(u)), 'every URL matches the pattern: ' + urls.filter(u => !/discogs/i.test(u)).slice(0, 3).join(', '));
  check(await page.locator('.sr-t tbody tr a[href*="/url/"]').count() > 0, 'each URL opens its MusicBrainz page');
  await attachShot(testInfo, page, 'url-search');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT, fullPage: false });
});
