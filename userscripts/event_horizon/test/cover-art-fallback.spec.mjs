import { test, expect, attachShot } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh', gm: { name: 'Event Horizon' } });

test('unavailable edit cover art keeps the native message and current-images link', { tag: '@prod' }, async ({ page, context, inject }, testInfo) => {
  // Start from the server markup, before MusicBrainz replaces the failed thumbnail.
  // This is also what Event Horizon receives when it fetches another edit in place.
  const response = await page.request.get('https://musicbrainz.org/edit/157655419');
  const html = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  await context.route('https://test.musicbrainz.org/edit/157655419', r => r.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('https://test.musicbrainz.org/edit/157655419');
  const expected = await page.locator('.edit-cover-art span.artwork-image').evaluate(x => {
    const el = document.createElement('em'); el.innerHTML = x.dataset.message;
    return { message: el.textContent, href: el.querySelector('a').getAttribute('href') };
  });
  await inject('event_horizon');
  const fallback = page.locator('#app .hdt .edit-cover-art .cover-art-error');
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveText(expected.message);
  await expect(fallback.locator('a')).toHaveAttribute('href', expected.href);
  await expect(page.locator('#app .hdt .edit-cover-art img')).toHaveCount(0);
  await attachShot(testInfo, page, 'cover-art-fallback');
  await page.screenshot({ path: 'dev/_cover-art-fallback.png', fullPage: true });
});
