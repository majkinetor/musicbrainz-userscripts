import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' }, profile: 'fresh' });

// #933: release events in search results show their country's flag
test('release search results show country flags', { tag: '@prod' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://musicbrainz.org/search?query=alessandro&type=release&method=indexed');
  await inject('event_horizon');
  const n = await until(() => page.locator('#app .sr-t img.flagi[src$="/fr.png"]').count(), n => n > 0);
  await attachShot(testInfo, page, 'flags');
  check(n > 0, 'France shows its flag');
});
