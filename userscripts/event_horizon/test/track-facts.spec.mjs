import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true } });

test('track and credit gestures toggle one object or its siblings', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/');
  const id = await page.evaluate(async () => (await (await fetch('/ws/2/release?query=release:Thriller%20AND%20artist:%22Michael%20Jackson%22%20AND%20status:official&limit=1&fmt=json')).json()).releases[0].id);
  await page.goto('https://test.musicbrainz.org/release/' + id);
  await inject('event_horizon');
  const rows = page.locator('.tr[data-row]');
  await until(() => rows.count(), n => n >= 2);
  await rows.first().click({ button: 'right' });
  check(await rows.locator('..').locator('.tr[aria-expanded="true"]').count() >= 2, 'right-click opens sibling tracks');
  const details = page.locator('.tl > .detail');
  const first = details.first().locator('.fxc');
  const second = details.nth(1).locator('.fxc');
  await until(() => first.count(), n => n > 0);
  await first.first().click();
  check(await first.first().getAttribute('aria-expanded') === 'true', 'click opens one credit');
  check(await second.first().getAttribute('aria-expanded') === 'false', 'other tracks stay unchanged');
  await details.first().click({ button: 'right', position: { x: 3, y: 3 } });
  check(await rows.locator('..').locator('.tr[aria-expanded="true"]').count() === 0, 'right-click in track body closes siblings');
});
