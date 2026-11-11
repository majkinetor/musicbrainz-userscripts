import { test, expect } from '../../../dev/test/harness.mjs';

const a = 'aaaaaaaa-0000-4000-8000-000000000001';
const b = 'aaaaaaaa-0000-4000-8000-000000000002';
const entry = gid => ({ gid, name: gid, info: [] });
test.use({ profile: 'fresh', gm: { name: 'Fusion', xhr: 'none', values: {
  'fusion.merge': JSON.stringify({ types: {
    artist: { pool: [entry(a)], groups: [{ id: 'artists', members: [entry(b)], target: b, state: 'pending' }] },
    label: { pool: [entry(a)], groups: [] },
  } }),
} } });

for (const surface of ['header', 'corner']) {
  test(`right-click ${surface} counter clears only that pool`, { tag: '@unit' }, async ({ page, inject }) => {
    const url = 'https://test.musicbrainz.org/recording/' + a;
    await page.route(url, r => r.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }));
    await page.goto(url);
    await inject('fusion', { waitFor: '__fusion' });
    await page.evaluate(async ([a, b]) => {
      const F = window.__fusion;
      F.SETTINGS.prefetchGroupReleases = false;
      for (const gid of [a, b]) F.addToPool(F.mkRecording(gid, { title: gid, artistCredit: 'Test' }));
      F.createGroupWithMember(a);
      await F.openFusion();
    }, [a, b]);
    if (surface === 'corner') await page.evaluate(() => window.__fusion.closeFusion());
    const root = surface === 'header' ? '#fs-hdr' : '#fs-launch-ctrs';
    await page.locator(root + ' .fs-ctr[data-type="artist"] svg').click({ button: 'right' });
    const saved = await page.evaluate(() => JSON.parse(GM_getValue('fusion.merge')));
    expect(saved.types.artist.pool).toEqual([]);
    expect(saved.types.artist.groups[0].members.map(x => x.gid)).toEqual([b]);
    expect(saved.types.label.pool.map(x => x.gid)).toEqual([a]);
    expect(await page.locator('#fs-settings').count()).toBe(0);
    await page.locator(root + ' .fs-ctr[data-type="recording"]').click({ button: 'right' });
    expect(await page.evaluate(() => {
      const S = window.__fusion.STATE;
      return { pool: S.poolOrder, groups: S.groups.map(g => g.memberGids), recs: [...S.recordings.keys()] };
    })).toEqual({ pool: [], groups: [[a]], recs: [a] });
    expect(await page.locator('#fs-settings').count()).toBe(0);
    if (surface === 'corner') {
      await page.locator('#fs-launch > img').click({ button: 'right' });
      await expect(page.locator('#fs-settings')).toBeVisible();
    }
  });
}
