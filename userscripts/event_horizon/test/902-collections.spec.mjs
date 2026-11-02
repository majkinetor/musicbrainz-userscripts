import { test, expect, pristine, requireLogin, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true } });

test('entity collections are filtered, cached and changed in the background', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  const mb = 'https://test.musicbrainz.org';
  await page.goto(mb);
  await requireLogin(page);
  const { mbid: id } = await pristine(page, 'artist');
  const { mbid: id2 } = await pristine(page, 'artist');
  const name = 'EH collections ' + Date.now();
  const create = async (n, type) => {
    const r = await page.request.post(mb + '/collection/create', { form: { 'edit-list.name': n, 'edit-list.type_id': type, 'edit-list.description': 'Automated sandbox test for #902' } });
    expect(r.ok()).toBeTruthy();
    const gid = r.url().match(/\/collection\/([0-9a-f-]{36})/);
    expect(gid, await r.text()).toBeTruthy();
    return gid[1];
  };
  const col = await create(name, '8');
  const other = await create(name + ' wrong type', '13');
  try {
    await page.goto(`${mb}/artist/${id}`);
    await inject('event_horizon');
    const trigger = page.locator('#app [data-pop="collections"]');
    await expect(trigger).toBeVisible();
    await trigger.click();
    const row = page.locator(`[data-collchange="${col}"]`);
    await expect(row).toBeVisible();
    await expect(page.locator(`[data-collchange="${other}"]`)).toHaveCount(0);
    await expect(row).toHaveAttribute('aria-pressed', 'false');
    const mutation = `${mb}/collection/${col}/collection_collaborator/add`;
    await page.route(mutation, r => r.fulfill({ status: 500, body: 'Temporary failure' }));
    await row.click();
    await expect(page.locator('#pop-collections [role="alert"]')).toContainText('HTTP 500');
    await expect(row).toHaveAttribute('aria-pressed', 'false');
    await page.unroute(mutation);
    await attachShot(testInfo, page, 'collections-before');
    const url = page.url();
    await row.click();
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    expect(page.url()).toBe(url);
    // A real read from the collection proves the background write reached the sandbox.
    let html = await (await page.request.get(`${mb}/collection/${col}`)).text();
    expect(html).toContain(`/artist/${id}`);
    await attachShot(testInfo, page, 'collections-added');
    await row.click();
    await expect(row).toHaveAttribute('aria-pressed', 'false');
    html = await (await page.request.get(`${mb}/collection/${col}`)).text();
    expect(html).not.toContain(`/artist/${id}`);
    // Open a second entity through EH: its sidebar is fetched once on the visit, before the menu is needed.
    let reads = 0;
    page.on('request', r => { if (r.method() === 'GET' && r.url() === `${mb}/artist/${id2}`) reads++; });
    await page.evaluate(href => { const a = document.createElement('a'); a.href = href; document.querySelector('#app').append(a); a.click(); }, `${mb}/artist/${id2}`);
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(row).toBeEnabled();
    await expect(row).toHaveAttribute('aria-pressed', 'false');
    expect(reads).toBe(1);
    await page.keyboard.press('Escape');
    await trigger.click();
    await expect(row).toBeVisible();
    expect(reads).toBe(1);
    await row.click();
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    html = await (await page.request.get(`${mb}/collection/${col}`)).text();
    expect(html).toContain(`/artist/${id2}`);
    // The manager's cache survives a reload, scoped to this account and origin.
    await page.reload();
    await inject('event_horizon');
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    await row.click();
    await expect(row).toHaveAttribute('aria-pressed', 'false');
  } finally {
    for (const gid of [col, other]) {
      const r = await page.request.post(`${mb}/collection/${gid}/own_collection/delete`, { form: {} });
      expect(r.url()).toContain('/user/majkinetor/collections');
    }
  }
});
