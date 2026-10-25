import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true } });

// Thriller: its recordings have ISRCs and first-release dates, so each track's recording side has a facts box
test('a click on a track side\'s chevron opens it on every track, and it stays open', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/');
  const id = await page.evaluate(async () => (await (await fetch('/ws/2/release?query=release:Thriller%20AND%20artist:%22Michael%20Jackson%22%20AND%20status:official&limit=1&fmt=json')).json()).releases[0].id);
  await page.goto('https://test.musicbrainz.org/release/' + id);
  await inject('event_horizon');
  const rows = page.locator('.tr[data-row]');
  await until(() => rows.count(), n => n >= 2);
  await page.locator('[data-rows="1"]').first().click();
  const chev = page.locator('.fxc[data-fx="rec"]');
  check(await until(() => chev.count(), n => n >= 2) >= 2, 'every open track has a recording chevron');
  check(await page.locator('.fxc[data-tip]').count() === 0 && await page.locator('.fxt[data-tip]').count() === 0, 'the chevron and tag carry no tooltip');
  await chev.first().click();
  const open = () => page.locator('.fxc[data-fx="rec"][aria-expanded="true"]').count();
  check(await until(open, n => n === 0 || n >= 2) === await chev.count(), 'one click opens the recording side on every track');
  await page.reload();
  await inject('event_horizon');
  await until(() => rows.count(), n => n >= 2);
  await page.locator('[data-rows="1"]').first().click();
  check(await until(open, n => n >= 2) >= 2, 'it is still open after a reload');
  await page.locator('.fxc[data-fx="rec"]').first().click();
  check(await until(open, n => n === 0) === 0, 'a second click closes it on every track');
});
