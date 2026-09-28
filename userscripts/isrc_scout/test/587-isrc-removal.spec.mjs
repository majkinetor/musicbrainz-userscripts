// Removing ISRCs in a batch (#587).
//
// chaban-mb: "there is no indicator apart from logs that (network) actions are in
// progress. Only once all submissions are done is the hourglass pending edit indicator
// inserted." A timing defect, so the run is watched: every 100 ms a snapshot, and the
// ⏳ count must climb through the run, not jump at the end.
//
// majkinetor then: "If there is no way to get pending status while getting ISRC, we
// wont do any more requests to MB … ANY NEW MB REQUEST MUST BE VERIFIED WITH ME.
// Remembering is not good idea as this is colaborative space." So: no request beyond
// one edit form per removal and one release lookup, and the ⏳ is gone after a reload.
//
// test.musicbrainz.org, on a sandbox release with ten ISRCs. The edit forms are real;
// the removal POSTs are answered here and never sent, so the ISRCs stay for next time.
import { test, check, requireLogin, answerGm, until, frames } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });

// the ISRCs to remove, one per row; returns [{ idx, isrc }]
const pick = (page, n) => page.evaluate(n => {
  const seen = new Set(), out = [];
  for (const cb of document.querySelectorAll('.ii-ex-del')) {
    const tr = cb.closest('tr[data-idx]'); if (!tr || seen.has(tr.dataset.idx)) continue;
    seen.add(tr.dataset.idx);
    cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
    out.push({ idx: tr.dataset.idx, isrc: cb.dataset.isrc, rec: (tr.querySelector('.ii-track-title a')?.href || '').split('/recording/')[1] || '' });
    if (out.length >= n) break;
  }
  return out;
}, n);

test('the ⏳ markers appear one by one while the batch runs; a failure is marked failed', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }) => {
  const posts = [], held = []; let failRec = null;
  // A created edit redirects away from /edit; one still on /edit reads as a validation
  // error. Each removal is held until the spec answers it, so the run is watched one
  // answer at a time, not sampled against a delay.
  answerGm(context, ({ url, method }) => {
    if (method !== 'POST') return null;
    posts.push(url);
    const reply = failRec && url.includes(failRec) ? { status: 500, body: 'nope' } : { status: 200, body: '<html><body>ok</body></html>', url: url.replace(/\/edit$/, ''), headers: 'content-type: text/html' };
    return new Promise(r => held.push(() => r(reply)));
  });
  page.on('dialog', d => d.accept());   // "Submit Remove ISRC edits?"
  await openScout(page, inject);
  await requireLogin(page);
  await page.waitForSelector('.ii-ex-del', { state: 'attached', timeout: 60000 });
  const picked = await pick(page, 4);
  check(picked.length === 4, `four ISRCs on four rows are ticked (${picked.length})`);
  failRec = picked[3].rec;
  const snap = () => page.evaluate(() => ({ pending: document.querySelectorAll('.ii-ex-pending').length, failed: document.querySelectorAll('.ii-ex-failed').length, btn: (document.querySelector('#ii-delete') || {}).textContent || '', busy: !!document.querySelector('#ii-delete.ii-busy'), prog: (document.querySelector('#ii-prog') || {}).textContent || '' }));
  check((await snap()).pending === 0, 'no ⏳ before the run');
  await page.evaluate(() => document.querySelector('#ii-delete').click());
  // the state while each removal is out, and after it is answered
  const seen = [], take = async () => { const s = await snap(); if (!seen.length || JSON.stringify(s) !== JSON.stringify(seen[seen.length - 1])) seen.push(s); return s; };
  for (let n = 1; n <= 4; n++) {
    await until(() => held.length, k => k > 0, { timeout: 30000 });
    await take();
    held.shift()();
    await until(take, s => s.pending + (s.failed ? 1 : 0) >= n || !s.busy, { timeout: 30000 });
  }
  await until(take, s => !s.busy, { timeout: 30000 });
  const frames = seen;
  check(frames.some(f => f.pending > 0 && f.pending < 3), `⏳ markers appeared during the run (${JSON.stringify(frames.map(f => f.pending))})`);
  check(frames.some(f => f.busy) && frames.some(f => /\d+\s*\/\s*\d+/.test(f.btn)), 'Delete showed a busy state and a live count');
  check(frames.some(f => /Submitting removals/.test(f.prog)), 'the status line said what was happening');
  const end = await snap();
  check(end.pending === 3 && end.failed >= 1 && !end.busy, `three ⏳, the failure marked failed, busy cleared (${JSON.stringify(end)})`);
  check(posts.length === 4, `four removals were submitted, all answered here (${posts.length})`);
});

test('a removal asks MusicBrainz for nothing extra, and remembers nothing after a reload', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }) => {
  const urls = [];
  answerGm(context, async ({ url, method }) => {
    urls.push(method + ' ' + url);
    return method === 'POST' ? { status: 200, body: '<html></html>', url: url.replace(/\/edit$/, ''), headers: 'content-type: text/html' } : null;
  });
  page.on('dialog', d => d.accept());
  await openScout(page, inject);
  await requireLogin(page);
  await page.waitForSelector('.ii-ex-del', { state: 'attached', timeout: 60000 });
  const picked = await pick(page, 2);
  await page.evaluate(() => document.querySelector('#ii-delete').click());
  await page.waitForFunction(() => !document.querySelector('#ii-delete.ii-busy'), null, { timeout: 60000 });
  check(await until(() => page.evaluate(() => document.querySelectorAll('.ii-ex-pending').length), n => n === 2) === 2, 'both removals are ⏳ in the session that sent them');
  const gets = urls.filter(u => u.startsWith('GET'));
  const release = gets.filter(u => /\/ws\/2\/release\//.test(u)), forms = gets.filter(u => /\/recording\/[0-9a-f-]{36}\/edit$/.test(u));
  const other = gets.filter(u => !release.includes(u) && !forms.includes(u));
  check(!urls.some(u => /open_edits/.test(u)), 'no /open_edits request');
  check(forms.length === picked.length, `one edit form per removal (${forms.length} for ${picked.length})`);
  check(release.length === 1, `the release is looked up once, not once per caller (${release.length})`);
  check(other.length === 0, `nothing else was fetched (${JSON.stringify(other)})`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#ii-btn', { state: 'attached', timeout: 25000 });
  await page.evaluate(() => document.getElementById('ii-btn').click());
  await page.waitForSelector('.ii-ex-del, .ii-ex-pending', { state: 'attached', timeout: 120000 });
  await frames(page);   // the table is drawn: any ⏳ it remembered would be on it
  const after = await page.evaluate(() => ({ pending: document.querySelectorAll('.ii-ex-pending').length, stored: Object.keys(localStorage).filter(k => /pending_removals_/.test(k)) }));
  check(after.pending === 0 && after.stored.length === 0, `after a reload, no ⏳ and nothing stored: only MusicBrainz knows now (${JSON.stringify(after)})`);
  check(!urls.some(u => /open_edits/.test(u)), 'and still no /open_edits');
});
