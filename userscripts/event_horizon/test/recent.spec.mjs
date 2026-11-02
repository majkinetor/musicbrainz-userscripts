import { test, expect } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true } });

const ARTIST = '89ad4ac3-39f7-470e-963a-56509c546377';
const entry = `#s-hrec a:not(.tt)[href$="/artist/${ARTIST}"]`;

test('Recently opened keeps its view, how many and which entity types', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/artist/${ARTIST}`);
  await inject('event_horizon');
  await expect(page.locator('.kicker [data-star]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.title)).not.toBe('');
  await page.waitForTimeout(1500);

  await page.goto('https://test.musicbrainz.org/');
  await inject('event_horizon');
  await expect(page.locator('[data-rec-view="row"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(entry)).toHaveCount(1);

  await page.locator('[data-rec-view="table"]').click();
  await expect(page.locator(entry)).toHaveCount(1);
  await expect(page.locator('#s-hrec [data-star-added] time').first()).toBeVisible();

  await page.locator('[data-pop="rec-set"]').click();
  await page.locator('.rec-pop label:has([data-rec-max][value="24"])').click();
  await expect(page.locator('#pop-rec-set')).toBeVisible();
  await page.locator('[data-rec-kind="artist"]').uncheck();
  await expect(page.locator('#pop-rec-set')).toBeVisible();
  await expect(page.locator(entry)).toHaveCount(0);

  await page.reload();
  await inject('event_horizon');
  await expect(page.locator('[data-rec-view="table"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(entry)).toHaveCount(0);
  await page.locator('[data-pop="rec-set"]').click();
  await expect(page.locator('[data-rec-max][value="24"]')).toBeChecked();
  await page.locator('[data-rec-kind="artist"]').check();
  await expect(page.locator(entry)).toHaveCount(1);
  await page.screenshot({ path: process.env.EH_SHOT || 'test-results/recent.png', fullPage: false });
});
