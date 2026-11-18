import { test, expect, pristine, requireLogin, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true } });

// MusicBrainz's "Add a new collection" opens in EH and is sent in the background: the tab never reloads (the player
// plays on), and EH moves on to the new collection, with the entity it was opened from in it
test('a new collection is added in EH without reloading the tab', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  const mb = 'https://test.musicbrainz.org';
  await page.goto(mb);
  await requireLogin(page);
  const { mbid: id } = await pristine(page, 'artist');
  const name = 'EH new collection ' + Date.now();
  let gid;
  try {
    await page.goto(`${mb}/artist/${id}`);
    await inject('event_horizon');
    await page.evaluate(() => { window.__noReload = 1; });
    const trigger = page.locator('#app [data-pop="collections"]');
    await expect(trigger).toBeVisible();
    await trigger.click();
    const create = page.locator('#pop-collections a[href*="/collection/create"]');
    await expect(create).toBeVisible();
    await create.click();
    const form = page.locator('#app form[data-cnform]');
    await expect(form).toBeVisible();
    expect(page.url()).toMatch(/\/collection\/create\?artist=\d+$/);
    // MusicBrainz's own form says nothing EH sends empty: the name is asked for before anything is sent
    await form.locator('button[type=submit]').click();
    await expect(form.locator('[role=alert]')).toBeVisible();
    await form.locator('[name="edit-list.name"]').fill(name);
    await form.locator('[name="edit-list.description"]').fill('Automated sandbox test: EH collection create');
    await attachShot(testInfo, page, 'collection-create');
    await form.locator('button[type=submit]').click();
    await expect(page).toHaveURL(/\/collection\/[0-9a-f-]{36}$/);
    gid = page.url().match(/\/collection\/([0-9a-f-]{36})$/)[1];
    expect(await page.evaluate(() => window.__noReload)).toBe(1);
    await expect(page.locator('#app h1')).toContainText(name);
    const html = await (await page.request.get(`${mb}/collection/${gid}`)).text();
    expect(html).toContain(`/artist/${id}`);
    await attachShot(testInfo, page, 'collection-created');
  } finally {
    if (gid) await page.request.post(`${mb}/collection/${gid}/own_collection/delete`, { form: {} });
  }
});
