import { test, expect, idle } from '../../../dev/test/harness.mjs';
import { RELEASE } from '../../art_station/test/as.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// From a release's overview the Disc IDs tab opens in the tab, without a page load (the player plays on), and Apollo
// builds its rip-log box there; Back returns to the overview, and the tab again shows the same box.
test('the disc IDs page opens from the overview without a page load', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await idle(page);
  await inject('event_horizon');
  await inject('apollo_editor');
  await expect(page.locator('#app')).toBeVisible();
  await page.evaluate(() => { window.__stay = 1; });
  const tab = () => page.locator(`#app a[href$="/release/${RELEASE}/discids"]`).first();   // in the action bar, folded into its menu at this width
  await tab().evaluate(a => a.click());
  await expect(page).toHaveURL(new RegExp(`/release/${RELEASE}/discids$`));
  await expect(page.locator('#dsc-slot #apollo-discid-box .fd-zone').first()).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(() => window.__stay)).toBe(1);
  const box = await page.evaluateHandle(() => document.querySelector('#apollo-discid-box'));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/release/${RELEASE}(#.*)?$`));
  await expect(page.locator('#dsc-slot')).toHaveCount(0);
  await tab().evaluate(a => a.click());
  await expect(page.locator('#dsc-slot #apollo-discid-box')).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(b => document.querySelector('#apollo-discid-box') === b, box)).toBe(true);
  expect(await page.evaluate(() => window.__stay)).toBe(1);
});
