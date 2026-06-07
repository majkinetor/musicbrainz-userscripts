// Verifies #146: recording cell right-click toggles the copy-to-recording flag,
// proxying the NATIVE update checkbox (so a casing-only diff still offers it),
// with the struck-through original preview and Ctrl(row)/Alt(column) variants.
//
// It manufactures two diffs on linked recordings (without editing track titles,
// which MB would react to by clearing the association):
//   row A — recording name = track name with casing flipped  → casing-only diff
//            (native says "differs", Apollo's ignore-casing would hide it)
//   row B — recording name = clearly different text           → a real diff
//
//   node test/verify-146.mjs [--headed] [MBID]
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const ORIGIN = 'https://musicbrainz.org';
const HEADED = process.argv.includes('--headed');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '51bdb849-5dfc-40c0-9fcb-f49fe7395cc7';
const LOG_DIR = resolve(HERE, 'logs', 'verify-146');

const main = async () => {
  await mkdir(LOG_DIR, { recursive: true });
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1000 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(`${ORIGIN}/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN — re-auth .pw-profile'); await ctx.close(); process.exit(3); }
  await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().some(m => m.tracks().length); } catch { return false; } }, null, { timeout: 120000 });
  await page.addScriptTag({ content: scriptCode });
  await page.waitForTimeout(1500);

  // Go to the Recordings tab via the native step nav anchor.
  await page.evaluate(() => {
    const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#recordings"]');
    if (a) a.click();
  });
  await page.waitForTimeout(800);
  await page.waitForFunction(() => !!document.getElementById('track-recording-assignation'), null, { timeout: 30000 }).catch(() => {});

  // Manufacture diffs on the first two tracks that HAVE a linked recording.
  const setup = await page.evaluate(() => {
    const u = v => (typeof v === 'function' ? v() : v);
    const ed = window.MB.releaseEditor; const rel = u(ed.rootField.release);
    const linked = [];
    u(rel.mediums).forEach(m => u(m.tracks).forEach(t => { const r = u(t.recording); if (r && u(r.gid)) linked.push({ t, r }); }));
    if (linked.length < 1) return { error: 'no linked recordings on this release' };
    const flip = s => [...String(s)].map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('');
    const out = {};
    const recName = e => { const r = u(e.t.recording); return r ? u(r.name) : null; };
    const stillLinked = e => { const r = u(e.t.recording); return !!(r && u(r.gid)); };
    // row A: casing-only — flip the case of the track title
    const a = linked[0]; out.aOrig = u(a.t.name); a.t.name(flip(out.aOrig || 'x'));
    out.aTrackNow = u(a.t.name); out.aRecName = recName(a); out.aStillLinked = stillLinked(a);
    out.aNativeTitleDiff = typeof a.t.titleDiffersFromRecording === 'function' ? !!a.t.titleDiffersFromRecording() : null;
    // row B: real diff
    if (linked[1]) { const b = linked[1]; out.bOrig = u(b.t.name); b.t.name('ZZ Totally Different Title'); out.bStillLinked = stillLinked(b); out.bNativeTitleDiff = !!b.t.titleDiffersFromRecording(); }
    window.__apolloEditor.showRecMirror();
    return out;
  });
  console.log('setup:', JSON.stringify(setup, null, 2));

  // Inspect rendered cell classes + readRecordings raw flags for the two rows.
  const inspect = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#tc-recwrap tbody tr.tc-recrow')];
    const pick = i => { const tr = rows[i]; if (!tr) return null; const tc = tr.querySelector('td.tc-recname'); return { cls: tc.className, html: tc.innerHTML.slice(0, 120), title: tc.title }; };
    const recs = window.__apolloEditor.readRecordings();
    return { rowA: pick(0), rowB: pick(1), rawA: recs[0] && { rawTitleDiff: recs[0].rawTitleDiff, copyTitle: recs[0].copyTitle }, rawB: recs[1] && { rawTitleDiff: recs[1].rawTitleDiff } };
  });
  console.log('inspect:', JSON.stringify(inspect, null, 2));

  // Right-click row A's title cell → should toggle copyTitle on + show strikethrough preview.
  const afterClick = await page.evaluate(() => {
    const u = v => (typeof v === 'function' ? v() : v);
    const tr = document.querySelector('#tc-recwrap tbody tr.tc-recrow'); const tc = tr.querySelector('td.tc-recname');
    tc.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    const ed = window.MB.releaseEditor; const t = u(u(ed.rootField.release).mediums)[0] && u(u(u(ed.rootField.release).mediums)[0].tracks)[0];
    const tc2 = document.querySelector('#tc-recwrap tbody tr.tc-recrow td.tc-recname');
    return { copyTitleNow: typeof t.updateRecordingTitle === 'function' ? !!u(t.updateRecordingTitle) : null, cellHtml: tc2.innerHTML, hasStrike: /tc-rec-orig/.test(tc2.innerHTML), hasArrow: tc2.textContent.includes('→') };
  });
  console.log('afterRightClick:', JSON.stringify(afterClick, null, 2));

  // Clean element screenshot of the recordings table (row A = casing diff now copying
  // with struck original; row B = real diff in red) BEFORE opening the picker.
  await page.locator('#tc-recwrap').screenshot({ path: resolve(LOG_DIR, 'table.png') }).catch(e => console.log('table shot failed:', e.message));

  // Alt+right-click row B title cell → toggle the whole TITLE column (every diffing row).
  const altCol = await page.evaluate(() => {
    const u = v => (typeof v === 'function' ? v() : v);
    const trs = [...document.querySelectorAll('#tc-recwrap tbody tr.tc-recrow')];
    const cellB = trs[1].querySelector('td.tc-recname');
    cellB.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, altKey: true }));
    const recs = window.__apolloEditor.readRecordings();
    return { row0CopyTitle: recs[0].copyTitle, row1CopyTitle: recs[1].copyTitle };
  });
  console.log('afterAltColumn:', JSON.stringify(altCol, null, 2));

  // Picker proxies the checkbox for the casing-only diff (row A).
  const picker = await page.evaluate(() => {
    const tc = document.querySelector('#tc-recwrap tbody tr.tc-recrow td.tc-recname');
    tc.click();   // opens the recording picker
    const ct = document.querySelector('.tc-rpk-ct');
    return { pickerOpen: !!document.querySelector('.tc-rpk-hd'), hasTitleCheckbox: !!ct, checked: ct ? ct.checked : null };
  });
  console.log('pickerProxy:', JSON.stringify(picker, null, 2));

  await page.screenshot({ path: resolve(LOG_DIR, 'recordings.png'), clip: { x: 0, y: 120, width: 1480, height: 480 } }).catch(() => {});
  await writeFile(resolve(LOG_DIR, 'result.json'), JSON.stringify({ setup, inspect, afterClick, altCol, picker }, null, 2));
  console.log('artifacts in', LOG_DIR);
  if (!HEADED) await ctx.close();
};
main().catch(e => { console.error(e); process.exit(1); });
