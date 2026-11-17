import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

const LABEL = 'https://test.musicbrainz.org/label/04201e6d-c430-4a53-a9a0-56170825fbde';

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
