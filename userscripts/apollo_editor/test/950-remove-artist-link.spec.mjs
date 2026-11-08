import { test, expect, pristine, idle } from '../../../dev/test/harness.mjs';

// MB also throws while caching invalid-link validation errors (React symbols) on submit.
// This is upstream of Apollo; the real POST and the saved edit are checked below.
test.use({ gm: { name: 'Apollo Editor' }, pageErrors: ['^Cannot convert symbol to JSON$'] });

for (const invalid of [true, false]) test(`${invalid ? 'legacy invalid' : 'valid'} artist link removal reaches the server through Apollo Enter edit`, { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  page.on('pageerror', error => { if (/Cannot convert symbol to JSON/.test(error.message)) expect(error.stack).toContain('https://static.metabrainz.org/MB/'); });
  const url = (invalid ? 'https://linktr.ee/apollo950' : 'https://musicbrainz-userscripts.test/apollo950') + Date.now();
  const { mbid } = await pristine(page, 'artist');
  const edit = `https://test.musicbrainz.org/artist/${mbid}/edit`;
  const seedUrl = 'https://musicbrainz-userscripts.test/' + Date.now();
  await page.goto(edit + '?' + new URLSearchParams({ 'edit-artist.url.0.text': seedUrl, 'edit-artist.url.0.link_type_id': '183' }));
  await idle(page);
  // A legacy URL the current client rejects: seed it server-side to reproduce existing data.
  await page.evaluate(url => {
    document.querySelector('form.edit-artist').addEventListener('formdata', e => e.formData.set('edit-artist.url.0.text', url));
  }, url);
  await expect(page.locator(`#external-links-editor a[href="${seedUrl}"]`)).toBeVisible();
  await page.locator('textarea[name="edit-artist.edit_note"]').fill('Legacy link for regression #950');
  await page.locator('button.submit.positive').click();
  await expect(page).toHaveURL(`https://test.musicbrainz.org/artist/${mbid}`);
  await page.goto(`https://test.musicbrainz.org/artist/${mbid}/edit`);
  await idle(page);
  await inject('apollo_editor');
  await expect(page.locator('#tc-rg-enter')).toBeVisible();
  const row = page.locator('#external-links-editor tr.external-link-item').filter({ has: page.locator(`a[href="${url}"]`) });
  await expect(row).toHaveCount(1);
  if (invalid) await expect(row.locator('.error')).toContainText('aggregator');
  const relationship = await page.evaluate(url => window.__MB__.$c.stash.source_entity.relationships.find(r => r.target?.name === url).id, url);
  await row.locator('button.remove-item').click();
  await row.locator('button.remove-item').click();
  expect(await page.evaluate(() => [...new FormData(document.querySelector('form.edit-artist'))].some(([key]) => key.endsWith('.removed')))).toBe(false);
  await row.locator('button.remove-item').click();
  await page.screenshot({ path: testInfo.outputPath('removed.png'), fullPage: true });
  const post = page.waitForRequest(r => r.method() === 'POST' && r.url().includes(`/artist/${mbid}/edit`));
  await page.locator('#tc-rg-enter').click();
  const body = new URLSearchParams((await post).postData());
  expect([...body].filter(([key]) => key.endsWith('.relationship_id')).map(([, value]) => value)).toEqual([String(relationship)]);
  expect([...body].filter(([key]) => key.endsWith('.removed')).map(([, value]) => value)).toEqual(['1']);
  await expect(page).toHaveURL(`https://test.musicbrainz.org/artist/${mbid}`);
  await page.goto(`https://test.musicbrainz.org/artist/${mbid}/open_edits`);
  await expect(page.locator('#content')).toContainText('Remove relationship');
  await expect(page.locator('#content')).toContainText(url);
});
