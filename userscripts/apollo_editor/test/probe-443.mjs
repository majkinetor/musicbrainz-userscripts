// Probe #443 — Ctrl+Alt+right-click on a recordings-tab cell must toggle the copy on
// the WHOLE SIDE (both Title and Artist columns, every eligible row), not just the row
// (Ctrl used to win over Alt). Opens the reported release, injects Apollo, shows the
// recordings mirror, and dispatches a Ctrl+Alt contextmenu on a recording-side cell —
// asserting every eligible recording cell flips to the copy state (td.tc-copy).
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const O = 'https://musicbrainz.org';
const REL = '2a9adcf7-c60b-4db9-9625-e4b87baffca1';
const log = (...a) => console.log('[probe-443]', ...a);

const code = await readFile(SCRIPT, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => { errs.push(e.message); log('[pageerror]', e.message); });
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });
await page.goto(`${O}/release/${REL}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForSelector('#release-editor, form', { timeout: 30000 }).catch(() => {});
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, { timeout: 20000 }).catch(() => {});
if (!await page.evaluate(() => !!window.__apolloEditor)) { log('apollo API not exposed'); await ctx.close(); process.exit(2); }

// This release currently has no track↔recording diffs, so induce a few (rename some
// tracks) to give the copy feature eligible cells — a real model edit, never submitted.
const induced = await page.evaluate(() => {
  const rel = window.MB && MB.releaseEditor && MB.releaseEditor.rootField && MB.releaseEditor.rootField.release && MB.releaseEditor.rootField.release();
  if (!rel) return { err: 'no MB release model' };
  let n = 0;
  for (const med of rel.mediums()) { for (const t of med.tracks()) { const rec = typeof t.recording === 'function' ? t.recording() : null; if (rec && n < 3) { try { t.name((t.name() || '') + ' ZZ'); n++; } catch (e) {} } } }
  return { induced: n };
});
log('induced diffs:', JSON.stringify(induced));

// open the recordings mirror and let it match
await page.evaluate(async () => { try { window.__apolloEditor.showRecMirror(); } catch (e) {} });
await page.waitForSelector('.tc-rectbl tr.tc-recrow', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1800);

const r = await page.evaluate(async () => {
  const sel = s => [...document.querySelectorAll(s)];
  const eligibleBefore = sel('.tc-rectbl td.tc-recname.tc-diff, .tc-rectbl td.tc-recartist.tc-diff').length;
  // pick a recording cell to right-click: prefer a diffing one, else any recording title cell
  // rerenderRec rebuilds the table each gesture, so re-query the target every time
  const fire = (ctrl, alt) => {
    const t = document.querySelector('.tc-rectbl td.tc-recname.tc-diff, .tc-rectbl td.tc-recartist.tc-diff')
           || document.querySelector('.tc-rectbl td.tc-recname.tc-copy, .tc-rectbl td.tc-recartist.tc-copy')
           || document.querySelector('.tc-rectbl td.tc-recname');
    if (!t) return false;
    t.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, ctrlKey: ctrl, altKey: alt }));   // handler preventDefaults → return value is not "handled"
    return true;
  };
  if (!fire(true, true)) return { eligibleBefore, err: 'no recording cell' };   // Ctrl+Alt = whole side ON
  await new Promise(z => setTimeout(z, 400));
  const copyAfterOn = sel('.tc-rectbl td.tc-recname.tc-copy, .tc-rectbl td.tc-recartist.tc-copy').length;
  const rowsWithCopy = new Set(sel('.tc-rectbl td.tc-copy').map(td => td.closest('tr').dataset.mi + '.' + td.closest('tr').dataset.ti)).size;
  const titleCopies = sel('.tc-rectbl td.tc-recname.tc-copy').length;
  const artistCopies = sel('.tc-rectbl td.tc-recartist.tc-copy').length;
  fire(true, true);                                  // Ctrl+Alt again = whole side OFF (toggle)
  await new Promise(z => setTimeout(z, 400));
  const copyAfterOff = sel('.tc-rectbl td.tc-recname.tc-copy, .tc-rectbl td.tc-recartist.tc-copy').length;
  return { eligibleBefore, copyAfterOn, copyAfterOff, rowsWithCopy, titleCopies, artistCopies };
});
log('eligible diffs:', r.eligibleBefore, '| after Ctrl+Alt ON:', r.copyAfterOn, `(title ${r.titleCopies}, artist ${r.artistCopies}, ${r.rowsWithCopy} rows)`, '| after toggle OFF:', r.copyAfterOff);

let fail = 0; const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(errs.length === 0, 'no page errors during the gesture');
check(r.eligibleBefore > 0, `release has recording diffs to copy (${r.eligibleBefore})`);
check(r.copyAfterOn === r.eligibleBefore, `Ctrl+Alt turns copy ON for EVERY eligible cell — whole side (${r.copyAfterOn}/${r.eligibleBefore})`);
check(r.copyAfterOff === 0, `a second Ctrl+Alt toggles the whole side back OFF (${r.copyAfterOff})`);
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
