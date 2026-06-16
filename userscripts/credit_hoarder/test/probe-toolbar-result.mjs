// Regression probe: the import "Done: N added…" summary must STAY visible in the
// toolbar status after the import finishes (it was being cleared 2s later).
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clickImport, waitForImportDone } from './lib/browser.js';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const DIST = resolve(HERE, '..', 'dist', 'credit_hoarder.user.js');
const O = 'https://musicbrainz.org';
const REL = '3cc7b91d-d9c3-4b1e-9d52-37c15aa17fc4';   // The Lost Tapes (Discogs 1801052/719254)
const log = (...a) => console.log('[probe-result]', ...a);

const code = await readFile(DIST, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1700, height: 1050 }, bypassCSP: true });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message));
await page.addInitScript(() => {
  window.GM_getValue = (k, d) => d; window.GM_setValue = () => {};
  window.GM_info = { script: { name: 'Credit Hoarder', version: 'test', homepageURL: 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/credit_hoarder/README.md' } };
});
await page.goto(`${O}/release/${REL}/edit-relationships`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.addScriptTag({ content: code });
await page.waitForSelector('.discogs-bar .discogs-import-btn', { timeout: 30000 });

await clickImport(page);
// the review table's confirm button is "<icon> Start import →" — match by
// substring (the lib's ^-anchored helper misses the leading icon text)
const startBtn = page.locator('button', { hasText: /Start import/i }).first();
await startBtn.waitFor({ state: 'visible', timeout: 4 * 60_000 });
await startBtn.click();
log('clicked Start import');
const { timedOut } = await waitForImportDone(page, { timeout: 4 * 60_000 });
log('import done, timedOut:', timedOut);

// wait past the 2s post-import timeout that used to clear the status
await page.waitForTimeout(3000);
const status = await page.evaluate(() => {
  const el = document.querySelector('.discogs-bar-status');
  return el ? { text: el.textContent.trim(), display: getComputedStyle(el).display } : null;
});
log('toolbar status after import:', JSON.stringify(status));

let fail = 0;
const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(!!status && status.display !== 'none', 'status line is still visible after import');
check(!!status && /added/i.test(status.text), 'status shows the result summary (… added …)');
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
