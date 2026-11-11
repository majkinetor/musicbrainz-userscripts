import { test, expect, idle } from '../../../dev/test/harness.mjs';
test.use({ gm: { name: 'Event Horizon' } });

test('arrow navigation keeps typing in the filter and Enter selects the highlighted option', { tag: '@sandbox' }, async ({page, inject}) => {
  await page.goto('https://test.musicbrainz.org/search/edits');
  await idle(page); await inject('event_horizon');
  const add = page.locator('#extra-condition'), filter = add.getByRole('searchbox');
  await add.locator('.eh-es-pick > button').click();
  await filter.fill('edit');
  await filter.press('ArrowDown');
  await expect(filter).toBeFocused();
  await filter.pressSequentially(' note');
  await expect(filter).toHaveValue('edit note');
  await filter.press('ArrowDown');
  await filter.press('ArrowDown');
  await filter.press('ArrowUp');
  await expect(filter).toBeFocused();
  await filter.press('ArrowDown');
  await filter.press('Enter');
  await expect(page.locator('#app .condition select.field')).toHaveValue('edit_note_content');
});

test('checkbox labels toggle selections without closing the picker or losing the filter to ID', { tag: '@sandbox' }, async ({page, inject}) => {
  await page.goto('https://test.musicbrainz.org/search/edits?conditions.0.field=id&conditions.0.operator=%3D&conditions.0.args.0=4&conditions.1.field=status&conditions.1.operator=%3D&conditions.1.args=1');
  await idle(page); await inject('event_horizon');
  const pick = page.locator('#app .field-status .eh-es-pick').last();
  await pick.locator(':scope > button').click();
  const filter = pick.getByRole('searchbox');
  await filter.fill('Applied');
  // Click text, not the checkbox: the whole item must toggle the native option.
  await pick.locator('label > span').filter({hasText: /^Applied$/}).click();
  await expect(pick.getByRole('checkbox', {name:'Applied', exact:true})).toBeChecked();
  await expect(pick.locator('.eh-es-menu')).toBeVisible();
  await filter.fill('Cancelled');
  await expect(filter).toBeFocused();
  // A background history redraw must preserve the open picker and its focused filter.
  await page.locator('[data-hgrp=type]').evaluate(b=>b.closest('#app').onclick({target:b}));
  await expect(filter).toBeFocused();
  await expect(filter).toHaveValue('Cancelled');
  await pick.locator('label > span').filter({hasText:/^Cancelled$/}).click();
  await expect(pick.getByRole('checkbox', {name:'Cancelled', exact:true})).toBeChecked();
  const selected = await page.locator('#app .field-status select[multiple]').evaluate(s=>[...s.selectedOptions].map(o=>o.text));
  expect(selected).toEqual(['Open', 'Applied', 'Cancelled']);
});
