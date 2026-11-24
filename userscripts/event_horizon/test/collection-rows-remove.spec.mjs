import { test, expect, requireLogin, mbJson } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true } });

// Right-dragging over a collection's rows picks them for removal, without folding the page's sections,
// and the header's Remove takes them out of the collection on MusicBrainz.
test('right-drag picks collection rows and removes them', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const mb = 'https://test.musicbrainz.org';
  await page.goto(mb); await requireLogin(page);
  const created = await page.request.post(`${mb}/collection/create`, { form: { 'edit-list.name': 'EH rows remove ' + Date.now(), 'edit-list.type_id': '1', 'edit-list.description': '' } });
  const gid = created.url().match(/\/collection\/([0-9a-f-]{36})/)?.[1];
  expect(gid).toBeTruthy();
  try {
    // three existing releases go in through their pages' "Add to" links
    const found = await mbJson(`${mb}/ws/2/release?artist=89ad4ac3-39f7-470e-963a-56509c546377&limit=3&fmt=json`);   // waits out the sandbox's 503 "busy"
    const mbids = found.releases.map(r => r.id);
    expect(mbids).toHaveLength(3);
    for (const mbid of mbids) {
      await page.goto(`${mb}/release/${mbid}`);
      const href = await page.locator(`a[href*="/collection/${gid}/collection_collaborator/add"]`).first().getAttribute('href');
      const status = await page.evaluate(async href => { const u = new URL(href, location.origin); return (await fetch(u.pathname, { method: 'POST', body: u.searchParams, credentials: 'include' })).status; }, href);
      expect(status).toBe(200);
    }
    await page.goto(`${mb}/collection/${gid}`);
    await inject('event_horizon');
    const rows = page.locator('#app tr[data-colrm]');
    await expect(rows).toHaveCount(3);
    const go = page.locator('#app [data-colrm-go]');
    await expect(go).toBeHidden();
    const folds = () => page.evaluate(() => document.querySelectorAll('#app>section.sec .fold[data-fold][aria-expanded="false"]').length);
    const f0 = await folds();
    // the row's middle: its cover, at the start, holds a play button, where the right button adds to the queue
    const mid = async i => { const b = await rows.nth(i).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
    // a drag over the first two
    await page.mouse.move(...await mid(0));
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(...await mid(1), { steps: 4 });
    await page.mouse.up({ button: 'right' });
    await expect(page.locator('#app tr.crm-on')).toHaveCount(2);
    await expect(go).toBeVisible();
    await expect(go).toContainText('2');
    expect(await folds()).toBe(f0);
    // Escape drops the pick; a single right-click picks one
    await page.keyboard.press('Escape');
    await expect(page.locator('#app tr.crm-on')).toHaveCount(0);
    await expect(go).toBeHidden();
    await page.mouse.click(...await mid(2), { button: 'right' });
    await expect(page.locator('#app tr.crm-on')).toHaveCount(1);
    const keep = await rows.nth(0).getAttribute('data-colrm'), gone = await rows.nth(2).getAttribute('data-colrm');
    await go.click();
    await expect(rows).toHaveCount(2);
    await expect(page.locator(`#app tr[data-colrm="${gone}"]`)).toHaveCount(0);
    await expect(page.locator(`#app tr[data-colrm="${keep}"]`)).toHaveCount(1);
    // read back through a page: a bare request gets MusicBrainz's "Verifying your browser" page, which only a page passes
    await page.goto(`${mb}/collection/${gid}`);
    const html = await page.content();
    expect(html).not.toContain(`value="${gone}"`);
    expect(html).toContain(`value="${keep}"`);
  } finally { await page.request.post(`${mb}/collection/${gid}/own_collection/delete`, { form: {} }); }
});
