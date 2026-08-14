// #501 follow-up (majkinetor, live: cluttered script-manager config): short-
// lived derived tokens (oauth_access_token/expiry, tidal_token/exp) and the
// per-release pending-removal draft move to localStorage — cheaply re-
// derived, gain nothing from syncing. oauth_refresh_token (the actual
// long-lived credential) stays on GM storage on purpose. This test proves
// the one-time sweep deletes stale pre-fix GM entries under the moved names,
// while leaving the refresh token and other real settings alone.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/isrc_scout/isrc_scout.user.js', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
const page = ctx.pages()[0] || await ctx.newPage();

await page.addInitScript(() => {
  const store = new Map([
    ['oauth_access_token', 'stale-token'],
    ['oauth_access_expiry', 123],
    ['tidal_token', 'stale-tidal'],
    ['tidal_token_exp', 456],
    ['pending_removals_aaaaaaaa-0000-0000-0000-000000000000', '{"rec1":["USRC1"]}'],
    ['oauth_refresh_token', 'keep-me'],   // long-lived credential — must survive
    ['col_widths', '{"a":1}'],            // genuine setting — must survive
  ]);
  window.__gmDeleted = [];
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => { window.__gmDeleted.push(k); store.delete(k); };
  window.GM_listValues = () => [...store.keys()];
  window.GM_info = { script: { name: 'ISRC Scout', version: 't' } };
});
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/release/aaaaaaaa-0000-0000-0000-000000000000', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForTimeout(500);

const swept = await page.evaluate(() => window.__gmDeleted);
const remaining = await page.evaluate(() => window.GM_listValues());
console.log('GM keys deleted by the sweep:', JSON.stringify(swept));
console.log('GM keys remaining:', JSON.stringify(remaining));
ck(swept.includes('oauth_access_token') && swept.includes('oauth_access_expiry'), 'stale oauth_access_token/expiry deleted from GM storage');
ck(swept.includes('tidal_token') && swept.includes('tidal_token_exp'), 'stale tidal_token/exp deleted from GM storage');
ck(swept.includes('pending_removals_aaaaaaaa-0000-0000-0000-000000000000'), 'stale pending_removals_* entry deleted from GM storage');
ck(remaining.includes('oauth_refresh_token'), 'the long-lived refresh token is left on GM storage (worth syncing)');
ck(remaining.includes('col_widths'), 'a genuine setting is left untouched by the sweep');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
