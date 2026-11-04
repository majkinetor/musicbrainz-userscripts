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

test('a type letter before the words picks that type, and the type list shows the letters', { tag: '@prod' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://musicbrainz.org/search?query=music&type=series&method=indexed');
  await inject('event_horizon');
  await until(() => page.locator('#app .hm-srch .hm-ty').count(), n => n === 1);
  check(await page.locator('.hm-srch .hm-ty').textContent() === 'Series', 'the type button shows the type searched');
  await page.locator('.hm-srch .hm-ty').click();
  check(await until(() => page.locator('.hm-td').isVisible()), 'the type list opens');
  check(await page.locator('.hm-td [data-v=work] kbd').textContent() === 'w', 'Work shows its letter');
  await attachShot(testInfo, page, 'types');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT, clip: { x: 0, y: 0, width: 1400, height: 900 } });
  await page.keyboard.press('p');
  check(await page.locator('.hm-srch select[name=type]').inputValue() === 'place' && await page.locator('.hm-td').isHidden(), 'its letter picks Place and closes the list');
  check(await page.locator('.hm-srch .hm-ty').textContent() === 'Place', 'the button shows Place');
  await page.locator('.hm-srch input[name=query]').fill('w yesterday');
  await page.locator('.hm-srch input[name=query]').press('Enter');
  check(await until(() => page.url(), h => /type=work/.test(h) && /query=yesterday(&|$)/.test(h)), 'w yesterday searches works for yesterday');
  check(await page.locator('.hm-srch select[name=type]').inputValue() === 'work', 'the type shows Work');
});
