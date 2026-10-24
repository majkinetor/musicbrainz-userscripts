// #821: a new cover that replaces the release's only one went in last: the old one, marked for removal, wasn't
// counted, so one cover was left to order and no reorder went in. While the removal is open for votes the old
// cover stays, and stays first (what Mission Control's replacing Execute did). The plan has a reorder now.
// Nothing is submitted: the new cover is a stand-in, and only the plan is read.
import { test, check, requireLogin, SANDBOX, idle } from '../../../dev/test/harness.mjs';
import { RELEASE } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

test('#821: a cover replacing the removed ones is reordered before them', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/release/${RELEASE}/cover-art`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page); await idle(page);
  await inject('art_station');
  await page.waitForSelector('#as-root .as-card', { timeout: 20000 }); await idle(page);

  const got = await page.evaluate(() => {
    const t = window.__asTest.mc, m = t.model();
    const old = m.filter(x => !x._new);
    old.forEach(x => { x._del = true; });
    m.forEach(x => { x.order++; });
    m.push({ id: 'new-821', types: ['Front'], comment: '', order: 0, w: 3000, h: 3000, _new: true, _del: false, _origTypes: [], _origComment: '', _origOrder: -1 });
    return { old: old.length, plan: t.plan() };
  });
  console.log(JSON.stringify(got));
  check(got.old > 0, `the release has covers to replace (${got.old})`);
  check(got.plan.filter(k => k === 'remove').length === got.old, 'each old cover is removed');
  check(got.plan.includes('reorder'), `a reorder puts the new cover first (${got.plan.join(', ')})`);
});
