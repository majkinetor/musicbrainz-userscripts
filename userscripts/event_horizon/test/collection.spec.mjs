import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// the sandbox account's "Event Horizon test" collection, of five Miles Davis releases
const COL = '7766058b-3ec5-440f-9798-f21035357e48';

test('a collection shows its facts and its releases, with the list\'s views and filter', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/collection/${COL}`);
  await inject('event_horizon');
  check(await until(() => page.locator('.hero h1').textContent().catch(() => ''), t => t === 'Event Horizon test') === 'Event Horizon test', 'the hero names the collection');
  check(/collection/i.test(await page.locator('.hero .by').textContent()), 'the hero says whose collection it is');
  check(/Event Horizon's collection viewer/.test(await page.locator('.hero .col-desc').textContent()), 'the hero shows the description');
  const rows = await until(() => page.locator('#s-cp tbody tr').count(), n => n >= 5);
  check(rows >= 5, 'the releases are listed: ' + rows);
  check(/Releases/.test(await page.locator('#s-cp h2').first().textContent()), 'the list is named after what it holds');
  check(await page.locator('#s-cp [data-tabview]').count() === 3, 'the list has the grid, row and table views');
  await page.click('#s-cp [data-tqopen]');
  await page.fill('#s-cp [data-tq]', 'kind of blue');
  check(await until(() => page.locator('#s-cp tbody tr').count(), n => n === 1) === 1, 'the filter keeps the one matching release');
  await attachShot(testInfo, page, 'collection');
});

test('an editor\'s collections list in place and open a collection', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/user/majkinetor/collections');
  await inject('event_horizon');
  const a = page.locator(`#app a[href$="/collection/${COL}"]`);
  check(await until(() => a.count(), n => n > 0) > 0, 'the collection is listed');
  await attachShot(testInfo, page, 'collections');
  await a.first().click();
  check(await until(() => page.locator('.hero h1').textContent().catch(() => ''), t => t === 'Event Horizon test') === 'Event Horizon test', 'the collection opens in Event Horizon');
});
