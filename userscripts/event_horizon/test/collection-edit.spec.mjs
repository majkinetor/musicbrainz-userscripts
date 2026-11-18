import { test, expect, requireLogin, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true } });

// A collection's Edit opens MusicBrainz's form in EH, filled in, and sends it in the background: the tab never reloads,
// the collaborators it has are kept unless taken off, and EH moves back to the collection
test('a collection is edited in EH without reloading the tab', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  const mb = 'https://test.musicbrainz.org';
  await page.goto(mb);
  await requireLogin(page);
  const name = 'EH edit collection ' + Date.now();
  // kellnerd's editor id on test, so the collection starts with a collaborator
  const collab = { id: '2077436', name: 'kellnerd' };
  const collabs = async gid => {
    const raw = await (await page.request.get(`${mb}/collection/${gid}/own_collection/edit`)).text();
    return [...raw.matchAll(/"html_name":"edit-list\.collaborators\.\d+\.name"[^}]*?"value":"([^"]*)"/g)].map(x => x[1]);
  };
  let gid;
  try {
    const r = await page.request.post(`${mb}/collection/create`, { form: { 'edit-list.name': name, 'edit-list.type_id': '1', 'edit-list.description': '' } });
    gid = r.url().match(/\/collection\/([0-9a-f-]{36})$/)[1];
    await page.request.post(`${mb}/collection/${gid}/own_collection/edit`, { form: { 'edit-list.name': name, 'edit-list.type_id': '1', 'edit-list.description': '', 'edit-list.collaborators.0.id': collab.id, 'edit-list.collaborators.0.name': collab.name } });
    expect(await collabs(gid)).toContain(collab.name);

    await page.goto(`${mb}/collection/${gid}`);
    await inject('event_horizon');
    await page.evaluate(() => { window.__noReload = 1; });
    const edit = page.locator(`#app a[href$="/collection/${gid}/own_collection/edit"]`).first();
    await expect(edit).toBeVisible();
    await edit.click();
    const form = page.locator('#app form[data-cnform]');
    await expect(form).toBeVisible();
    expect(page.url()).toMatch(/\/own_collection\/edit$/);
    await expect(form.locator('[name="edit-list.name"]')).toHaveValue(name);
    await expect(form.locator('.cn-col')).toContainText(collab.name);
    // a rename keeps the collaborator
    await form.locator('[name="edit-list.name"]').fill(name + ' renamed');
    await form.locator('[name="edit-list.description"]').fill('Automated sandbox test: EH collection edit');
    await attachShot(testInfo, page, 'collection-edit');
    await form.locator('button[type=submit]').click();
    await expect(page).toHaveURL(new RegExp(`/collection/${gid}$`));
    await expect(page.locator('#app h1')).toContainText(name + ' renamed');
    expect(await collabs(gid)).toContain(collab.name);

    // taking the collaborator off, then saving, takes it off the collection
    await page.locator(`#app a[href$="/collection/${gid}/own_collection/edit"]`).first().click();
    await expect(form.locator('[name="edit-list.name"]')).toHaveValue(name + ' renamed');
    await form.locator('[data-cncolx]').first().click();
    await expect(form.locator('.cn-col')).toHaveCount(0);
    await expect(form.locator('[name="edit-list.description"]')).toHaveValue('Automated sandbox test: EH collection edit');
    await form.locator('button[type=submit]').click();
    await expect(page).toHaveURL(new RegExp(`/collection/${gid}$`));
    expect(await collabs(gid)).not.toContain(collab.name);
    expect(await page.evaluate(() => window.__noReload)).toBe(1);
  } finally {
    if (gid) await page.request.post(`${mb}/collection/${gid}/own_collection/delete`, { form: {} });
  }
});

// opened straight from its address, EH reads the form off the page MusicBrainz drew, collaborators included
test('a collection edit page opened directly is EH\'s form, filled in', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const mb = 'https://test.musicbrainz.org';
  await page.goto(mb);
  await requireLogin(page);
  const name = 'EH edit collection ' + Date.now();
  let gid;
  try {
    const r = await page.request.post(`${mb}/collection/create`, { form: { 'edit-list.name': name, 'edit-list.type_id': '1', 'edit-list.description': 'kept', 'edit-list.public': '1' } });
    gid = r.url().match(/\/collection\/([0-9a-f-]{36})$/)[1];
    await page.request.post(`${mb}/collection/${gid}/own_collection/edit`, { form: { 'edit-list.name': name, 'edit-list.type_id': '1', 'edit-list.description': 'kept', 'edit-list.public': '1', 'edit-list.collaborators.0.id': '2077436', 'edit-list.collaborators.0.name': 'kellnerd' } });
    await page.goto(`${mb}/collection/${gid}/own_collection/edit`);
    await inject('event_horizon');
    const form = page.locator('#app form[data-cnform]');
    await expect(form).toBeVisible();
    await expect(form.locator('[name="edit-list.name"]')).toHaveValue(name);
    await expect(form.locator('[name="edit-list.description"]')).toHaveValue('kept');
    await expect(form.locator('[name="edit-list.public"]')).toBeChecked();
    await expect(form.locator('.cn-col')).toContainText('kellnerd');
    await expect(page).toHaveTitle(new RegExp(`^${name} · Edit collection`));
  } finally {
    if (gid) await page.request.post(`${mb}/collection/${gid}/own_collection/delete`, { form: {} });
  }
});
