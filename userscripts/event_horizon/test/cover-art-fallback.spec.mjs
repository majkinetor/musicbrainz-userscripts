import { test, expect, attachShot } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh', gm: { name: 'Event Horizon' } });

test('a cover edit MusicBrainz cannot show shows its full image from archive.org', { tag: '@prod' }, async ({ page, context, inject }, testInfo) => {
  // Start from the server markup, before MusicBrainz replaces the failed thumbnail.
  // This is also what Event Horizon receives when it fetches another edit in place.
  // MusicBrainz's website answers a plain request with its "Verifying your browser" page: a tab passes the check
  // first, and the request then carries its cookie
  await page.goto('https://musicbrainz.org/edit/157655419', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !/Verifying your browser/i.test(document.title) && document.querySelector('table.details'), null, { timeout: 60000 });
  const response = await page.request.get('https://musicbrainz.org/edit/157655419');
  const html = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  await context.route('https://test.musicbrainz.org/edit/157655419', r => r.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('https://test.musicbrainz.org/edit/157655419');
  const file = await page.locator('table.details td').evaluateAll(tds => tds.map(td => td.textContent.trim()).find(t => /^mbid-[0-9a-f-]{36}-\d+\.\w+$/.test(t)));
  expect(file).toBeTruthy();
  const url = `https://archive.org/download/${file.slice(0, 41)}/${file}`;
  await inject('event_horizon');
  // the native "unavailable" message gives way to the image itself (b59ea368)
  const img = page.locator('#app .hdt .edit-cover-art img.eh-cvi');
  await expect(img).toHaveAttribute('src', url);
  await expect(img.locator('xpath=..')).toHaveAttribute('href', url);
  await expect(page.locator('#app .hdt .edit-cover-art .cover-art-error')).toHaveCount(0);
  await attachShot(testInfo, page, 'cover-art-fallback');
  await page.screenshot({ path: 'dev/_cover-art-fallback.png', fullPage: true });
});
