// Probe #228 — hover × clears the credited-as field.
// Loads the release editor, finds a .tc-cred input, gives it an override value,
// confirms the clear button appears (tc-has-cred) and clears the field on click.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const OUT = resolve(HERE, 'logs', '228');
const O = 'https://musicbrainz.org';
const REL = '3cc7b91d-d9c3-4b1e-9d52-37c15aa17fc4';
const log = (...a) => console.log('[probe-228]', ...a);

await mkdir(OUT, { recursive: true });
const code = await readFile(SCRIPT, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });
await page.goto(`${O}/release/${REL}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.addScriptTag({ content: code });
await page.waitForSelector('.tc-aslot .tc-cred', { timeout: 30000 }).catch(() => log('apollo tracklist table not found'));
const hasCred = await page.evaluate(() => !!document.querySelector('.tc-aslot .tc-cred'));
log('apollo table rendered:', hasCred);
if (!hasCred) { await ctx.close(); process.exit(2); }

const res = await page.evaluate(async () => {
  const cred = document.querySelector('.tc-aslot .tc-cred');
  const setN = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setN.call(cred, 'Probe Credit'); cred.dispatchEvent(new Event('input', { bubbles: true }));
  const line = cred.closest('.tc-aslot');
  const clr = line.querySelector('.tc-cred-clr');
  const hasClass = line.classList.contains('tc-has-cred');
  const clrExists = !!clr;
  clr && clr.click();
  await new Promise(r => setTimeout(r, 50));
  return { hasClass, clrExists, valueAfterClear: cred.value, classAfter: line.classList.contains('tc-has-cred') };
});
log('result:', JSON.stringify(res));

let fail = 0;
const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(res.clrExists, 'clear button exists in the slot');
check(res.hasClass, 'tc-has-cred class set when the field has a value (shows × on hover)');
check(res.valueAfterClear === '', 'clicking × clears the credited-as field');
check(res.classAfter === false, 'tc-has-cred removed after clearing');
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
