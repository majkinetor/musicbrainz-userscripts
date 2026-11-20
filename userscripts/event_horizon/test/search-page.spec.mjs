import { test, expect, idle } from '../../../dev/test/harness.mjs';
test.use({ gm: { name: 'Event Horizon' } });

test('the home search links to the search page, which opens in place and offers every lookup', { tag: '@sandbox' }, async ({ page, inject }) => {
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('https://test.musicbrainz.org/');
  await idle(page); await inject('event_horizon');
  await page.evaluate(() => { window.__kept = 1; });
  const all = page.locator('#app a.hm-all');
  if (!(await all.isVisible())) await page.locator('#app .hm-tg').first().click();
  await all.click();
  const form = page.locator('#app form[data-sl]');
  await expect(form).toBeVisible();
  expect(await page.evaluate(() => window.__kept)).toBe(1);
  expect(page.url()).toMatch(/\/search$/);
  // every lookup is in the one Add criteria list
  const add = form.locator('[data-sl-add]');
  expect(await add.locator('optgroup').evaluateAll(g => g.map(x => x.label))).toEqual(['Search', 'Tag lookup', 'Other lookups']);
  expect(await add.locator('option').count()).toBe(1 + 2 + 6 + 12);
  // a tag lookup criterion switches the form to the tag lookup
  await add.selectOption('tag-lookup.artist');
  await expect(form).toHaveAttribute('action', /\/taglookup\/index$/);
  await expect(form.locator('.sl-row[data-f="tag-lookup.artist"] input')).toBeFocused();
  await expect(form.locator('.sl-row[data-f="query"]')).toHaveCount(0);
  // the last row removed: back to the plain search
  await form.locator('.sl-row[data-f="tag-lookup.artist"] [data-sl-x]').click();
  await expect(form).toHaveAttribute('action', /\/search$/);
  await expect(form.locator('.sl-row[data-f="query"]')).toHaveCount(1);
  // a barcode, through MusicBrainz's redirect, in place
  await form.locator('[data-sl-add]').selectOption('other-lookup.barcode');
  await expect(form).toHaveAttribute('action', /\/otherlookup\/barcode$/);
  // each kind of submit stays in the viewer
  await form.locator('.sl-row[data-f="other-lookup.barcode"] [data-sl-x]').click();
  await form.locator('.sl-row[data-f="query"] input').fill('Radiohead');
  await form.locator('.sl-row[data-f="query"] input').press('Enter');
  await expect(page).toHaveURL(/query=Radiohead/);
  expect(await page.evaluate(() => window.__kept)).toBe(1);
  await page.goBack();
  const f2 = page.locator('#app form[data-sl]');
  await expect(f2).toBeVisible();
  await f2.locator('[data-sl-add]').selectOption('tag-lookup.artist');
  await f2.locator('.sl-row[data-f="tag-lookup.artist"] input').fill('Radiohead');
  await f2.locator('.sl-row[data-f="tag-lookup.artist"] input').press('Enter');
  await expect(page).toHaveURL(/taglookup/);
  expect(await page.evaluate(() => window.__kept)).toBe(1);
  expect(errs).toEqual([]);
});

test('a direct load of the search page shows the form', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/search');
  await idle(page); await inject('event_horizon');
  await expect(page.locator('#app form[data-sl]')).toBeVisible();
});
