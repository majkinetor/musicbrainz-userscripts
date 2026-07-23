// #462 — Mammoth field pins (mmthf-pin/bar @ z-index 9998) were floating over MB's
// autocomplete dropdown (ul.ui-autocomplete @ z-index 100). Fix: flag html.mmthf-acopen
// while any lookup menu is open, which hides the babies until it closes. Loads Mammoth on
// a real release editor, opens a lookup, and asserts the pins hide then reappear.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'mammoth.user.js'), 'utf8');
const MBID = '35e0c3ca-1130-4cfb-911d-c275ab31100e';

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2, bypassCSP: true });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
await page.addInitScript(() => { const s = {}; window.GM_getValue = (k, d) => k in s ? s[k] : d; window.GM_setValue = (k, v) => { s[k] = v; }; window.GM_registerMenuCommand = () => {}; window.GM_info = { script: { name: 'Mammoth', version: 't' } }; window.unsafeWindow = window; });
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(3000);
await page.addScriptTag({ content: code });
await page.waitForTimeout(1500);
// open the artist-credit bubble (its fields get pinned), then focus a lookup field
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(b => /^\s*Edit\s*$/.test(b.textContent || '')).map(b => ({ b, r: b.getBoundingClientRect() })).find(o => o.r.top > 90 && o.r.top < 170 && o.r.left > 400 && o.r.left < 700); b && b.b.click(); });
await page.waitForTimeout(1200);
const inp = page.locator('.bubble input.ui-autocomplete-input, input.ui-autocomplete-input').first();
await inp.click().catch(() => {});
const state = () => page.evaluate(() => ({
  acopen: document.documentElement.classList.contains('mmthf-acopen'),
  dropOpen: [...document.querySelectorAll('ul.ui-autocomplete')].some(u => u.offsetParent !== null && getComputedStyle(u).display !== 'none'),
  pinsVisible: [...document.querySelectorAll('.mmthf-pin')].filter(el => getComputedStyle(el).opacity !== '0' && getComputedStyle(el).pointerEvents !== 'none').length,
  pinsTotal: document.querySelectorAll('.mmthf-pin').length,
}));
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const before = await state(); console.log('before:', JSON.stringify(before));
await page.keyboard.press('Control+A'); await page.keyboard.type('Lucidium61 zzz', { delay: 30 });
await page.waitForTimeout(1200);
const during = await state(); console.log('during:', JSON.stringify(during));
ck(during.dropOpen, 'autocomplete dropdown is open while typing');
ck(during.acopen, 'html.mmthf-acopen set while dropdown open');
ck(during.pinsVisible === 0 && during.pinsTotal > 0, `pins hidden while dropdown open (visible ${during.pinsVisible}/${during.pinsTotal})`);
await page.keyboard.press('Escape'); await page.waitForTimeout(600);
const after = await state(); console.log('after Escape:', JSON.stringify(after));
ck(!after.acopen && after.pinsVisible > 0, `pins reappear after dropdown closes (visible ${after.pinsVisible})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
