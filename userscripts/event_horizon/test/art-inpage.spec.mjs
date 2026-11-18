import { test, expect, idle, attachShot } from '../../../dev/test/harness.mjs';
import { RELEASE } from '../../art_station/test/as.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// From a release's overview the Cover art tab opens Art Station's gallery in the tab, without a page load (the
// player plays on); Back returns to the overview, and the Cover art tab again shows the same gallery.
test('the cover-art page opens from the overview without a page load', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await idle(page);
  await inject('event_horizon');
  await inject('art_station');
  await expect(page.locator('#app')).toBeVisible();
  await page.evaluate(() => { window.__stay = 1; });
  const tab = page.locator(`#app a[href$="/release/${RELEASE}/cover-art"]`).first();
  await tab.click();
  await expect(page).toHaveURL(new RegExp(`/release/${RELEASE}/cover-art$`));
  await expect(page.locator('#as-slot #as-root .as-card').first()).toBeVisible({ timeout: 30000 });
  expect(await page.locator('#as-slot #as-root .as-card').count()).toBe(4);
  expect(await page.evaluate(() => window.__stay)).toBe(1);
  await attachShot(testInfo, page, 'art');
  const gallery = await page.evaluateHandle(() => document.querySelector('#as-root'));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/release/${RELEASE}(#.*)?$`));
  await expect(page.locator('#as-slot')).toHaveCount(0);
  await page.locator(`#app a[href$="/release/${RELEASE}/cover-art"]`).first().click();
  await expect(page.locator('#as-slot #as-root .as-card').first()).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(g => document.querySelector('#as-root') === g, gallery)).toBe(true);
  expect(await page.evaluate(() => window.__stay)).toBe(1);
});

// Loaded on the cover-art page, the gallery is that page's own; the overview drops it with the slot, and the Cover art
// tab shows it again (it went blank, nothing but a page load brought it back).
test('the loaded cover-art page shows its gallery again after the overview', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/cover-art`, { waitUntil: 'domcontentloaded' });
  await idle(page);
  await inject('event_horizon');
  await inject('art_station');
  await expect(page.locator('#as-slot #as-root .as-card').first()).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => { window.__stay = 1; });
  await page.locator(`#app a[href$="/release/${RELEASE}"]`).first().click();
  await expect(page.locator('#as-slot')).toHaveCount(0);
  await page.locator(`#app a[href$="/release/${RELEASE}/cover-art"]`).first().click();
  await expect(page.locator('#as-slot #as-root .as-card').first()).toBeVisible({ timeout: 30000 });
  expect(await page.locator('#as-slot #as-root .as-card').count()).toBe(4);
  expect(await page.evaluate(() => window.__stay)).toBe(1);
});
