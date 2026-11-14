// #1047: a place (or any credit) entered without its "Credited as" name gets it on
// every matching credit at once, from the pencil menu's Set "Credited as"…
//
// test.musicbrainz.org: staged in the relationship editor, never submitted.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { blockEdits, openRelEditor, installRelReader } from './gt.mjs';

test.use({ gm: { name: 'Group Therapy' } });

test('Set "Credited as" stages the credited name on every matching credit', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const posts = await blockEdits(page);
  await openRelEditor(page, inject);
  await installRelReader(page);

  const res = await page.evaluate(() => {
    const GT = window.__groupTherapy;
    for (const it of document.querySelectorAll('.relationship-item')) {
      const labels = GT.replaceRoleMenuItems(it).filter(x => x.label).map(x => x.label);
      if (!labels.length) continue;
      const rel = window.__rel(it), ends = GT.relEnds(rel); if (!ends) continue;
      const items = GT.collect(it.querySelector('button.icon.remove-item'), 'target');
      const n = GT.setCredit(items, 'GT Credited 1047', () => 'test credit');
      return { labels, n, gid: ends.other.gid, total: items.length };
    }
    return null;
  });
  check(res && res.labels.includes('Set “Credited as”…'), 'the pencil menu offers Set “Credited as”…');
  check(res && res.n > 0, `credits are updated (${res && res.n} of ${res && res.total})`);
  const after = await until(() => page.evaluate(gid => {
    const rels = [...document.querySelectorAll('.relationship-item')].map(window.__rel).filter(Boolean)
      .filter(r => (r.entity0 && r.entity0.gid === gid) || (r.entity1 && r.entity1.gid === gid));
    return { all: rels.length, credited: rels.filter(r => r.entity0_credit === 'GT Credited 1047' || r.entity1_credit === 'GT Credited 1047').length,
      shown: document.body.innerText.includes('GT Credited 1047') };
  }, res ? res.gid : ''), a => a.credited > 0 && a.credited === a.all);
  check(after.credited === after.all, `every credit of that entity carries the name (${after.credited}/${after.all})`);
  check(after.shown, 'the editor shows the credited name');
  // a second name replaces the first (MB's merge keeps a non-empty date, so check a credit isn't kept the same way)
  const n2 = await page.evaluate(gid => {
    const GT = window.__groupTherapy;
    const it = [...document.querySelectorAll('.relationship-item')].find(i => { const r = window.__rel(i); return r && ((r.entity0 && r.entity0.gid === gid) || (r.entity1 && r.entity1.gid === gid)); });
    return GT.setCredit(GT.collect(it.querySelector('button.icon.remove-item'), 'target'), 'GT Second 1047', () => 'test credit 2');
  }, res ? res.gid : '');
  const after2 = await until(() => page.evaluate(() => document.body.innerText.includes('GT Second 1047') && !document.body.innerText.includes('GT Credited 1047')), x => x);
  check(n2 > 0 && after2, 'a second name replaces the first');
  check(posts.length === 0, `nothing was submitted (${posts.length})`);
});
