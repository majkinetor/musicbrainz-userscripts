// #762 (chaban-mb): "once I got to AcoustID page and remove bad links there I'd like to get fresh
// AcoustID data in current Fusion session without having to reload whole page. Then it can
// reevaluate matches."
//
// A group of three synthetic recordings sharing an AcoustID; acoustid.org (faked, so the answer
// is known) has since lost one of the links. ↻ on the group asks again: the unlinked recording
// shows none, the group no longer claims an AcoustID shared by every member, and the other
// group is left alone. A failed lookup keeps what was known.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Fusion', xhr: 'fetch' } });

const ACID = '96cf2b66-85a2-4d95-9830-d8f0f0a67f9f';

test('↻ on a group asks acoustid.org again and re-evaluates the group', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  // what acoustid.org says now: zz762-c was unlinked
  let asked = [], fail = false;
  await page.route(/^https:\/\/api\.acoustid\.org\/v2\/track\/list_by_mbid\?/, route => {
    const mbids = new URL(route.request().url()).searchParams.getAll('mbid');
    asked.push(mbids);
    if (fail) return route.fulfill({ status: 503, body: '', headers: { 'access-control-allow-origin': '*' } });
    const body = { status: 'ok', mbids: mbids.map(m => ({ mbid: m, tracks: m === 'zz762-c' ? [] : [{ id: ACID }] })) };
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  });
  await page.goto(`${SANDBOX}/recording/effa9b02-4c08-4ea7-b136-cea70acd5b67`, { waitUntil: 'domcontentloaded' });
  await inject('fusion', { waitFor: '__fusion' });
  const ids = await page.evaluate(acid => {
    const F = window.__fusion;
    F.openFusion();
    const mk = (gid, t) => F.mkRecording(gid, { title: t, length: 200000, isrcs: [], isrcsKnown: true, artistCredit: 'Someone', acoustids: [acid], releases: [] });
    ['a', 'b', 'c', 'x', 'y'].forEach(k => F.addToPool(mk('zz762-' + k, 'Zz 762 ' + k)));
    const g = F.createGroupWithMember('zz762-a'); F.addToGroup('zz762-b', g.id); F.addToGroup('zz762-c', g.id);
    const o = F.createGroupWithMember('zz762-x'); F.addToGroup('zz762-y', o.id);
    F.renderAll();
    return { g: g.id, o: o.id };
  }, ACID);
  const state = () => page.evaluate(({ g, o }) => {
    const F = window.__fusion, G = F.findGroup(g), O = F.findGroup(o);
    return { all: G.signalsAll, members: G.memberGids, c: F.STATE.recordings.get('zz762-c').acoustids, a: F.STATE.recordings.get('zz762-a').acoustids,
      other: O.signalsAll, chip: document.querySelector(`.fs-gcard[data-gid="${g}"] .fs-sig span.hit`)?.textContent || '',
      chips: [...document.querySelectorAll(`.fs-gcard[data-gid="${g}"] .fs-sig span`)].map(s => s.textContent + ':' + s.className) };
  }, ids);
  const s0 = await state();
  check(s0.all.includes('acoustid'), `before: every member shares the AcoustID (${s0.all})`);

  await until(() => asked.length, n => n >= 1);   // Fusion's own lookup on opening, for the page's recording
  asked = [];   // only what the click asks
  await page.click(`.fs-gcard[data-gid="${ids.g}"] [data-act="refresh-acoustid"]`);
  const s1 = await until(state, s => !s.all.includes('acoustid'));
  console.log(JSON.stringify({ asked, s1 }));
  check(asked.length === 1 && asked[0].sort().join() === 'zz762-a,zz762-b,zz762-c', `one request, for this group's members only (${JSON.stringify(asked)})`);
  check(Array.isArray(s1.c) && s1.c.length === 0, `the unlinked recording has no AcoustID now (${JSON.stringify(s1.c)})`);
  check(!s1.all.includes('acoustid'), `the group no longer claims an AcoustID every member shares (${s1.all})`);
  check(s1.chips.some(c => /^AcoustID:partial/.test(c)), `its AcoustID chip is partial (${s1.chips})`);
  check(s1.members.length === 3, 'the members stay where they are; the user decides');
  check(s1.other.includes('acoustid'), 'the other group is untouched');

  // a failed lookup keeps what was known
  fail = true; asked = [];
  await page.click(`.fs-gcard[data-gid="${ids.g}"] [data-act="refresh-acoustid"]`);
  await until(() => asked.length, n => n >= 1);
  const s2 = await until(state, s => s.a && s.a.length === 1);
  await page.waitForFunction(g => !window.__fusion.findGroup(g).acRefreshing, ids.g);
  const s3 = await state();
  check(s3.a?.[0] === ACID && Array.isArray(s3.c) && s3.c.length === 0, `a failed lookup keeps the AcoustIDs as they were (${JSON.stringify([s2.a, s3.c])})`);
});
