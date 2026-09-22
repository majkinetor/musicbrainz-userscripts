// #597 (majkinetor): "Text Pattern support for individual tracks" — liner
// notes scope credits in the role text itself ("Lead vocals (tracks 2,6,9)"),
// and that clause was parsed, resolved and then silently discarded: the credit
// went on the whole release.
//
// Nothing looked wrong either. Measured before any of this was written:
//
//     "Lead vocals"                ->  vocal
//     "Lead vocals (tracks 2,6,9)" ->  vocal      <- matcher tolerates the suffix
//     "Djembe (track 4)"           ->  djembe
//
// so a run that ignored the clause produced a perfectly plausible result on the
// wrong scope. That is why the tracks column exists and why most of what is
// checked below is about REFUSING to detect — a false positive here credits the
// wrong recording, silently, which is worse than not having the feature.
//
// Per majkinetor's decision on the proposal, this deliberately does NOT add a
// `T` pattern field and does NOT make [,] bracket-aware. A line carrying two
// track lists is split by hand; detection stands down and says so.
//
// Track matching runs against SYNTHETIC row sets, so a 9-track CD, a vinyl and
// a 2-CD set can all be checked without needing three sandbox releases. The
// end-to-end half uses the real editor and never submits: every POST to /edit
// is aborted and asserted zero.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.GT_SRC || resolve(HERE, '..', 'group_therapy.user.js'), 'utf8');

