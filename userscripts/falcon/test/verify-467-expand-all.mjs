// #467 (majkinetor: "Lets have button to uncollapse all details") — a toolbar
// button that expands every queue row's url detail at once, and toggles to
// "Collapse all" once they're all open, instead of clicking each ▸ individually.
//
// The label is read off `.falcon-bt`, not the button's textContent: toolbar
// buttons are icon + label spans so they can collapse to icon-only on a narrow
// panel (see verify-toolbar-collapse.mjs), so textContent now carries the icon
// glyph too.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });
await page.evaluate(() => window.__falconTest.setQueue([
  { id: 'a', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://myspace.com/exp1', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' },
  { id: 'b', entityType: 'artist', mbid: '5441c29d-3602-4898-b1a1-b77fa23b8e50', urls: [{ url: 'https://myspace.com/exp2', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' },
  { id: 'c', entityType: 'artist', mbid: 'b31113ab-205d-461b-b431-5d5c52635117', urls: [{ url: 'https://myspace.com/exp3', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' },
]));

const initialLabel = await page.textContent('#falcon-expand-all .falcon-bt');
ck(initialLabel === 'Expand all', `starts as "Expand all" when nothing is expanded (got "${initialLabel}")`);

await page.click('#falcon-expand-all');
const expandedCount = await page.evaluate(() => window.__falconTest.getExpandedIds().size);
const labelAfterExpand = await page.textContent('#falcon-expand-all .falcon-bt');
console.log('expanded count:', expandedCount, 'label:', labelAfterExpand);
ck(expandedCount === 3, `clicking it expands ALL 3 rows at once (got ${expandedCount})`);
ck(labelAfterExpand === 'Collapse all', `label flips to "Collapse all" once everything is expanded (got "${labelAfterExpand}")`);

await page.click('#falcon-expand-all');
const expandedAfterCollapse = await page.evaluate(() => window.__falconTest.getExpandedIds().size);
const labelAfterCollapse = await page.textContent('#falcon-expand-all .falcon-bt');
console.log('expanded after collapse-all:', expandedAfterCollapse, 'label:', labelAfterCollapse);
ck(expandedAfterCollapse === 0, `clicking it again collapses everything (got ${expandedAfterCollapse})`);
ck(labelAfterCollapse === 'Expand all', `label flips back to "Expand all" (got "${labelAfterCollapse}")`);

// expanding one row manually, then the rest via the button, still reaches "all expanded"
await page.click('.falcon-row-expand[data-id="a"]');
const labelPartial = await page.textContent('#falcon-expand-all .falcon-bt');
ck(labelPartial === 'Expand all', `with only SOME rows expanded, the button still offers "Expand all" (got "${labelPartial}")`);
await page.click('#falcon-expand-all');
const allExpandedNow = await page.evaluate(() => window.__falconTest.getExpandedIds().size);
ck(allExpandedNow === 3, `clicking "Expand all" from a partial state expands the remaining rows too (got ${allExpandedNow})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
