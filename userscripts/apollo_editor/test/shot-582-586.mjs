// Screenshots for #583/#584/#586 — the tracklist with the video markers and the
// data section opened in one click, and the recordings table with a selected
// range about to be unset. Read-only; nothing is submitted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
const MBID = '55530bc0-97ec-4256-97fc-e6058958c251';

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: true, viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 3 });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Apollo Editor', version: 't' } };
  window.GM_xmlhttpRequest = () => {};
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.route(/\/ws\/js\/edit\/|\/relationship-editor|\/edit\/create/i, r => r.abort());
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(5000);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 20000 });
const tab = async n => { await page.evaluate(x => { const b = [...document.querySelectorAll('#tc-nav-bar button, #tc-nav-bar a')].find(e => e.textContent.trim().toLowerCase().startsWith(x)); if (b) b.click(); }, n); await page.waitForTimeout(3000); };

await tab('tracklist');
await page.evaluate(() => {   // keep the ⤓ visible for the shot
  const st = document.createElement('style'); st.textContent = '.tc-mirror .tc-dtmv{visibility:visible!important}'; document.head.appendChild(st);
});
await page.locator('.tc-mirror').first().screenshot({ path: resolve(HERE, 'logs', 'shot-tracklist-before.png') });
await page.evaluate(() => {
  const tr = [...document.querySelectorAll('.tc-mirror tr[data-tk]')].find(r => r.dataset.ti === '10');
  tr.querySelector('.tc-dtmv.down').click();
});
await page.waitForTimeout(1200);
await page.evaluate(() => { const st = document.createElement('style'); st.textContent = '.tc-mirror .tc-dtmv{visibility:visible!important}'; document.head.appendChild(st); });
await page.locator('.tc-mirror').first().screenshot({ path: resolve(HERE, 'logs', 'shot-tracklist-after.png') });

await tab('recording');
// #583 — unset one row so a neighbour shows BOTH ＋ and ↺, then force the hover
// actions visible for the shot (they are hover-only in normal use).
await page.evaluate(() => {
  const tr = [...document.querySelectorAll('#tc-recwrap tr.tc-recrow')].find(r => r.dataset.ti === '11');
  tr.querySelector('.tc-rec-new-btn').click();
});
await page.waitForTimeout(900);
await page.evaluate(() => {
  const st = document.createElement('style');
  st.textContent = '.tc-rectbl .tc-rec-new-btn,.tc-rectbl .tc-rec-rev{visibility:visible!important}';
  document.head.appendChild(st);
});
await page.waitForTimeout(300);
await page.locator('#tc-recwrap').screenshot({ path: resolve(HERE, 'logs', 'shot-recordings-plus.png') });
console.log('shots written');
await ctx.close();
