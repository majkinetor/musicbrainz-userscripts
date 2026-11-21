import { test, expect, pristine, requireLogin, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true } });

// "New collection" in an entity's collections menu opens a form in the menu, as in the player's picker: the collection
// is added in the background with the entity in it, the tab stays where it is and never reloads
test('a new collection is added from the collections menu without leaving the page', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
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
    const url = page.url();
    const trigger = page.locator('#app [data-pop="collections"]');
    await expect(trigger).toBeVisible();
    await trigger.click();
    const pop = page.locator('#pop-collections');
    await pop.locator('[data-cnew]').click();
    const form = pop.locator('form.cn');
    await expect(form).toBeVisible();
    await expect(form.locator('[name=n]')).toBeFocused();
    // nothing is sent without a name
    await form.locator('button[type=submit]').click();
    await expect(form.locator('[role=alert]')).toBeVisible();
    await form.locator('[name=n]').fill(name);
    await form.locator('[name=d]').fill('Automated sandbox test: EH collection create');
    await attachShot(testInfo, page, 'collection-create');
    await form.locator('button[type=submit]').click();
    await expect(form).toHaveCount(0);
    const row = pop.locator('[data-collchange]', { hasText: name });
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    gid = await row.getAttribute('data-collchange');
    expect(page.url()).toBe(url);
    expect(await page.evaluate(() => window.__noReload)).toBe(1);
    const html = await (await page.request.get(`${mb}/collection/${gid}`)).text();
    expect(html).toContain(`/artist/${id}`);
    await attachShot(testInfo, page, 'collection-created');
  } finally {
    if (gid) await page.request.post(`${mb}/collection/${gid}/own_collection/delete`, { form: {} });
  }
});
