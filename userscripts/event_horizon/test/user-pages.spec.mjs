import { test, expect, requireLogin } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true } });

test('the subscription types sit below the profile header', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/user/majkinetor/subscriptions/artist');
  await requireLogin(page);
  await inject('event_horizon');
  const nav = page.locator('nav.u-sbn');
  await expect(nav).toBeVisible();
  const tabs = await page.getByRole('navigation', { name: 'Editor' }).boundingBox();
  const box = await nav.boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(tabs.y + tabs.height - 1);
  expect(await nav.evaluate(n => getComputedStyle(n).display)).toBe('flex');
});

test('a click on a collection card opens it in place', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/user/majkinetor/collections');
  await requireLogin(page);
  await inject('event_horizon');
  await page.evaluate(() => { window.__noReload = 1; });
  const card = page.locator('.cl-tile').first();
  await expect(card).toBeVisible();
  const href = await card.locator('.cl-a').getAttribute('href');
  const box = await card.boundingBox();
  await page.mouse.click(box.x + box.width - 20, box.y + box.height / 2);
  await expect(page).toHaveURL(new RegExp(href.split('/').pop() + '$'));
  expect(await page.evaluate(() => window.__noReload)).toBe(1);
});
