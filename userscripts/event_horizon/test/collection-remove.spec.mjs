import { test, expect, requireLogin } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true } });

test('removes a collection inline without reloading', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const mb = 'https://test.musicbrainz.org', name = 'EH remove ' + Date.now();
  await page.goto(mb + '/collection/create');
  await requireLogin(page);
  const form = page.locator('form').filter({ has: page.locator('[name="edit-list.name"]') });
  await form.locator('[name="edit-list.name"]').fill(name);
  await form.locator('button[type=submit]').click();
  await page.waitForURL(/\/collection\/[0-9a-f-]{36}$/);
  const url = page.url(), id = url.split('/').pop();
  try {
    await page.goto(mb + '/user/majkinetor/collections');
    await inject('event_horizon');
    await page.evaluate(() => { window.__noReload = 1; });
    const remove = page.locator(`#app a[href*="${id}/own_collection/delete"]`);
    await expect(remove).toBeVisible();
    await remove.click();
    await expect(remove).toContainText('Confirm removal');
    await expect(page.locator('#app [data-colcancel]')).toBeVisible();
    await remove.click();
    await expect(remove).toHaveCount(0);
    expect(await page.evaluate(() => window.__noReload)).toBe(1);
    const list = await (await page.request.get(mb + '/user/majkinetor/collections')).text();
    expect(list).not.toContain(id);
  } finally {
    await page.request.post(url + '/own_collection/delete', { form: {} });
  }
});
