// #501 follow-up (majkinetor, live: his script-manager config was visibly
// cluttered with pc:cache:v2:*/pc:mbdata:*/pc:pending:* entries riding along
// in a sync backup). These are same-origin (musicbrainz.org-only), so they
// belong in localStorage, not GM storage — GM storage is reserved for real
// settings that should sync/backup. This test proves: (1) the cache/pending
// functions now read/write localStorage, not GM storage; (2) a one-time
// sweep on load deletes any stale entries a pre-fix install already wrote to
// GM storage under these names.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/platform_check/platform_check.user.js', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
const page = ctx.pages()[0] || await ctx.newPage();

// pre-seed GM storage with stale pre-fix entries under all three prefixes,
// PLUS one genuine setting key — the sweep must only touch the cache/pending
// prefixes, never a real setting.
const deletedKeys = [];
await page.addInitScript(() => {
  const store = new Map([
    ['pc:cache:v2:spotify:aaaaaaaa-0000-0000-0000-000000000000', '{"url":"x"}'],
    ['pc:mbdata:aaaaaaaa-0000-0000-0000-000000000000', '{"artist":"x"}'],
    ['pc:pending:aaaaaaaa-0000-0000-0000-000000000000', '{"spotify":"y"}'],
    ['pc:pending:rg:bbbbbbbb-0000-0000-0000-000000000000', '{"discogs-master":"z"}'],
    ['pc:layout', '2row'],   // genuine setting — must survive the sweep
  ]);
  window.__gmDeleted = [];
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => { window.__gmDeleted.push(k); store.delete(k); };
  window.GM_listValues = () => [...store.keys()];
  window.GM_info = { script: { name: 'Platform Check', version: 't' } };
});
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/release/aaaaaaaa-0000-0000-0000-000000000000', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForTimeout(500);

const swept = await page.evaluate(() => window.__gmDeleted);
console.log('GM keys deleted by the sweep:', JSON.stringify(swept));
ck(swept.includes('pc:cache:v2:spotify:aaaaaaaa-0000-0000-0000-000000000000'), 'stale pc:cache:v2:* entry deleted from GM storage');
ck(swept.includes('pc:mbdata:aaaaaaaa-0000-0000-0000-000000000000'), 'stale pc:mbdata:* entry deleted from GM storage');
ck(swept.includes('pc:pending:aaaaaaaa-0000-0000-0000-000000000000'), 'stale pc:pending:* entry deleted from GM storage');
ck(swept.includes('pc:pending:rg:bbbbbbbb-0000-0000-0000-000000000000'), 'stale pc:pending:rg:* entry deleted from GM storage');
ck(!swept.includes('pc:layout'), 'a genuine setting (pc:layout) is left untouched by the sweep');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
