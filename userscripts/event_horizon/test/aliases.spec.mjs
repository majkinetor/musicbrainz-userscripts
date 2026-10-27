import { test, check, until, settled, requireLogin, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

const RG = 'ed64def7-4a2f-4ff7-9ae3-fbdfac9f8e0e';

// the alias pencil opens Apollo Editor's alias editor (the shared one) in a popup; Escape closes it
test('the alias pencil opens the alias editor in a popup', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/release-group/${RG}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await requireLogin(page);
  await settled(page);
  await inject('event_horizon');
  check(await until(() => page.locator('button.eh-edit[data-aliases] svg').count(), n => n > 0) > 0, 'the pencil shows');
  await page.locator('button.eh-edit[data-aliases]').first().click();
  check(await until(() => page.locator('#eh-aliases #tc-alias').count(), n => n === 1) === 1, 'the popup holds the alias editor');
  check(await until(() => page.locator('#eh-aliases .tc-al-list input').count(), n => n > 0) > 0, 'with a row to type a new alias in');
  await attachShot(testInfo, page, 'aliases');
  await page.keyboard.press('Escape');
  check(await until(() => page.locator('#eh-aliases').count(), n => n === 0) === 0, 'Escape closes it');
});
