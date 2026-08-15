// #517 (majkinetor, live): "Today I get [edit page never loaded] a lot, and
// I can always finish workers by hand... is there anything to be done here
// (like providing an option to wait more, retry/continue from failed step
// etc.)" — proved the SAME items commit fine on a second try, so the
// failure is transient (MB being slow that day), not a broken item. A
// "Retry failed" button re-queues every failed/partial item — resetting it
// to the same starting state a fresh import would give it — so the next
// Start naturally picks it up again.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

function item(id, status, extra = {}) {
  return { id, entityType: 'recording', mbid: `aaaaaaaa-5170-0000-0000-00000000000${id}`, name: `Item ${id}`, urls: [{ url: 'https://example.com/' + id }], isrcs: [], disambiguation: '', cover: [], status, error: status === 'failed' ? 'edit page never loaded' : '', ...extra };
}

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
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });

// 1. disabled with nothing failed/partial.
await page.evaluate(() => window.__falconTest.setQueue([{ id: '1', entityType: 'artist', mbid: 'aaaaaaaa-5170-0000-0000-000000000001', urls: [], isrcs: [], disambiguation: '', cover: [], status: 'done', error: '' }]));
let disabled = await page.evaluate(() => document.getElementById('falcon-retry-failed').disabled);
ck(disabled === true, `disabled when nothing is failed/partial (got ${disabled})`);

// 2. enabled once something failed/partial; clicking re-queues ONLY those.
await page.evaluate(() => window.__falconTest.setQueue([
  { id: '1', entityType: 'recording', mbid: 'aaaaaaaa-5170-0000-0000-000000000001', urls: [{ url: 'https://x.com/1' }], isrcs: [], disambiguation: '', cover: [], status: 'done', error: '', timing: { totalMs: 5 } },
  { id: '2', entityType: 'recording', mbid: 'aaaaaaaa-5170-0000-0000-000000000002', urls: [{ url: 'https://x.com/2' }], isrcs: [], disambiguation: '', cover: [], status: 'failed', error: 'edit page never loaded', timing: { totalMs: 5 } },
  { id: '3', entityType: 'recording', mbid: 'aaaaaaaa-5170-0000-0000-000000000003', urls: [{ url: 'https://x.com/3' }], isrcs: [], disambiguation: '', cover: [], status: 'partial', error: 'one url failed', urlResults: [{ url: 'x', ok: false }], timing: { totalMs: 5 } },
  { id: '4', entityType: 'recording', mbid: 'aaaaaaaa-5170-0000-0000-000000000004', urls: [{ url: 'https://x.com/4' }], isrcs: [], disambiguation: '', cover: [], status: 'queued', error: '' },
]));
disabled = await page.evaluate(() => document.getElementById('falcon-retry-failed').disabled);
ck(disabled === false, `enabled once there's a failed/partial item (got ${disabled})`);

await page.click('#falcon-retry-failed');
await page.waitForTimeout(150);
const after = await page.evaluate(() => window.__falconTest.getQueue().map(i => ({ id: i.id, status: i.status, error: i.error, urlResults: i.urlResults, timing: i.timing })));
console.log('queue after retry:', JSON.stringify(after));
ck(after.find(i => i.id === '1').status === 'done', 'the already-done item is untouched');
ck(after.find(i => i.id === '2').status === 'queued', 'the failed item is re-queued');
ck(after.find(i => i.id === '2').error === '', 'its error is cleared');
ck(after.find(i => i.id === '2').timing === undefined, 'its stale timing is cleared too, so the next run\'s numbers are fresh');
ck(after.find(i => i.id === '3').status === 'queued', 'the partial item is re-queued too');
ck(after.find(i => i.id === '3').urlResults === null, 'its stale per-url results are cleared');
ck(after.find(i => i.id === '4').status === 'queued', 'the already-queued item stays queued (no-op for it)');

// 3. now nothing's failed/partial anymore — disabled again.
disabled = await page.evaluate(() => document.getElementById('falcon-retry-failed').disabled);
ck(disabled === true, `disabled again once nothing is left failed/partial (got ${disabled})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
