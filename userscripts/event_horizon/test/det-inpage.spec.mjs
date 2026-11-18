import { test, expect, idle } from '../../../dev/test/harness.mjs';
import { RELEASE } from '../../art_station/test/as.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// From a release's overview the Details tab opens in the tab, without a page load (the player plays on), with
// MusicBrainz's details table in its card; Back returns to the overview, and the tab opens it again.
test('the details page opens from the overview without a page load', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await idle(page);
  await inject('event_horizon');
  await expect(page.locator('#app')).toBeVisible();
  await page.evaluate(() => { window.__stay = 1; });
  const tab = () => page.locator(`#app a[href$="/release/${RELEASE}/details"]`).first();   // folded into the action bar's menu at this width
  await tab().evaluate(a => a.click());
  await expect(page).toHaveURL(new RegExp(`/release/${RELEASE}/details$`));
  await expect(page.locator('#app .eh-details table.details tr').first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#app .eh-details h2')).toHaveCount(1);
  expect(await page.evaluate(() => window.__stay)).toBe(1);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/release/${RELEASE}(#.*)?$`));
  await expect(page.locator('#det-body')).toHaveCount(0);
  await tab().evaluate(a => a.click());
  await expect(page.locator('#app .eh-details table.details tr').first()).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(() => window.__stay)).toBe(1);
});
