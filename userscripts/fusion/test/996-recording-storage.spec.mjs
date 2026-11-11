import { expect } from '@playwright/test';
import { test as harness } from '../../../dev/test/harness.mjs';

// Exercise the full script and its GM save timer, rather than a copy of the serializer.
const url = 'https://test.musicbrainz.org/release-group/aaaaaaaa-0000-4000-8000-000000000001';
const a = 'aaaaaaaa-0000-4000-8000-000000000002';
const b = 'aaaaaaaa-0000-4000-8000-000000000003';
const c = 'aaaaaaaa-0000-4000-8000-000000000004';
harness.use({ profile: 'fresh', gm: { name: 'Fusion', persist: 'tabs', xhr: 'none' } });

async function load(inject, target) {
  await inject('fusion', { target, waitFor: '__fusion', transform: code => `
    {
      const add = window.GM_addValueChangeListener;
      window.GM_addValueChangeListener = (key, fn) => {
        if (key === 'fusion.recordings') window.receiveRecordingSnapshot = fn;
        return add(key, fn);
      };
      // Supply remote notifications missing from the harness's shared GM shim.
      window.addEventListener('storage', e => {
        if (e.key?.endsWith('fusion.recordings') && window.receiveRecordingSnapshot)
          window.receiveRecordingSnapshot('fusion.recordings', JSON.parse(e.oldValue || 'null'), JSON.parse(e.newValue || 'null'), true);
      });
    }
  ` + code });
}
harness.beforeEach(async ({ context, page, inject }) => {
  await context.route(url, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body><div id="content"></div></body>' }));
  await page.goto(url);
  await load(inject);
});

async function group(page) {
  await page.evaluate(([a, b, c]) => {
    const F = window.__fusion;
    for (const gid of [a, b, c]) F.addToPool(F.mkRecording(gid, { title: gid, artistCredit: 'Test', length: 100000, video: false }));
    const g = F.createGroupWithMember(a);
    F.addToGroup(b, g.id);
    F.renderAll();
  }, [a, b, c]);
  await expect.poll(() => page.evaluate(() => {
    const s = JSON.parse(GM_getValue('fusion.recordings', '{}'));
    return s.groups?.[0]?.memberGids;
  })).toEqual([a, b]);
}

async function board(page) {
  return page.evaluate(() => {
    const S = window.__fusion.STATE;
    return { recs: [...S.recordings.keys()].sort(), pool: S.poolOrder, members: S.groups.map(g => g.memberGids) };
  });
}

harness('group members survive save and reload', { tag: '@unit' }, async ({ page, inject }) => {
  await group(page);
  await page.reload();
  await load(inject);
  expect(await board(page)).toEqual({ recs: [a, b, c], pool: [c], members: [[a, b]] });
});

harness('remote snapshot keeps grouped recordings and pool separate', { tag: '@unit' }, async ({ page }) => {
  await group(page);
  const saved = await page.evaluate(() => GM_getValue('fusion.recordings'));
  // The harness GM shim does not deliver remote value-change notifications.
  // Capture the real script's listener and feed it the snapshot saved above.
  await page.evaluate(raw => window.receiveRecordingSnapshot('fusion.recordings', '', raw, true), saved);
  expect(await board(page)).toEqual({ recs: [a, b, c], pool: [c], members: [[a, b]] });
});

harness('an idle second tab cannot erase a newly grouped recording', { tag: '@unit' }, async ({ page, context, inject }) => {
  const other = await context.newPage();
  await other.goto(url);
  await load(inject, other);
  await group(page);
  await expect.poll(() => board(other)).toEqual({ recs: [a, b, c], pool: [c], members: [[a, b]] });
  // Let the receiving tab's render save its board back, as a manager does.
  await other.clock.install();
  await other.clock.runFor(1000);
  expect(await board(page)).toEqual({ recs: [a, b, c], pool: [c], members: [[a, b]] });
});

harness('one tab retains the group after timers and Clear pool preserves it', { tag: '@unit' }, async ({ page }) => {
  await page.evaluate(() => window.__fusion.openFusion());
  await group(page);
  await page.clock.install();
  await page.clock.runFor(5000);
  expect(await board(page)).toEqual({ recs: [a, b, c], pool: [c], members: [[a, b]] });
  await page.locator('#fs-clear').click();
  await page.getByText('Clear pool', { exact: true }).click();
  expect(await board(page)).toEqual({ recs: [a, b], pool: [], members: [[a, b]] });
});
