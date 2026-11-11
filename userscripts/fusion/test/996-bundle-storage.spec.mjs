import { readFileSync } from 'node:fs';
import { test, expect, requireLogin } from '../../../dev/test/harness.mjs';

const off = readFileSync(new URL('../../string_theory/members.txt', import.meta.url), 'utf8')
  .split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#') && s !== 'fusion');
test.use({ gm: { name: 'String Theory', persist: true, values: { 'string_theory.off': off } } });

test('bundled Fusion keeps a recording grouped after save and timer callbacks', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/recording/b9348679-060f-4af4-82be-2736fd3476f3');
  await requireLogin(page);
  await page.clock.install();
  await inject('string_theory', { waitFor: '__fusion' });
  const gid = 'b9348679-060f-4af4-82be-2736fd3476f3';
  await page.evaluate(async gid => {
    const F = window.__fusion;
    F.SETTINGS.prefetchGroupReleases = false;
    F.addToPool(F.mkRecording(gid, { title: 'Storage regression', artistCredit: 'Test', length: 100000, video: false }));
    await F.openFusion();
  }, gid);
  await page.locator('#fs-pool-body .fs-pcard').dblclick();
  await expect(page.locator('#fs-groups-body .fs-grow')).toHaveCount(1);
  await page.clock.runFor(5000);
  expect(await page.evaluate(gid => {
    const S = window.__fusion.STATE;
    return [S.recordings.has(gid), S.poolOrder.includes(gid), S.groups.map(g => g.memberGids)];
  }, gid)).toEqual([true, false, [[gid]]]);
  const saved = await page.evaluate(() => JSON.parse(GM_getValue('fusion.recordings')));
  expect(saved.recs.map(r => r.gid)).toContain(gid);
  expect(saved.groups[0].memberGids).toEqual([gid]);
  await page.evaluate(() => {
    const F = window.__fusion;
    F.addToPool(F.mkRecording('aaaaaaaa-0000-4000-8000-000000000001', { title: 'Clear this pool entry', artistCredit: 'Test' }));
    F.renderAll();
  });
  await page.locator('#fs-hdr .fs-ctr[data-type="recording"] svg').click({ button: 'right' });
  expect(await page.evaluate(() => window.__fusion.STATE.poolOrder)).toEqual([]);
  await expect(page.locator('#fs-groups-body .fs-grow')).toHaveCount(1);
  expect(await page.locator('#fs-settings').count()).toBe(0);
  await page.screenshot({ path: 'dev/_996-bundle.png' });
});
