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

// opened from the pinned bar, the menu stays under the bar's icon when it turns into the form, not back at the header
test('the collections menu opened from the pinned bar stays there for a new collection', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const mb = 'https://test.musicbrainz.org';
  await page.goto(mb);
  await requireLogin(page);
  const { mbid: id } = await pristine(page, 'artist');
  await page.goto(`${mb}/artist/${id}`);
  await inject('event_horizon');
  await page.evaluate(() => { document.body.style.minHeight = '4000px'; scrollTo(0, 1500); });
  const pc = page.locator('#eh-pin.on .pcol');
  await expect(pc).toBeVisible();
  await pc.click();
  const pop = page.locator('#pop-collections');
  await expect(pop).toBeVisible();
  const under = async () => {
    const [b, p] = await Promise.all([pc.boundingBox(), pop.boundingBox()]);
    expect(Math.abs(p.y - (b.y + b.height + 6))).toBeLessThan(3);
  };
  await under();
  await pop.locator('[data-cnew]').click();
  await expect(pop.locator('form.cn')).toBeVisible();
  await under();
});
