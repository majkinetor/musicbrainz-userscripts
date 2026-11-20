import { test, expect, pristine, requireLogin } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true } });

// A recording collection's rows lead with a cover, as a release collection's do: the release group of the
// recording's oldest release (undated ones last), from one ws/2 search for the page's recordings.
test('recording collection rows show their release group cover', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const mb = 'https://test.musicbrainz.org';
  await page.goto(mb); await requireLogin(page);
  const { mbid: rec } = await pristine(page, 'standalone-recording');
  const created = await page.request.post(`${mb}/collection/create`, { form: { 'edit-list.name': 'EH recording covers ' + Date.now(), 'edit-list.type_id': '12', 'edit-list.description': '' } });
  const gid = created.url().match(/\/collection\/([0-9a-f-]{36})/)?.[1];
  expect(gid).toBeTruthy();
  try {
    await page.goto(`${mb}/recording/${rec}`);
    const href = await page.locator(`a[href*="/collection/${gid}/collection_collaborator/add"]`).first().getAttribute('href');
    const status = await page.evaluate(async href => { const u = new URL(href, location.origin); return (await fetch(u.pathname, { method: 'POST', body: u.searchParams, credentials: 'include' })).status; }, href);
    expect(status).toBe(200);
    const oldRg = '11111111-1111-4111-8111-111111111111', newRg = '22222222-2222-4222-8222-222222222222';
    let searches = 0;
    // the search goes through the page's own fetch: a fresh recording is not in the sandbox's search index yet
    await page.route(/\/ws\/2\/recording\?query=/, route => {
      searches++;
      expect(decodeURIComponent(route.request().url())).toContain(rec);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, recordings: [{ id: rec, releases: [
        { id: 'a', date: '2020', 'release-group': { id: newRg } },
        { id: 'b', 'release-group': { id: newRg } },
        { id: 'c', date: '1999-05', 'release-group': { id: oldRg } }] }] }) });
    });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await page.route('https://coverartarchive.org/release-group/**', route => route.fulfill({ contentType: 'image/png', body: png }));
    await page.goto(`${mb}/collection/${gid}`);
    await inject('event_horizon');
    const img = page.locator(`#app td.tc img[data-dgcover="recording"][data-aid="${rec}"]`);
    await expect(img).toHaveAttribute('src', `https://coverartarchive.org/release-group/${oldRg}/front-250`, { timeout: 30000 });
    expect(searches).toBe(1);
  } finally {
    await page.request.post(`${mb}/collection/${gid}/own_collection/delete`, { form: {} });
  }
});
