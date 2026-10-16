// #761 (chaban-mb): "It would be useful to have the AcoustIDs linked to more easily fix the
// linked recordings when erroneous."
//
// Fusion opened on test.musicbrainz.org, with two synthetic recordings sharing an AcoustID: on the
// pool card and in the group's row, the AcoustID opens its page on acoustid.org in a new tab.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Fusion', xhr: 'none' } });

const ACID = '96cf2b66-85a2-4d95-9830-d8f0f0a67f9f';
const WANT = 'https://acoustid.org/track/' + ACID;

test('an AcoustID links to its acoustid.org page, in the pool and in a group', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/recording/effa9b02-4c08-4ea7-b136-cea70acd5b67`, { waitUntil: 'domcontentloaded' });
  await inject('fusion', { waitFor: '__fusion' });
  await page.evaluate(acid => {
    const F = window.__fusion;
    F.openFusion();
    const mk = (gid, t) => F.mkRecording(gid, { title: t, length: 200000, isrcs: [], isrcsKnown: true, artistCredit: 'Someone', acoustids: [acid], releases: [] });
    F.addToPool(mk('zz761-a', 'Zz 761 pooled')); F.addToPool(mk('zz761-b', 'Zz 761 grouped')); F.addToPool(mk('zz761-c', 'Zz 761 grouped too'));
    const g = F.createGroupWithMember('zz761-b'); F.addToGroup('zz761-c', g.id);
    F.renderAll();
  }, ACID);
  const read = () => page.evaluate(() => ({
    pool: [...document.querySelectorAll('.fs-pcard[data-gid="zz761-a"] a.fs-idtag')].map(a => [a.href, a.target]),
    group: [...document.querySelectorAll('.fs-grow[data-gid="zz761-b"] a.fs-idv')].map(a => [a.href, a.target, a.className]),
  }));
  const got = await until(read, x => x.pool.length && x.group.length);
  console.log(JSON.stringify(got));
  check(got.pool.length === 1 && got.pool[0][0] === WANT && got.pool[0][1] === '_blank', `the pool card's AcoustID opens ${WANT} in a new tab (${JSON.stringify(got.pool)})`);
  check(got.group.length === 1 && got.group[0][0] === WANT && got.group[0][1] === '_blank', `the group row's AcoustID opens it too (${JSON.stringify(got.group)})`);
  check(got.group.length && /fs-idc\d/.test(got.group[0][2]), 'a shared AcoustID keeps its tint');
});
