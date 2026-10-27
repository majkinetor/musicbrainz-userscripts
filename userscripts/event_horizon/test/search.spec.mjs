import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test("a search page links home with Event Horizon's orb", { tag: '@prod' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://musicbrainz.org/search?query=music&type=series&method=indexed');
  await inject('event_horizon');
  check(await until(() => page.locator('#app .hm-hero .hm-hi').count(), n => n === 1) === 1, 'the hero shows');
  check(await page.locator('#app .hm-home[href$="/"] svg.hm-orb').count() === 1, 'the orb links home');
  await attachShot(testInfo, page, 'search');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT, clip: { x: 0, y: 0, width: 1400, height: 500 } });
});
