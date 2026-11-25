import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test("a search page links home with Event Horizon's orb", { tag: '@prod' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://musicbrainz.org/search?query=music&type=series&method=indexed');
  await inject('event_horizon');
  check(await until(() => page.locator('#app .hm-hero .hm-hi').count(), n => n === 1) === 1, 'the hero shows');
  check(await page.locator('#app .hm-home svg.hm-orb').count() === 1, 'the hero shows the orb');
  // logged out, the orb logs in instead (916aa247)
  const home = await page.locator('#app .hm-home').evaluate(a => ({ out: a.classList.contains('eh-out'), href: a.getAttribute('href') }));
  check(home.out ? home.href === 'https://musicbrainz.org/login?returnto=%2F' : home.href === 'https://musicbrainz.org/', 'the orb links home, or to the login when logged out — ' + JSON.stringify(home));
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
  // the results page may still be drawing its box anew: wait for the pick to land
  check(await until(async () => await page.locator('.hm-srch select[name=type]').inputValue().catch(() => '') === 'place' && await page.locator('.hm-td').isHidden(), v => v) === true, 'its letter picks Place and closes the list');
  check(await until(() => page.locator('.hm-srch .hm-ty').textContent().catch(() => ''), t => t === 'Place') === 'Place', 'the button shows Place');
  await page.locator('.hm-srch input[name=query]').fill('');
  await page.locator('.hm-srch input[name=query]').pressSequentially('e ');
  check(await page.locator('.hm-srch .hm-ty').textContent() === 'Editor' && await page.locator('.hm-srch input[name=query]').inputValue() === '', 'typing e and a space picks Editor at once and leaves the box empty');
  await page.locator('.hm-srch input[name=query]').fill('w yesterday');
  await page.locator('.hm-srch input[name=query]').press('Enter');
  check(await until(() => page.url(), h => /type=work/.test(h) && /query=yesterday(&|$)/.test(h)), 'w yesterday searches works for yesterday');
  // the address changes a moment before the new page's box shows its type
  check(await until(() => page.locator('.hm-srch select[name=type]').inputValue().catch(() => ''), v => v === 'work') === 'work', 'the type shows Work');
});
