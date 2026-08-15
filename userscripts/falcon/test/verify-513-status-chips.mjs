// #513 (majkinetor): "Its still not easily seeable that there were issues.
// Lets add some chip with results in appropriate color if there are issues...
// Make window wider if needed to fit the chips. Make the chip clickable to
// filter in just those results."
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

function item(id, status, entityType = 'recording') {
  return { id, entityType, mbid: `aaaaaaaa-5130-0000-0000-00000000000${id}`, name: `Item ${id}`, urls: [{ url: 'https://example.com/' + id }], isrcs: [], disambiguation: '', cover: [], status, error: status === 'failed' ? 'boom' : '' };
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

// 1. no chips at all when nothing has a problem status.
await page.evaluate(() => window.__falconTest.setQueue([{ id: '1', entityType: 'artist', mbid: 'aaaaaaaa-5130-0000-0000-000000000001', name: 'Fine', urls: [{ url: 'https://x.com/1' }], isrcs: [], disambiguation: '', cover: [], status: 'done', error: '' }]));
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });
const noChips = await page.evaluate(() => document.querySelectorAll('.falcon-status-chip').length);
ck(noChips === 0, `no status chips when everything's fine (got ${noChips})`);

// 2. one chip per non-trivial outcome status present, with the right count
// — #513 follow-up (majkinetor): "Lets add other statuses that are not
// Done/Excluded here (Like skipped, partial etc.)" — 'done'/'queued' never
// get one (a plain success, or work still pending — the progress bar
// already covers pending), but 'skipped' now does too, alongside
// failed/partial/manual.
await page.evaluate((mk) => window.__falconTest.setQueue([
  { id: '1', entityType: 'recording', mbid: 'aaaaaaaa-5130-0000-0000-000000000001', urls: [], isrcs: [], disambiguation: '', cover: [], status: 'failed', error: 'x' },
  { id: '2', entityType: 'recording', mbid: 'aaaaaaaa-5130-0000-0000-000000000002', urls: [], isrcs: [], disambiguation: '', cover: [], status: 'failed', error: 'x' },
  { id: '3', entityType: 'recording', mbid: 'aaaaaaaa-5130-0000-0000-000000000003', urls: [], isrcs: [], disambiguation: '', cover: [], status: 'partial', error: 'x' },
  { id: '4', entityType: 'release', mbid: 'aaaaaaaa-5130-0000-0000-000000000004', urls: [], isrcs: [], disambiguation: '', cover: [], status: 'done', error: '' },
  { id: '5', entityType: 'recording', mbid: 'aaaaaaaa-5130-0000-0000-000000000005', urls: [], isrcs: [], disambiguation: '', cover: [], status: 'skipped', error: '' },
  { id: '6', entityType: 'recording', mbid: 'aaaaaaaa-5130-0000-0000-000000000006', urls: [], isrcs: [], disambiguation: '', cover: [], status: 'queued', error: '' },
]), null);
await page.waitForTimeout(150);
const chips = await page.evaluate(() => [...document.querySelectorAll('.falcon-status-chip')].map(c => ({ status: c.dataset.status, text: c.textContent })));
console.log('chips:', JSON.stringify(chips));
ck(chips.length === 3, `failed+partial+skipped get a chip — done/queued don't (got ${chips.length})`);
// text-transform:uppercase is CSS-only — textContent stays lowercase.
ck(chips.some(c => c.status === 'failed' && c.text === 'failed 2'), `failed chip shows the right count (got ${JSON.stringify(chips.find(c => c.status === 'failed'))})`);
ck(chips.some(c => c.status === 'partial' && c.text === 'partial 1'), `partial chip shows the right count (got ${JSON.stringify(chips.find(c => c.status === 'partial'))})`);
ck(chips.some(c => c.status === 'skipped' && c.text === 'skipped 1'), `skipped chip shows the right count (got ${JSON.stringify(chips.find(c => c.status === 'skipped'))})`);

// 3. clicking a chip filters the queue view to just that status; clicking again clears it.
await page.click('.falcon-status-chip[data-status="failed"]');
await page.waitForTimeout(150);
let visibleIds = await page.evaluate(() => [...document.querySelectorAll('.falcon-row')].map(r => r.dataset.id));
ck(visibleIds.length === 2 && visibleIds.every(id => ['1', '2'].includes(id)), `filtering to 'failed' shows only those 2 rows (got ${JSON.stringify(visibleIds)})`);
const filterState = await page.evaluate(() => window.__falconTest.getStatusFilter());
ck(filterState === 'failed', `_statusFilter tracks the active chip (got "${filterState}")`);

