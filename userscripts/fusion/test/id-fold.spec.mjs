// majkinetor (screenshot of Human Nature, "this is problematic"): a recording carrying dozens of
// AcoustIDs stacked them all, one per line, stretching its group row to a whole screen.
//
// Fusion opened on test.musicbrainz.org with two synthetic recordings sharing one AcoustID, one of
// them carrying 25 more of its own: the shared one stays, the unshared rest folds past three lines
// behind "+N more", which unfolds and folds back. A short list doesn't fold.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Fusion', xhr: 'none' } });

const SHARED = '00000000-0000-4000-8000-000000000000';
const own = n => Array.from({ length: n }, (_, i) => (i + 1).toString(16).padStart(8, '0') + '-1111-4111-8111-111111111111');

test('a long AcoustID list folds behind "+N more"', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/recording/effa9b02-4c08-4ea7-b136-cea70acd5b67`, { waitUntil: 'domcontentloaded' });
  await inject('fusion', { waitFor: '__fusion' });
  await page.evaluate(([shared, many, few]) => {
    const F = window.__fusion;
    F.openFusion();
    const mk = (gid, acoustids) => F.mkRecording(gid, { title: 'Zz fold', length: 200000, isrcs: [], isrcsKnown: true, artistCredit: 'Someone', acoustids, releases: [] });
    F.addToPool(mk('zzfold-a', [...many, shared])); F.addToPool(mk('zzfold-b', [shared, ...few]));
    const g = F.createGroupWithMember('zzfold-a'); F.addToGroup('zzfold-b', g.id);
    F.renderAll();
  }, [SHARED, own(25), own(2)]);
  const read = gid => page.evaluate(gid => {
    const cells = document.querySelectorAll('.fs-grow[data-gid="' + gid + '"] .fs-isrc');
    const cell = cells[1];   // ISRC, then AcoustID
    return cell && { ids: [...cell.querySelectorAll('.fs-idv')].map(a => a.href.split('/').pop()), more: (cell.querySelector('.fs-idmore') || {}).textContent || null };
  }, gid);
  const a = await until(() => read('zzfold-a'), x => x && x.ids.length);
  console.log(JSON.stringify(a));
  check(a.ids.length === 3 && a.ids[0] === SHARED, `the long list shows three, the shared one first (${a.ids.length}, first ${a.ids[0]})`);
  check(a.more === '+23 more', `the rest folds behind "+23 more" (${a.more})`);
  const b = await read('zzfold-b');
  check(b.ids.length === 3 && b.more === null, `a three-id list doesn't fold (${JSON.stringify(b)})`);
  await page.click('.fs-grow[data-gid="zzfold-a"] .fs-idmore');
  const open = await until(() => read('zzfold-a'), x => x && x.ids.length > 3);
  check(open.ids.length === 26 && open.more === 'less', `"+23 more" unfolds all 26, with "less" (${open.ids.length}, ${open.more})`);
  await page.click('.fs-grow[data-gid="zzfold-a"] .fs-idmore');
  const shut = await until(() => read('zzfold-a'), x => x && x.ids.length === 3);
  check(shut.more === '+23 more', `"less" folds it back (${shut.more})`);
  await page.locator('.fs-grow[data-gid="zzfold-a"]').screenshot({ path: 'test-results/id-fold.png' });
});
