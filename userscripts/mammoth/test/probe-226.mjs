// Probe #226 — undo after Mammoth sets a note.
// Runs against a local minimal edit-note form (no MB login needed — the fix is
// about preserving the textarea's native undo stack). Types original text via
// real keystrokes, inserts a saved note via Mammoth (replace), presses Ctrl+Z
// and asserts the field returns to the original; Ctrl+Y redoes the note.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', 'mammoth.user.js');
const log = (...a) => console.log('[probe-226]', ...a);

const code = await readFile(SCRIPT, 'utf8');
const ctx = await chromium.launchPersistentContext('', { headless: true, viewport: { width: 1200, height: 800 } });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message));
await page.addInitScript(() => {
  window.__gm = {};
  window.GM_getValue = (k, d) => (k in window.__gm ? window.__gm[k] : d);
  window.GM_setValue = (k, v) => { window.__gm[k] = v; };
});
await page.goto('about:blank');
await page.setContent('<!doctype html><html><body><form><fieldset class="editnote"><div class="row"><label for="en">Edit note:</label><textarea id="en" class="edit-note" rows="6" cols="80"></textarea></div></fieldset><button type="submit">Enter edit</button></form></body></html>');
await page.addScriptTag({ content: code });
await page.waitForSelector('.mmth-side', { timeout: 10000 });
log('sidebar mounted:', await page.evaluate(() => !!document.querySelector('.mmth-side')));

const ev = fn => page.evaluate(fn);
const taVal = () => ev(() => document.querySelector('textarea.edit-note').value);
const TA = 'textarea.edit-note';

// seed a saved note so there's a row to click
await ev(() => { const ta = document.querySelector('textarea.edit-note'); ta.value = 'Imported from Discogs — see release link'; });
await page.evaluate(() => document.querySelector('button.mmth-fb[title="Save current edit note"]').click());
await page.waitForTimeout(60);
// clear, then TYPE the original via real keystrokes so it enters the undo stack
await ev(() => { const ta = document.querySelector('textarea.edit-note'); ta.value = ''; ta.focus(); });
await page.click(TA);
await page.keyboard.type('ORIGINAL TEXT');
const original = await taVal();
log('typed original:', JSON.stringify(original));

// Mammoth inserts the saved note (default action = replace)
await page.evaluate(() => document.querySelector('.mmth-side .mmth-row').click());
await page.waitForTimeout(60);
const afterInsert = await taVal();
log('after Mammoth insert:', JSON.stringify(afterInsert));

// Ctrl+Z should restore the original typed text
await page.click(TA);
await page.keyboard.press('Control+z');
await page.waitForTimeout(60);
const afterUndo = await taVal();
log('after Ctrl+Z:', JSON.stringify(afterUndo));

// Ctrl+Y (redo) should bring the note back
await page.keyboard.press('Control+y');
await page.waitForTimeout(60);
const afterRedo = await taVal();
log('after Ctrl+Y:', JSON.stringify(afterRedo));

let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  : ' : 'FAIL: ') + msg); if (!cond) fail++; };
check(afterInsert.includes('Imported from Discogs') && afterInsert !== original, 'note replaced the field');
check(afterUndo === original, 'Ctrl+Z restored the original typed text');
check(afterRedo.includes('Imported from Discogs'), 'Ctrl+Y redid the note insertion');
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
