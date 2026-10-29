import { test, expect } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh', gm: { name: 'Fusion' } });
test('Fusion follows EH navigation and restores each page board', { tag: '@unit' }, async ({ page, inject }) => {
  const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222';
  await page.route('https://test.musicbrainz.org/artist/*', r => r.fulfill({ body: '<html><body></body></html>', contentType: 'text/html' }));
  await page.goto('https://test.musicbrainz.org/artist/' + a);
  await page.route('https://test.musicbrainz.org/ws/2/**', route => {
    const url = route.request().url();
    const id = url.includes(a) ? a : b;
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id, title: id, releases: [], 'artist-credit': [] }) });
  });
  await inject('fusion', { waitFor: '__fusion' });
  const go = async id => {
    await page.evaluate(id => {
      history.pushState({}, '', '/recording/' + id);
      document.documentElement.setAttribute('data-mbu-page', location.pathname);
    }, id);
    await expect(page.locator('#fs-launch')).toHaveCount(1);
    await page.evaluate(() => window.__fusion.openFusion());
  };
  await go(a);
  expect(await page.evaluate(() => window.__fusion.SCOPE.mbid)).toBe(a);
  expect(await page.evaluate(() => window.__fusion.STATE.poolOrder)).toEqual([a]);
  await go(b);
  expect(await page.evaluate(() => window.__fusion.SCOPE.mbid)).toBe(b);
  expect(await page.evaluate(() => window.__fusion.STATE.poolOrder)).toEqual([b]);
  await go(a);
  expect(await page.evaluate(() => window.__fusion.STATE.poolOrder)).toEqual([a]);
});
