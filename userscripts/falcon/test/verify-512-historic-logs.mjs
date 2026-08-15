// #512 (majkinetor): "Fix Log that it doesn't show anything from previous
// runs anymore. Or, alternatively, it can keep configurable number of last
// runs in local storage so those can be selected and loaded by datetime.
// Besides that: 1. wrap entire log section in <details> on copy, as usual.
// 2. in work summary at the end of the log, add what was done the same as
// shown in collapsed queue (e.g. 2 link, isrc)."
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const errs = []; const page = await ctx.newPage();
page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });

// 1. formatSessionLabel / loadSessionLines round-trip.
const fmtResult = await page.evaluate(() => window.__falconTest.formatSessionLabel('20260815134523-1'));
ck(fmtResult === '2026-08-15 13:45:23', `session id formats as a readable datetime (got "${fmtResult}")`);

// 2. pruneOldSessions caps the count, keeping the NEWEST ones.
const pruneResult = await page.evaluate(() => {
  const t = window.__falconTest;
  localStorage.clear();
  for (let i = 1; i <= 25; i++) {
    const id = `2026081500${String(i).padStart(4, '0')}-1`;
    localStorage.setItem('falcon:session:' + id, JSON.stringify([`line ${i}`]));
  }
  t.cfg.logHistoryCount = 5;
  t.pruneOldSessions();
  return t.listSessionKeys();
});
console.log('surviving sessions after prune to 5:', JSON.stringify(pruneResult));
ck(pruneResult.length === 5, `pruneOldSessions caps to cfg.logHistoryCount (got ${pruneResult.length})`);
ck(pruneResult[pruneResult.length - 1] === '20260815000025-1', `the newest session (i=25) survives (last kept: ${pruneResult[pruneResult.length - 1]})`);
ck(pruneResult[0] === '20260815000021-1', `the oldest surviving one (i=21) is exactly the cutoff for keeping 5 of 25 (first kept: ${pruneResult[0]})`);

// 3. selecting a historical session in the dropdown shows ITS content, and
// Copy Log copies that content (not the live one), labeled accordingly.
await page.evaluate(() => { localStorage.clear(); });
const histResult = await page.evaluate(async () => {
  const t = window.__falconTest;
  localStorage.setItem('falcon:session:20260101120000-1', JSON.stringify(['[12:00:00] INFO  historical line one', '[12:00:01] INFO  historical line two']));
  t.setViewingSession('20260101120000-1');
  const shown = document.getElementById('falcon-log-text');
  return { viewing: t.getViewingSession(), currentLines: t.currentLogLines() };
});
console.log('viewing historical session:', JSON.stringify(histResult));
ck(histResult.viewing === '20260101120000-1', 'setViewingSession switches the tracked session');
ck(histResult.currentLines.length === 2 && histResult.currentLines[0].includes('historical line one'), `currentLogLines() returns the historical content, not live LOG (got ${JSON.stringify(histResult.currentLines)})`);

// back to live for the rest of the test
await page.evaluate(() => window.__falconTest.setViewingSession(null));

// 4. logRunSummary's "worked on: ..." line reflects link/isrc/disambiguation/cover counts.
const summaryLog = await page.evaluate(() => {
  const t = window.__falconTest;
  t.setQueue([
    { id: 'x1', entityType: 'recording', mbid: 'aaaaaaaa-5120-0000-0000-000000000001', urls: [{ url: 'https://a.com/1' }, { url: 'https://a.com/2' }], isrcs: ['NLTH1'], disambiguation: '', cover: [], status: 'done', error: '', timing: { worker: '[w1]', loadMs: 1, settleMs: 1, fillMs: 1, submitMs: 1, totalMs: 4 } },
    { id: 'x2', entityType: 'release', mbid: 'aaaaaaaa-5120-0000-0000-000000000002', urls: [], isrcs: [], disambiguation: '', cover: [{ url: 'https://a.com/cover.jpg' }], status: 'done', error: '', timing: { worker: '[w1]', loadMs: 1, settleMs: 1, fillMs: 1, submitMs: 1, totalMs: 4 } },
  ]);
  t.logRunSummary();
  return new Promise(resolve => setTimeout(() => resolve(t.getLog().join('\n')), 400));
});
console.log('run summary tail:', summaryLog.split('\n').filter(l => /worked on/.test(l)).join('\n'));
ck(/worked on:.*2 links/.test(summaryLog), 'run summary totals the links across the run (2 links)');
ck(/worked on:.*isrc on 1/.test(summaryLog), 'run summary counts items with isrc');
ck(/worked on:.*cover on 1/.test(summaryLog), 'run summary counts items with cover');

// 5. Copy Log still wraps in <details>, matching the existing single-session
// convention, and includes which session is being copied.
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });
await page.click('#falcon-tab-log');
await page.waitForTimeout(200);
await page.evaluate(() => {
  navigator.clipboard.writeText = (t) => { window.__copiedText = t; return Promise.resolve(); };
});
await page.click('#falcon-log-copy');
await page.waitForTimeout(200);
const copied = await page.evaluate(() => window.__copiedText);
console.log('copied text starts with:', JSON.stringify((copied || '').slice(0, 80)));
ck(/^<details><summary>Falcon log \(v[^,]+, current session, \d+ lines\)<\/summary>/.test(copied || ''), `copy wraps in <details> with a session label (got "${(copied || '').slice(0, 120)}")`);
ck((copied || '').includes('```') && (copied || '').trim().endsWith('</details>'), 'copy still fences the log body and closes the <details> block');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
