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
const ORIGIN = process.env.TC_ORIGIN || 'https://musicbrainz.org';
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
  // medium-format header is lifted above our table; minimal (text, label/help/idk hidden, but
  // move buttons VISIBLE) when a format is chosen; full native header when none; warning hidden
  const fmtTidy = await page.evaluate(() => {
    const tbl = document.querySelector('table.advanced-format'); if (!tbl) return { notbl: true };
    const fmt = tbl.querySelector('[id^="medium-format"]');
    const lbl = tbl.querySelector('td.format > label[for^="medium-format"]');
    const help = tbl.querySelector('td.format a');
    const moves = tbl.querySelector('td.align-right.icon');
    const idkLbl = tbl.querySelector('td.format input[type=checkbox]').closest('label');
    const warn = document.querySelector('fieldset.advanced-medium .warning');
    const lifted = !!tbl.closest('#tc-mirror-wrap');
    const set = which => { fmt.value = which; fmt.dispatchEvent(new Event('change')); };
    set(fmt.options[1].value);   // a real format → minimal
    const withFmt = { flat: fmt.classList.contains('tc-fmt-flat'), labelHidden: lbl.style.display === 'none', helpHidden: help ? help.style.display === 'none' : 'no-help', movesVisible: moves ? moves.style.display !== 'none' : 'no-moves', idkHidden: idkLbl.style.display === 'none' };
    set('');                     // no format → full native header
    const noFmt = { notFlat: !fmt.classList.contains('tc-fmt-flat'), labelShown: lbl.style.display !== 'none', idkShown: idkLbl.style.display !== 'none' };
    set(fmt.options[1].value);   // restore a format
    return { lifted, warnHidden: warn ? warn.style.display === 'none' : 'no-warn', withFmt, noFmt };
  });
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

  // guess case: messy title → diff highlight, then REAL-mouse hover preview / leave restore / click apply
  const row1 = page.locator('#tc-mirror-wrap .tc-mirror tbody tr').first();
  const setup = await page.evaluate(async () => {
    const tin = document.querySelector('#tc-mirror-wrap .tc-mirror tbody tr .t-title');
    tin.value = 'the QUICK (brown) FOX feat. someone'; tin.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 100));
    const t2 = document.querySelector('#tc-mirror-wrap .tc-mirror tbody tr .t-title');
    return { hasDiff: t2.classList.contains('diff'), messy: t2.value, guessed: (t2 || {}).title ? t2.title.replace('Guess case → ', '') : null };
  });
  const readTitle = () => page.evaluate(() => { const t = document.querySelector('#tc-mirror-wrap .tc-mirror tbody tr .t-title'); return { val: t.value, hi: t.classList.contains('gcpreview') }; });
  await row1.locator('.t-wrap').hover();   // real hover over the title cell → preview
  await page.waitForTimeout(50); const hov = await readTitle();
  await page.locator('#tc-mirror-wrap .tc-mirror tbody tr').nth(2).locator('.t-num').hover();   // move away → restore
  await page.waitForTimeout(50); const left = await readTitle();
  await row1.locator('.t-gc').click(); await page.waitForTimeout(100);
  const gc = await page.evaluate((s) => {
    const t = document.querySelector('#tc-mirror-wrap .tc-mirror tbody tr .t-title');
    return { hasDiff: s.hasDiff, guessed: s.guessed, after: t.value, stillDiff: t.classList.contains('diff'), hoverPreview: s.hov.val === s.guessed && s.hov.hi, leaveRestores: s.left.val === s.messy && !s.left.hi };
  }, { ...setup, hov, left });

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

  // Tools split-button: apply-mode moved into the Artist header; pick a tool → label + inline options;
  // Search & Replace is real-time (no apply); guess-case options proxy MB's hidden settings.
  const tools = await page.evaluate(async () => {
    const pause = () => new Promise(r => setTimeout(r, 120));
    const bar = document.querySelector('#tc-bar');
    const amInHeader = !!document.querySelector('#tc-mirror-wrap .tc-mirror thead .tc-applymode');
    const amInBar = !!bar.querySelector('.tc-applymode');
    const pick = async label => { bar.querySelector('[data-act="menu"]').click(); await pause(); const mi = [...document.querySelectorAll('#tc-menu .tc-mi')].find(e => e.textContent === label); mi.click(); await pause(); };
    // Search & Replace → real-time
    await pick('Search and Replace');
    const toolLabel = bar.querySelector('[data-act="tool"]').textContent;
    const find = bar.querySelector('.tc-toolopts .tc-sr-find'), rep = bar.querySelector('.tc-toolopts .tc-sr-rep');
    const before0 = document.querySelector('#tc-mirror-wrap .tc-mirror tbody .t-title').value;
    find.value = before0.slice(0, 4); find.dispatchEvent(new Event('input'));
    rep.value = 'ZZ'; rep.dispatchEvent(new Event('input'));
    await pause();
    const afterRep = document.querySelector('#tc-mirror-wrap .tc-mirror tbody .t-title').value;
    const srStatus = document.querySelector('#tc-mirror-wrap .tc-hstatus').textContent;
    find.value = ''; find.dispatchEvent(new Event('input')); await pause();   // clear → restore from snapshot
    const restored = document.querySelector('#tc-mirror-wrap .tc-mirror tbody .t-title').value;
    // Guess case → inline options present
    await pick('Guess case');
    const gcLabel = bar.querySelector('[data-act="tool"]').textContent;
    const gco = bar.querySelector('.tc-toolopts .tc-gco');
    const gcOpts = gco ? { lang: !!gco.querySelector('select'), checks: gco.querySelectorAll('input[type=checkbox]').length } : null;
    return { amInHeader, amInBar, toolLabel, srChanged: afterRep !== before0, srStatus, restored, restoredOk: restored === before0, gcLabel, gcOpts };
  });

  // Add-tracks control: clicking ＋ drives MB's native add-tracks for the last medium
  const addTracks = await page.evaluate(async () => {
    const u = v => (typeof v === 'function' ? v() : v);
    const med0 = () => u(u(u(window.MB.releaseEditor.rootField.release).mediums)[0].tracks).length;
    const before = med0();
    const inp = document.querySelector('#tc-mirror-wrap .tc-addn'); inp.value = '2';
    document.querySelector('#tc-mirror-wrap .tc-addbtn').click();
    await new Promise(r => setTimeout(r, 700));   // scheduleSync (400ms) + render
    const rows = document.querySelectorAll('#tc-mirror-wrap .tc-mirror tbody tr[data-tk]').length;
    return { before, after: med0(), rows };
  });

  // Match button is disabled for the duration of a match pass
  const matchBtn = await page.evaluate(async () => {
    const btn = document.querySelector('#tc-bar [data-act="match"]');
    const before = btn.disabled;
    window.__trackCannon.model.tracks[0].slots[0]._pending = true;   // force the pass to actually do (and await) work
    btn.click();
    const during = btn.disabled;   // setMatching(true) runs synchronously at the pass start
    await new Promise(res => { const iv = setInterval(() => { if (!btn.disabled) { clearInterval(iv); res(); } }, 60); });
    return { before, during, after: btn.disabled };
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
  log('format header tidy —', JSON.stringify(fmtTidy));
  log('add tracks (＋2) — tracks:', addTracks.before, '→', addTracks.after, '· rows now:', addTracks.rows);
  log('auto-committed on load — resolved slots:', resolved.res + '/' + resolved.slots);
  log('move 1↓ (UI ▼) — before:', ops.before.join(' | '), '→ after:', ops.afterMove.join(' | '));
  log('remove last (UI ✕) — count:', ops.countBefore, '→', ops.countAfter);
  log('guess case — diff:', gc.hasDiff, '· guessed:', JSON.stringify(gc.guessed), '· hover-preview:', gc.hoverPreview, '· leave-restores:', gc.leaveRestores, '· applied:', JSON.stringify(gc.after), '· stillDiff:', gc.stillDiff);
  log('match button — before:', matchBtn.before, '· during pass:', matchBtn.during, '· after:', matchBtn.after);
  log('tools — apply-mode in header:', tools.amInHeader, '(not in bar:', !tools.amInBar + ')', '· S&R label:', JSON.stringify(tools.toolLabel), 'live-changed:', tools.srChanged, 'status:', JSON.stringify(tools.srStatus), 'restored:', tools.restoredOk, '· Guess-case label:', JSON.stringify(tools.gcLabel), 'opts:', JSON.stringify(tools.gcOpts));
  log('edit # → "A1", length → "1:23" — model now:', JSON.stringify(fields));
  log('split/merge on', JSON.stringify(split.title), '— credit names:', split.c0, '→ +slot', split.c1, '→ +pick', split.c2, '→ -slot', split.c3, '· credited-as auto-filled:', split.autofilled, '(' + JSON.stringify(split.credAfter) + ')');
  log('artifacts in', LOG_DIR);
  if (!HEADED) await ctx.close();
}
main().catch(e => { console.error(e); process.exit(1); });
