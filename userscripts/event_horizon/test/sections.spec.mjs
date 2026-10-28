import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test('the Sections button in the action row opens the section list', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/artist/b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');
  await inject('event_horizon');
  const btn = page.locator('#app .kicker .acts [data-ehsec]');
  check(await until(() => btn.count(), n => n > 0, 20000) === 1, 'the button is in the action row');
  check(!(await page.locator('#eh-rail').isVisible()), 'the list is closed at first');
  await btn.click();
  check(await page.locator('#eh-rail').isVisible(), 'a click opens the list');
  check(await page.locator('#eh-rail [data-sec]').count() > 1, 'it lists the sections');
  await page.locator('#app h1').click();
  check(!(await page.locator('#eh-rail').isVisible()), 'a click elsewhere closes it');
});
