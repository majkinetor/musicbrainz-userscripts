// Probe #228 (artist name) — hover × after the name clears + unsets the artist.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const O = 'https://musicbrainz.org';
const REL = '3cc7b91d-d9c3-4b1e-9d52-37c15aa17fc4';
const log = (...a) => console.log('[probe-228name]', ...a);

const code = await readFile(SCRIPT, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1600, height: 1000 }, bypassCSP: true });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });
await page.goto(`${O}/release/${REL}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.addScriptTag({ content: code });
await page.waitForSelector('.tc-aslot .tc-search .nm', { timeout: 30000 }).catch(() => {});
if (!(await page.evaluate(() => !!document.querySelector('.tc-aslot .tc-search .nm')))) { log('no apollo table'); await ctx.close(); process.exit(2); }

const res = await page.evaluate(async () => {
  const inp = document.querySelector('.tc-aslot .tc-search .nm'); const box = inp.closest('.tc-search');
  const setN = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setN.call(inp, 'Some Artist Name'); inp.dispatchEvent(new Event('input', { bubbles: true }));
  const clr = box.querySelector('.tc-nm-clr');
  const hasClass = box.classList.contains('tc-has-nm');
  const exists = !!clr;
  clr && clr.click();
  await new Promise(r => setTimeout(r, 60));
  return { exists, hasClass, valueAfter: inp.value, classAfter: box.classList.contains('tc-has-nm') };
});
log('result:', JSON.stringify(res));

let fail = 0;
const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(res.exists, 'clear × exists in the search box');
check(res.hasClass, 'tc-has-nm set when the name field has a value (shows × on hover)');
check(res.valueAfter === '', 'clicking × clears the artist name field');
check(res.classAfter === false, 'tc-has-nm removed after clearing');
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
