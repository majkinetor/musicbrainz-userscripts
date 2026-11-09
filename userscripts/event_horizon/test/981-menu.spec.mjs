import { test, expect, functionSource, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true, values: { view: {
  menuTitles: true, menuResponsive: true,
  menuOrder: ['tags', 'edits', 'edit', 'relationships', 'releases', 'details'],
  menuPlaces: { tags: 'more', edits: 'main', edit: 'main', relationships: 'main', releases: 'main', details: 'more' },
} } } });

const topIds = page => page.locator('#app .kicker .acts').first().locator(':scope>[data-menu-key]:not([hidden])').evaluateAll(a => a.map(n => n.dataset.menuKey));
const ids = page => page.locator('#app .kicker .acts').first().locator('[data-menu-key]').evaluateAll(a => a.map(n => n.dataset.menuKey));
const open = async (page, inject) => {
  await page.goto(SANDBOX + '/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e');
  await inject('event_horizon');
  await expect(page.locator('#app .kicker [data-menu-key="edit"]')).toHaveCount(1);
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('mbu-open-settings', { detail: 'event_horizon', cancelable: true })));
  await page.locator('#eh-cfg [data-tab=menu]').click();
};

test('Menu settings reorder, hide and place actions immediately and survive reload', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
  await open(page, inject);
  await expect.poll(() => topIds(page)).toContain('tags');
  const top = await topIds(page);
  expect(top.indexOf('tags')).toBeLessThan(top.indexOf('edits'));
  await page.locator('#eh-cfg [data-g=menuResponsive]').click();
  expect(await topIds(page)).not.toContain('tags');
  await page.locator('#eh-cfg [data-menu-place=tags][data-place=main]').click();
  expect((await topIds(page))[0]).toBe('tags');
  await page.locator('#eh-cfg [data-menu-visible=edit]').click();
  await expect(page.locator('#app .kicker [data-menu-key=edit]')).toBeHidden();
  await expect(page.locator('#eh-cfg [data-menu-visible=edit]')).toHaveText('');
  // Reordering uses the same handle as a pointer drag; keyboard operation preserves focus.
  await page.locator('#eh-cfg [data-menu-drag=edits]').focus();
  await page.keyboard.press('ArrowUp');
  expect((await topIds(page))[0]).toBe('edits');
  expect(await page.evaluate(() => GM_getValue('view').menuOrder.slice(0, 2))).toEqual(['edits', 'tags']);
  await page.screenshot({ path: 'dev/_981-menu.png' });
  await page.keyboard.press('Escape');
  await page.reload(); await inject('event_horizon');
  await expect(page.locator('#app .kicker [data-menu-key=edit]')).toBeHidden();
  await expect.poll(() => topIds(page)).toEqual(['edits', 'tags', 'relationships', 'releases']);
});

test('responsive promotion preserves ordering through resize and pinned headers', { tag: '@sandbox' }, async ({ page, inject }) => {
  await open(page, inject);
  const all = await ids(page);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 420, height: 800 });
  await expect.poll(async () => (await topIds(page)).length).toBeLessThan(all.length);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('#eh-pin')).toHaveClass(/\bon\b/);
  await expect(page.locator('#eh-pin .acts > [data-menu-key]:not([hidden])')).toHaveCount(0);
  await page.locator('#eh-pin .eh-more summary').click();
  await expect(page.locator('#eh-pin .abm [data-menu-key=tags]')).toBeVisible();
  await page.screenshot({ path: 'dev/_981-menu-phone.png' });
  await page.evaluate(() => scrollTo(0, 0));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await expect.poll(() => topIds(page)).toContain('tags');
  const top = await topIds(page);
  expect(top.indexOf('tags')).toBeLessThan(top.indexOf('edits'));
  expect(new Set(await ids(page)).size).toBe(all.length);
});

test('pointer dragging persists the same order used by the header', { tag: '@sandbox' }, async ({ page, inject }) => {
  await open(page, inject);
  const grip = await page.locator('#eh-cfg [data-menu-drag=tags]').boundingBox();
  const target = await page.locator('#eh-cfg [data-menu-row=edit]').boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, target.y + target.height - 2, { steps: 8 });
  await page.mouse.up();
  const saved = await page.evaluate(() => GM_getValue('view').menuOrder);
  expect(saved.indexOf('tags')).toBeGreaterThan(saved.indexOf('edit'));
  const top = await topIds(page);
  expect(top.indexOf('tags')).toBeGreaterThan(top.indexOf('edit'));
});

test('menu identity and configured order tolerate missing actions and duplicate settings @unit', async () => {
  const src = await functionSource('event_horizon', ['menuKey', 'menuSort']);
  const { menuKey, menuSort } = new Function(src + '; return {menuKey,menuSort};')();
  expect(menuKey('set-cover-art')).toBe('cover-art');
  expect(menuKey('event-art')).toBe('cover-art');
  expect(menuSort(['edit', 'tags', 'edits'], ['edits', 'missing', 'tags'])).toEqual(['edits', 'tags', 'edit']);
  expect(menuSort(['edit', 'tags', 'edits'], ['edits', 'tags', 'edits'])).toEqual(['edits', 'tags', 'edit']);
});
