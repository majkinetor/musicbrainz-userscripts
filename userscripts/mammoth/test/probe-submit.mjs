// Probe #252: Ctrl/Cmd+Enter submits the edit. The submit control differs per page
// (release editor's #enter-edit vs a form's submit button), and it must NOT hijack
// Ctrl+Enter when focus is in some unrelated field.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', 'mammoth.user.js');
const log = (...a) => console.log('[probe-submit]', ...a);
const code = await readFile(SCRIPT, 'utf8');

const ctx = await chromium.launchPersistentContext('', { headless: true, viewport: { width: 1100, height: 800 } });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message));
await page.addInitScript(() => { window.__gm = {}; window.GM_getValue = (k, d) => (k in window.__gm ? window.__gm[k] : d); window.GM_setValue = (k, v) => { window.__gm[k] = v; }; });

let fail = 0; const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const ctrlEnter = sel => page.evaluate(s => { const el = document.querySelector(s); el.focus(); el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true })); }, sel);
async function load(html) {
  await page.goto('about:blank');
  await page.setContent('<!doctype html><html><body>' + html + '</body></html>');
  await page.addScriptTag({ content: code });
  await page.waitForSelector('.mmth-side', { timeout: 10000 });
  await page.evaluate(() => { window.__clicked = null; document.querySelectorAll('button').forEach(b => b.addEventListener('click', e => { e.preventDefault(); window.__clicked = b.id || b.className || b.textContent.trim(); })); });
  await page.waitForTimeout(150);
}

// 1) standard edit form: submit button inside the form
await load('<form><fieldset class="editnote"><div class="row"><label for="en">Edit note:</label><textarea id="en" class="edit-note" rows="3"></textarea></div></fieldset><div class="row no-label buttons"><button type="submit" class="submit positive">Enter edit</button></div></form>');
await ctrlEnter('textarea.edit-note');
let clicked = await page.evaluate(() => window.__clicked);
check(/submit|Enter edit/i.test(clicked || ''), `standard form: Ctrl+Enter clicked the form submit (${clicked})`);

// 2) release-editor style: #enter-edit outside any form
await load('<div id="release-editor"><button id="enter-edit">Enter edit</button></div><form><fieldset class="editnote"><div class="row"><textarea id="en" class="edit-note" rows="3"></textarea></div></fieldset></form>');
await ctrlEnter('textarea.edit-note');
clicked = await page.evaluate(() => window.__clicked);
check(clicked === 'enter-edit', `release editor: Ctrl+Enter clicked #enter-edit (${clicked})`);

// 3) focus guard: an unrelated textarea must NOT trigger submit
await load('<form><fieldset class="editnote"><div class="row"><textarea id="en" class="edit-note" rows="3"></textarea></div></fieldset><button type="submit" class="submit positive">Enter edit</button></form><textarea id="other" rows="3"></textarea>');
await ctrlEnter('#other');
clicked = await page.evaluate(() => window.__clicked);
check(clicked === null, `unrelated field: Ctrl+Enter did NOT submit (${clicked})`);

// 4) disabled submit is skipped (no crash)
await load('<form><fieldset class="editnote"><div class="row"><textarea id="en" class="edit-note" rows="3"></textarea></div></fieldset><button type="submit" class="submit positive" disabled>Enter edit</button></form>');
await ctrlEnter('textarea.edit-note');
clicked = await page.evaluate(() => window.__clicked);
check(clicked === null, `disabled submit: nothing clicked, no error (${clicked})`);

console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
