import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Fusion' } });

test('owned collections merge through Fusion', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const base = 'https://test.musicbrainz.org';
  await page.goto(base + '/collection/create');
  const ids = [];
  for (let i = 0; i < 2; i++) {
    const form = { 'edit-list.name': `Fusion 1075 ${Date.now()} ${i}`, 'edit-list.type_id': '1', 'edit-list.description': '' };
    if (!i) form['edit-list.public'] = '1';
    const r = await page.request.post(base + '/collection/create', { form });
    const id = r.url().match(/\/collection\/([0-9a-f-]{36})/)?.[1];
    if (!id) throw new Error('Collection creation failed: ' + r.url());
    ids.push(id);
  }
  await page.goto(base + '/collection/' + ids[0]);
  await inject('fusion', { waitFor: '__fusion' });
  await page.click('#fs-launch', { modifiers: ['Control'] });
  await page.click('#fs-addmenu [data-a="add"]');
  await until(() => page.locator('#fs-launch-ctrs .fs-ctr[data-type="collection"]').count(), n => n === 1);
  await page.click('#fs-launch-ctrs .fs-ctr[data-type="collection"]');
  await page.click('#fs-em-pool-hdr .fs-addbtn');
  await page.fill('#fs-em-input', base + '/collection/' + ids[1]);
  await page.press('#fs-em-input', 'Enter');
  await until(() => page.locator('#fs-em-pool .fs-pcard').count(), n => n === 2, { timeout: 30000 });
  check(await page.locator('#fs-em-pool .fs-pcard').count() === 2, 'both collections are in the pool');
  await page.press('#fs-em-input', 'Escape');
  await page.click('#fs-em-overlay [data-act="newgroup"]');
  await page.click('#fs-em-groups [data-act="merge-group"]');
  await page.waitForSelector('#fs-em-groups .fs-mbtn.fs-done, #fs-em-groups .fs-mbtn.fs-err', { timeout: 90000 });
  const err = await page.locator('#fs-em-groups .fs-mbtn.fs-err').getAttribute('data-tip').catch(() => null);
  if (err) console.log((await page.evaluate(() => window.__fusion.getLogLines())).join('\n'));
  check(!err, 'merged without error: ' + err);
  const response = await page.request.get(base + '/collection/' + ids[1]);
  check(response.url().includes(ids[0]), 'the merged collection redirects to the target');
});
