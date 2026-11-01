import { test, expect } from '../../../dev/test/harness.mjs';

const recording = '89ad4ac3-39f7-470e-963a-56509c546377';
const release = '6e0e2d94-4d49-4e98-a917-b7b8f2087348';
test.use({ gm: { name: 'Event Horizon', persist: true, values: { view: { starView: 'grid', stars: [{ key: `recording/${recording}`, title: 'A recording' }] } } } });

test('a saved star fills its missing picture in the background and keeps it', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.route(`**/ws/2/release?recording=${recording}*`, route => route.fulfill({ json: { releases: [{ id: release, 'cover-art-archive': { front: true } }] } }));
  await page.route(`https://coverartarchive.org/release/${release}/front-250`, route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>' }));
  await page.goto('https://test.musicbrainz.org/');
  await inject('event_horizon');
  const image = page.locator('#s-hstar .hm-star-grid img');
  await expect(image).toHaveAttribute('src', `https://coverartarchive.org/release/${release}/front-250`);
  await page.reload();
  await inject('event_horizon');
  await expect(image).toHaveAttribute('src', `https://coverartarchive.org/release/${release}/front-250`);
});
