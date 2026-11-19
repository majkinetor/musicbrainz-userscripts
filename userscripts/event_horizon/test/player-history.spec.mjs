import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

// Lagos Disco Inferno: every recording has a Spotify link
const REL = 'https://musicbrainz.org/release/20d82991-89d9-4143-9f7e-5989e73759e7';

test.describe('recent playlists', () => {
  test.use({ profile: 'fresh', gm: { name: 'Event Horizon', persist: true, values: { view: { on: true, player: true } } }, pageErrors: ['No valid solution has been found to play this item'] });

  // a playlist a new one replaces is kept, listed in the menu by when it was made, and plays again from there
  test('a replaced playlist is kept and comes back from the menu', { tag: '@prod' }, async ({ page, inject }, testInfo) => {
    await page.goto(REL);
    await inject('event_horizon');
    await page.locator('button[data-playall]').click();
    const n = await until(() => page.evaluate(() => window.__ehPlayerTest?.state().q.length || 0), v => v > 1);
    check(n > 1, 'the release queues its tracks: ' + n);
    const links = [{ key: 'youtube', name: 'YouTube', urls: [{ url: 'https://www.youtube.com/watch?v=abcdefghijk' }] }];
    await page.evaluate(links => window.__ehPlayerTest.recording({ id: '00000000-0000-0000-0000-000000000001', title: 'One', ac: [], links }, []), links);
    check(await until(() => page.evaluate(() => window.__ehPlayerTest.state().q.length), v => v === 1) === 1, 'a recording replaces the playlist');
    check(await page.evaluate(() => window.__ehPlayerTest.history().length) === 1, 'the replaced playlist is kept');
    await page.locator('#eh-ply [data-ply="lb"]').click();
    await page.locator('#eh-ply-menu [data-m="hist"]').click();
    const item = page.locator('#eh-ply-menu [data-k="0"]');
    const text = await until(() => item.textContent().catch(() => ''), t => !!t);
    check(/^\d{4}-\d\d-\d\dT\d\d:\d\d · \d+ tracks$/.test(text.trim()), 'the menu names it by its ISO 8601 time: ' + text);
    await attachShot(testInfo, page.locator('#eh-ply-menu'), 'recent playlists');
    await item.click();
    check(await until(() => page.evaluate(() => window.__ehPlayerTest.state().q.length), v => v === n) === n, 'a click plays it again');
    check(await page.evaluate(() => window.__ehPlayerTest.history().length) === 0, 'and takes it off the list; the one-track playlist is not kept');
  });
});
