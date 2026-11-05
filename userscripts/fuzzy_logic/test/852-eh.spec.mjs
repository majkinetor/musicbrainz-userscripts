import { test, check, until, requireLogin, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Fuzzy Logic' } });

// #852: Event Horizon's header pencil gets a button under its box; the window it opens votes through EH
test('votes through Event Horizon\'s tag editor', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/release-group/b1392450-e666-3926-a536-22c65f834433');
  await requireLogin(page);
  await inject('event_horizon');
  await inject('fuzzy_logic', { waitFor: '__fuzzyLogic' });
  await until(() => page.locator('button.eh-edit[data-tgin="open"]').count(), n => n > 0);
  await page.click('button.eh-edit[data-tgin="open"]');
  await until(() => page.evaluate(() => window.__fuzzyLogic.ran && !window.__fuzzyLogic.busy), b => b, { timeout: 90000 });
  check(await page.locator('[data-tgin]:not(button) + .fl-ehb').count() === 1, 'the button sits under the editor');
  await page.click('.fl-ehb');
  if (!(await page.locator('.fl-row:not(.have):not(.bad)').count())) await page.click('[data-a=alltags]');
  await page.evaluate(() => window.__fuzzyLogic.sel.clear());
  const row = page.locator('.fl-row:not(.have):not(.bad)').first();
  const name = await row.getAttribute('data-t');
  await attachShot(testInfo, page.locator('.fl-pop .mbu-ov-panel'), 'window');
  await row.click();
  await page.click('[data-a=vote]');
  const mine = page.locator('.tgi.mine', { hasText: name });
  check(await until(() => mine.count(), n => n === 1) === 1, 'EH added ' + name);
  check(await page.locator('.fl-row.have[data-t="' + name + '"]').count() === 1, 'the window strikes what is tagged');
  await page.keyboard.press('Escape');
  await mine.locator('button').click();
  check(await until(() => mine.count(), n => n === 0) === 0, 'withdrawn');
  await page.click('button[data-tgin="close"]');
  check(await until(() => page.locator('.fl-ehb').count(), n => n === 0) === 0, 'Done removes the button');
});
