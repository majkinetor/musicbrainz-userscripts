import { test, expect } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: 'tabs', values: { view: { on: true, player: true } } } });
test('the tab player restores on release subpages', { tag: '@sandbox' }, async ({ page, context, inject }) => {
  test.setTimeout(120000);
  await context.route('https://www.youtube-nocookie.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<p>player fixture</p>' }));
  const rel = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';
  await page.goto('https://test.musicbrainz.org/');
  await page.evaluate(id => {
    const q = [{ key: '1-1', n: 1, title: 'Track', rid: 'rec', artist: 'Artist', len: 100000, rel: id, relTitle: 'Album', srcs: [{ key: 'youtube', name: 'YouTube', urls: [{ url: 'https://www.youtube.com/watch?v=abcdefghijk' }] }] }];
    window.name = 'eh-ply-test';
    sessionStorage.setItem('eh-ply', JSON.stringify({ tab: 'eh-ply-test', rel: id, key: '1-1', src: 'youtube', played: 10000, q }));
  }, rel);
  for (const sub of ['cover-art', 'edit-relationships', 'details', 'discids', 'edit_annotation']) {
    await page.goto(`https://test.musicbrainz.org/release/${rel}/${sub}`, { waitUntil: 'domcontentloaded' });
    await inject('event_horizon');
    await expect(page.locator('#eh-ply iframe')).toHaveCount(1, { timeout: 20000 });
    await expect(page.locator('.ply-ctl .ply-t b')).toHaveText('Track');
  }
});
