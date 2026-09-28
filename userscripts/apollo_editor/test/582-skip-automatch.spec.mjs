// #582 (majkinetor): "When I open an existing release for editing the recording
// auto-matching runs even though all recordings are linked already." His log:
// two /ws/2 round-trips — the release-group recording pool and the position
// index, 26 seconds and a 503 retry between them — and then
// "recording auto-match: linked 0 of 0 unset tracks".
//
// The pass read what needed matching only AFTER paying for both lookups. It now
// reads first (waiting, but only while the tracklist is still empty, since the
// pass fires while MB may still be loading collapsed media) and returns before
// any network when nothing is unset.
//
// Measured on the wire, not in the log: every /ws/2 URL the page requests is
// recorded, and the two the pass would have made must not be among them. The
// release is opened with autoMatchRec ON, exactly his setup.
import { test, check, until, settled } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm({ autoMatchRec: true, discogsUrlMatch: false }) });
const MBID = '55530bc0-97ec-4256-97fc-e6058958c251';

test('an all-linked release makes no matching lookups', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const ws = [];
  page.on('request', r => { if (r.url().includes('/ws/2/')) ws.push(r.url()); });
  const posted = await openApollo(page, inject, { release: MBID });
  check(await page.evaluate(() => !!window.__apolloEditor.settings.autoMatchRec), 'fixture really has auto-match-recordings ON (the effective setting, not the default)');

  // enter the Recordings tab — this is what fires the pass on load
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#tc-nav-bar button, #tc-nav-bar a')].find(x => x.textContent.trim().toLowerCase().startsWith('recording'));
    if (b) b.click();
  });
  /* A multi-medium release opens with its media collapsed and loads them one
     round-trip at a time, so wait generously — and that case is the point of the
     guard: the first medium can arrive fully linked while the rest are still
     coming, and the pass must not decide the whole release from it. */
  await page.waitForSelector('#tc-recwrap', { state: 'attached', timeout: 20000 });
  await settled(page);
  if (!(await page.$('#tc-recwrap tbody tr.tc-recrow'))) {
    await page.evaluate(() => { const b = document.querySelector('#tc-recwrap .tc-recmed-exp'); if (b) b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); });
  }
  await page.waitForSelector('#tc-recwrap tbody tr.tc-recrow', { state: 'attached', timeout: 60000 });
  // until the pass has given its verdict (his pre-fix run took ~35 s through both lookups)
  await until(() => page.evaluate(() => (document.querySelector('#tc-recwrap .tc-rec-amstatus') || {}).textContent || ''), t => /already linked|linked \d+ of \d+|nothing to|stopped|failed/i.test(t), { timeout: 90000 });
  await settled(page);

  const rows = await page.evaluate(() => {
    const r = window.__apolloEditor.readRecordings();
    return { total: r.length, unset: r.filter(x => !x.recGid).length,
             status: (document.querySelector('#tc-recwrap .tc-rec-amstatus') || {}).textContent || '',
             log: (window.__apolloEditor.logMarkdown ? window.__apolloEditor.logMarkdown() : '') };
  });
  const rgPool = ws.filter(u => /\/ws\/2\/recording\?query=rgid:/.test(u));
  const posIdx = ws.filter(u => /\/ws\/2\/release\?release-group=.*inc=recordings/.test(u));

  check(rows.total > 0, `the tracklist loaded (${rows.total} tracks)`);
  check(rows.unset === 0, `every track is already linked — the case he reported (${rows.unset} unset)`);
  check(rgPool.length === 0, `no release-group recording pool was fetched (${rgPool.length})`);
  check(posIdx.length === 0, `no release-group position index was fetched (${posIdx.length})`);
  check(/already linked/.test(rows.status), `the pane says why nothing happened, not "linked 0 of 0": "${rows.status}"`);
  check(!posted.some(u => /\/edit\/create/.test(u)), 'nothing was submitted');
});
