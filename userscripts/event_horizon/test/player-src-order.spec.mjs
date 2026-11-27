import { test, expect, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true, values: { view: { on: true, player: true } } } });

// #1125: the player's sources are ordered in its settings, not by the tracklist's link order
test('Player sources reorder by drag and turn off by click', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(SANDBOX + '/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e');
  await inject('event_horizon');
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('mbu-open-settings', { detail: 'event_horizon', cancelable: true })));
  await page.locator('#eh-cfg [data-tab=player]').click();
  const keys = () => page.locator('#eh-cfg [data-g=plySrc]').evaluateAll(a => a.map(n => n.dataset.k));
  expect((await keys()).slice(0, 3)).toEqual(['bandcamp', 'ytmusic', 'spotify']);
  await page.screenshot({ path: test.info().outputPath('player-sources.png') });
  // drag Tidal onto Bandcamp: it goes first
  const from = await page.locator('#eh-cfg [data-g=plySrc][data-k=tidal]').boundingBox();
  const to = await page.locator('#eh-cfg [data-g=plySrc][data-k=bandcamp]').boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(keys).toEqual(expect.arrayContaining(['tidal']));
  expect((await keys())[0]).toBe('tidal');
  expect((await page.evaluate(() => GM_getValue('view').playerSrc))[0]).toBe('tidal');
  // a click turns a source off, and the next one takes its number
  await page.locator('#eh-cfg [data-g=plySrc][data-k=bandcamp]').click();
  await expect(page.locator('#eh-cfg [data-g=plySrc][data-k=bandcamp]')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => GM_getValue('view').playerSrcOff)).toEqual(['bandcamp']);
  await expect(page.locator('#eh-cfg [data-g=plySrc][data-k=ytmusic] .ord')).toHaveText('2');
});
