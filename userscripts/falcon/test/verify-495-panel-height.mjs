// #495 (majkinetor) — "if I first maximize the page, it doesn't go empty...
// in unmaximized state it is simply moved off window." Reproduced: the panel
// (display:flex, flex-direction:column) had only max-height, no real height —
// without one, #falcon-queue-list's flex:1 has no space to grow into, and the
// whole panel collapses to its non-flexible children's content size (~170px,
// squeezing every row onto a sliver) instead of the intended 70vh. Giving the
// panel a real `height` alongside the existing `max-height` fixes it. This
// test never touches a real MB submit — it only checks the panel's own
// rendered box size on a synthetic queue.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1000, height: 700 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });
// a single, sparse item — the exact shape that reproduced the collapse live
// (a small queue, nothing expanded).
await page.evaluate(() => window.__falconTest.setQueue([
  { id: 'x1', entityType: 'release', mbid: 'bafa58c1-e9b3-4ed3-b42d-70a387e411f4', urls: [{ url: 'https://example.com/x', linkTypeId: '268' }], note: '', comment: '', isrcs: [], cover: { url: '', candidates: [] }, name: 'Hazy Dreams', urlResults: null, status: 'failed', error: 'never redirected off /edit after submit' },
]));
const box = await page.evaluate(() => {
  const r = document.getElementById('falcon-panel').getBoundingClientRect();
  return { width: r.width, height: r.height };
});
console.log('panel box on a small viewport (1000x700), sparse queue:', JSON.stringify(box));
// 70vh of a 700px-tall viewport is 490px — the bug collapsed this to ~170px.
ck(box.height > 400, `panel renders at its intended ~70vh height, not collapsed (got ${box.height}px)`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
