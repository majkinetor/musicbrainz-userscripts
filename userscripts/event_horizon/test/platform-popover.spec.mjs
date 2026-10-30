import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true } });

// the gear beside the tracklist's SHOW toggles opens the platform settings; Settings no longer has a Platforms tab
test('the tracklist gear opens the platform icon settings', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/');
  const id = await page.evaluate(async () => (await (await fetch('/ws/2/release?query=release:Thriller%20AND%20artist:%22Michael%20Jackson%22%20AND%20status:official&limit=1&fmt=json')).json()).releases[0].id);
  await page.goto('https://test.musicbrainz.org/release/' + id);
  await inject('event_horizon');
  await until(() => page.locator('.tr[data-row]').count(), n => n >= 2);
  const gear = page.locator('[data-plcfg="1"]');
  check(await gear.count() === 1, 'the tracklist has one platform gear');
  await gear.click();
  const pop = page.locator('#eh-plcfg');
  check(await until(() => pop.count(), n => n === 1) === 1, 'a click opens the popover');
  check(await pop.locator('[data-g=plSize]').count() === 3, 'it holds the icon sizes');
  await pop.locator('[data-g=plSize][data-k="22"]').click();
  check(await until(() => pop.locator('[data-g=plSize][data-k="22"][aria-pressed=true]').count(), n => n === 1) === 1, 'a size click applies and the popover stays');
  await gear.locator('xpath=..').screenshot({ path: 'test-results/eh-gear.png' });
  await pop.screenshot({ path: 'test-results/eh-plpop.png' });
  await page.keyboard.press('Escape');
  check(await until(() => pop.count(), n => n === 0) === 0, 'Escape closes it');
  await page.locator('[data-plcfg=hd]').click();
  check(await until(() => pop.locator('[data-g=fact]').count(), n => n > 0) > 0, 'the header gear opens the facts');
  await pop.locator('[data-g=fact][data-k=asin]').click();
  check(await until(() => pop.locator('[data-k=asin][aria-pressed=true]').count(), n => n === 1) === 1, 'a fact click applies');
  await page.locator('.facts-col').screenshot({ path: 'test-results/eh-hd.png' });
  await pop.screenshot({ path: 'test-results/eh-hdpop.png' });
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.getElementById('eh-launch').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })));
  await until(() => page.locator('#eh-cfg [data-tab]').count(), n => n > 0);
  check(await page.locator('#eh-cfg [data-tab=platforms]').count() === 0, 'Settings has no Platforms tab');
});
