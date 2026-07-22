// Probe #455 — Track length parser. Opens the parser on a real release, pastes messy
// tracklist text (Bandcamp-style: track numbers on their own lines), verifies the
// editable list extracts durations in order (ignoring numbers/titles), that invalid
// times block Apply and delete/insert re-map, then Applies and checks the track lengths.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const O = 'https://musicbrainz.org';
const REL = '20b03c7d-9e8a-42b9-8a96-bcc9564de034';   // the discussion's example (Copenhagen, no lengths)
const log = (...a) => console.log('[probe-455]', ...a);

const code = await readFile(SCRIPT, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1500, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message.split('\n')[0]));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });
await page.goto(`${O}/release/${REL}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForSelector('#release-editor, form', { timeout: 30000 }).catch(() => {});
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, { timeout: 20000 }).catch(() => {});
if (!await page.evaluate(() => !!window.__apolloEditor)) { log('apollo API not exposed'); await ctx.close(); process.exit(2); }

// 1) pure parser unit checks
const unit = await page.evaluate(() => {
  const A = window.__apolloEditor;
  const messy = "1.\nIntro\n2:07\n2.\nThe Descent\n5:50\n3.\nCopenhagen\n6:30";
  const traps = "Track 12  Year 1999  Disc 2  3:45  12 remixes";
  return {
    messy: A.lpParse(messy).map(x => x.value),
    traps: A.lpParse(traps).map(x => x.value),
    hours: A.lpParse("Long  1:23:45").map(x => x.value),
    validGood: A.lpValid('5:50') && A.lpValid('1:23:45') && A.lpValid('99:45'),
    validBad: !A.lpValid('99:99') && !A.lpValid('1:99:45') && !A.lpValid('1:2'),
  };
});
log('parse messy(bandcamp):', JSON.stringify(unit.messy));
log('parse traps:', JSON.stringify(unit.traps), '| hours:', JSON.stringify(unit.hours));

// 1b) smart extraction from fetched HTML — the tightest container with >= N durations,
//     ignoring nav/footer noise blocks that have fewer.
const extract = await page.evaluate(() => {
  const A = window.__apolloEditor;
  const rows = Array.from({ length: 12 }, (_, i) => `<tr><td>${i + 1}</td><td>Song ${i + 1}</td><td>${i + 2}:${String((i * 5) % 60).padStart(2, '0')}</td></tr>`).join('');
  const html = `<html><body><nav>Home 0:00 Cart 9:99</nav><main><table>${rows}</table></main><footer>2:00 min read · 1:30</footer></body></html>`;
  const text = A.lpExtractFromHtml(html, 12);
  return { vals: A.lpParse(text).map(x => x.value), hasNav: /9:99/.test(text) };
});
log('extract from HTML:', JSON.stringify(extract.vals), '| pulled in nav noise:', extract.hasNav);

// 1c) edit-note stamping
const note = await page.evaluate(() => {
  const A = window.__apolloEditor;
  let ta = document.getElementById('edit-note-text');
  if (!ta) { ta = document.createElement('textarea'); ta.id = 'edit-note-text'; document.body.appendChild(ta); }
  ta.value = 'Existing note.';
  A.lpNoteSource('https://example.bandcamp.com/album/x');
  const once = ta.value;
  A.lpNoteSource('https://example.bandcamp.com/album/x');   // idempotent
  return { text: ta.value, dupd: ta.value !== once };
});
log('edit note after stamp:', JSON.stringify(note.text));

// 2) open the panel — chooser overlays the left textarea beside the list; pick "Enter text", then paste/edit/apply
await page.evaluate(() => window.__apolloEditor.openLengthParser(0));
await page.waitForSelector('#tc-lppop .tc-lp-choose', { timeout: 5000 });
const chooser = await page.evaluate(() => {
  const p = document.getElementById('tc-lppop');
  return {
    opts: [...p.querySelectorAll('.tc-lp-choose .tc-lp-cbtn')].map(b => b.dataset.o),
    hasExtLabel: !!p.querySelector('.tc-lp-choose .tc-lp-clbl'),
    hasFavArea: !!p.querySelector('.tc-lp-choose .tc-lp-favs'),
    listVisibleWithChooser: !!p.querySelector('.tc-lp-list'),   // list stays beside the chooser (#455.2)
    backHiddenAtStart: getComputedStyle(p.querySelector('.tc-lp-back')).display === 'none',   // no back on the initial screen
    noCancelBtn: !p.querySelector('.tc-lp-cancel'),   // #455 r4: Cancel removed (✕ is equivalent)
  };
});
// #455 r4: after choosing a source, a "‹ Sources" back button appears and returns to the chooser
await page.evaluate(() => document.querySelector('#tc-lppop [data-o="text"]').click());
await page.waitForSelector('#tc-lppop .tc-lp-ta', { timeout: 5000 });
const back = await page.evaluate(() => {
  const p = document.getElementById('tc-lppop'), bk = p.querySelector('.tc-lp-back'), ch = p.querySelector('.tc-lp-choose');
  const backShownAfterChoose = getComputedStyle(bk).display !== 'none' && getComputedStyle(ch).display === 'none';
  bk.click();   // go back
  const chooserBackAfterBack = getComputedStyle(ch).display !== 'none' && getComputedStyle(bk).display === 'none';
  p.querySelector('[data-o="text"]').click();   // re-enter text mode for the rest of the probe
  return { backShownAfterChoose, chooserBackAfterBack };
});
const ui = await page.evaluate(async () => {
  const p = document.getElementById('tc-lppop');
  const ta = p.querySelector('.tc-lp-ta'), ok = p.querySelector('.tc-lp-ok');
  const setTA = v => { ta.value = v; ta.dispatchEvent(new Event('input', { bubbles: true })); };
  const rows = () => [...p.querySelectorAll('.tc-lp-row')];
  const vals = () => rows().map(r => r.querySelector('.tc-lp-val').value);
  // paste a blob with the right count for this release (probe reads track count)
  const nT = (window.__apolloEditor.model.tracks || []).filter(t => t.mi === 0).length;
  const blob = Array.from({ length: nT }, (_, i) => `${i + 1}. Track ${i + 1}  ${i + 2}:${String((i * 7) % 60).padStart(2, '0')}`).join('\n');
  setTA(blob);
  const afterParse = vals();
  const okAfterParse = !ok.disabled;
  const noClipButton = !p.querySelector('.tc-lp-clip'), noOutsideDismiss = true;   // #455.5 / #455.6
  // make one invalid → Apply must disable + row flagged red + header badge shows (#455.3)
  const firstVal = p.querySelector('.tc-lp-val'); firstVal.value = '9:99'; firstVal.dispatchEvent(new Event('input', { bubbles: true }));
  const err = p.querySelector('.tc-lp-err');
  const okWhenInvalid = ok.disabled, firstBad = firstVal.classList.contains('bad');
  const badgeShown = getComputedStyle(err).display !== 'none' && /invalid/i.test(err.textContent);
  // #455.7 fixing it must clear the red immediately (no re-render, keeps focus)
  firstVal.value = afterParse[0]; firstVal.dispatchEvent(new Event('input', { bubbles: true }));
  const clearedAfterFix = !firstVal.classList.contains('bad') && !ok.disabled;
  const badgeHidden = getComputedStyle(err).display === 'none';
  // delete row 2 → list shifts up
  const before = vals().length;
  rows()[1].querySelector('.tc-lp-del').click();
  const afterDel = vals().length;
  // insert via a row's + (#455.2 per-row +, inserts below)
  rows()[0].querySelector('.tc-lp-add').click();
  const afterIns = vals().length;
  return { nT, afterParse, okAfterParse, noClipButton, okWhenInvalid, firstBad, badgeShown, clearedAfterFix, badgeHidden, before, afterDel, afterIns };
});
log('panel: parsed', ui.afterParse.length, 'rows for', ui.nT, 'tracks; Apply enabled =', ui.okAfterParse, '; clip-btn removed =', ui.noClipButton);
log('invalid → Apply disabled =', ui.okWhenInvalid, ', flagged =', ui.firstBad, ', cleared-after-fix =', ui.clearedAfterFix, '; delete', ui.before, '→', ui.afterDel, '; insert →', ui.afterIns);

// 3) reset to a clean N-count list and Apply, then read track lengths
const applied = await page.evaluate(async () => {
  const p = document.getElementById('tc-lppop'); const ta = p.querySelector('.tc-lp-ta'), ok = p.querySelector('.tc-lp-ok');
  const nT = (window.__apolloEditor.model.tracks || []).filter(t => t.mi === 0).length;
  const times = Array.from({ length: nT }, (_, i) => `${i + 2}:${String((i * 5 + 3) % 60).padStart(2, '0')}`);
  ta.value = times.map((t, i) => `${i + 1}. Song  ${t}`).join('\n'); ta.dispatchEvent(new Event('input', { bubbles: true }));
  ok.click();
  await new Promise(z => setTimeout(z, 400));
  const med = window.__apolloEditor.model; // read live lengths from the KO model
  const rel = window.__apolloEditor;
  // read back via readTracklist (formattedLength)
  const tl = rel.readTracklist().filter(t => t.mi === 0);
  return { expected: times, got: tl.map(t => t.length), closed: !document.getElementById('tc-lppop') };
});
log('applied expected:', JSON.stringify(applied.expected));
log('applied got:     ', JSON.stringify(applied.got));

let fail = 0; const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(JSON.stringify(unit.messy) === JSON.stringify(['2:07', '5:50', '6:30']), 'bandcamp-shifted paste → 3 durations in order, numbers/titles ignored');
check(JSON.stringify(unit.traps) === JSON.stringify(['3:45']), 'trap text → only the real duration');
check(JSON.stringify(unit.hours) === JSON.stringify(['1:23:45']), 'hours kept as h:mm:ss');
check(unit.validGood && unit.validBad, 'lpValid: m:ss / h:mm:ss valid; 99:99 / 1:99:45 / 1:2 invalid');
check(extract.vals.length === 12 && !extract.hasNav, `smart extraction pulls the 12 tracklist durations, skips nav/footer noise (got ${extract.vals.length}, nav=${extract.hasNav})`);
check(/Existing note\./.test(note.text) && /Track lengths from https:\/\/example\.bandcamp\.com/.test(note.text) && !note.dupd, 'edit note gets the source line, keeps the existing note, idempotent (#455.2)');
check(JSON.stringify(chooser.opts) === JSON.stringify(['text', 'clip']) && chooser.hasExtLabel && chooser.hasFavArea, 'chooser overlays the left column: Enter text / Paste from clipboard buttons + external-link favicon area (#455 r3)');
check(chooser.listVisibleWithChooser, 'the track list stays visible beside the chooser (integrated layout, no separate start window)');
check(chooser.backHiddenAtStart && chooser.noCancelBtn, 'initial screen has no back button; Cancel button removed (#455 r4)');
check(back.backShownAfterChoose && back.chooserBackAfterBack, 'after choosing a source the "‹ Sources" button returns to the chooser (#455 r4)');
check(ui.afterParse.length === ui.nT && ui.okAfterParse, 'panel parsed one row per track, Apply enabled');
check(ui.okWhenInvalid && ui.firstBad, 'an invalid time flags the row and disables Apply');
check(ui.badgeShown, 'an invalid time raises a prominent badge in the header (#455.3)');
check(ui.clearedAfterFix && ui.badgeHidden, 'fixing an invalid time clears the red, hides the badge and re-enables Apply (#455.7)');
check(ui.afterDel === ui.before - 1 && ui.afterIns === ui.afterDel + 1, 'per-row delete removes a row; per-row + inserts one (#455.2)');
check(applied.got.length && applied.expected.every((t, i) => applied.got[i] === t), 'Apply wrote every length to the tracks in order');
check(applied.closed, 'panel closes after Apply');
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
