// #798 (majkinetor): "Add it as a explicit request on individual rows" — whether a
// candidate has held the row's role before. Only when asked (Check roles), since an
// artist's relationships run to megabytes; five candidates at most.
//
// MusicBrainz's answers are stubbed: the candidate the spec chooses has produced
// three recordings, the others nothing. Never submits.
import { test, check } from '../../../dev/test/harness.mjs';
import { openRelEditor, blockEdits, tpPaste, tpRow, tpSettle } from './gt.mjs';

test.use({ gm: { name: 'Group Therapy' } });

test('the text parser: Check roles ranks the candidates on the role they held before', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  test.setTimeout(300000);
  const posts = await blockEdits(page);
  // nothing from the release group or co-credits, so John Smith stays open
  await page.route(/\/ws\/2\/release\?release-group=/, r => r.fulfill({ json: { releases: [] } }));
  await page.route(/\/ws\/2\/recording\?query=arid/, r => r.fulfill({ json: { recordings: [] } }));
  let target = null;
  const asked = [];
  await page.route(/\/ws\/2\/artist\/[0-9a-f-]{36}\?inc=release-rels\+recording-rels/, r => {
    const gid = r.request().url().match(/artist\/([0-9a-f-]{36})/)[1];
    asked.push(gid);
    const rel = (t, i) => ({ type: 'producer', 'target-type': t, attributes: [], [t]: { id: '00000000-0000-4000-8000-00000000000' + i, title: 'X' } });
    r.fulfill({ json: { id: gid, name: 'John Smith', relations: gid === target ? [rel('recording', 1), rel('recording', 2), rel('release', 3)] : [{ type: 'mix', 'target-type': 'recording', attributes: [] }] } });
  });

  await openRelEditor(page, inject);
  await tpPaste(page, 'Producer: John Smith', 'R: E');
  const row = tpRow(page, 'John Smith');
  const cands = await row.locator('a.gt-tp-cand-name').evaluateAll(as => as.map(a => a.getAttribute('href').split('/').pop()));
  console.log('candidates: ' + cands.length);
  check(cands.length > 1 && !(await row.locator('.gt-tp-cand-on').count()), `several John Smiths, none picked (${cands.length})`);
  check(asked.length === 0, 'no relationships are read until asked');
  check(await row.locator('.gt-tp-hist').count() === 1, 'the row offers Check roles');
  target = cands[2];   // the third: the check must lift it

  await row.locator('.gt-tp-hist').click();
  await page.waitForFunction(() => !document.querySelector('.gt-tp-hist:disabled'), null, { timeout: 60000 }).catch(() => {});
  await tpSettle(page);
  const st = await row.evaluate(tr => ({
    picked: (tr.querySelector('.gt-tp-cand-on a.gt-tp-cand-name') || { getAttribute: () => '' }).getAttribute('href').split('/').pop(),
    why: [...tr.querySelectorAll('.gt-tp-cand-on .gt-tp-why')].map(w => w.textContent + ' {' + (w.dataset.tip || '') + '}'),
  }));
  console.log('asked ' + asked.length + ': ' + JSON.stringify(st));
  check(asked.length > 0 && asked.length <= 5, `one request per candidate, five at most (${asked.length})`);
  check(st.picked === target, 'the one who produced before is picked');
  check(st.why.some(w => /producer ×3/.test(w) && /2 recordings · 1 release/.test(w)), `with a "producer ×3" badge that says where (${JSON.stringify(st.why)})`);
  // the others say they never did — ✕ brings the list back to read them
  await row.locator('.gt-tp-cand-x').click();
  await tpSettle(page);
  const never = await row.locator('.gt-tp-why-neg', { hasText: 'never producer' }).count();
  check(never >= 1, `the others say "never producer" (${never})`);
  check(posts.length === 0, `nothing was submitted (${posts.length})`);
});
