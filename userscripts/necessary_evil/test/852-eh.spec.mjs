import { test, check, until, requireLogin, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Necessary Evil' } });

// #852: Event Horizon's header pencil gets a row of the collected tags; a click adds one through EH, × takes it back
test('offers its tags in Event Horizon\'s tag editor', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/release-group/b1392450-e666-3926-a536-22c65f834433');
  await requireLogin(page);
  await inject('event_horizon');
  await inject('necessary_evil', { waitFor: '__necessaryEvil' });
  await until(() => page.locator('button.eh-edit[data-tgin="open"]').count(), n => n > 0);
  await page.click('button.eh-edit[data-tgin="open"]');
  await until(() => page.evaluate(() => window.__necessaryEvil.ran && !window.__necessaryEvil.busy), b => b, { timeout: 90000 });
  check(await page.locator('[data-tgin]:not(button) + .ne-eh').count() === 1, 'the row sits under the editor');
  if (!(await page.locator('.ne-eh .ne-chip').count())) await page.click('.ne-eh [data-a=all]');
  const chip = page.locator('.ne-eh .ne-chip').first();
  const name = (await chip.getAttribute('data-t'));
  await attachShot(testInfo, page.locator('.ne-eh'), 'row');
  await chip.click();
  const mine = page.locator('.tgi.mine', { hasText: name });
  check(await until(() => mine.count(), n => n === 1) === 1, 'EH added ' + name);
  check(await page.locator('.ne-eh .ne-chip[data-t="' + name + '"]').count() === 0, 'the row drops what is tagged');
  await mine.locator('button').click();
  check(await until(() => mine.count(), n => n === 0) === 0, 'withdrawn');
  await page.click('button[data-tgin="close"]');
  check(await until(() => page.locator('.ne-eh').count(), n => n === 0) === 0, 'Done removes the row');
});
