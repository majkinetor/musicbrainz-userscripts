// Probe: the edit-note height is floored to the sidebar and only a real user
// resize (mouse down→up on the field) is persisted — a layout-only height change
// (e.g. visiting a differently-sized edit page) must NOT overwrite the setting.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', 'mammoth.user.js');
const log = (...a) => console.log('[probe-height]', ...a);

const code = await readFile(SCRIPT, 'utf8');
const ctx = await chromium.launchPersistentContext('', { headless: true, viewport: { width: 1200, height: 900 } });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message));
await page.addInitScript(() => {
  window.__gm = {};
  window.GM_getValue = (k, d) => (k in window.__gm ? window.__gm[k] : d);
  window.GM_setValue = (k, v) => { window.__gm[k] = v; };
});
await page.goto('about:blank');
await page.setContent('<!doctype html><html><body><form><fieldset class="editnote"><div class="row"><label for="en">Edit note:</label><textarea id="en" class="edit-note" rows="3" cols="80"></textarea></div></fieldset></form></body></html>');
await page.addScriptTag({ content: code });
await page.waitForSelector('.mmth-side', { timeout: 10000 });
await page.waitForTimeout(300);   // let the sidebar lay out + the floor ResizeObserver settle

const r1 = await page.evaluate(() => {
  const ta = document.querySelector('textarea.edit-note'); const side = document.querySelector('.mmth-side');
  return { taMinH: ta.style.minHeight, sideH: side.offsetHeight, taH: ta.offsetHeight };
});
log('floor:', JSON.stringify(r1));

// a SMALL saved height must still be floored to the sidebar (the bug: field below sidebar)
const small = await page.evaluate(() => {
  const ta = document.querySelector('textarea.edit-note'); const side = document.querySelector('.mmth-side');
  ta.style.height = '50px';
  return { taH: ta.offsetHeight, sideH: side.offsetHeight };
});
log('small saved height floored:', JSON.stringify(small));

// 1) layout-only height change (no mouse) → must NOT persist
const layout = await page.evaluate(() => {
  const ta = document.querySelector('textarea.edit-note');
  ta.style.height = '500px';   // simulate a different page laying it out taller
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return JSON.parse(window.__gm['mammoth:settings'] || '{}').taHeight ?? null;
});
log('after layout-only change, saved taHeight:', layout);

// 2) real user resize (mousedown → grow → mouseup) → must persist
const resized = await page.evaluate(() => {
  const ta = document.querySelector('textarea.edit-note');
  ta.style.height = '180px';   // reset to a known size first
  ta.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));   // _downH captured = 180
  ta.style.height = '320px';   // user drags the grip → bigger
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  return JSON.parse(window.__gm['mammoth:settings'] || '{}').taHeight ?? null;
});
log('after user resize, saved taHeight:', resized);

let fail = 0;
const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(r1.sideH > 0 && r1.taH >= r1.sideH - 1, 'textarea is at least as tall as the sidebar');
check(small.taH >= small.sideH - 1, 'a small saved height is still floored to the sidebar (never shorter)');
check(layout == null, 'a layout-only height change does NOT overwrite the saved height');
check(resized >= 300, 'a real user resize (mousedown→up) persists the new height');
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