const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';   // 3 tracks, one medium
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1100 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Group Therapy', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
let posts = 0;
await page.route(() => true, route => {
  const r = route.request();
  if (r.method() === 'POST' && /\/edit/.test(r.url())) { posts++; return route.abort(); }
  return route.continue();
});
for (let a = 1; ; a++) {
  try { await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/edit-relationships`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 3) throw e; console.log('goto retry ' + a); await page.waitForTimeout(4000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(4000);
await page.addScriptTag({ content: code });
await page.waitForTimeout(1500);
ck(await page.evaluate(() => !!(window.__groupTherapy && window.__groupTherapy.txpDetectTracks)), 'txpDetectTracks is exported');

// Synthetic row sets, shaped exactly like txpTrackRows() output.
await page.evaluate(() => {
  const mk = (nums, medium, from) => nums.map((n, i) => ({ num: n, medium, ordinal: from + i, title: 'T' + n, rec: { gid: 'g' + medium + '-' + n } }));
  window.__fix = {
    cd9: mk(['1', '2', '3', '4', '5', '6', '7', '8', '9'], 1, 1),
    vinyl: mk(['A1', 'A2', 'A3', 'B1', 'B2', 'B3'], 1, 1),
    twoCd: mk(['1', '2', '3'], 1, 1).concat(mk(['1', '2', '3'], 2, 4)),
  };
});
// ⚠ returns the string 'THREW' rather than letting the exception out: against a
// build that has no txpDetectTracks at all, an uncaught TypeError would abort
// the run on the first case and report nothing about the rest — which is how a
// previous test managed to "fail" without saying anything useful.
const det = (text, fixture) => page.evaluate(([t, f]) => {
  try {
    const d = window.__groupTherapy.txpDetectTracks(t, window.__fix[f]);
    if (!d) return null;
    if (d.ambiguous) return { ambiguous: d.ambiguous };
    return { spec: d.spec, clean: d.clean, nums: d.targets.map(x => x.num) };
  } catch (e) { return 'THREW: ' + e.message; }
}, [text, fixture]);
const show = (label, got) => console.log('   ' + label.padEnd(52) + ' -> ' + JSON.stringify(got));

// ── 1. it detects what it should ───────────────────────────────────────────
console.log('\nDETECTS:');
let g = await det('Lead vocals (tracks 2,6,9)', 'cd9'); show('Lead vocals (tracks 2,6,9)', g);
ck(!!g && g.spec === '2,6,9' && JSON.stringify(g.nums) === '["2","6","9"]', 'the issue\'s own line picks tracks 2, 6, 9');
ck(!!g && g.clean === 'Lead vocals', 'and the clause is REMOVED from the role text, so role matching sees "Lead vocals"');

g = await det('Djembe (track 4)', 'cd9'); show('Djembe (track 4)', g);
ck(!!g && JSON.stringify(g.nums) === '["4"]' && g.clean === 'Djembe', 'the singular "(track 4)" works too');

g = await det('Piano (trk 3)', 'cd9'); show('Piano (trk 3)', g);
ck(!!g && JSON.stringify(g.nums) === '["3"]', 'abbreviated "(trk 3)"');

g = await det('Bass on tracks 2, 6 and 9', 'cd9'); show('Bass on tracks 2, 6 and 9', g);
ck(!!g && JSON.stringify(g.nums) === '["2","6","9"]' && g.clean === 'Bass', 'unbracketed trailing form, with "and" for the last one');

g = await det('Guitar [tracks 1-3]', 'cd9'); show('Guitar [tracks 1-3]', g);
ck(!!g && JSON.stringify(g.nums) === '["1","2","3"]', 'square brackets and a range');

g = await det('Backing vocals (2,6,9)', 'cd9'); show('Backing vocals (2,6,9)', g);
ck(!!g && JSON.stringify(g.nums) === '["2","6","9"]', 'a BARE multi-number list, with no "track" word at all');

g = await det('Percussion (A1, B2)', 'vinyl'); show('Percussion (A1, B2) [vinyl]', g);
ck(!!g && JSON.stringify(g.nums) === '["A1","B2"]', 'vinyl positions, bare');

// ── 2. it refuses when it should — the half that matters ───────────────────
console.log('\nREFUSES:');
for (const [text, fixture, why] of [
  ['Guitar', 'cd9', 'a plain role with nothing in it'],
  ['Mastering (2003)', 'cd9', 'a YEAR — 2003 is not a track on this release, so the clause is not a track list'],
  ['Guitar (1)', 'cd9', 'a bare single number is a footnote marker as often as a track, so it needs company'],
  ['Drums (drum set, congas)', 'cd9', 'a parenthesised instrument detail'],
  ['Vocals (Bob)', 'cd9', 'a credited-as name'],
  ['Engineer (tracks 10,11)', 'cd9', 'a track clause naming tracks this release does not have'],
  ['Guitar (tracks 1,2,99)', 'cd9', 'ONE bad number in an otherwise good list rejects the whole clause'],
  ['Backing vocals (2,6,9)', 'vinyl', 'bare numbers that match no vinyl position and no ordinal 6/9'],
]) {
  const got = await det(text, fixture); show(text + '  [' + fixture + ']', got);
  ck(got === null, why);
}

// ── 3. more than one list on a line: stand down, do not guess ──────────────
console.log('\nAMBIGUOUS:');
g = await det('Mandolin (tracks 1,2,4,7,8), Guitar (tracks 3,5,6,8,9)', 'cd9');
show('Martin Cradick\'s line, unsplit', g);
ck(!!g && g.ambiguous === 2,
  'two track lists on one line is reported as ambiguous, not silently resolved to one of them');

// ── 4. the ordinal fallback (vinyl) ────────────────────────────────────────
console.log('\nORDINAL FALLBACK:');
const mt = (spec, fixture) => page.evaluate(([s, f]) => {
  try { return window.__groupTherapy.txpMatchTracks(s, window.__fix[f]).map(x => x.num); }
  catch (e) { return 'THREW: ' + e.message; }
}, [spec, fixture]);
let m = await mt('4', 'vinyl'); show('txpMatchTracks("4", vinyl)', m);
ck(JSON.stringify(m) === '["B1"]', 'a bare 4 on a vinyl means the 4th track — B1 — since no position is literally "4"');
m = await mt('1,2,4', 'vinyl'); show('txpMatchTracks("1,2,4", vinyl)', m);
ck(JSON.stringify(m) === '["A1","A2","B1"]', 'and a whole liner-note list maps across the side break');
m = await mt('A1', 'vinyl'); show('txpMatchTracks("A1", vinyl)', m);
ck(JSON.stringify(m) === '["A1"]', 'a literal position still wins');
m = await mt('3', 'twoCd'); show('txpMatchTracks("3", 2-CD)', m);
ck(JSON.stringify(m) === '["3","3"]', 'UNCHANGED: on a 2-CD set a literal "3" still names both discs\' track 3, never the ordinal');
m = await mt('2:2', 'twoCd'); show('txpMatchTracks("2:2", 2-CD)', m);
ck(JSON.stringify(m) === '["2"]', 'and the medium-qualified form is untouched');

// ── 5. end to end: the column, and Apply putting credits on the right row ──
console.log('\nEND TO END (real editor, 3 tracks):');
await page.evaluate(() => window.__groupTherapy.openTextParser());
await page.waitForSelector('.gt-tp', { timeout: 15000 });
await page.evaluate(() => {
  const set = (el, v) => { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  set(document.querySelector('.gt-tp-ta'), 'Mbossi Rene: Guitar\nSeckou Keita: Djembe (track 2)');
  set(document.querySelector('.gt-tp-pat'), 'E: R');
});
await page.waitForTimeout(3000);
const cells = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-tbl tbody tr')].map(tr => ({
  role: (tr.querySelectorAll('td')[3] || {}).innerText,
  tracks: ((tr.querySelector('.gt-tp-trk') || {}).innerText || '').trim(),
})));
console.log('   rows: ' + JSON.stringify(cells));
ck(cells.length === 2, 'two rows parsed');
ck(!!cells[1] && cells[1].tracks === '2', 'the tracks column shows "2" for the "(track 2)" row');
ck(!!cells[1] && !/track/i.test(cells[1].role), 'and its role cell no longer carries the clause — ' + JSON.stringify(cells[1] && cells[1].role));
ck(!!cells[0] && cells[0].tracks === '', 'the unqualified row claims no tracks — it follows Scope');

const hdr = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-tbl thead th')].map(t => t.textContent.trim()));
ck(hdr.includes('tracks'), 'the table has a tracks column — ' + JSON.stringify(hdr));

// Turning detection off has to restore the old behaviour exactly.
// ⚠ guarded: on a build without the control, selectOption throws a TimeoutError
// that kills the process before the summary is printed — so the remaining
// checks report nothing at all and the run looks like a crash rather than a
// list of failures. Assert the control exists, then use it.
const hasDet = await page.evaluate(() => !!document.querySelector('.gt-tp-det-sel'));
ck(hasDet, 'the Tracks: auto/off control is in the scope pill');
if (hasDet) {
  await page.selectOption('.gt-tp-det-sel', 'off');
  await page.waitForTimeout(2500);
  const offCells = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-tbl tbody tr')].map(tr => ({
    role: (tr.querySelectorAll('td')[3] || {}).innerText,
    tracks: ((tr.querySelector('.gt-tp-trk') || {}).innerText || '').trim(),
  })));
  console.log('   Tracks: off -> ' + JSON.stringify(offCells));
  ck(offCells.every(c => c.tracks === ''), 'with Tracks: off nothing claims a track');
  ck(!!offCells[1] && /track 2/i.test(offCells[1].role), 'and the clause is back in the role text, exactly as before #597');
  await page.selectOption('.gt-tp-det-sel', 'auto');
  await page.waitForTimeout(2500);
}

// ── 6. the other half of the issue: vertical move by track spec ────────────
// majkinetor: "Vertical move could also have option to paste tracks or specify
// them as in Text Pattern scope as selecting checkboxes is slow."
console.log('\nVERTICAL MOVE (⬆ release → recordings):');
await page.evaluate(() => { const x = document.querySelector('.gt-tp-x, .gt-cons-x'); if (x) x.click(); });
await page.waitForTimeout(500);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => /⬆/.test(x.textContent || ''));
  if (b) b.click();
});
await page.waitForTimeout(800);
const upMenu = await page.evaluate(() => {
  const m = document.querySelector('.gt-menu');
  return m ? { hdr: (m.querySelector('.gt-hdr') || {}).textContent || '', hasInput: !!m.querySelector('.gt-mi-in'),
    info: (m.querySelector('.gt-mi-ininfo') || {}).textContent || '' } : null;
});
console.log('   ⬆ menu: ' + JSON.stringify(upMenu));
ck(!!upMenu, 'the ⬆ menu opens');
// The sandbox release may legitimately have no release-level credits to push
// down; the track field is only offered on the menu that can actually copy.
if (upMenu && upMenu.hasInput) {
  ck(/all 3 recordings|selected recording/.test(upMenu.info), 'it opens showing where a copy would go now — ' + JSON.stringify(upMenu.info));
  const typed = await page.evaluate(() => {
    const inp = document.querySelector('.gt-menu .gt-mi-in');
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(inp), 'value').set;
    set.call(inp, '1,3'); inp.dispatchEvent(new Event('input', { bubbles: true }));
    const m = document.querySelector('.gt-menu');
    return { info: (m.querySelector('.gt-mi-ininfo') || {}).textContent || '', hdr: (m.querySelector('.gt-hdr') || {}).textContent || '' };
  });
  console.log('   after typing "1,3": ' + JSON.stringify(typed));
  ck(/2 tracks \(1, 3\)/.test(typed.info), 'typing a spec re-targets it live, and says exactly which tracks — ' + JSON.stringify(typed.info));
  ck(/2 tracks \(1, 3\)/.test(typed.hdr), 'and the menu header follows too — ' + JSON.stringify(typed.hdr));
  const bad = await page.evaluate(() => {
    const inp = document.querySelector('.gt-menu .gt-mi-in');
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(inp), 'value').set.call(inp, '77');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    const i = document.querySelector('.gt-menu .gt-mi-ininfo');
    return { text: i.textContent, warn: /warn/.test(i.style.color) || i.style.color !== '' };
  });
  console.log('   after typing "77": ' + JSON.stringify(bad));
  ck(/nothing matched/.test(bad.text), 'a spec matching no track says so rather than silently copying everywhere');
} else {
  console.log('   (no release-level credits on this release — the field is only on the actionable menu)');
}
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

console.log('\nVERTICAL MOVE (⬇ recordings → release):');
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => /⬇/.test(x.textContent || ''));
  if (b) b.click();
});
await page.waitForTimeout(800);
const downMenu = await page.evaluate(() => {
  const m = document.querySelector('.gt-menu');
  return m ? { hdr: (m.querySelector('.gt-hdr') || {}).textContent || '', hasInput: !!m.querySelector('.gt-mi-in'),
    info: (m.querySelector('.gt-mi-ininfo') || {}).textContent || '' } : null;
});
console.log('   ⬇ menu: ' + JSON.stringify(downMenu));
ck(!!downMenu && downMenu.hasInput, 'the ⬇ menu offers the same track field, even when there is nothing to collect');
ck(!!downMenu && /all 3 recordings/.test(downMenu.info),
  'and blank means ALL tracks there — ⬇ never used the tick boxes, so it must not start now — ' + JSON.stringify(downMenu && downMenu.info));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

ck(posts === 0, `nothing was submitted (${posts} POSTs to /edit)`);
ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('\nFAILURES: ' + fail) : '\nALL PASS');
process.exit(fail ? 1 : 0);
