import { test, expect, functionSource } from '../../../dev/test/harness.mjs';

test('Details routes cover every entity type and reject foreign sites', { tag: '@unit' }, async () => {
  const src = await functionSource('event_horizon', ['MBID', 'formKey']);
  const location = { href: 'https://test.musicbrainz.org/', origin: 'https://test.musicbrainz.org' };
  const route = new Function('location', src + '; return formKey;')(location);
  const id = 'a74b1b7f-71a5-4011-9441-d0b5e4122711';
  for (const type of ['release', 'release-group', 'artist', 'label', 'recording', 'work', 'area', 'instrument', 'place', 'series', 'event']) {
    expect(route(`/${type}/${id}/details`)).toBe(`form/${type}/${id}/details`);
    expect(route(`/${type}/${id}/details/`)).toBe(`form/${type}/${id}/details`);
    expect(route(`https://example.com/${type}/${id}/details`)).toBeNull();
  }
  expect(route(`/artist/${id}/set-cover-art`)).toBeNull();
});

test('Details retains arbitrary extra fields and exact links', { tag: '@unit' }, async ({ page }) => {
  const src = await functionSource('event_horizon', ['detailsDress']);
  await page.setContent('<div id="content"><h2>Details</h2><table class="details"><tbody>'
    + Array.from({ length: 40 }, (_, i) => `<tr><th>Field ${i}</th><td><a href="https://example.com/?field=${i}&amp;fmt=json">Value ${i}</a></td></tr>`).join('')
    + '</tbody></table></div>');
  const before = await page.locator('table').innerHTML();
  await page.evaluate(src => new Function(src + '; detailsDress(document.getElementById("content"));')(), src);
  expect(await page.locator('.eh-details table').innerHTML()).toBe(before);
  expect(await page.locator('.eh-details tr').count()).toBe(40);
});
