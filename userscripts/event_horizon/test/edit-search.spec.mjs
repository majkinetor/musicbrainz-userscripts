import { test, expect, idle, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true } });
const path = '/search/edits?conditions.0.field=id&conditions.0.operator=%3D&conditions.0.args.0=4';

test('edit search keeps native conditions and saves the draft by name', { tag: '@sandbox' }, async ({ page, inject }, info) => {
  await page.goto('https://test.musicbrainz.org' + path);
  await idle(page);
  const fields = await page.locator('#extra-condition select').evaluate(s => [...s.options].filter(o => o.value).map(o => [o.value, o.text]));
  await inject('event_horizon');
  await expect(page.locator('#app #edit-search')).toBeVisible();
  expect(await page.locator('#extra-condition select').evaluate(s => [...s.options].filter(o => o.value).map(o => [o.value, o.text]))).toEqual(fields);
  const extra = page.locator('#extra-condition');
  await extra.locator('.eh-es-pick > button').click();
  await extra.getByRole('searchbox').fill('Status');
  await extra.getByRole('option', { name: 'Status', exact: true }).click();
  const status = page.locator('.condition:has(span.field-status)');
  await expect(status.locator('select[multiple]')).toHaveCount(1);
  const nativeStatuses = await status.locator('select[multiple]').evaluate(s => [...s.options].map(o => o.text));
  const picker = status.locator('.eh-es-pick').last();
  await picker.locator(':scope > button').click();
  await picker.getByRole('searchbox').fill('Open');
  await picker.getByRole('checkbox', { name: 'Open', exact: true }).check();
  await picker.getByRole('searchbox').fill('Cancelled');
  await picker.getByRole('checkbox', { name: 'Cancelled', exact: true }).check();
  expect(await status.locator('select[multiple]').evaluate(s => [...s.selectedOptions].map(o => o.text))).toEqual(['Open', 'Cancelled']);
  await picker.getByRole('searchbox').fill('');
  expect(await picker.getByRole('checkbox').count()).toBe(nativeStatuses.length);
  await picker.getByRole('searchbox').press('Escape');
  for (const key of ['type', 'voter']) {
    await extra.locator('select').evaluate((s, k) => { s.value = k; s.dispatchEvent(new Event('change', { bubbles: true })); }, key);
    await expect(page.locator('.condition span.field-' + key)).toHaveCount(1);
  }
  await page.locator('.condition .field-type select[multiple]').evaluate(s => { for (const o of s.options) o.selected = ['54,220', '17,262'].includes(o.value); s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.locator('.condition .field-voter select.operator').evaluate(s => { s.value = 'me'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.locator('.condition .field-voter select[multiple]').evaluate(s => { for (const o of s.options) o.selected = o.value === 'no'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.locator('#edit-search select[name=order]').evaluate(s => { s.value = 'asc'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.getByRole('textbox', { name: 'Search name', exact: true }).fill('My review');
  await page.getByRole('button', { name: 'Save search', exact: true }).click();
  await expect(page.locator('.eh-es-status')).toHaveText('Saved “My review”');
  const saved = await page.evaluate(() => GM_getValue('editSearches'));
  expect(saved).toHaveLength(1);
  const query = new URLSearchParams(saved[0].query);
  const statusIndex = [...query].find(([k,v]) => k.endsWith('.field') && v === 'status')[0].replace('.field', '');
  expect(query.getAll(statusIndex + '.args')).toHaveLength(2);
  expect(query.get('conditions.0.args.0')).toBe('4');
  expect(query.has('field')).toBe(false);
  const typeIndex = [...query].find(([k,v]) => k.endsWith('.field') && v === 'type')[0].replace('.field', '');
  expect(query.getAll(typeIndex + '.args').sort()).toEqual(['17,262', '54,220']);
  expect(query.get('order')).toBe('asc');
  await page.locator('.condition input[type=number]').first().fill('5');
  await page.locator('[data-hgrp=type]').click();
  await expect(page.locator('.condition input[type=number]').first()).toHaveValue('5');
  await page.getByRole('button', { name: 'Replace saved search', exact: true }).click();
  expect(new URLSearchParams((await page.evaluate(() => GM_getValue('editSearches')))[0].query).get('conditions.0.args.0')).toBe('5');
  await Promise.all([page.waitForURL(u => u.searchParams.get('conditions.0.args.0') === '5'), page.getByRole('button', { name: 'Load', exact: true }).click()]);
  await idle(page); await inject('event_horizon');
  await expect(page.locator('#app #edit-search')).toBeVisible();
  await expect(page.locator('.condition input[type=number]').first()).toHaveValue('5');
  expect(await page.locator('.condition span.field-status select[multiple]').evaluate(s => [...s.selectedOptions].map(o => o.text))).toEqual(['Open', 'Cancelled']);
  expect(await page.locator('.condition .field-type select[multiple]').evaluate(s => [...s.selectedOptions].map(o => o.value).sort())).toEqual(['17,262', '54,220']);
  expect(await page.locator('.condition .field-voter select[multiple]').evaluate(s => [...s.selectedOptions].map(o => o.value))).toEqual(['no']);
  await Promise.all([page.waitForEvent('domcontentloaded'), page.locator('#edit-search button[type=submit]').click()]);
  await idle(page); await inject('event_horizon');
  await expect(page.locator('#app #edit-search')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('conditions.0.args.0')).toBe('5');
  await page.locator('.eh-es-saved select').evaluate(s => { s.value = 'My review'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.getByRole('button', { name: 'Delete saved search', exact: true }).click();
  expect(await page.evaluate(() => GM_getValue('editSearches'))).toEqual([]);
  await attachShot(info, page, 'edit-search');
});

test('empty edit search keeps every native field, ranges and voter values', { tag: '@sandbox' }, async ({ page, inject }, info) => {
  await page.goto('https://test.musicbrainz.org/search/edits');
  await idle(page); await inject('event_horizon');
  await expect(page.locator('#app #edit-search')).toBeVisible();
  const keys = await page.locator('#extra-condition select').evaluate(s => [...s.options].map(o => o.value).filter(v => /^[a-z_]+$/.test(v)));
  expect(keys.length).toBeGreaterThan(30);
  for (const key of keys) {
    await page.locator('#extra-condition select').evaluate((s, k) => { s.value = k; s.dispatchEvent(new Event('change', { bubbles: true })); }, key);
    const row = page.locator('.condition').last();
    await expect(row.locator('span.field-' + key)).toHaveCount(1);
    await expect(row.locator(':scope > .eh-es-pick')).toHaveCount(1);
    const parity = await row.evaluate(r => [...r.querySelectorAll('select')].every(s => s.nextElementSibling?._esSelect === s && s.nextElementSibling.querySelectorAll('[data-es-index]').length === s.options.length));
    expect(parity, key + ' keeps every native select option').toBe(true);
    if (key === 'open_time') {
      await row.locator('select.operator').evaluate(s => { s.value = 'BETWEEN'; s.dispatchEvent(new Event('change', { bubbles: true })); });
      await expect(row.locator('.arg:visible')).toHaveCount(2);
      await row.locator('.arg input').nth(0).fill('2026-01-01');
      await row.locator('.arg input').nth(1).fill('2026-02-01');
    }
    if (key === 'voter') {
      const votes = await row.locator('select[multiple]').evaluate(s => [...s.options].map(o => [o.value, o.text]));
      expect(votes).toContainEqual(['no', 'No vote']); expect(votes).toContainEqual(['0', 'No']);
      expect(votes).toContainEqual(['4', 'Admin rejection']); expect(votes).toContainEqual(['3', 'Admin approval']);
    }
    await row.locator('button.remove-item').click();
    await expect(page.locator('.condition')).toHaveCount(0);
  }
  await page.locator('#extra-condition select').evaluate(s => { s.value = 'artist_area'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  const input = page.locator('.condition .autocomplete input.name');
  await input.fill('France');
  await expect(page.locator('.ui-autocomplete:visible .ui-menu-item').first()).toBeVisible();
  // The sandbox's indexed lookup can be empty; MusicBrainz offers its direct database lookup.
  const direct = page.locator('.ui-autocomplete:visible .ui-menu-item').filter({ hasText: 'Try again with direct search' });
  if (await direct.count()) await direct.click();
  await page.locator('.ui-autocomplete:visible .ui-menu-item').filter({ hasText: /^France/ }).first().click();
  await expect(page.locator('.condition .autocomplete input.id')).not.toHaveValue('');
  await page.getByRole('button', { name: 'Native form', exact: true }).click();
  await expect(page.locator('#edit-search .condition select.field')).toBeVisible();
  await page.getByRole('button', { name: 'Event Horizon', exact: true }).click();
  await expect(page.locator('#app #edit-search')).toBeVisible();
  await attachShot(info, page, 'empty-edit-search');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT, fullPage: true });
});

test('homepage links to edit search beside advanced search', { tag: '@sandbox' }, async ({ page, inject }, info) => {
  await page.goto('https://test.musicbrainz.org/'); await idle(page); await inject('event_horizon');
  await expect(page.locator('.hm-tg + a.hm-es')).toHaveAttribute('href', 'https://test.musicbrainz.org/search/edits');
  await Promise.all([page.waitForURL('**/search/edits'), page.locator('.hm-es').click()]);
  await idle(page); await inject('event_horizon');
  await expect(page.locator('#app #edit-search')).toBeVisible();
  await expect(page.locator('.condition')).toHaveCount(0);
  await attachShot(info, page, 'homepage-edit-search');
});
