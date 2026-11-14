import { test, expect, idle } from '../../../dev/test/harness.mjs';
test.use({ gm: { name: 'Event Horizon' } });

test('a tag lookup shows its fields in a pinned bar over the results', async ({ page, inject }) => {
  await page.goto('https://musicbrainz.org/taglookup/index?tag-lookup.artist=Swayzak&tag-lookup.release=Dirty+Dancing&tag-lookup.tracknum=10');
  await idle(page); await inject('event_horizon');
  const bar = page.locator('#app form.tl-bar');
  await expect(bar.locator('[name="tag-lookup.artist"]')).toHaveValue('Swayzak');
  await expect(bar.locator('[name="tag-lookup.release"]')).toHaveValue('Dirty Dancing');
  await expect(page.locator('#app .hm-srch')).toHaveCount(0);
  await expect(page.locator('#app .sr-t tbody tr').first()).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: process.env.SHOT || 'tl.png' });
});
