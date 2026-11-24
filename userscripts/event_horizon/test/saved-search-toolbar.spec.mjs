import {test,expect,idle} from '../../../dev/test/harness.mjs';
test.use({gm:{name:'Event Horizon',persist:true}});

test('one saved-search name supports rename, copy, filtering and deletion', {tag:'@sandbox'}, async({page,inject})=>{
  await page.goto('https://test.musicbrainz.org/search/edits?conditions.0.field=id&conditions.0.operator=%3D&conditions.0.args.0=4');
  await idle(page);await inject('event_horizon');
  const bar=page.locator('.eh-es-saved'),name=bar.getByLabel('Search name',{exact:true});
  await expect(bar.locator('[data-es-find]')).toHaveCount(1);
  await expect(bar.locator('select')).toHaveCount(0);
  await name.fill('Review');await bar.getByRole('button',{name:'Save',exact:true}).click();
  await name.fill('Renamed review');await bar.getByRole('button',{name:'Save',exact:true}).click();
  expect((await page.evaluate(()=>GM_getValue('editSearches'))).map(s=>s.name)).toEqual(['Renamed review']);
  await name.click();
  await bar.getByRole('option',{name:'Renamed review',exact:true}).getByRole('button',{name:'Save a copy'}).click();
  expect((await page.evaluate(()=>GM_getValue('editSearches'))).map(s=>s.name)).toEqual(['Renamed review','Renamed review copy']);
  await name.fill('Renamed review copy');await bar.getByRole('button',{name:'Save',exact:true}).click();
  await expect(bar.getByRole('status')).toHaveText('A search with this name already exists');
  await name.fill('Renamed review');
  await bar.getByRole('button',{name:'Find a saved search'}).click();
  await name.fill('no match');await expect(bar.locator('[data-es-results]')).toContainText('No saved searches');
  await name.press('Escape');await expect(name).toHaveValue('Renamed review');
  await bar.getByRole('button',{name:'Find a saved search'}).click();
  await name.fill('copy');await name.press('ArrowDown');await expect(name).toBeFocused();
  // an edit search runs in the tab since 2026-11-18 (f38e50429): no page load, so no new injection, only a new history entry
  const h0=await page.evaluate(()=>history.length);
  await name.press('Enter');
  await expect.poll(()=>page.evaluate(()=>history.length)).toBeGreaterThan(h0);
  await idle(page);
  await expect(page.locator('.eh-es-saved').getByLabel('Search name',{exact:true})).toHaveValue('Renamed review copy');
  // Both saved entries have the same query; selecting by name must retain the chosen identity.
  await page.locator('.eh-es-saved').getByLabel('Search name',{exact:true}).click();
  await page.locator('.eh-es-saved').getByRole('option',{name:'Renamed review copy',exact:true}).getByRole('button',{name:'Delete'}).click();
  expect((await page.evaluate(()=>GM_getValue('editSearches'))).length).toBe(1);
  // New search is the group bar's New since 2026-11-18 (d83520159); the form's own button stays hidden
  await Promise.all([page.waitForURL(u=>u.pathname==='/search/edits'&&!u.search),page.locator('[data-hnew]').click()]);
  await idle(page);
  await expect(page.locator('.eh-es-saved')).toHaveCount(1);
  await expect(page.locator('#app .condition')).toHaveCount(0);
  await expect(page.locator('.eh-es-saved').getByLabel('Search name',{exact:true})).toHaveValue('');
});

test('saved names are visible on combo focus and New search resets without reloading', {tag:'@sandbox'},async({page,inject})=>{
  await page.goto('https://test.musicbrainz.org/search/edits?conditions.0.field=id&conditions.0.operator=%3D&conditions.0.args.0=4');
  await idle(page);
  await page.evaluate(()=>GM_setValue('editSearches', [{name:'Review four',query:'conditions.0.field=id&conditions.0.operator=%3D&conditions.0.args.0=4'},{name:'Review five',query:'conditions.0.field=id&conditions.0.operator=%3D&conditions.0.args.0=5'}]));
  await inject('event_horizon');
  const bar=page.locator('.eh-es-saved'),name=bar.getByLabel('Search name',{exact:true});
  await name.focus();
  await expect(bar.getByRole('option',{name:'Review four',exact:true})).toBeVisible();
  await expect(bar.getByRole('option',{name:'Review five',exact:true})).toBeVisible();
  await name.press('Escape');
  await page.evaluate(()=>window.__searchResetMarker=1);
  await page.locator('[data-hnew]').click();
  await expect(page.locator('#app .condition')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__searchResetMarker)).toBe(1);
  expect(new URL(page.url()).search).toBe('');
  expect((await page.evaluate(()=>GM_getValue('editSearches'))).length).toBe(2);
});
