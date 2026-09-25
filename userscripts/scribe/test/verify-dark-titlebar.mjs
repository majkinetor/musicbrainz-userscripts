// majkinetor: "fix scribe black theme (titlebar here)" — the session window's title
// ("Scribe vX") and its –/✕ controls rendered black on the dark-green header.
// Cause: dark userstyles (kellnerd's, #564) ship `div[style*=background]{color:initial}`;
// the header div carries an inline background but no colour of its own, so its text
// inherited `initial` → canvastext → black.
//
// Injects that userstyle rule, opens the session window (startSession draws it before
// it contacts the local helper, which isn't running here), and asserts every header
// text element is light. SCRIBE_SRC=<old build> to see them black. Nothing is edited.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.SCRIBE_SRC || resolve(HERE, '..', 'scribe.user.js'), 'utf8');
const SHOT = process.env.SHOT || join(tmpdir(), 'scribe-dark-titlebar.png');
const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';   // test.musicbrainz.org sandbox release
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 }, deviceScaleFactor: 3 });
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_info = { script: { name: 'Scribe', version: '9.9.9-test' } };
  window.GM_registerMenuCommand = () => {};
  window.GM_xmlhttpRequest = o => { setTimeout(() => { try { (o.onerror || (() => {}))(new Error('no helper in test')); } catch (e) {} }, 20); return { abort() {} }; };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(4000);
// the hostile dark-userstyle rule (kellnerd's, as in #564)
await page.addStyleTag({ content: 'div[style*=background]{color:initial !important}' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => window.__scribe && window.__scribe.startSession, null, { timeout: 20000 });
await page.evaluate(() => { window.__scribe.startSession(); });
await page.waitForSelector('#scribe-panel', { timeout: 20000 });
await page.waitForTimeout(800);
const cols = await page.evaluate(() => {
  const hdr = document.querySelector('#scribe-panel > div');
  const kids = [...hdr.children].filter(e => (e.textContent || '').trim() && !/^\d+$/.test(e.textContent.trim()));   // title, –, ✕ (not the count badge)
  const lum = c => { const m = c.match(/[\d.]+/g).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
  return kids.map(e => ({ text: e.textContent.trim().slice(0, 20), color: getComputedStyle(e).color, lum: +lum(getComputedStyle(e).color).toFixed(2) }));
});
console.log(JSON.stringify(cols));
ck(cols.length >= 3, `found the title and the –/✕ controls (${cols.length})`);
ck(cols.every(c => c.lum > 0.6), 'every header text element is light on the dark header, even under `div[style*=background]{color:initial}`');
const box = await page.evaluate(() => { const r = document.getElementById('scribe-panel').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
await page.screenshot({ path: SHOT, clip: box });
const title = cols[0] && cols[0].text;
ck(/v9\.9\.9-test/.test(title || ''), `title shows the manager's @version, not a stale literal (${title})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
