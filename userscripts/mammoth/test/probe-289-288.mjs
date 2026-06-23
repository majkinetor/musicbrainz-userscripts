// #289: shift-click a saved note → sets the note AND submits the edit.
// #288: foreign edit-note error/warning <p>s inserted into .mmth-wrap stack on
//       their own full-width lines (warning above, invalid below) instead of
//       being squished beside the field.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'mammoth.user.js'), 'utf8');

const ctx = await chromium.launchPersistentContext('', { headless: true, viewport: { width: 1100, height: 800 } });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));
// seed one saved note so it renders as a row
await page.addInitScript(() => {
  window.__gm = { 'mammoth:data': JSON.stringify({ saved: [{ id: 'n1', text: 'Same versions, confirmed.' }], history: [] }) };
  window.GM_getValue = (k, d) => (k in window.__gm ? window.__gm[k] : d);
  window.GM_setValue = (k, v) => { window.__gm[k] = v; };
});
let fail = 0; const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
async function load(html) {
  await page.goto('about:blank');
  await page.setContent('<!doctype html><html><body>' + html + '</body></html>');
  await page.addScriptTag({ content: code });
  await page.waitForSelector('.mmth-side', { timeout: 10000 });
  await page.waitForTimeout(150);
}

// ── #289: shift-click sets + submits ────────────────────────────────────────
await load('<form><fieldset class="editnote"><div class="row"><label for="en">Edit note:</label><textarea id="en" class="edit-note" rows="3"></textarea></div></fieldset><div class="row buttons"><button type="submit" class="submit positive">Enter edit</button></div></form>');
await page.evaluate(() => { window.__clicked = null; document.querySelectorAll('button').forEach(b => b.addEventListener('click', e => { e.preventDefault(); if (!b.closest('.mmth-side,.mmth-pop')) window.__clicked = (b.className || b.textContent).trim(); })); });
const r289 = await page.evaluate(() => {
  const row = document.querySelector('.mmth-list .mmth-row');
  if (!row) return { err: 'no saved-note row' };
  row.dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true, cancelable: true }));
  return { val: document.querySelector('textarea.edit-note').value, clicked: window.__clicked, title: row.title };
});
check(!r289.err, '#289 saved-note row present');
check(r289.val === 'Same versions, confirmed.', `#289 shift-click set the note (${JSON.stringify(r289.val)})`);
check(/submit|Enter edit/i.test(r289.clicked || ''), `#289 shift-click submitted the edit (${r289.clicked})`);
check(/shift-click: set \+ submit/.test(r289.title || ''), '#289 tooltip documents shift-click');
// plain click must NOT submit
await page.evaluate(() => { window.__clicked = null; document.querySelector('textarea.edit-note').value = ''; document.querySelector('.mmth-list .mmth-row').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
check(await page.evaluate(() => window.__clicked) === null, '#289 plain click does NOT submit');

// ── #288: foreign error <p>s stack full-width (not beside the field) ────────
await load('<form><fieldset class="editnote"><div class="row"><label for="en2">Edit note:</label><textarea id="en2" class="edit-note" rows="5"></textarea></div></fieldset></form>');
const r288 = await page.evaluate(() => {
  const ta = document.querySelector('textarea.edit-note');
  const wrap = ta.closest('.mmth-wrap');
  // simulate MB / MERGE HELPOR inserting siblings of the textarea (inside the wrap)
  const warn = document.createElement('p'); warn.className = 'error'; warn.textContent = 'Merging recordings is destructive…';
  const bad = document.createElement('p'); bad.className = 'error invalid'; bad.textContent = 'Your edit note seems to have no actual content.';
  wrap.insertBefore(warn, ta);
  wrap.insertBefore(bad, ta.nextSibling);
  const R = el => el.getBoundingClientRect();
  const w = R(wrap), t = R(ta), wa = R(warn), ba = R(bad);
  return {
    wrapW: Math.round(w.width), taW: Math.round(t.width),
    warnFull: wa.width > w.width * 0.9, badFull: ba.width > w.width * 0.9,
    warnAbove: wa.bottom <= t.top + 1, badBelow: ba.top >= t.bottom - 1,
    warnBeside: wa.right <= t.left + 1 || wa.left >= t.right - 1,
  };
});
check(r288.warnFull, `#288 warning spans full width (own line), not beside the field`);
check(r288.badFull, `#288 invalid-note error spans full width (own line)`);
check(r288.warnAbove, '#288 warning sits ABOVE the field');
check(r288.badBelow, '#288 invalid error sits BELOW the field');
check(!r288.warnBeside, '#288 warning is NOT beside the field');

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
