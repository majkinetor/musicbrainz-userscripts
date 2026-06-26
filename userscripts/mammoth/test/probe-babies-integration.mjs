// Integration check: baby mammoths inside mammoth.user.js, gated by SET.showBabies
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'mammoth.user.js'), 'utf8');
const MBID = 'd39b6cab-6ae6-4de8-b782-528865f4e832';
const ctx = await chromium.launchPersistentContext(resolve('C:/Work/mb-userscripts/.pw-profile'), { headless: true, viewport: { width: 1400, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));
let fail = 0; const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

async function run(settings, expectPins) {
  await page.addInitScript(s => { window.__gm = { 'mammoth:settings': s }; window.GM_getValue = (k, d) => (k in window.__gm ? window.__gm[k] : d); window.GM_setValue = (k, v) => { window.__gm[k] = v; }; }, settings);
  await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4500);
  await page.addScriptTag({ content: code });
  await page.waitForTimeout(700);
  return page.evaluate(() => ({ pins: document.querySelectorAll('.mmthf-pin').length, side: !!document.querySelector('.mmth-side') }));
}

// default ON (no settings)
let r = await run('{}', true);
check(r.pins >= 6, `babies ON by default → pins present (${r.pins})`);

// explicitly OFF
r = await run('{"showBabies":false}', false);
check(r.pins === 0, `babies OFF → no pins (${r.pins})`);

// toggle ON at runtime via the ⚙ settings checkbox (needs the edit-note panel)
await page.evaluate(() => { const b = document.querySelector('.mmth-side .mmth-fb[title="Settings"]'); if (b) b.click(); });
await page.waitForTimeout(150);
const hasCb = await page.evaluate(() => !!document.querySelector('.mmth-s-babies'));
if (hasCb) {
  await page.evaluate(() => { const cb = document.querySelector('.mmth-s-babies'); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(500);
  check(await page.evaluate(() => document.querySelectorAll('.mmthf-pin').length) >= 6, 'toggling the ⚙ checkbox ON adds pins at runtime');
} else { console.log('note: edit-note panel not present, skipping runtime-toggle check'); }

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
