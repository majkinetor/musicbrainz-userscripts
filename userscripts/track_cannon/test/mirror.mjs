// Track Cannon — mirror-table mode: enable "Replace MB track list", verify the mirror
// renders, drives MB's model for reorder/remove/length, and matches artists.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'track_cannon.user.js');
const SEED_PATH = resolve(HERE, 'seed-saigon.local.json');
const ORIGIN = 'https://musicbrainz.org';
const HEADED = process.argv.includes('--headed');
const LOG_DIR = resolve(HERE, 'logs', 'mirror-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
const log = (...a) => console.log('[mirror]', ...a);

async function main() {
  if (!existsSync(SEED_PATH)) { console.error('missing seed'); process.exit(2); }
  await mkdir(LOG_DIR, { recursive: true });
  const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1680, height: 1150 }, deviceScaleFactor: 2 });
  ctx.on('page', async p => { try { const u = p.url(); if (u && u !== 'about:blank' && /\/(artist|label)\/(add|create)/.test(u)) await p.close(); } catch {} });
  const page = ctx.pages()[0] || await ctx.newPage();
  const cons = [];
  page.on('console', m => cons.push(`${m.type().padEnd(7)} ${m.text()}`));
  page.on('pageerror', e => cons.push(`pageerror ${e.name}: ${e.message}`));

  await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('not logged in'); await ctx.close(); process.exit(3); }
  // pre-enable replace mode so the script renders the mirror on load
  await page.evaluate(() => localStorage.setItem('trackCannon.settings.v1', JSON.stringify({ replace: true, autoRun: false })));
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
  await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length; } catch { return false; } }, null, { timeout: 120000 });
  log('editor ready');
  await page.addScriptTag({ content: scriptCode });
  await page.waitForFunction(() => !!window.__trackCannon, null, { timeout: 15000 });
  await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});

  // mirror should auto-render once the Tracklist tab is shown; wait for its rows
  await page.waitForSelector('#tc-mirror-wrap .tc-mirror tbody tr', { timeout: 60000 });   // shell renders instantly
  await page.waitForFunction(() => { const m = window.__trackCannon.model; return m && m.tracks.length && m.tracks.every(t => t.slots.every(s => !s._pending)); }, null, { timeout: 60000 });   // matching done
  await page.waitForTimeout(600);
  const nativeHidden = await page.evaluate(() => [...document.querySelectorAll('table')].filter(t => t.querySelector('tr.track')).every(t => t.style.display === 'none'));
  const toolsHidden = await page.evaluate(() => { const t = document.getElementById('tracklist-tools'); return t ? t.style.display === 'none' : 'no-div'; });
  const guessHidden = await page.evaluate(() => { const g = document.querySelector('fieldset.guesscase, .guesscase'); return g ? g.style.display === 'none' : 'no-gc'; });
  // hideMirror reveals the native bits; re-show puts Canon back
  const shown = await page.evaluate(() => { window.__trackCannon.hideMirror(); const t = document.getElementById('tracklist-tools'); const tbl = [...document.querySelectorAll('table')].find(x => x.querySelector('tr.track')); return { tools: t ? t.style.display !== 'none' : null, table: tbl ? tbl.style.display !== 'none' : null }; });
  await page.evaluate(() => window.__trackCannon.showMirror());
  await page.waitForSelector('#tc-mirror-wrap .tc-mirror tbody tr', { timeout: 30000 });
  await page.waitForFunction(() => { const m = window.__trackCannon.model; return m && m.tracks.length && m.tracks.every(t => t.slots.every(s => !s._pending)); }, null, { timeout: 60000 });
  await page.locator('#tc-mirror-wrap').screenshot({ path: resolve(LOG_DIR, 'mirror.png') }).catch(() => page.screenshot({ path: resolve(LOG_DIR, 'mirror.png'), fullPage: true }));

  const titles3 = () => page.evaluate(() => { const u = v => (typeof v === 'function' ? v() : v); return u(u(window.MB.releaseEditor.rootField.release).mediums)[0].tracks().slice(0, 3).map(t => u(t.name)); });
  const trackCount = () => page.evaluate(() => { const u = v => (typeof v === 'function' ? v() : v); return u(u(window.MB.releaseEditor.rootField.release).mediums)[0].tracks().length; });

  // no apply phase — confident matches auto-commit on load; verify they're written to the model
  const resolved = await page.evaluate(() => { const tl = window.__trackCannon.readTracklist(); const slots = tl.reduce((n, t) => n + t.names.length, 0); const res = tl.reduce((n, t) => n + t.names.filter(x => x.artistGid).length, 0); return { slots, res }; });

  // guess case: messy title → diff highlight + per-title apply
  const gc = await page.evaluate(async () => {
    const sel = () => document.querySelector('#tc-mirror-wrap .tc-mirror tbody tr');
    const tin = sel().querySelector('.t-title'); tin.value = 'the QUICK (brown) FOX feat. someone'; tin.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 100));
    const t2 = sel().querySelector('.t-title'); const hasDiff = t2.classList.contains('diff');
    const btn = sel().querySelector('.t-gc'); const guessed = btn ? btn.title.replace('Guess case → ', '') : null;
    if (btn) btn.click(); await new Promise(r => setTimeout(r, 100));
    const after = sel().querySelector('.t-title').value; const stillDiff = sel().querySelector('.t-title').classList.contains('diff');
    return { hasDiff, guessed, after, stillDiff };
  });

  // editable # and length write through to the model
  const fields = await page.evaluate(async () => {
    const tc = window.__trackCannon, u = v => (typeof v === 'function' ? v() : v);
    const t = tc.model.tracks[0];
    const ko = () => u(u(u(window.MB.releaseEditor.rootField.release).mediums)[t.mi].tracks)[t.ti];
    const row = document.querySelector(`tr[data-tk="${t.mi}:${t.ti}"]`);
    const ni = row.querySelector('.t-num'); ni.value = 'A1'; ni.dispatchEvent(new Event('change'));
    const li = row.querySelector('.t-len'); li.value = '1:23'; li.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 120));
    return { number: String(u(ko().number)), length: u(ko().formattedLength) };
  });

  // exercise model-backed ops via the actual UI buttons (which rebuild the mirror)
  const before = await titles3();
  await page.locator('.tc-mirror tbody tr').first().locator('.dn').click();   // move row 1 down
  await page.waitForSelector('.tc-mirror tbody tr', { timeout: 30000 });
  await page.waitForTimeout(400);
  const afterMove = await titles3();
  const countBefore = await trackCount();
  const lastRow = page.locator('.tc-mirror tbody tr').last(); await lastRow.hover();   // ✕ reveals on hover
  await lastRow.locator('.rm').click();     // remove last row
  await page.waitForTimeout(600);
  const countAfter = await trackCount();
  const ops = { before, afterMove, countBefore, countAfter };
  await page.locator('#tc-mirror-wrap').screenshot({ path: resolve(LOG_DIR, 'mirror-after-ops.png') }).catch(() => {});

  // split/merge: add an artist slot to a single-artist track, fill it, then remove it
  const split = await page.evaluate(async () => {
    const tc = window.__trackCannon, u = v => (typeof v === 'function' ? v() : v);
    const t = tc.model.tracks.find(t => t.slots.length === 1);
    const trackKo = () => u(u(u(window.MB.releaseEditor.rootField.release).mediums)[t.mi].tracks)[t.ti];
    const credCount = () => (u(u(trackKo().artistCredit).names) || []).length;
    const c0 = credCount();
    tc.addSlot(t);
    const c1 = credCount(); const slots1 = t.slots.length;
    const newSlot = t.slots[t.slots.length - 1]; const credBefore = newSlot.creditedAs;
    const cand = (await tc.searchArtist('CBC Band'))[0]; tc.pickArtist(newSlot, cand);
    const c2 = credCount(); const credAfter = newSlot.creditedAs;
    tc.removeSlot(t, t.slots.length - 1);
    const c3 = credCount();
    return { title: t.title.slice(0, 20), c0, c1, slots1, c2, c3, credBefore, credAfter, autofilled: !credBefore && credAfter === cand.name };
  });
  await page.locator('#tc-mirror-wrap').screenshot({ path: resolve(LOG_DIR, 'mirror-split.png') }).catch(() => {});

  await writeFile(resolve(LOG_DIR, 'console.log'), cons.join('\n'));
  await writeFile(resolve(LOG_DIR, 'ops.json'), JSON.stringify({ ops, resolved, nativeHidden }, null, 2));
  log('hidden — table:', nativeHidden, '· tools:', toolsHidden, '· guesscase:', guessHidden, '· hideMirror reveals:', JSON.stringify(shown));
  log('auto-committed on load — resolved slots:', resolved.res + '/' + resolved.slots);
  log('move 1↓ (UI ▼) — before:', ops.before.join(' | '), '→ after:', ops.afterMove.join(' | '));
  log('remove last (UI ✕) — count:', ops.countBefore, '→', ops.countAfter);
  log('guess case — diff:', gc.hasDiff, '· guessed:', JSON.stringify(gc.guessed), '· applied:', JSON.stringify(gc.after), '· stillDiff:', gc.stillDiff);
  log('edit # → "A1", length → "1:23" — model now:', JSON.stringify(fields));
  log('split/merge on', JSON.stringify(split.title), '— credit names:', split.c0, '→ +slot', split.c1, '→ +pick', split.c2, '→ -slot', split.c3, '· credited-as auto-filled:', split.autofilled, '(' + JSON.stringify(split.credAfter) + ')');
  log('artifacts in', LOG_DIR);
  if (!HEADED) await ctx.close();
}
main().catch(e => { console.error(e); process.exit(1); });
