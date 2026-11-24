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
    // the toast: a loading page's skeleton is a status too
    await expect(page.locator('#toast')).toHaveText(/Saved 2 recordings|Collection save failed/, { timeout: 30000 });
    expect(await page.locator('#toast').textContent()).toContain('Saved 2 recordings');
    await page.goto(`${mb}/collection/${gid}`);
    await expect(page.locator(`a[href="/recording/${second.mbid}"]`).first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator(`a[href="/recording/${first.mbid}"]`).first()).toBeVisible();
    const yt = [{ 'target-type': 'url', type: 'streaming', url: { resource: 'https://www.youtube.com/watch?v=abcdefghijk' } }];
    await page.route('**/ws/2/recording/*', route => {
      const id = new URL(route.request().url()).pathname.split('/').pop();
      if (![first.mbid, second.mbid].includes(id)) return route.continue();
      return route.fulfill({ json: { id, title: id, 'artist-credit': [], releases: [{ id: 'n', title: 'Newer', date: '2020', 'release-group': { id: 'g2' } }, { id: 'o', title: 'Oldest', date: '1999-05', 'release-group': { id: 'g1' } }], relations: yt } });
    });
    // the player reads a recording collection by browse since 0912228ac (2026-11-20), the covers after by lookup
    await page.route(`**/ws/2/recording?collection=${gid}*`, route => route.fulfill({ json: { 'recording-count': 2, 'recording-offset': 0, recordings: [first, second].map(r => ({ id: r.mbid, title: r.mbid, 'artist-credit': [], relations: yt })) } }));
    await inject('event_horizon', { waitFor: '__ehPlayerTest' });
    await page.evaluate(({ first, links }) => window.__ehPlayerTest.recording({ id: first.mbid, title: 'First', ac: [], links }, []), { first, links });
    await page.locator('.ply-ctl [data-ply="lb"]').click();
    await page.locator('#eh-ply-menu [data-m="loadcoll"]').click();
    await page.locator('#eh-ply-menu button').filter({ hasText: name }).click();
    await expect.poll(async () => (await page.evaluate(() => window.__ehPlayerTest.state())).q.length).toBe(2);
    // a loose recording's second row names the oldest release, whose release group gives the cover
    await expect(page.locator('.ply-ctl .ply-rl')).toHaveText('Oldest · 1999');
    await page.locator(`[data-colplay="${first.mbid}"]`).locator('..').hover();
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
    const fixture = { id: rel.mbid, title: 'Release fixture', 'artist-credit': [], 'release-group': {}, media: [{ tracks: [1, 2].map(n => ({ number: String(n), title: 'Track ' + n, recording: { id: `00000000-0000-0000-0000-00000000000${n}`, relations: [{ 'target-type': 'url', type: 'streaming', url: { resource: 'https://www.youtube.com/watch?v=abcdefghijk' } }] } })) }] };
    await page.route(`**/ws/2/release/${rel.mbid}*`, route => route.fulfill({ json: fixture }));
    // the player reads a release collection by browse since 0912228ac (2026-11-20); one release alone still by lookup
    await page.route(`**/ws/2/release?collection=${gid}*`, route => route.fulfill({ json: { 'release-count': 1, 'release-offset': 0, releases: [fixture] } }));
    await inject('event_horizon', { waitFor: '__ehPlayerTest' });
    await page.locator('[data-colplay="all"]').click();
    await expect.poll(async () => (await page.evaluate(() => window.__ehPlayerTest.state())).q.length).toBe(2);
    await page.locator(`[data-colplay="${rel.mbid}"]`).locator('..').hover();
    await page.locator(`[data-colplay="${rel.mbid}"]`).click({ button: 'right' });
    await expect.poll(async () => (await page.evaluate(() => window.__ehPlayerTest.state())).q.length).toBe(4);
  } finally { await page.request.post(`${mb}/collection/${gid}/own_collection/delete`, { form: {} }); }
});

test('makes a new collection right in the collections picker, holding the recording', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }) => {
  const mb = 'https://test.musicbrainz.org';
  await context.route('https://www.youtube-nocookie.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<p>player fixture</p>' }));
  await page.goto(mb); await requireLogin(page);
  const rec = await pristine(page, 'standalone-recording');
  await page.goto(mb);
  await inject('event_horizon', { waitFor: '__ehPlayerTest' });
  const links = [{ key: 'youtube', name: 'YouTube', urls: [{ url: 'https://www.youtube.com/watch?v=abcdefghijk' }] }];
  await page.evaluate(({ rec, links }) => window.__ehPlayerTest.recording({ id: rec.mbid, title: 'First', ac: [], links }, []), { rec, links });
  await page.locator('[data-ply="list"]').click();
  const btn = page.locator('#eh-ply-menu .ply-ra [data-pa="rec"]');
  await btn.click({ button: 'right' });
  const menu = page.locator('#eh-ply-coll');
  await menu.locator('[data-cnew]').click();
  const name = 'Picker new ' + Date.now();
  await expect(menu.locator('form.cn [name=n]')).toBeFocused();
  await menu.locator('form.cn [name=n]').fill(name);
  await menu.locator('form.cn [name=d]').fill('made in the picker');
  await menu.locator('form.cn [name=p]').check();
  const created = page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/collection/create'));
  await menu.locator('form.cn button[type=submit]').click();
  const res = await created;
  const gid = res.headers().location?.match(/\/collection\/([0-9a-f-]{36})/)?.[1];
  expect(gid, `status ${res.status()}`).toBeTruthy();
  try {
    expect(res.request().postData()).toContain('edit-list.public=1');
    await expect(menu.locator('form.cn')).toHaveCount(0);
    await expect(menu.locator(`[data-cc="${gid}"]`)).toHaveAttribute('aria-checked', 'true');
    await expect(menu.locator(`[data-cc="${gid}"]`)).toContainText(name);
    await page.goto(`${mb}/collection/${gid}`);
    await expect(page.locator(`a[href="/recording/${rec.mbid}"]`).first()).toBeVisible({ timeout: 30000 });
  } finally { await page.request.post(`${mb}/collection/${gid}/own_collection/delete`, { form: {} }); }
});
