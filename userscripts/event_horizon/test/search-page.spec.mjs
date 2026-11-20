import { test, expect, idle } from '../../../dev/test/harness.mjs';
test.use({ gm: { name: 'Event Horizon' } });

// picks an entry of a filterable list by typing part of it
const pick = async (inp, text) => { await inp.click(); await inp.fill(text); await inp.press('Enter'); };

test('the home search links to the search page, where a category is picked first and shows all its criteria', { tag: '@sandbox' }, async ({ page, inject }) => {
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('https://test.musicbrainz.org/');
  await idle(page); await inject('event_horizon');
  await page.evaluate(() => { window.__kept = 1; });
  await page.locator('#app .hm-ctl a.hm-es[href$="/search"]').click();
  const form = page.locator('#app form[data-sl]');
  await expect(form).toBeVisible();
  expect(await page.evaluate(() => window.__kept)).toBe(1);
  expect(page.url()).toMatch(/\/search$/);
  const cat = form.locator('[data-sl-cat]');
  await expect(cat).toHaveValue('Search');
  // every criterion of the category is on the form
  await expect(form.locator('[data-sl-rows] .sl-row')).toHaveCount(4);
  // the category list filters, and a category brings all its own criteria
  await cat.click(); await cat.fill('tag');
  expect(await page.locator('.eh-cb-pop .eh-cb-opt').count()).toBe(1);
  await cat.press('Enter');
  await expect(form).toHaveAttribute('action', /\/taglookup\/index$/);
  await expect(cat).toHaveValue('Tag lookup');
  await expect(form.locator('.sl-row[data-f="query"]')).toHaveCount(0);
  await expect(form.locator('[data-sl-rows] .sl-row')).toHaveCount(6);
  // a barcode: its one criterion
  await pick(cat, 'barcode');
  await expect(form).toHaveAttribute('action', /\/otherlookup\/barcode$/);
  await expect(form.locator('[data-sl-rows] .sl-row')).toHaveCount(1);
  // each kind of submit stays in the viewer
  await pick(cat, 'search');
  await form.locator('.sl-row[data-f="query"] input').fill('Radiohead');
  await form.locator('.sl-row[data-f="query"] input').press('Enter');
  await expect(page).toHaveURL(/query=Radiohead/);
  expect(await page.evaluate(() => window.__kept)).toBe(1);
  await page.goBack();
  const f2 = page.locator('#app form[data-sl]');
  await expect(f2).toBeVisible();
  await pick(f2.locator('[data-sl-cat]'), 'tag');
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
