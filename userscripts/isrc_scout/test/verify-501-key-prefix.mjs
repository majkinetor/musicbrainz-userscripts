// #501 follow-up (majkinetor):
//   1. "Tokens should go into GM storage, so that we don't have to
//      initialize plugins on every place" — auth tokens (including the
//      short-lived oauth_access_token/tidal_token, silently re-derived) stay
//      on GM storage; only the per-release pending-removal DRAFT moves to
//      localStorage (it's not a token or a setting).
//   2. "tidy up config prefixes, some have them, some don't
//      (ignore_pc_confidence, col_widths ...)" — every persisted key now
//      carries the `ii:` prefix, with a one-time non-destructive migration
//      from the old bare name.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/isrc_scout/isrc_scout.user.js', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
const page = ctx.pages()[0] || await ctx.newPage();

// pre-seed OLD bare-named GM entries — the one-time migration should adopt
// them under the new ii:-prefixed name on load.
await page.addInitScript(() => {
  const store = new Map([
    ['col_widths', '{"a":1}'],
    ['ignore_pc_confidence', true],
    ['oauth_refresh_token', 'my-refresh-token'],
    ['tidal_token', 'my-tidal-token'],
  ]);
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_listValues = () => [...store.keys()];
  window.__gmStore = store;
  window.GM_info = { script: { name: 'ISRC Scout', version: 't' } };
});
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/release/aaaaaaaa-0000-0000-0000-000000000000', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__isrcScoutTestStore, { timeout: 5000 });

// migration is LAZY (happens inside store.get on first real read of that
// specific key) — call the getters directly via the test hook, same as a
// real feature (settings pane, OAuth flow) would on first use.
const reads = await page.evaluate(() => {
  const { store } = window.__isrcScoutTestStore;
  return {
    colWidths: store.get('col_widths', null),
    ignorePc: store.get('ignore_pc_confidence', null),
    refreshToken: store.get('oauth_refresh_token', null),
    tidalToken: store.get('tidal_token', null),
  };
});
console.log('store.get() results (bare names, wrapper prefixes internally):', JSON.stringify(reads));
ck(reads.colWidths === '{"a":1}', `col_widths migrated and read correctly via store.get (got ${JSON.stringify(reads.colWidths)})`);
ck(reads.ignorePc === true, `ignore_pc_confidence migrated and read correctly (got ${reads.ignorePc})`);
ck(reads.refreshToken === 'my-refresh-token', `oauth_refresh_token migrated and read correctly (got "${reads.refreshToken}")`);
ck(reads.tidalToken === 'my-tidal-token', `tidal_token migrated and read correctly (got "${reads.tidalToken}")`);

const state = await page.evaluate(() => ({
  colWidthsPrefixed: window.__gmStore.get('ii:col_widths'),
  tidalTokenPrefixed: window.__gmStore.get('ii:tidal_token'),
  oldColWidthsStillThere: window.__gmStore.get('col_widths'),
  tidalTokenOnLocalStorage: localStorage.getItem('ii:tidal_token'),
}));
console.log('migrated state:', JSON.stringify(state));
ck(state.colWidthsPrefixed === '{"a":1}', `col_widths migrated onto GM storage as ii:col_widths (got ${JSON.stringify(state.colWidthsPrefixed)})`);
ck(state.tidalTokenPrefixed === 'my-tidal-token', `tidal_token migrated onto GM storage as ii:tidal_token, STILL ON GM not localStorage (got "${state.tidalTokenPrefixed}")`);
ck(state.oldColWidthsStillThere === '{"a":1}', 'the old bare-named key is left in place (non-destructive), just no longer read from');
ck(state.tidalTokenOnLocalStorage === null, 'tidal_token is NOT on localStorage — tokens stay on GM storage per majkinetor');

// pending_removals — the one thing that DOES move to localStorage (a
// per-release draft, not a token/setting).
const pendState = await page.evaluate(() => {
  const { localStore } = window.__isrcScoutTestStore;
  localStore.set('pending_removals_test', { rec1: ['USRC1'] });
  return {
    onLocalStorage: localStorage.getItem('ii:pending_removals_test'),
    onGmStore: window.__gmStore.get('ii:pending_removals_test'),
  };
});
console.log('pending_removals state:', JSON.stringify(pendState));
ck(!!pendState.onLocalStorage, `pending_removals draft lands on localStorage under the ii: prefix (got ${JSON.stringify(pendState.onLocalStorage)})`);
ck(pendState.onGmStore === undefined, 'pending_removals draft is NOT written to GM storage');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
