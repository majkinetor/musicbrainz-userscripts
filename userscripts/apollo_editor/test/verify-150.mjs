// #150 — reorder artist-credit slots within a track by dragging the ⠿ grab handle that appears among
// the per-slot hover icons. This drives the REAL handle + drag handlers: it gives a track two artist
// slots (via the ↵ add button), tags the slot objects, simulates a drag of slot 0 onto slot 1, and
// asserts both the model slot order and MB's committed artistCredit `names` order flipped.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = process.env.SCRIPT || resolve(HERE, '..', 'apollo_editor.user.js');
const SEED_PATH = resolve(HERE, 'seed-saigon.local.json');
const ORIGIN = 'https://musicbrainz.org';
const HEADED = process.argv.includes('--headed');

if (!existsSync(SEED_PATH)) { console.error('missing seed'); process.exit(2); }
const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: !HEADED, viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
ctx.on('page', async p => { try { const u = p.url(); if (u && u !== 'about:blank' && /\/(artist|label)\/(add|create)/.test(u)) await p.close(); } catch {} });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.error('not logged in'); await ctx.close(); process.exit(3); }
await page.evaluate(({ origin, params }) => {
  const f = document.createElement('form'); f.method = 'POST'; f.action = origin + '/release/add'; f.style.display = 'none';
  const add = (n, v) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = n; i.value = v; f.appendChild(i); };
  for (const [k, v] of Object.entries(params)) Array.isArray(v) ? v.forEach(x => add(k, x)) : add(k, v);
  document.body.appendChild(f); f.submit();
}, { origin: ORIGIN, params: seed });
await page.waitForLoadState('domcontentloaded');
if (await page.locator('h1', { hasText: /Confirm form submission/i }).count().catch(() => 0)) {
  await page.locator('button[type=submit]', { hasText: /Continue/i }).first().click();
  await page.waitForLoadState('domcontentloaded');
}
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length > 0; } catch { return false; } }, null, { timeout: 120000 });
await page.addScriptTag({ content: await readFile(SCRIPT, 'utf8') });
await page.waitForTimeout(800);
// the Tracklist tab must be the visible panel (rects are needed for the drop math)
await page.evaluate(() => { const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#tracklist"]'); if (a) a.click(); });
await page.waitForTimeout(400);
await page.evaluate(() => window.__apolloEditor.showMirror());
await page.waitForFunction(() => { const l = document.querySelector('.tc-mirror tr .tc-aslot'); return l && l.offsetParent !== null; }, null, { timeout: 20000 });

const result = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const A = window.__apolloEditor;
  const rowSel = 'tbody tr';
  // first data row with a title input
  const row = [...document.querySelectorAll('.tc-mirror tbody tr')].find(r => r.querySelector('.c-art .tc-aslot'));
  if (!row) return { err: 'no track row' };

  // give this track a 2nd artist slot via the ↵ add button (programmatic click works on hidden btns)
  row.querySelector('.c-art .tc-aslot .tc-enter').click();
  await sleep(120);

  // locate the model track for this row and tag its slot objects so we can read the permutation
  const mi = +row.dataset.mi, ti = +row.dataset.ti;
  let track = A.model.tracks.find(t => t.mi === mi && t.ti === ti);
  if (!track) track = A.model.tracks[0];
  if (track.slots.length < 2) return { err: 'expected 2 slots after ↵, got ' + track.slots.length };
  track.slots.forEach((s, i) => { s._tid = i; });   // [0,1]
  // distinct credited-as text so MB's committed names are identifiable
  track.slots[0].creditedAs = 'ZZZ_first'; track.slots[1].creditedAs = 'ZZZ_second';
  A.commitTrack(track);

  const before = {
    modelOrder: track.slots.map(s => s._tid),
    handles: document.querySelectorAll(`.tc-mirror tr[data-mi="${mi}"][data-ti="${ti}"] .c-art .tc-slotgrab`).length,
    committed: window.MB.releaseEditor.rootField.release().mediums()[mi].tracks()[ti].artistCredit().names.map(n => n.name),
  };

  // simulate dragging slot 0's grab handle and dropping on the LOWER half of slot 1 (=> place after it)
  const lines = [...document.querySelectorAll(`.tc-mirror tr[data-mi="${mi}"][data-ti="${ti}"] .c-art .tc-aslot`)];
  const grab0 = lines[0].querySelector('.tc-slotgrab');
  const r1 = lines[1].getBoundingClientRect();
  const dt = new DataTransfer();
  grab0.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  lines[1].dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt, clientX: r1.left + 5, clientY: r1.bottom - 2 }));
  lines[1].dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt, clientX: r1.left + 5, clientY: r1.bottom - 2 }));
  grab0.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
  await sleep(150);

  const t2 = A.model.tracks.find(t => t.mi === mi && t.ti === ti) || A.model.tracks[0];
  const after = {
    modelOrder: t2.slots.map(s => s._tid),
    committed: window.MB.releaseEditor.rootField.release().mediums()[mi].tracks()[ti].artistCredit().names.map(n => n.name),
  };
  return { before, after };
});

console.log(JSON.stringify(result, null, 2));
const ok = result.before && result.before.handles === 2 &&
  JSON.stringify(result.before.modelOrder) === '[0,1]' &&
  JSON.stringify(result.after.modelOrder) === '[1,0]' &&
  JSON.stringify(result.before.committed) === '["ZZZ_first","ZZZ_second"]' &&
  JSON.stringify(result.after.committed) === '["ZZZ_second","ZZZ_first"]';
console.log(ok ? 'PASS' : 'FAIL');
if (!HEADED) await ctx.close();
process.exit(ok ? 0 : 1);
