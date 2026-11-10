import { test, expect, functionSource, requireLogin, idle } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test('collection history defaults to others and preserves an explicit all choice', { tag: '@unit' }, async ({ page }) => {
  const src = await functionSource('event_horizon', ['MBID', 'H_LISTS', 'histKey']);
  const keys = await page.evaluate(src => {
    const run = new Function('location', src + '; return histKey;')({ href: 'https://test.musicbrainz.org/', origin: 'https://test.musicbrainz.org' });
    const path = 'https://test.musicbrainz.org/collection/c16fa0e2-30b3-459a-9ed2-36181a89903a/open_edits';
    return [run(path), run(path + '?hide_own=0'), run(path + '?hide_own=1&page=2')].map(x => decodeURIComponent(x));
  }, src);
  expect(keys[0]).toContain('?hide_own=1');
  expect(keys[1]).toContain('?hide_own=0');
  expect(keys[2]).toBe(keys[0]);
});

test('group voting filters permission, skips unchanged votes and recovers after failure', { tag: '@unit' }, async ({ page }) => {
  const src = await functionSource('event_horizon', ['H_VOTES', 'histVoteSend']);
  const result = await page.evaluate(async src => {
    const data = { id: 'list', edits: [{ id: 1, can: true, my: '-2' }, { id: 2, can: false, my: '-2' }, { id: 3, can: true, my: '1' }] };
    const sent = [], warnings = [];
    let fail = true;
    const send = new Function('data', 'MB', 'histSrc', 'histVotePaint', 'LOG', 'mbnFetch', 'kpWrote', 'toast', src + '; return histVoteSend;')(data, 'https://test.musicbrainz.org', () => '/edit/open', () => {}, { keep() {}, info() {}, err() {} }, async (_, o) => { sent.push([...o.body]); return { ok: !fail, status: fail ? 500 : 200 }; }, () => {}, x => warnings.push(x));
    const b = { closest: () => ({ dataset: { hids: '1,2,3' } }), dataset: { hgvote: '1' } };
    await send(b);
    const failed = data.edits.map(e => ({ my: e.my, busy: !!e.voting }));
    fail = false; await send(b); await send(b);
    return { sent, warnings, failed, final: data.edits.map(e => e.my) };
  }, src);
  expect(result.sent).toHaveLength(2);
  expect(result.sent[1]).toContainEqual(['enter-vote.vote.0.edit_id', '1']);
  expect(result.sent[1].filter(([k]) => k.endsWith('edit_id'))).toHaveLength(1);
  expect(result.failed).toEqual([{ my: '-2', busy: false }, { my: '-2', busy: false }, { my: '1', busy: false }]);
  expect(result.final).toEqual(['1', '-2', '1']);
  expect(result.warnings).toHaveLength(1);
});

test('a group batch persists on the sandbox and keeps its group open state', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/edit/open');
  await requireLogin(page);
  await idle(page);
  await inject('event_horizon');
  await expect(page.locator('#app .hgrp').first()).toBeVisible();
  await expect(page.locator('#app .hld')).not.toContainText('loading');
  await page.locator('[data-hgrp="editor"]').click();
  const groups = page.locator('#app [data-hids]');
  await expect(groups.first()).toBeVisible();
  const sizes = await groups.evaluateAll(xs => xs.map(x => x.dataset.hids.split(',').length));
  const index = sizes.indexOf(Math.min(...sizes.filter(n => n >= 2)));
  expect(index).toBeGreaterThanOrEqual(0);
  const group = groups.nth(index), ids = (await group.getAttribute('data-hids')).split(',');
  const native = await context.newPage();
  const before = [];
  try {
    for (const id of ids) {
      await native.goto('https://test.musicbrainz.org/edit/' + id);
      before.push([id, await native.locator('.voteopts input:checked').inputValue()]);
    }
    const choice = before.some(([, v]) => v !== '-1') ? '-1' : '-2';
    const parent = group.locator('xpath=..');
    const wasOpen = await parent.locator('xpath=..').getAttribute('class');
    const responsePromise = page.waitForResponse(r => r.url().includes('/edit/enter_votes') && r.request().method() === 'POST');
    await group.locator(`[data-hgvote="${choice}"]`).click();
    const response = await responsePromise;
    const submitted = new URLSearchParams(response.request().postData());
    expect([...submitted].filter(([k]) => k.endsWith('.edit_id')).map(([, id]) => id).sort()).toEqual(before.filter(([, v]) => v !== choice).map(([id]) => id).sort());
    await expect(group.locator(`[data-hgvote="${choice}"]`)).toHaveAttribute('aria-pressed', 'true');
    expect(await parent.locator('xpath=..').getAttribute('class')).toBe(wasOpen);
    await page.screenshot({ path: 'dev/_990-group-votes.png', fullPage: true });
    await testInfo.attach('group-votes', { path: 'dev/_990-group-votes.png', contentType: 'image/png' });
    for (const id of ids) {
      await native.goto('https://test.musicbrainz.org/edit/' + id);
      await idle(native);
      await expect(native.locator('.voteopts input:checked')).toHaveValue(choice);
    }
  } finally {
    if (before.length) {
      const fields = new URLSearchParams({ url: 'https://test.musicbrainz.org/edit/open' });
      before.forEach(([id, v], i) => { fields.set(`enter-vote.vote.${i}.edit_id`, id); fields.set(`enter-vote.vote.${i}.vote`, v); });
      const response = await context.request.post('https://test.musicbrainz.org/edit/enter_votes', { form: Object.fromEntries(fields) });
      expect(response.ok()).toBeTruthy();
    }
    await native.close();
  }
});

test('an empty collection retains its quick links and loads others by default', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const mb = 'https://test.musicbrainz.org';
  await page.goto(mb);
  await requireLogin(page);
  const response = await page.request.post(mb + '/collection/create', { form: { 'edit-list.name': 'Group vote links ' + Date.now(), 'edit-list.type_id': '8', 'edit-list.description': 'Sandbox check for #990' } });
  const id = response.url().match(/\/collection\/([0-9a-f-]{36})/)[1];
  try {
    const path = `/collection/${id}/open_edits`;
    await page.goto(mb + path);
    const load = page.waitForRequest(r => r.method() === 'GET' && r.url().includes(path + '?hide_own=1'));
    await inject('event_horizon');
    await load;
    const all = page.locator('#app .hql a', { hasText: 'All edits for this collection' });
    const others = page.locator('#app .hql a', { hasText: 'Others’ edits for this collection' });
    await expect(all).toHaveAttribute('href', mb + path + '?hide_own=0');
    await expect(others).toHaveAttribute('href', mb + path + '?hide_own=1');
    await expect(page.locator('#app .hld')).not.toContainText('loading');
    await all.click();
    await expect(page).toHaveURL(mb + path + '?hide_own=0');
    await expect(page.locator('#app .hld')).not.toContainText('loading');
    await others.click();
    await expect(page).toHaveURL(mb + path + '?hide_own=1');
    await expect(page.locator('#app .hld')).not.toContainText('loading');
  } finally {
    await page.request.post(`${mb}/collection/${id}/own_collection/delete`, { form: {} });
  }
});
