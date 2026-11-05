import { test, check, until, requireLogin, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Necessary Evil' } });

// #852: a release with a Discogs link gets the panel, collects tags and offers genres
test('collects genres from the links', { tag: ['@sandbox', '@web'] }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/release-group/b1392450-e666-3926-a536-22c65f834433');
  await requireLogin(page);
  await inject('necessary_evil', { waitFor: '__necessaryEvil' });
  if (!(await page.locator('.ne-body').count())) await page.click('.ne-head .ne-sum');
  await until(() => page.evaluate(() => window.__necessaryEvil.ran && !window.__necessaryEvil.busy), b => b, { timeout: 90000 });
  const n = await page.evaluate(() => window.__necessaryEvil.tags.size);
  await attachShot(testInfo, page.locator('.ne-box'), 'panel');
  check(n > 0, 'tags collected (' + n + ')');
});

// #852: Vote sends one batched ws/2 POST, Withdraw takes it back
test('votes and withdraws', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/release-group/b1392450-e666-3926-a536-22c65f834433');
  await requireLogin(page);
  await inject('necessary_evil', { waitFor: '__necessaryEvil' });
  if (!(await page.locator('.ne-body').count())) await page.click('.ne-head .ne-sum');
  await until(() => page.evaluate(() => window.__necessaryEvil.ran && !window.__necessaryEvil.busy), b => b, { timeout: 90000 });
  if (!(await page.locator('.ne-chip').count())) await page.click('[data-a=all]');
  await page.evaluate(() => window.__necessaryEvil.sel.clear());
  await page.locator('.ne-chip').first().click();
  const text = await page.locator('.ne-chip.sel').first().innerText();
  await page.click('[data-a=vote]');
  check(/Voted 1 tag/.test(await until(() => page.locator('#mbu-toast').innerText().catch(() => ''), t => /Voted|failed/.test(t))), 'vote toast ok (' + text + ')');
  await page.click('[data-a=withdraw]');
  check(/Withdrew/.test(await until(() => page.locator('#mbu-toast').innerText().catch(() => ''), t => /Withdrew|failed/.test(t))), 'withdraw toast ok');
});
