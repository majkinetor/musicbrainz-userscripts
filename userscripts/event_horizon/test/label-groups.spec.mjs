import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

const LABEL = 'https://test.musicbrainz.org/label/04201e6d-c430-4a53-a9a0-56170825fbde';

test('a missing group thumbnail recovers from its release cover', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(LABEL);
  await inject('event_horizon');
  await until(() => page.locator('[data-lbmode="groups"][aria-pressed="true"]').count(), n => n > 0);
  await page.locator('#s-ed [data-edview="table"]').click();
  const img = page.locator('table.lbg img[data-lbcovers]:not([data-lbcovers=""])').first();
  await img.waitFor();
  const id = '00000000-0000-4000-8000-000000000001';
  const full = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
  await page.route(`https://coverartarchive.org/release-group/${id}/front*`, route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }));
  await page.route(`https://coverartarchive.org/release/${id}`, route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { images: [{ front: true, image: full }] } }));
  await img.evaluate((el, id) => { el.dataset.lbcovers = id; el.src = 'https://coverartarchive.org/release-group/00000000-0000-4000-8000-000000000001/front-250'; el.dispatchEvent(new Event('error')); el.dispatchEvent(new Event('error')); }, id);
  const src = await until(() => page.locator('table.lbg img[data-lbcovers]').first().evaluateAll(xs => xs[0]?.getAttribute('src') || ''), value => value === full);
  check(src === full, 'full release cover replaces the missing group thumbnail: ' + src);
});

test("a label's releases show by release group, by type, and expand in place", { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(LABEL);
  await inject('event_horizon');
  await until(() => page.locator('[data-lbmode="groups"][aria-pressed="true"]').count(), n => n > 0);
  await page.locator('#s-ed [data-edview="table"]').click();
  await until(() => page.locator('table.ed-t.lbg tbody tr:not(.gh)').count(), n => n > 0);
  const heads = await page.$$eval('table.ed-t.lbg tr.gh .gf', x => x.map(h => h.textContent.trim()));
  check(heads.length > 0, 'grouped by type: ' + heads.join(' | '));
  const links = await page.$$eval('table.ed-t.lbg tbody tr:not(.gh):not(.lbg-r) td:nth-child(2) a', x => x.map(a => a.pathname));
  check(links.every(p => /^\/release-group\//.test(p) || /^\/release\//.test(p)), 'rows link to release groups');
  const chip = page.locator('table.ed-t.lbg [data-lbx]').first();
  if (await chip.count()) {
    const n = parseInt(await chip.textContent());
    await chip.click();
    await until(() => page.locator('table.ed-t.lbg tr.lbg-r').count(), c => c === n);
    check(true, `expanded ${n} releases`);
  }
  await page.locator('[data-lbmode="releases"]').click();
  await until(() => page.locator('table.ed-t:not(.lbg) tbody tr.ed-r').count(), n => n > 0);
  check(true, 'Releases shows the flat list');
});
