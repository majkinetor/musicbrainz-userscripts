// #615 (majkinetor): "Merge all or subset of mediums (keep only one and move tracks to
// it and reset # on it)" / "Split 1 medium on track (add medium, move tracks to it and
// reset # on new one)".
//
// REAL end-to-end on test.musicbrainz.org (the sanctioned sandbox), on a release made by
// test/fixture-615-multimedium.mjs (3 mediums: 2+2+3). Through Apollo's own toolbar:
//   1. Merge mediums (all ticked) → submit → MB has ONE medium, 7 tracks numbered 1..7,
//      each still on its ORIGINAL recording, in order.
//   2. Split medium at track 5 → submit → MB has two mediums (4 + 3), numbered from 1,
//      same recordings.
// The recordings are read back from MB's web service after each submit — nothing is
// taken on the editor's word. Usage: node test/verify-615-merge-split-mediums.mjs <release-mbid>
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.APOLLO_SRC || resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
const REL = process.argv[2];
if (!/^[0-9a-f-]{36}$/.test(REL || '')) { console.log('usage: node test/verify-615-merge-split-mediums.mjs <sandbox release mbid>'); process.exit(2); }
const ORIGIN = 'https://test.musicbrainz.org';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const UA = { 'User-Agent': 'mb-userscripts-test/1.0 ( https://github.com/majkinetor/musicbrainz-userscripts )', Accept: 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function mbRelease() {
  for (let a = 0; a < 6; a++) {
    const r = await fetch(`${ORIGIN}/ws/2/release/${REL}?inc=recordings&fmt=json&_=${Date.now()}`, { headers: UA });
    if (r.ok) { const j = await r.json(); return j.media.map(m => ({ pos: m.position, tracks: m.tracks.map(t => ({ num: t.number, pos: t.position, title: t.title, rec: t.recording.id })) })); }
    await sleep(1500 * (a + 1));
  }
  throw new Error('ws/2 read failed');
}
const shape = media => media.map(m => m.tracks.length).join('+');
// MB applies "Edit medium" at once but a normal account's "Remove medium" waits for votes —
// the same as doing it by hand. So the removals are checked as OPEN edits on the release.
// (fetched from inside the browser page: MB's HTML pages sit behind a bot check for plain HTTP clients)
async function openRemoveMediumEdits() {
  return page.evaluate(async rel => {
    const html = await fetch(`/release/${rel}/open_edits`).then(r => r.ok ? r.text() : '').catch(() => '');
    return (html.match(/Remove medium/g) || []).length;
  }, REL);
}

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: !process.argv.includes('--headed'), viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_info = { script: { name: 'Apollo Editor', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));

async function openEditor() {
  for (let a = 1; ; a++) {
    try { await page.goto(`${ORIGIN}/release/${REL}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 4) throw e; await sleep(5000); }
  }
  if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForFunction(() => window.MB && MB.releaseEditor && MB.releaseEditor.rootField && MB.releaseEditor.rootField.release(), null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => window.__apolloEditor, null, { timeout: 20000 });
  await page.evaluate(() => { const a = [...document.querySelectorAll('a')].find(x => /^#tracklist$/.test(x.getAttribute('href') || '') || x.textContent.trim() === 'Tracklist'); if (a) a.click(); });
  await page.waitForSelector('.tc-tools, #tc-bar, .tc-toolbtns', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
}
// pick a tool the way the Tools menu does, then click its trigger (icon/name) in the toolbar
async function runTool(act, setup) {
  await page.evaluate(a => window.__apolloEditor.pickTool(a), act);
  await page.waitForSelector(`.tc-opt[data-tool="${act}"] .tc-opttrig`, { timeout: 15000 });
  if (setup) await setup();
  const box = await page.evaluate(a => { const g = document.querySelector(`.tc-opt[data-tool="${a}"]`); g.scrollIntoView({ block: 'center' }); const r = g.getBoundingClientRect(); return { x: Math.max(0, r.x - 6), y: Math.max(0, r.y - 6), width: r.width + 12, height: r.height + 12 }; }, act);
  await page.screenshot({ path: join(tmpdir(), `615-${act}-params.png`), clip: box });
  await page.click(`.tc-opt[data-tool="${act}"] .tc-opttrig`);
}
const editorMedia = () => page.evaluate(() => MB.releaseEditor.rootField.release().mediums().map(m => ({ pos: m.position(), tracks: m.tracks().map(t => ({ num: String(t.number()), title: t.name(), rec: t.recording() && !t.hasNewRecording() ? t.recording().gid : null, id: t.id || null })) })));
async function submit(label) {
  const ok = await page.evaluate(() => MB.releaseEditor.allowsSubmission());
  ck(ok, `${label}: MB allows submitting the edits`);
  if (!ok) return false;
  const edits = await page.evaluate(() => MB.releaseEditor.allEdits().map(e => e.edit_type));
  console.log(`${label}: edit types ${JSON.stringify(edits)}`);
  await page.evaluate(() => MB.releaseEditor.submitEdits());
  await page.waitForURL(u => !/\/edit$/.test(u.pathname), { timeout: 120000 });
  await page.waitForTimeout(3000);
  return true;
}

// ── 0. the fixture as MB has it ───────────────────────────────────────────────
const before = await mbRelease();
const recOrder = before.flatMap(m => m.tracks.map(t => t.rec));
console.log('before:', shape(before), JSON.stringify(before.map(m => m.tracks.map(t => t.title.split(' ')[0]))));
ck(before.length >= 2, `fixture has several mediums (${shape(before)})`);

// ── 1. Merge (all mediums ticked) ─────────────────────────────────────────────
await openEditor();
await runTool('mergemed');
await page.waitForFunction(() => MB.releaseEditor.rootField.release().mediums().length === 1, null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(1500);
let ed = await editorMedia();
console.log('editor after merge:', JSON.stringify(ed.map(m => m.tracks.map(t => t.num + ':' + t.title.split(' ')[0]))));
ck(ed.length === 1, `editor: one medium left (${ed.length})`);
ck(ed[0] && ed[0].tracks.length === recOrder.length, `editor: all ${recOrder.length} tracks on it (${ed[0] && ed[0].tracks.length})`);
ck(ed[0] && ed[0].tracks.every((t, i) => t.num === String(i + 1)), 'editor: numbers reset 1..N');
ck(ed[0] && JSON.stringify(ed[0].tracks.map(t => t.rec)) === JSON.stringify(recOrder), 'editor: every track still on its original recording, in order');
const apolloRows = await page.evaluate(() => document.querySelectorAll('.tc-mirror tbody tr').length);
ck(apolloRows >= recOrder.length, `Apollo re-rendered the merged tracklist (${apolloRows} rows)`);
if (await submit('merge')) {
  const after = await mbRelease();
  console.log('MB after merge:', shape(after), JSON.stringify(after.map(m => m.tracks.map(t => t.num + ':' + t.title.split(' ')[0]))));
  ck(after[0].tracks.length === recOrder.length && after[0].tracks.every((t, i) => t.num === String(i + 1)), `MB: medium 1 has all ${recOrder.length} tracks, numbered 1..N`);
  ck(JSON.stringify(after[0].tracks.map(t => t.rec)) === JSON.stringify(recOrder), 'MB: medium 1 is on the SAME recordings, in the same order (none new, none lost)');
  const removals = await openRemoveMediumEdits();
  console.log(`MB: ${after.length - 1} emptied medium(s) still listed; open "Remove medium" edits on the release: ${removals}`);
  ck(after.length === 1 || removals >= after.length - 1, `MB: every merged-away medium is removed or has an open "Remove medium" edit (${removals} open)`);
}

// ── 2. Split at track 5 ───────────────────────────────────────────────────────
const mid = await mbRelease();
if (mid[0].tracks.length >= 5) {   // medium 1 (other mediums may still be listed, pending removal)
  await openEditor();
  await runTool('splitmed', async () => { /* by VALUE (track index): a bare '4' also matches the LABEL "4" (index 3) first */ await page.selectOption('.tc-opt[data-tool="splitmed"] .tc-spat', { value: '4' }); });
  await page.waitForFunction(() => MB.releaseEditor.rootField.release().mediums().length === 2, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  ed = await editorMedia();
  console.log('editor after split:', JSON.stringify(ed.map(m => m.tracks.map(t => t.num + ':' + t.title.split(' ')[0]))));
  const n1 = mid.length;   // mediums before the split
  ck(ed.length === n1 + 1 && ed[0].tracks.length === 4 && ed[1].tracks.length === recOrder.length - 4, `editor: medium 1 split into 4 + ${recOrder.length - 4} (${ed.map(m => m.tracks.length).join('+')})`);
  ck(ed[1] && ed[1].pos === 2 && ed[1].tracks.every((t, i) => t.num === String(i + 1)), 'editor: new medium is #2, numbered from 1');
  ck(ed.every((m, i) => m.pos === i + 1), `editor: medium positions stay 1..N after the insert (${ed.map(m => m.pos).join(',')})`);
  ck(JSON.stringify(ed.slice(0, 2).flatMap(m => m.tracks.map(t => t.rec))) === JSON.stringify(recOrder), 'editor: recordings kept, in order');
  if (await submit('split')) {
    const after = await mbRelease();
    console.log('MB after split:', shape(after), JSON.stringify(after.map(m => m.tracks.map(t => t.num + ':' + t.title.split(' ')[0]))));
    ck(after[0].tracks.length === 4 && after[1] && after[1].tracks.length === recOrder.length - 4, `MB: medium 1 has 4, new medium 2 has ${recOrder.length - 4} (${shape(after)})`);
    ck(after[1] && after[1].tracks.every((t, i) => t.num === String(i + 1)), 'MB: medium 2 numbered from 1');
    ck(JSON.stringify(after.slice(0, 2).flatMap(m => m.tracks.map(t => t.rec))) === JSON.stringify(recOrder), 'MB: the SAME recordings, in order');
  }
} else console.log('skipping split: MB did not show the merged release (edits may be open) —', shape(mid));

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
