import { test, check, until, attachShot, idle } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// another site seeding the release editor: MusicBrainz's "Confirm form submission" page wears EH's theme
test('the seed confirmation page is themed', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setContent('<form method="post" action="https://test.musicbrainz.org/release/add"><input name="name" value="EH seed test"></form>');
  await Promise.all([page.waitForURL(/\/release\/add/, { timeout: 60000 }), page.evaluate(() => document.forms[0].submit())]);
  await page.waitForLoadState('domcontentloaded');
  await idle(page);
  check(await page.locator('.confirm-seed').count() > 0, 'MusicBrainz shows its confirmation');
  await inject('event_horizon');
  check(await until(() => page.evaluate(() => document.documentElement.hasAttribute('data-eh-rel')), v => v) === true, 'EH dresses it');
  check(await page.locator('#eh-relhd h1').count() === 1, 'EH\'s header shows');
  await attachShot(testInfo, page, 'seed-confirm');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT });
});
