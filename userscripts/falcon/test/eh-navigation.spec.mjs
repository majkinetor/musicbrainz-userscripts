import { test, expect } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh', gm: { name: 'Falcon' } });
test('Add from page follows EH navigation with an existing panel', { tag: '@unit' }, async ({ page, inject }) => {
  const id = '11111111-1111-4111-8111-111111111111';
  await page.route('https://test.musicbrainz.org/release/*', r => r.fulfill({ body: '<html><body></body></html>', contentType: 'text/html' }));
  await page.goto('https://test.musicbrainz.org/release/' + id);
  await inject('falcon', { waitFor: '__falconTest' });
  await page.evaluate(() => window.__falconTest.showPanel());
  await expect(page.locator('#falcon-add-page')).toContainText('Add from release');
  await page.evaluate(id => {
    history.pushState({}, '', '/release-group/' + id);
    document.documentElement.setAttribute('data-mbu-page', location.pathname);
  }, id);
  await expect(page.locator('#falcon-add-page')).toContainText('Add from group');
  await page.locator('#falcon-add-page').click();
  await expect(page.locator('.falcon-addmenu input[data-w="recording"]')).toHaveCount(0);
  await expect(page.locator('.falcon-addmenu input[data-w="release"]')).toHaveCount(1);
});