await page.click('.falcon-status-chip[data-status="failed"]');
await page.waitForTimeout(150);
visibleIds = await page.evaluate(() => [...document.querySelectorAll('.falcon-row')].map(r => r.dataset.id));
ck(visibleIds.length === 6, `clicking the SAME chip again clears the filter — all 6 rows back (got ${visibleIds.length})`);

// 4. switching directly from one filter to another (not toggling the same one).
await page.click('.falcon-status-chip[data-status="failed"]');
await page.waitForTimeout(100);
await page.click('.falcon-status-chip[data-status="partial"]');
await page.waitForTimeout(150);
visibleIds = await page.evaluate(() => [...document.querySelectorAll('.falcon-row')].map(r => r.dataset.id));
ck(visibleIds.length === 1 && visibleIds[0] === '3', `switching chips replaces the filter, doesn't stack (got ${JSON.stringify(visibleIds)})`);
await page.evaluate(() => window.__falconTest.setStatusFilter(null));

// 5. the header fits all 4 possible chips without clipping (measured, not just visual).
await page.evaluate(() => window.__falconTest.setQueue([
  { id: '1', entityType: 'recording', mbid: 'aaaaaaaa-5130-0000-0000-000000000001', urls: [], isrcs: [], disambiguation: '', cover: [], status: 'failed', error: 'x' },
  { id: '2', entityType: 'recording', mbid: 'aaaaaaaa-5130-0000-0000-000000000002', urls: [], isrcs: [], disambiguation: '', cover: [], status: 'partial', error: 'x' },
  { id: '3', entityType: 'recording', mbid: 'aaaaaaaa-5130-0000-0000-000000000003', urls: [], isrcs: [], disambiguation: '', cover: [], status: 'manual', error: 'x' },
  { id: '4', entityType: 'recording', mbid: 'aaaaaaaa-5130-0000-0000-000000000004', urls: [], isrcs: [], disambiguation: '', cover: [], status: 'skipped', error: '' },
]));
await page.waitForTimeout(150);
const fit = await page.evaluate(() => {
  const chipsWrap = document.getElementById('falcon-status-chips');
  const tabQueue = document.getElementById('falcon-tab-queue');
  return { chipsRight: chipsWrap.getBoundingClientRect().right, tabLeft: tabQueue.getBoundingClientRect().left, chipCount: chipsWrap.children.length };
});
console.log('fit check:', JSON.stringify(fit));
ck(fit.chipCount === 4, `all 4 possible chips render (got ${fit.chipCount})`);
ck(fit.chipsRight <= fit.tabLeft + 1, `the chip strip doesn't overlap the Queue tab button (chips end at ${fit.chipsRight}, tab starts at ${fit.tabLeft})`);

// 6. the empty-after-filter state offers a way back.
await page.evaluate(() => window.__falconTest.setQueue([{ id: '1', entityType: 'recording', mbid: 'aaaaaaaa-5130-0000-0000-000000000001', urls: [], isrcs: [], disambiguation: '', cover: [], status: 'failed', error: 'x' }]));
await page.click('.falcon-status-chip[data-status="failed"]');
await page.waitForTimeout(100);
// now remove the only failed item externally (simulating a re-run that fixed it)
await page.evaluate(() => window.__falconTest.setQueue([{ id: '1', entityType: 'recording', mbid: 'aaaaaaaa-5130-0000-0000-000000000001', urls: [], isrcs: [], disambiguation: '', cover: [], status: 'done', error: '' }]));
await page.waitForTimeout(150);
const afterClear = await page.evaluate(() => ({ filter: window.__falconTest.getStatusFilter(), rows: document.querySelectorAll('.falcon-row').length }));
console.log('after the filtered status disappears entirely:', JSON.stringify(afterClear));
ck(afterClear.filter === null, `the filter self-clears once nothing matches it anymore (got "${afterClear.filter}")`);
ck(afterClear.rows === 1, 'and the (now-fine) item is visible again');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
