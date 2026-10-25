import { test, check, until, attachShot, settled, requireLogin } from '../../../dev/test/harness.mjs';
import { RELEASE } from '../../art_station/test/as.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// the release's Relate opens MusicBrainz's relationship editor dressed as Event Horizon: its header, its theme, the editor itself untouched
test('the relationship editor takes Event Horizon\'s header and theme', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/edit-relationships`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await requireLogin(page);
  await settled(page);
  await inject('event_horizon');
  check(await until(() => page.locator('#content > #eh-relhd h1 a').count(), n => n === 1) === 1, 'the header shows, its title linking to the release');
  check(await page.locator('#eh-relhd .ab.on[aria-current=page]').textContent() === 'Relate', 'Relate is the open tab');
  check(await page.locator('#eh-relhd .by a').count() > 0, 'the artist shows');
  check(!(await page.locator('body > .header').isVisible()), 'MusicBrainz\'s header hides');
  check(await page.locator('#tracklist').isVisible(), 'the editor stays');
  check(await page.evaluate(() => getComputedStyle(document.body).fontFamily).then(f => /Manrope/.test(f)), 'the page takes Event Horizon\'s font');
  // the editor still works: Add relationship opens MusicBrainz's dialog
  await page.locator('#release-rels button.add-item, #release-rels .add-relationship').first().click();
  check(await until(() => page.locator('[role=dialog], .dialog').count(), n => n > 0) > 0, 'Add relationship opens the dialog');
  await attachShot(testInfo, page, 'relate-dialog');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace('.png', '-dialog.png') });
  await page.keyboard.press('Escape');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT, fullPage: true });
  // the launcher goes back to MusicBrainz's own page, and again
  await page.locator('#eh-launch').click();
  check(await until(() => page.locator('body > .header').isVisible(), v => v) === true, 'off: MusicBrainz\'s header is back');
  check(!(await page.locator('#eh-relhd').isVisible()), 'off: the header hides');
  await page.locator('#eh-launch').click();
  check(await until(() => page.locator('#eh-relhd').isVisible(), v => v) === true, 'on again');
});
