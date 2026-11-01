import { test, expect } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true } });

test('stars survive navigation and reload and can be removed', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/artist/89ad4ac3-39f7-470e-963a-56509c546377');
  await inject('event_horizon');
  const star = page.locator('[data-star]');
  await expect(star).toHaveAttribute('aria-pressed', 'false');
  await star.click();
  await expect(star).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.kicker a.eh-home').click();
  await expect(page.locator('#s-hstar a[href$="/artist/89ad4ac3-39f7-470e-963a-56509c546377"]')).toHaveCount(1);
  await page.locator('[data-star-group]').selectOption('none');
  await page.reload();
  await inject('event_horizon');
  await expect(page.locator('[data-star-group]')).toHaveValue('none');
  await page.locator('#s-hstar a').click();
  await expect(page.locator('[data-star]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-star]').click();
  await page.locator('.kicker a.eh-home').click();
  await expect(page.locator('#s-hstar a')).toHaveCount(0);
});
