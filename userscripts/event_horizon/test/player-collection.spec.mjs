import { test, expect, pristine, requireLogin } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true, values: { view: { on: true, player: true } } } });

test('saves the queue to a new recording collection', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }) => {
  const mb = 'https://test.musicbrainz.org';
  await context.route('https://www.youtube-nocookie.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<p>player fixture</p>' }));
  await page.goto(mb);
  await requireLogin(page);
  const first = await pristine(page, 'standalone-recording');
  const second = await pristine(page, 'standalone-recording');
  await inject('event_horizon', { waitFor: '__ehPlayerTest' });
  const links = [{ key: 'youtube', name: 'YouTube', urls: [{ url: 'https://www.youtube.com/watch?v=abcdefghijk' }] }];
  await page.evaluate(({ first, second, links }) => {
    window.__ehPlayerTest.recording({ id: first.mbid, title: 'First', ac: [], links }, []);
    window.__ehPlayerTest.recording({ id: second.mbid, title: 'Second', ac: [], links }, [], true);
  }, { first, second, links });
  await page.locator('.ply-ctl [data-ply="lb"]').click();
  await page.locator('#eh-ply-menu [data-m="savecoll"]').click();
  const name = 'Player queue ' + Date.now();
  await page.locator('#eh-ply-menu input').fill(name);
  const created = page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/collection/create'));
  await page.locator('#eh-ply-menu [data-m="save"]').click();
  const response = await created;
  const gid = response.headers().location?.match(/\/collection\/([0-9a-f-]{36})/)?.[1];
  expect(gid, `status ${response.status()}`).toBeTruthy();
  try {
    await expect(page.getByRole('status')).toHaveText(/Saved 2 recordings|Collection save failed/, { timeout: 30000 });
    expect(await page.getByRole('status').textContent()).toContain('Saved 2 recordings');
    await page.goto(`${mb}/collection/${gid}`);
    await expect(page.locator(`a[href="/recording/${second.mbid}"]`).first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator(`a[href="/recording/${first.mbid}"]`).first()).toBeVisible();
    await page.route('**/ws/2/recording/*', route => {
      const id = new URL(route.request().url()).pathname.split('/').pop();
      if (![first.mbid, second.mbid].includes(id)) return route.continue();
      return route.fulfill({ json: { id, title: id, 'artist-credit': [], relations: [{ 'target-type': 'url', type: 'streaming', url: { resource: 'https://www.youtube.com/watch?v=abcdefghijk' } }] } });
    });
    await inject('event_horizon', { waitFor: '__ehPlayerTest' });
    await page.evaluate(({ first, links }) => window.__ehPlayerTest.recording({ id: first.mbid, title: 'First', ac: [], links }, []), { first, links });
    await page.locator('.ply-ctl [data-ply="lb"]').click();
    await page.locator('#eh-ply-menu [data-m="loadcoll"]').click();
    await page.locator('#eh-ply-menu button').filter({ hasText: name }).click();
    await expect.poll(async () => (await page.evaluate(() => window.__ehPlayerTest.state())).q.length).toBe(2);
    await page.locator(`[data-colplay="${first.mbid}"]`).click();
    await expect.poll(async () => (await page.evaluate(() => window.__ehPlayerTest.state())).q.length).toBe(1);
    await page.locator('[data-colplay="all"]').click();
    await expect.poll(async () => (await page.evaluate(() => window.__ehPlayerTest.state())).q.length).toBe(2);
  } finally {
    await page.request.post(`${mb}/collection/${gid}/own_collection/delete`, { form: {} });
  }
});

test('plays a release collection and an individual release', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }) => {
  const mb = 'https://test.musicbrainz.org';
  await context.route('https://www.youtube-nocookie.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<p>player fixture</p>' }));
  await page.goto(mb); await requireLogin(page);
  const rel = await pristine(page, 'release', { tracks: 2 });
  const created = await page.request.post(`${mb}/collection/create`, { form: { 'edit-list.name': 'Player release ' + Date.now(), 'edit-list.type_id': '1', 'edit-list.description': '' } });
  const gid = created.url().match(/\/collection\/([0-9a-f-]{36})/)?.[1];
  expect(gid).toBeTruthy();
  try {
    await page.goto(`${mb}/release/${rel.mbid}`);
    const add = page.locator(`a[href*="/collection/${gid}/collection_collaborator/add"]`).first();
    await expect(add).toBeAttached();
    const href = await add.getAttribute('href');
    const status = await page.evaluate(async href => { const u = new URL(href, location.origin); const r = await fetch(u.pathname, { method: 'POST', body: u.searchParams, credentials: 'include' }); return r.status; }, href);
    expect(status).toBe(200);
    await page.goto(`${mb}/collection/${gid}`);
    await expect(page.locator(`a[href="/release/${rel.mbid}"]`).first()).toBeVisible();
    await page.route(`**/ws/2/release/${rel.mbid}*`, route => route.fulfill({ json: { id: rel.mbid, title: 'Release fixture', 'artist-credit': [], 'release-group': {}, media: [{ tracks: [1, 2].map(n => ({ number: String(n), title: 'Track ' + n, recording: { id: `00000000-0000-0000-0000-00000000000${n}`, relations: [{ 'target-type': 'url', type: 'streaming', url: { resource: 'https://www.youtube.com/watch?v=abcdefghijk' } }] } })) }] } }));
    await inject('event_horizon', { waitFor: '__ehPlayerTest' });
    await page.locator('[data-colplay="all"]').click();
    await expect.poll(async () => (await page.evaluate(() => window.__ehPlayerTest.state())).q.length).toBe(2);
    await page.locator(`[data-colplay="${rel.mbid}"]`).click({ button: 'right' });
    await expect.poll(async () => (await page.evaluate(() => window.__ehPlayerTest.state())).q.length).toBe(4);
  } finally { await page.request.post(`${mb}/collection/${gid}/own_collection/delete`, { form: {} }); }
});
