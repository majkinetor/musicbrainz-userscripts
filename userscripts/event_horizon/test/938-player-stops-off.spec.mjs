import { test, expect } from '../../../dev/test/harness.mjs';

// #938: the player belongs to Event Horizon's view. V to MusicBrainz's page stops a player that plays in the tab,
// so no sound goes on with its controls gone, and nothing brings it back on MusicBrainz's page.
test.use({ gm: { name: 'Event Horizon', persist: 'tabs', values: { view: { on: true, player: true } } } });
test('turning Event Horizon off stops the tab player', { tag: '@sandbox' }, async ({ page, context, inject }) => {
  test.setTimeout(120000);
  await context.route('https://www.youtube-nocookie.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<p>player fixture</p>' }));
  const rel = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';
  await page.goto('https://test.musicbrainz.org/');
  const seed = () => page.evaluate(id => {
    const q = [{ key: '1-1', n: 1, title: 'Track', rid: 'rec', artist: 'Artist', len: 100000, rel: id, relTitle: 'Album', srcs: [{ key: 'youtube', name: 'YouTube', urls: [{ url: 'https://www.youtube.com/watch?v=abcdefghijk' }] }] }];
    window.name = 'eh-ply-test';
    sessionStorage.setItem('eh-ply', JSON.stringify({ tab: 'eh-ply-test', rel: id, key: '1-1', src: 'youtube', played: 10000, q }));
  }, rel);
  // the release page (setOn1) and the relationship editor (relSet)
  for (const sub of ['', '/edit-relationships']) {
    await seed();
    await page.goto(`https://test.musicbrainz.org/release/${rel}${sub}`, { waitUntil: 'domcontentloaded' });
    await inject('event_horizon');
    await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
    // the V before saved Event Horizon as off: the saved player waits on MusicBrainz's page, and resumes once the view shows
    if (sub) {
      await page.waitForTimeout(2500);
      await expect(page.locator('#eh-ply')).toHaveCount(0);
      await page.keyboard.press('v');
    }
    await expect(page.locator('#eh-launch')).toHaveClass(/\bon\b/, { timeout: 10000 });
    await expect(page.locator('#eh-ply iframe')).toHaveCount(1, { timeout: 20000 });
    await page.keyboard.press('v');
    await expect(page.locator('#eh-launch')).not.toHaveClass(/\bon\b/, { timeout: 10000 });
    await expect(page.locator('#eh-ply')).toHaveCount(0);
    expect(await page.evaluate(() => sessionStorage.getItem('eh-ply'))).toBeNull();
    // the player's once-a-second resume must not bring it back on MusicBrainz's page
    await page.waitForTimeout(2500);
    await expect(page.locator('#eh-ply')).toHaveCount(0);
  }
});
