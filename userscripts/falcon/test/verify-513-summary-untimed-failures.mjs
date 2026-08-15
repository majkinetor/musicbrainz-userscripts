// #513 follow-up (majkinetor, live): "What about 'edit page was never
// loaded'" — that failure sets item.status = 'failed' immediately, WITHOUT
// ever setting item.timing (the worker never gets past the initial iframe-
// load wait). logRunSummary() used to restrict itself to
// queue.filter(i => i.timing), silently dropping that item (and its status)
// from BOTH the per-row table and the totals/byStatus count. Every settled
// item now gets counted; ones with no timing data just show dashes.
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

const summaryLog = await page.evaluate(() => {
  const t = window.__falconTest;
  t.setQueue([
    // a normal, timed success — the common case, must still work
    { id: 'r1', entityType: 'recording', mbid: 'aaaaaaaa-5130-0000-0000-000000000001', name: 'Timed OK', urls: [{ url: 'https://a.com/1' }], isrcs: [], disambiguation: '', cover: [], status: 'done', error: '', timing: { worker: '[w1]', loadMs: 5, settleMs: 1, fillMs: 1, submitMs: 1, totalMs: 8 } },
    // an "edit page never loaded" style failure — status set, no timing at all
    { id: 'r2', entityType: 'recording', mbid: 'aaaaaaaa-5130-0000-0000-000000000002', name: 'Never Loaded', urls: [{ url: 'https://a.com/2' }], isrcs: [], disambiguation: '', cover: [], status: 'failed', error: 'edit page never loaded' },
  ]);
  t.logRunSummary();
  return new Promise(resolve => setTimeout(() => resolve(t.getLog().join('\n')), 400));
});
console.log('summary:', summaryLog.split('\n').slice(-8).join('\n'));
ck(/Never Loaded/.test(summaryLog), 'the untimed failure now gets its OWN row in the table (used to be silently dropped)');
ck(/Never Loaded[^\n]*failed[^\n]*-[^\n]*-[^\n]*-[^\n]*-[^\n]*-/.test(summaryLog), 'its missing timing columns show dashes instead of crashing or showing garbage');
ck(/2 item\(s\)/.test(summaryLog), 'the item count includes it (2 items total, not just the 1 timed one)');
ck(/totals:.*1 done.*1 failed|totals:.*1 failed.*1 done/.test(summaryLog), `totals correctly counts BOTH the timed done and the untimed failed (got: ${summaryLog.match(/totals:[^\n]*/)})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
