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

// 2) open the panel, paste, edit-invalid, delete, insert, apply
await page.evaluate(() => window.__apolloEditor.openLengthParser(0));
await page.waitForSelector('#tc-lppop', { timeout: 5000 });
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
  // make one invalid → Apply must disable
  const firstVal = p.querySelector('.tc-lp-val'); firstVal.value = '9:99'; firstVal.dispatchEvent(new Event('input', { bubbles: true }));
  const okWhenInvalid = ok.disabled, firstBad = firstVal.classList.contains('bad');
  // fix it back
  firstVal.value = afterParse[0]; firstVal.dispatchEvent(new Event('input', { bubbles: true }));
  // delete row 2, then the list shifts
  const before = vals().length;
  rows()[1].querySelector('.tc-lp-del').click();
  const afterDel = vals().length;
  // insert at end (last add button)
  const adds = [...p.querySelectorAll('.tc-lp-add')]; adds[adds.length - 1].click();
  const afterIns = vals().length;
  return { nT, afterParse, okAfterParse, okWhenInvalid, firstBad, before, afterDel, afterIns };
});
log('panel: parsed', ui.afterParse.length, 'rows for', ui.nT, 'tracks; Apply enabled =', ui.okAfterParse);
log('invalid → Apply disabled =', ui.okWhenInvalid, ', row flagged =', ui.firstBad, '; delete', ui.before, '→', ui.afterDel, '; insert →', ui.afterIns);

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
check(ui.afterParse.length === ui.nT && ui.okAfterParse, 'panel parsed one row per track, Apply enabled');
check(ui.okWhenInvalid && ui.firstBad, 'an invalid time flags the row and disables Apply');
check(ui.afterDel === ui.before - 1 && ui.afterIns === ui.afterDel + 1, 'delete removes a row; insert adds one');
check(applied.got.length && applied.expected.every((t, i) => applied.got[i] === t), 'Apply wrote every length to the tracks in order');
check(applied.closed, 'panel closes after Apply');
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
