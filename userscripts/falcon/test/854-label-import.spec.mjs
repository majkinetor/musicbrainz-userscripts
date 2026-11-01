import { test, expect } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh', gm: { name: 'Falcon' } });

test('label import paginates releases and deduplicates groups', { tag: '@unit' }, async ({ page, inject }) => {
  const label = '11111111-1111-4111-8111-111111111111';
  const group = { id: '22222222-2222-4222-8222-222222222222', title: 'Shared group' };
  const requests = [];
  await page.route('https://test.musicbrainz.org/label/*', r => r.fulfill({ body: '<html><body></body></html>', contentType: 'text/html' }));
  await page.route('**/ws/2/release?*', r => {
    const url = new URL(r.request().url());
    requests.push(url.searchParams.get('offset'));
    const offset = Number(url.searchParams.get('offset'));
    const count = offset ? 1 : 100;
    const releases = Array.from({ length: count }, (_, i) => ({ id: `33333333-3333-4333-8333-${String(offset + i).padStart(12, '0')}`, title: `Release ${offset + i}`, 'release-group': group }));
    return r.fulfill({ json: { releases, 'release-count': 101 } });
  });
  await page.goto(`https://test.musicbrainz.org/label/${label}`);
  await inject('falcon', { waitFor: '__falconTest' });
  await page.evaluate(() => window.__falconTest.showPanel());
  await expect(page.locator('#falcon-add-page')).toContainText('Add from label');
  await page.locator('#falcon-add-page').click();
  await page.locator('.falcon-addmenu [data-a="ok"]').click();
  await expect.poll(() => page.evaluate(() => window.__falconTest.getQueue().length)).toBe(102);
  const queue = await page.evaluate(() => window.__falconTest.getQueue().map(i => ({ type: i.entityType, name: i.name, urls: i.urls.length })));
  expect(queue.filter(i => i.type === 'release')).toHaveLength(101);
  expect(queue.filter(i => i.type === 'release_group')).toEqual([{ type: 'release_group', name: 'Shared group', urls: 0 }]);
  expect(queue.every(i => i.name && !i.urls)).toBeTruthy();
  expect(requests).toEqual(['0', '100']);
});
