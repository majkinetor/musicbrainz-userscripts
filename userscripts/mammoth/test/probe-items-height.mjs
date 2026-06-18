// Probe #245 (follow-up): with no user-saved height, the field's initial height
// is determined by the Items Shown setting (the panel's height) and tracks it
// live when changed. After a real user resize, the saved height wins and no
// longer auto-tracks.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', 'mammoth.user.js');
const log = (...a) => console.log('[probe-items-height]', ...a);

const code = await readFile(SCRIPT, 'utf8');
const ctx = await chromium.launchPersistentContext('', { headless: true, viewport: { width: 1200, height: 900 } });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message));
await page.addInitScript(() => {
  window.__gm = {};
  window.GM_getValue = (k, d) => (k in window.__gm ? window.__gm[k] : d);
  window.GM_setValue = (k, v) => { window.__gm[k] = v; };
  // plenty of SAVED rows (the default view) so the panel is tall at 6 rows and clearly shorter at 2
  window.__gm['mammoth:data'] = JSON.stringify({ saved: Array.from({ length: 12 }, (_, i) => ({ id: 'id' + i, text: 'note ' + (i + 1), ts: 1700000000000 - i })), history: [] });
});
await page.goto('about:blank');
await page.setContent('<!doctype html><html><body><form><fieldset class="editnote"><div class="row"><label for="en">Edit note:</label><textarea id="en" class="edit-note" rows="3" cols="80"></textarea></div></fieldset></form></body></html>');
await page.addScriptTag({ content: code });
await page.waitForSelector('.mmth-side', { timeout: 10000 });
await page.waitForTimeout(700);

const dims = () => page.evaluate(() => {
  const ta = document.querySelector('textarea.edit-note'); const side = document.querySelector('.mmth-side');
  return { taH: ta.offsetHeight, sideH: side.offsetHeight, taStyleH: parseInt(ta.style.height, 10) || 0 };
});
async function setItemsShown(n) {
  await page.click('.mmth-ft button[title="Settings"]');
  await page.waitForSelector('.mmth-s-rows', { timeout: 5000 });
  await page.fill('.mmth-s-rows', String(n));
  await page.dispatchEvent('.mmth-s-rows', 'change');
  await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(() => document.querySelector('.mmth-pop')?.remove());
  await page.waitForTimeout(400);
}

const at6 = await dims(); log('Items Shown 6 (default):', JSON.stringify(at6));
await setItemsShown(2);
const at2 = await dims(); log('Items Shown 2:', JSON.stringify(at2));

let fail = 0;
const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(at6.sideH > 0 && Math.abs(at6.taH - at6.sideH) <= 8, `initial field height tracks the panel (field ${at6.taH} ≈ panel ${at6.sideH})`);
check(at6.taStyleH > 0 && Math.abs(at6.taStyleH - at6.sideH) <= 2, `field's explicit height is set to the panel height (${at6.taStyleH} vs ${at6.sideH})`);
check(at2.sideH < at6.sideH - 20, `panel shrank when Items Shown 6→2 (${at6.sideH}→${at2.sideH})`);
check(Math.abs(at2.taH - at2.sideH) <= 8, `field followed Items Shown down live (field ${at2.taH} ≈ panel ${at2.sideH})`);

// a real user resize → persists and the height stops auto-tracking
const resized = await page.evaluate(() => {
  const ta = document.querySelector('textarea.edit-note');
  ta.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  ta.style.height = '420px';
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  return JSON.parse(window.__gm['mammoth:settings'] || '{}').taHeight ?? null;
});
check(resized >= 418 && resized <= 440, `a user resize is remembered (saved taHeight ${resized}, ~420 + padding)`);
await setItemsShown(6);
const afterTrack = await dims();
check(afterTrack.taH >= 415, `after a saved resize the field keeps the user's height, not the panel's (${afterTrack.taH})`);

console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
