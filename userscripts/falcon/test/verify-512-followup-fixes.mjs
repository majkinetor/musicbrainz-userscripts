// #512 follow-up (majkinetor, live):
// 1. "See the log before starting queue - it still contains older logs from
//    13:54" — falcon:session:current lives in localStorage, shared across
//    EVERY tab on musicbrainz.org. A brand new tab/page-load consuming a
//    fresh `?falcon=` seed was reattaching to whatever session the LAST
//    tab's LAST run left behind instead of starting clean.
// 2. "add on each worker what was done in this log table like I shown on w1
//    and w2" — per-row "; N links, disambiguation, isrc" breakdown in the
//    run summary table, not just the aggregate line.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });

// 1. a fresh ?falcon= seed on a BRAND NEW page must not inherit a stale
// session left in localStorage by an earlier, unrelated tab/run.
{
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  // simulate an EARLIER, unrelated run's leftover session in shared localStorage
  await page.evaluate(() => {
    localStorage.setItem('falcon:session:current', '20260101120000-1');
    localStorage.setItem('falcon:session:20260101120000-1', JSON.stringify(['[12:00:00] INFO  === session 20260101120000-1 started (an old, unrelated run) ===', '[12:00:05] INFO  old stuff happened here']));
  });
  const payload = await page.evaluate(() => window.__falconTest ? null : null);   // no-op, just keep structure symmetric
  const RECORDING = 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7';
  const b64 = Buffer.from(JSON.stringify([{ entityType: 'recording', mbid: RECORDING, url: 'https://example.com/fresh-seed' }])).toString('base64');
  await page.goto('https://musicbrainz.org/?falcon=' + encodeURIComponent(b64), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.waitForTimeout(300);
  const log = await page.evaluate(() => window.__falconTest.getLog());
  console.log('log after a fresh seed on a new page:', JSON.stringify(log));
  ck(!log.some(l => l.includes('an old, unrelated run')), 'the old, unrelated session\'s lines are NOT present in the new page\'s log');
  ck(log.some(l => /=== session .* started \(seeded 1 item/.test(l)), 'a fresh seed starts its own new session, logged as such');
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
}

// 2. run summary shows a per-row breakdown, not just the aggregate.
{
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  const summaryLog = await page.evaluate(() => {
    const t = window.__falconTest;
    t.setQueue([
      { id: 'r1', entityType: 'recording', mbid: 'aaaaaaaa-5120-0000-0000-000000000001', name: 'Flight 505', urls: [{ url: 'https://a.com/1' }, { url: 'https://a.com/2' }], isrcs: ['NLTH1'], disambiguation: '', cover: [], status: 'failed', error: '', timing: { worker: '[w1]', loadMs: 1, settleMs: 1, fillMs: 1, submitMs: 1, totalMs: 4 } },
      { id: 'r2', entityType: 'recording', mbid: 'aaaaaaaa-5120-0000-0000-000000000002', name: 'We Got to Love', urls: [{ url: 'https://a.com/1' }, { url: 'https://a.com/2' }, { url: 'https://a.com/3' }, { url: 'https://a.com/4' }], isrcs: ['NLTH2'], disambiguation: 'remix', cover: [], status: 'failed', error: '', timing: { worker: '[w2]', loadMs: 1, settleMs: 1, fillMs: 1, submitMs: 1, totalMs: 4 } },
      { id: 'r3', entityType: 'recording', mbid: 'aaaaaaaa-5120-0000-0000-000000000003', name: 'Search', urls: [], isrcs: [], disambiguation: '', cover: [], status: 'skipped', error: '', timing: { worker: '[w3]', loadMs: 1, settleMs: 1, fillMs: 1, submitMs: 1, totalMs: 4 } },
    ]);
    t.logRunSummary();
    return new Promise(resolve => setTimeout(() => resolve(t.getLog().join('\n')), 400));
  });
  const tableLines = summaryLog.split('\n').filter(l => /^\[w\d\]/.test(l));
  console.log('summary table rows:', JSON.stringify(tableLines));
  ck(tableLines.some(l => l.includes('Flight 505') && l.includes('; 2 links, isrc')), `[w1] row shows "; 2 links, isrc" (rows: ${JSON.stringify(tableLines)})`);
  ck(tableLines.some(l => l.includes('We Got to Love') && l.includes('; 4 links, disambiguation, isrc')), `[w2] row shows "; 4 links, disambiguation, isrc" (rows: ${JSON.stringify(tableLines)})`);
  ck(tableLines.some(l => l.includes('Search') && !l.includes(';')), '[w3] row (nothing to report) has no trailing "; ..." at all');
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
