// Track Cannon — mirror-table mode: enable "Replace MB track list", verify the mirror
// renders, drives MB's model for reorder/remove/length, and matches artists.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const SEED_PATH = resolve(HERE, 'seed-saigon.local.json');
const ORIGIN = process.env.TC_ORIGIN || 'https://beta.musicbrainz.org';
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
  // the editor opens on the Release-information tab — the Original/Track-Cannon toggle must NOT show there
  await page.waitForTimeout(700);   // let the watcher tick once
  const launchBeforeTracklist = await page.evaluate(() => !!document.getElementById('tc-launch'));
  await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});

  // mirror should auto-render once the Tracklist tab is shown; wait for its rows
  await page.waitForSelector('.tc-medsec .tc-mirror tbody tr', { timeout: 60000 });   // shell renders instantly
  await page.waitForFunction(() => { const m = window.__trackCannon.model; return m && m.tracks.length && m.tracks.every(t => t.slots.every(s => !s._pending)); }, null, { timeout: 60000 });   // matching done
  await page.waitForTimeout(600);
  // Apollo hides the native tracklist tables WITHIN the Tracklist tab only (not e.g. the Recordings-tab
  // recording-associations table — issue #114). Also assert a tr.track table OUTSIDE #tracklist is untouched.
  const nativeHidden = await page.evaluate(() => { const tl = document.getElementById('tracklist'); return [...tl.querySelectorAll('table')].filter(t => t.querySelector('tr.track')).every(t => t.style.display === 'none'); });
  const outsideUntouched = await page.evaluate(() => {
    const tl = document.getElementById('tracklist');
    // a tr.track table that is NOT inside #tracklist must NOT be display:none'd by Apollo
    const outside = [...document.querySelectorAll('table')].filter(t => t.querySelector('tr.track') && (!tl || !tl.contains(t)));
    return outside.length === 0 ? 'none-present' : outside.every(t => t.style.display !== 'none');
  });
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
    const warn = [...document.querySelectorAll('fieldset.advanced-medium .warning')].find(w => /capitali[sz]/i.test(w.textContent));   // a capitalization warning — must now be SHOWN (all MB warnings stay visible)
    const sec = document.querySelector('.tc-medsec');
    const aboveTable = !!(sec && (tbl.compareDocumentPosition(sec) & Node.DOCUMENT_POSITION_FOLLOWING));   // our table follows the native format header
    const set = which => { fmt.value = which; fmt.dispatchEvent(new Event('change')); };
    set(fmt.options[1].value);   // a real format → minimal
    const withFmt = { flat: fmt.classList.contains('tc-fmt-flat'), labelHidden: lbl.style.display === 'none', helpHidden: help ? help.style.display === 'none' : 'no-help', movesVisible: moves ? moves.style.display !== 'none' : 'no-moves', idkHidden: idkLbl.style.display === 'none' };
    set('');                     // no format → full native header
    const noFmt = { notFlat: !fmt.classList.contains('tc-fmt-flat'), labelShown: lbl.style.display !== 'none', idkShown: idkLbl.style.display !== 'none' };
    set(fmt.options[1].value);   // restore a format
    return { aboveTable, capWarnShown: warn ? getComputedStyle(warn).display !== 'none' : 'no-cap-warn', withFmt, noFmt };
  });
  // a non-capitalization warning (e.g. the Digital-Media / packaging one) must stay VISIBLE in Canon
  const realWarn = await page.evaluate(async () => {
    const fs = document.querySelector('fieldset.advanced-medium'); if (!fs) return { ok: false };
    const w = document.createElement('div'); w.className = 'warning'; w.id = 'tc-test-warn';
    w.textContent = 'Warning: This medium format is set to “Digital Media”, but the packaging type is not “None”.';
    fs.appendChild(w);
    await new Promise(r => setTimeout(r, 700));   // let the sync watcher run setNativeHidden at least once
    const el = document.getElementById('tc-test-warn');
    const visible = !!el && getComputedStyle(el).display !== 'none';
    if (el) el.remove();
    return { ok: true, visible };
  });
  // hideMirror reveals the native bits; re-show puts Canon back
  const shown = await page.evaluate(() => { window.__trackCannon.hideMirror(); const t = document.getElementById('tracklist-tools'); const tbl = [...document.querySelectorAll('table')].find(x => x.querySelector('tr.track')); return { tools: t ? t.style.display !== 'none' : null, table: tbl ? tbl.style.display !== 'none' : null }; });
  await page.evaluate(() => window.__trackCannon.showMirror());
  await page.waitForSelector('.tc-medsec .tc-mirror tbody tr', { timeout: 30000 });
  await page.waitForFunction(() => { const m = window.__trackCannon.model; return m && m.tracks.length && m.tracks.every(t => t.slots.every(s => !s._pending)); }, null, { timeout: 60000 });
  await page.locator('#tracklist').screenshot({ path: resolve(LOG_DIR, 'mirror.png') }).catch(() => page.screenshot({ path: resolve(LOG_DIR, 'mirror.png'), fullPage: true }));

  const titles3 = () => page.evaluate(() => { const u = v => (typeof v === 'function' ? v() : v); return u(u(window.MB.releaseEditor.rootField.release).mediums)[0].tracks().slice(0, 3).map(t => u(t.name)); });
  const trackCount = () => page.evaluate(() => { const u = v => (typeof v === 'function' ? v() : v); return u(u(window.MB.releaseEditor.rootField.release).mediums)[0].tracks().length; });

  // splittable credits (e.g. "A & B") highlight the credited-as field + show ⋔, and clear live on edit
  const splittable = await page.evaluate(() => {
    const tc = window.__trackCannon, t = tc.model.tracks[0];
    t.slots[0].creditedAs = 'Some One & Other Two'; t.slots[0].committed = false; t.slots[0].name = '';
    tc.addSlot(t); tc.removeSlot(t, t.slots.length - 1);   // forces a rerender of our rows
    const row = document.querySelector(`.tc-medsec tr[data-tk="${t.mi}:${t.ti}"]`);
    const cred = row.querySelector('.tc-cred'); const line = cred.closest('.tc-aslot'); const btn = row.querySelector('.tc-splitb');
    const on = { highlighted: line.classList.contains('tc-can-split'), btnShown: getComputedStyle(btn).display !== 'none', bg: getComputedStyle(cred).backgroundColor };
    cred.value = 'ddddd'; cred.dispatchEvent(new Event('input'));   // edit to a single name → highlight + ⋔ go away live
    const off = { highlighted: line.classList.contains('tc-can-split'), btnShown: getComputedStyle(btn).display !== 'none' };
    return { on, off };
  });
  log('splittable credit — when multi:', JSON.stringify(splittable.on), '· after edit to single:', JSON.stringify(splittable.off));

  // column resize must not jump on grab — a 1px drag should change the width by ~1px, not ~1em
  const resize = await page.evaluate(() => {
    const table = document.querySelector('.tc-medsec .tc-mirror'); const th = [...table.querySelectorAll('thead th')][2];
    const r = th.getBoundingClientRect(); const x = r.right, y = r.top + 5; const before = th.offsetWidth;
    table.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: x + 1, clientY: y, bubbles: true }));
    const after = th.offsetWidth;
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return { before, after, jump: Math.abs(after - before) };
  });
  log('column resize — 1px drag jump:', resize.jump + 'px (', resize.before, '→', resize.after, ')');

  // "Resize columns" tool: Fit sizes Title to content, Centered balances Title≈Artist, Default resets
  const colTool = await page.evaluate(async () => {
    const u = v => (typeof v === 'function' ? v() : v);
    const widthOf = k => { const c = document.querySelector(`.tc-medsec .tc-mirror colgroup col:nth-child(${['mv', 'num', 'title', 'art', 'len', 'badge'].indexOf(k) + 1})`); return c ? parseInt(c.style.width) || 0 : -1; };
    document.querySelector('#tc-bar [data-act="menu"]').click(); await new Promise(r => setTimeout(r, 120));
    const item = [...document.querySelectorAll('#tc-menu .tc-mi')].find(e => e.textContent === 'Resize columns'); item && item.click();
    await new Promise(r => setTimeout(r, 120));
    const btns = [...document.querySelectorAll('.tc-toolopts .tc-colbtn')].map(b => b.textContent);
    const click = label => { const b = [...document.querySelectorAll('.tc-toolopts .tc-colbtn')].find(x => x.textContent === label); b && b.click(); };
    click('Fit'); await new Promise(r => setTimeout(r, 60));
    const fitTitle = widthOf('title'), fitSaved = u(window.__trackCannon.settings).colWidths.title;
    click('Centered'); await new Promise(r => setTimeout(r, 60));
    const balTitle = widthOf('title'), artW = document.querySelector('.tc-medsec .tc-mirror thead th:nth-child(4)').offsetWidth, balTh = document.querySelector('.tc-medsec .tc-mirror thead th:nth-child(3)').offsetWidth;
    click('Default'); await new Promise(r => setTimeout(r, 60));
    const defCleared = Object.keys(u(window.__trackCannon.settings).colWidths).length === 0, defTitle = widthOf('title');
    return { btns, fitTitle, fitSaved, balTitle, balNearArt: Math.abs(balTh - artW) < 60, defCleared, defTitle };
  });
  log('resize-columns tool — buttons:', JSON.stringify(colTool.btns), '· Fit title→', colTool.fitTitle, '(saved', colTool.fitSaved + ')',
    '· Centered title≈artist:', colTool.balNearArt, '(' + colTool.balTitle + ')', '· Default cleared:', colTool.defCleared, '→', colTool.defTitle);

  // no apply phase — confident matches auto-commit on load; verify they're written to the model
  const resolved = await page.evaluate(() => { const tl = window.__trackCannon.readTracklist(); const slots = tl.reduce((n, t) => n + t.names.length, 0); const res = tl.reduce((n, t) => n + t.names.filter(x => x.artistGid).length, 0); return { slots, res }; });

  // global unresolved total shows in the toolbar (left of Match), as a red badge when > 0 (after the resolved check — it corrupts a slot)
  const gstat = await page.evaluate(() => {
    const tc = window.__trackCannon, t = tc.model.tracks[1];
    t.slots[0].committed = false; t.slots[0].gid = null; t.slots[0].status = 'none';
    tc.addSlot(t); tc.removeSlot(t, t.slots.length - 1);   // benign rerender → refreshStatus
    const el = document.querySelector('#tc-bar .tc-globalstat');
    return { text: el ? el.textContent : 'missing', badge: el ? el.classList.contains('tc-unres') : false };
  });
  log('toolbar global status:', JSON.stringify(gstat.text), '· badge:', gstat.badge);

  // guess case: messy title → diff highlight, then REAL-mouse hover preview / leave restore / click apply
  const row1 = page.locator('.tc-medsec .tc-mirror tbody tr').first();
  const setup = await page.evaluate(async () => {
    const tin = document.querySelector('.tc-medsec .tc-mirror tbody tr .t-title');
    tin.value = 'the QUICK (brown) FOX feat. someone'; tin.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 100));
    const t2 = document.querySelector('.tc-medsec .tc-mirror tbody tr .t-title');
    return { hasDiff: t2.classList.contains('diff'), messy: t2.value, guessed: (t2 || {}).title ? t2.title.replace('Guess case → ', '') : null };
  });
  const readTitle = () => page.evaluate(() => { const t = document.querySelector('.tc-medsec .tc-mirror tbody tr .t-title'); return { val: t.value, hi: t.classList.contains('gcpreview') }; });
  await row1.locator('.t-wrap').hover();   // real hover over the title cell → preview
  await page.waitForTimeout(50); const hov = await readTitle();
  await page.locator('.tc-medsec .tc-mirror tbody tr').nth(2).locator('.t-num').hover();   // move away → restore
  await page.waitForTimeout(50); const left = await readTitle();
  await row1.hover();   // Aa is hidden until row hover
  await row1.locator('.t-gc').click(); await page.waitForTimeout(100);
  const gc = await page.evaluate((s) => {
    const t = document.querySelector('.tc-medsec .tc-mirror tbody tr .t-title');
    return { hasDiff: s.hasDiff, guessed: s.guessed, after: t.value, stillDiff: t.classList.contains('diff'), hoverPreview: s.hov.val === s.guessed && s.hov.hi, leaveRestores: s.left.val === s.messy && !s.left.hi };
  }, { ...setup, hov, left });

  // Aa button is hidden until row hover (like the other hover actions)
  const aaHiddenDefault = await page.evaluate(() => { const g = document.querySelector('.tc-medsec .t-gc'); return g ? getComputedStyle(g).visibility : 'no-aa'; });
  const gcTk = await page.evaluate(() => { const g = document.querySelector('.tc-medsec .t-gc'); return g ? g.closest('tr[data-tk]').dataset.tk : null; });
  if (gcTk) await page.locator(`.tc-medsec tr[data-tk="${gcTk}"]`).hover();
  const aaVisibleOnHover = await page.evaluate(() => { const g = document.querySelector('.tc-medsec .t-gc'); return g ? getComputedStyle(g).visibility : 'no-aa'; });

  // ↑/↓ move to the same field in the adjacent row (search box moves rows when resolved, not over results)
  const keysNav = await page.evaluate(async () => {
    const rows = [...document.querySelectorAll('.tc-medsec .tc-mirror tbody tr[data-tk]')];
    const press = (el, key) => el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    const t1 = rows[0].querySelector('.t-title'); t1.focus(); press(t1, 'ArrowDown');
    const titleDown = document.activeElement === rows[1].querySelector('.t-title');
    const t2 = rows[1].querySelector('.t-title'); t2.focus(); press(t2, 'ArrowUp');
    const titleUp = document.activeElement === rows[0].querySelector('.t-title');
    // Enter → next field, Shift+Enter → prev (non-search fields)
    const e1 = rows[0].querySelector('.t-title'); e1.focus(); press(e1, 'Enter');
    const titleEnter = document.activeElement === rows[1].querySelector('.t-title');
    const e2 = rows[1].querySelector('.t-title'); e2.focus(); e2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
    const titleShiftEnter = document.activeElement === rows[0].querySelector('.t-title');
    const s1 = rows[0].querySelector('.tc-search input.nm'); s1.focus(); await new Promise(r => setTimeout(r, 60));   // resolved → focus shows candidates
    press(s1, 'ArrowDown');
    const searchDown = document.activeElement === rows[1].querySelector('.tc-search input.nm');
    // multi-artist: ↓ from the 1st artist line goes to the 2nd line on the SAME track (not the next track)
    const tc = window.__trackCannon; const t = tc.model.tracks[5]; t.slots.length = 1; tc.addSlot(t);
    await new Promise(r => setTimeout(r, 80));
    const mrow = () => document.querySelector(`.tc-medsec tr[data-tk="${t.mi}:${t.ti}"]`);
    const ins = mrow().querySelectorAll('.tc-search input.nm'); ins[0].focus(); await new Promise(r => setTimeout(r, 40));
    press(ins[0], 'ArrowDown'); await new Promise(r => setTimeout(r, 60));
    const multiArtistDown = document.activeElement === mrow().querySelectorAll('.tc-search input.nm')[1];
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // close any autocomplete popup
    return { titleDown, titleUp, searchDown, multiArtistDown, titleEnter, titleShiftEnter };
  });
  await page.waitForTimeout(250);   // let the autocomplete popup close before later clicks

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
    const amInHeader = !!document.querySelector('.tc-medsec .tc-mirror thead .tc-applymode');
    const amInBar = !!bar.querySelector('.tc-applymode');
    const pick = async label => { bar.querySelector('[data-act="menu"]').click(); await pause(); const mi = [...document.querySelectorAll('#tc-menu .tc-mi')].find(e => e.textContent === label); mi.click(); await pause(); };
    // Search & Replace → real-time
    await pick('Search and Replace');
    const toolLabel = bar.querySelector('[data-act="tool"]').textContent;
    const find = bar.querySelector('.tc-toolopts .tc-sr-find'), rep = bar.querySelector('.tc-toolopts .tc-sr-rep');
    const before0 = document.querySelector('.tc-medsec .tc-mirror tbody .t-title').value;
    find.value = before0.slice(0, 4); find.dispatchEvent(new Event('input'));
    rep.value = 'ZZ'; rep.dispatchEvent(new Event('input'));
    await pause();
    const afterRep = document.querySelector('.tc-medsec .tc-mirror tbody .t-title').value;
    const srStatus = document.querySelector('.tc-medsec .tc-hstatus').textContent;
    find.value = ''; find.dispatchEvent(new Event('input')); await pause();   // clear → restore from snapshot
    const restored = document.querySelector('.tc-medsec .tc-mirror tbody .t-title').value;
    // Guess case → inline options present
    await pick('Guess case');
    const gcLabel = bar.querySelector('[data-act="tool"]').textContent;
    const gco = bar.querySelector('.tc-toolopts .tc-gco');
    const gcOpts = gco ? { lang: !!gco.querySelector('select'), checks: gco.querySelectorAll('input[type=checkbox]').length } : null;
    return { amInHeader, amInBar, toolLabel, srChanged: afterRep !== before0, srStatus, restored, restoredOk: restored === before0, gcLabel, gcOpts };
  });

  // search popups must not pile up: a row rebuild closes any open popup (the bug was orphaned .tc-acpop)
  const popups = await page.evaluate(async () => {
    const find = i => [...document.querySelectorAll('.tc-medsec .tc-mirror tbody tr[data-tk]')][i].querySelector('.tc-search input.nm');
    let maxOpen = 0;
    for (let i = 0; i < 4; i++) {
      const inp = find(i); inp.focus(); inp.value = 'rock' + i; inp.dispatchEvent(new Event('input'));
      await new Promise(r => setTimeout(r, 350));
      maxOpen = Math.max(maxOpen, document.querySelectorAll('.tc-acpop').length);
      const t = window.__trackCannon.model.tracks[8]; window.__trackCannon.addSlot(t); window.__trackCannon.removeSlot(t, t.slots.length - 1);   // a rerender that used to orphan the popup
      await new Promise(r => setTimeout(r, 120));
    }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    await new Promise(r => setTimeout(r, 250));
    return { maxOpen, leftover: document.querySelectorAll('.tc-acpop').length };
  });
  log('search popups — max concurrent:', popups.maxOpen, '· leftover after rebuilds:', popups.leftover);

  // Compact layout (⚙ → Row layout) packs the rows tighter
  const compact = await page.evaluate(async () => {
    const tbl = document.querySelector('.tc-medsec .tc-mirror');
    const h = () => { const a = tbl.querySelector('.tc-aslot'); return a ? Math.round(a.getBoundingClientRect().height) : 0; };
    const cozyH = h();
    document.querySelector('#tc-bar [data-act="gear"]').click(); await new Promise(r => setTimeout(r, 80));
    const help = document.querySelector('#tc-settings .tc-help');   // help button → README, opens in a new tab
    const helpOk = !!help && /README\.md$/.test(help.getAttribute('href')) && help.target === '_blank';
    const verEl = document.querySelector('#tc-settings .tc-ver');   // installed version shown in the header
    const verOk = !!verEl && /^v\d{4}\.\d+\.\d+\.\d+$/.test(verEl.textContent.trim());
    const appearSec = [...document.querySelectorAll('#tc-settings .tc-s-sec')].some(e => /appearance/i.test(e.textContent));   // section header
    const setLayout = v => { const rb = document.querySelector(`#tc-settings input[name="tc-s-layout"][value="${v}"]`); rb.checked = true; rb.dispatchEvent(new Event('change', { bubbles: true })); };
    const radios = document.querySelectorAll('#tc-settings input[name="tc-s-layout"]').length;   // row layout is radios now, not a select
    setLayout('compact');
    await new Promise(r => setTimeout(r, 80));
    const compactH = h(); const hasClass = tbl.classList.contains('compact');
    setLayout('cozy'); document.querySelector('#tc-bar [data-act="gear"]').click();   // restore
    return { hasClass, cozyH, compactH, tighter: compactH > 0 && compactH < cozyH, helpOk, verOk, ver: verEl ? verEl.textContent.trim() : null, appearSec, radios };
  });

  // Add-tracks control: clicking ＋ drives MB's native add-tracks for the last medium
  const addTracks = await page.evaluate(async () => {
    const u = v => (typeof v === 'function' ? v() : v);
    const med0 = () => u(u(u(window.MB.releaseEditor.rootField.release).mediums)[0].tracks).length;
    const before = med0();
    const inp = document.querySelector('.tc-medsec .tc-addn'); inp.value = '2';
    document.querySelector('.tc-medsec .tc-addbtn').click();
    await new Promise(r => setTimeout(r, 700));   // scheduleSync (400ms) + render
    const rows = document.querySelectorAll('.tc-medsec .tc-mirror tbody tr[data-tk]').length;
    // new tracks must be BLANK — MB seeds them with the previous track's artist credit; we clear it
    const u2 = v => (typeof v === 'function' ? v() : v);
    const tks = u2(u2(u2(window.MB.releaseEditor.rootField.release).mediums)[0].tracks);
    const newCredit = tks.slice(-2).map(t => { const ac = u2(t.artistCredit) || {}; return (u2(ac.names) || []).map(n => u2(n.name) || (u2(n.artist) ? u2(u2(n.artist).name) : '')).join('').trim(); });
    return { before, after: med0(), rows, newCredit };
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

  // reorder by DRAG (replaces the old ▲▼): drag row 1 down to 3rd place — a multi-step move in one gesture
  const before = await titles3();
  const noOldButtons = await page.evaluate(() => !document.querySelector('.tc-mirror .mv'));   // ▲▼ buttons are gone
  await page.evaluate(async () => {
    const rows = [...document.querySelectorAll('.tc-medsec .tc-mirror tbody tr[data-tk]')];
    const src = rows[0], dst = rows[2]; const dt = new DataTransfer();
    const handle = src.querySelector('.tc-drag');
    handle.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
    const r = dst.getBoundingClientRect();
    dst.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, clientY: r.bottom - 2 }));   // lower half → drop after
    dst.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, clientY: r.bottom - 2 }));
    handle.dispatchEvent(new DragEvent('dragend', { dataTransfer: dt, bubbles: true }));
  });
  await page.waitForSelector('.tc-medsec .tc-mirror tbody tr', { timeout: 30000 });
  await page.waitForTimeout(600);
  const afterMove = await titles3();
  const draggedToThird = afterMove[2] === before[0];   // row 1's title landed in 3rd place
  const countBefore = await trackCount();
  const lastRow = page.locator('.tc-mirror tbody tr').last(); await lastRow.hover();   // ✕ reveals on hover
  await lastRow.locator('.rm').click();     // remove last row
  await page.waitForTimeout(600);
  const countAfter = await trackCount();
  const ops = { before, afterMove, countBefore, countAfter, draggedToThird, noOldButtons };
  await page.locator('#tracklist').screenshot({ path: resolve(LOG_DIR, 'mirror-after-ops.png') }).catch(() => {});

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
  await page.locator('#tracklist').screenshot({ path: resolve(LOG_DIR, 'mirror-split.png') }).catch(() => {});

  // multi-medium: add a 2nd medium → each medium gets its OWN Canon table with format header above + Add footer
  const multiMed = await page.evaluate(async () => {
    const u = v => (typeof v === 'function' ? v() : v);
    const before = u(u(window.MB.releaseEditor.rootField.release).mediums).length;
    const open = [...document.querySelectorAll('button')].find(b => /add medium/i.test(b.textContent) && b.getAttribute('data-click') === 'open');
    if (open) open.click(); await new Promise(r => setTimeout(r, 500));
    const addBtn = [...document.querySelectorAll('button')].find(b => /add medium/i.test(b.textContent) && b.getAttribute('data-click') === 'addMedium');
    if (addBtn) addBtn.click();
    await new Promise(r => setTimeout(r, 1400));   // mediums.subscribe → scheduleSync(400) → re-render
    const after = u(u(window.MB.releaseEditor.rootField.release).mediums).length;
    const perMedium = [...document.querySelectorAll('.tc-medsec')].map(sec => {
      const fs = sec.closest('fieldset.advanced-medium');
      const hdr = fs ? fs.querySelector('table.advanced-format') : null;
      const above = hdr && (hdr.compareDocumentPosition(sec) & Node.DOCUMENT_POSITION_FOLLOWING);
      return { mi: sec.dataset.mi, headerAbove: !!above, hasAdd: !!sec.querySelector('.tc-addbtn') };
    });
    const toolsAllHidden = [...document.querySelectorAll('[id="tracklist-tools"]')].every(t => t.style.display === 'none');
    const statuses = [...document.querySelectorAll('.tc-medsec .tc-hstatus')].map(e => e.textContent);   // per-medium unresolved counts
    // a medium-scoped tool (Reset #) now shows an inline medium combo (one option per medium), and doesn't auto-run
    document.querySelector('#tc-bar [data-act="menu"]').click(); await new Promise(r => setTimeout(r, 150));
    const mi2 = [...document.querySelectorAll('#tc-menu .tc-mi')].find(e => e.textContent === 'Reset #'); if (mi2) mi2.click();
    await new Promise(r => setTimeout(r, 150));
    const combo = document.querySelector('.tc-toolopts .tc-medsel');
    const comboOpts = combo ? combo.querySelectorAll('option').length : 0;
    // select Medium 2, switch to another medium-scoped tool, and confirm the choice is remembered
    if (combo) { combo.value = '1'; combo.dispatchEvent(new Event('change')); }
    document.querySelector('#tc-bar [data-act="menu"]').click(); await new Promise(r => setTimeout(r, 150));
    const swp = [...document.querySelectorAll('#tc-menu .tc-mi')].find(e => e.textContent === 'Swap'); if (swp) swp.click();
    await new Promise(r => setTimeout(r, 150));
    const comboKept = (document.querySelector('.tc-toolopts .tc-medsel') || {}).value;
    return { before, after, sections: document.querySelectorAll('.tc-medsec').length, perMedium, toolsAllHidden, comboOpts, comboKept, statuses };
  });
  await page.locator('#tracklist').screenshot({ path: resolve(LOG_DIR, 'mirror-multimedium.png') }).catch(() => {});

  // changed tracks (differ from page-load) get the ↺ button + a left-border marker; unchanged don't —
  // and reverting a track (no re-match) clears both. Runs LAST: revertTrack mutates a track destructively.
  const changed = await page.evaluate(async () => {
    const tc = window.__trackCannon;
    const t = tc.model.tracks.find(x => tc.trackChanged(x));   // an auto-matched / edited (changed) track
    if (!t) return { skipped: true };
    const tk = t.mi + ':' + t.ti, row = () => document.querySelector(`.tc-medsec tr[data-tk="${tk}"]`);
    const before = { hasRevert: !!row().querySelector('.trev'), marked: row().classList.contains('tc-changed') };
    // a DIFFERENT matched track whose badge is a match source (rg / name / user, not "set") — reverting
    // t must NOT collapse its badge to "set" (the reported bug)
    const other = tc.model.tracks.find(x => x !== t && x.slots.some(s => s.committed && s.status && s.status !== 'set'));
    const otherTk = other && other.mi + ':' + other.ti, otherStatusBefore = other && other.slots.find(s => s.committed && s.status !== 'set').status;
    tc.revertTrack(t);
    await new Promise(r => setTimeout(r, 120));
    const t2 = tc.model.tracks.find(x => x.mi + ':' + x.ti === tk);
    const other2 = otherTk && tc.model.tracks.find(x => x.mi + ':' + x.ti === otherTk);
    const otherStatusAfter = other2 && (other2.slots.find(s => s.committed) || {}).status;
    const otherKept = !other || otherStatusAfter === otherStatusBefore;   // badge survived the rebuild
    const after = { changed: tc.trackChanged(t2), hasRevert: !!row().querySelector('.trev'), marked: row().classList.contains('tc-changed'), otherStatusBefore, otherStatusAfter, otherKept };
    // editing the credited-as override must re-flag the row INSTANTLY (no rerender) — the reported bug
    const cred = row().querySelector('.tc-cred'); cred.value = 'Zzz Changed Credit'; cred.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 40));
    const afterCred = { marked: row().classList.contains('tc-changed'), hasRevert: !!row().querySelector('.trev') };
    return { before, after, afterCred };
  });

  // "Show more…" in the search popup loads a larger page of results (a common term has well over 8 matches)
  const showMore = await page.evaluate(async () => {
    const inp = document.querySelector('.tc-medsec .tc-mirror tbody tr .tc-search input.nm');
    if (!inp) return { ok: false };
    inp.focus(); inp.value = 'john'; inp.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 1300));   // debounce (250ms) + fetch
    const pop = () => document.querySelector('.tc-acpop');
    const count = () => { const p = pop(); return p ? p.querySelectorAll('.tc-acrow[data-i]').length : 0; };
    const before = count(), hadMore = !!(pop() && pop().querySelector('.tc-acmore'));
    const more = pop() && pop().querySelector('.tc-acmore'); if (more) more.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await new Promise(r => setTimeout(r, 1500));   // re-fetch at the bigger limit
    const after = count();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    return { ok: true, before, hadMore, after, grew: after > before };
  });

  // an exact name shared by several artists must NOT auto-resolve to high (the "Dansu" case) — it stays 'low'
  const ambiguous = await page.evaluate(async () => {
    const tc = window.__trackCannon;
    const fold = s => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
    const m = await tc.matchSlot('Dansu');
    const exact = (m.candidates || []).filter(c => fold(c.name) === fold('Dansu')).length;
    return { confidence: m.confidence, source: m.source, exact };
  });

  // launcher shows on Tracklist, disappears when you switch away, returns on the way back
  const launchOnTracklist = await page.evaluate(() => !!document.getElementById('tc-launch'));
  await page.locator('a, button', { hasText: /Edit Note/i }).first().click().catch(() => {});
  await page.waitForTimeout(800);
  const launchOffTracklist = await page.evaluate(() => !!document.getElementById('tc-launch'));
  await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});
  await page.waitForTimeout(800);
  const launchBack = await page.evaluate(() => !!document.getElementById('tc-launch'));

  await writeFile(resolve(LOG_DIR, 'console.log'), cons.join('\n'));
  await writeFile(resolve(LOG_DIR, 'ops.json'), JSON.stringify({ ops, resolved, nativeHidden }, null, 2));
  log('hidden — table:', nativeHidden, '· tools:', toolsHidden, '· guesscase:', guessHidden, '· outside-#tracklist untouched (#114):', outsideUntouched, '· hideMirror reveals:', JSON.stringify(shown));
  log('format header tidy —', JSON.stringify(fmtTidy), '· capitalization warn SHOWN:', fmtTidy.capWarnShown, '· packaging warn shown:', realWarn.visible);
  log('add tracks (＋2) — tracks:', addTracks.before, '→', addTracks.after, '· rows now:', addTracks.rows,
    '· new tracks blank (no inherited artist):', addTracks.newCredit.every(c => !c), JSON.stringify(addTracks.newCredit));
  log('compact layout — class:', compact.hasClass, '· row height', compact.cozyH + 'px →', compact.compactH + 'px · tighter:', compact.tighter, '· settings help→README:', compact.helpOk, '· version shown:', compact.verOk, '(' + compact.ver + ')', '· Appearance section:', compact.appearSec, '· layout radios:', compact.radios);
  log('multi-medium — mediums:', multiMed.before, '→', multiMed.after, '· sections:', multiMed.sections, '· all tools hidden:', multiMed.toolsAllHidden, '· medium-combo opts:', multiMed.comboOpts, '· choice kept across tools (want "1"):', JSON.stringify(multiMed.comboKept), '· per-medium status:', JSON.stringify(multiMed.statuses), '·', JSON.stringify(multiMed.perMedium));
  log('auto-committed on load — resolved slots:', resolved.res + '/' + resolved.slots);
  log('drag-reorder (row 1 → 3rd) — before:', ops.before.join(' | '), '→ after:', ops.afterMove.join(' | '), '· landed 3rd:', ops.draggedToThird, '· ▲▼ removed:', ops.noOldButtons);
  log('remove last (UI ✕) — count:', ops.countBefore, '→', ops.countAfter);
  log('guess case — diff:', gc.hasDiff, '· guessed:', JSON.stringify(gc.guessed), '· hover-preview:', gc.hoverPreview, '· leave-restores:', gc.leaveRestores, '· applied:', JSON.stringify(gc.after), '· stillDiff:', gc.stillDiff);
  log('Aa on hover — default:', aaHiddenDefault, '· on row hover:', aaVisibleOnHover);
  log('arrow row-nav — title ↓:', keysNav.titleDown, '· title ↑:', keysNav.titleUp, '· resolved search ↓:', keysNav.searchDown, '· multi-artist ↓ (same track):', keysNav.multiArtistDown, '· Enter→next:', keysNav.titleEnter, '· Shift+Enter→prev:', keysNav.titleShiftEnter);
  log('match button — before:', matchBtn.before, '· during pass:', matchBtn.during, '· after:', matchBtn.after);
  log('tools — apply-mode in header:', tools.amInHeader, '(not in bar:', !tools.amInBar + ')', '· S&R label:', JSON.stringify(tools.toolLabel), 'live-changed:', tools.srChanged, 'status:', JSON.stringify(tools.srStatus), 'restored:', tools.restoredOk, '· Guess-case label:', JSON.stringify(tools.gcLabel), 'opts:', JSON.stringify(tools.gcOpts));
  log('edit # → "A1", length → "1:23" — model now:', JSON.stringify(fields));
  log('split/merge on', JSON.stringify(split.title), '— credit names:', split.c0, '→ +slot', split.c1, '→ +pick', split.c2, '→ -slot', split.c3, '· credited-as auto-filled:', split.autofilled, '(' + JSON.stringify(split.credAfter) + ')');
  log('changed-track marker — has ↺ + border when changed:', changed.before?.hasRevert, '/', changed.before?.marked,
    '· after revert (no ↺/border/change):', !!(changed.after && !changed.after.hasRevert && !changed.after.marked && !changed.after.changed),
    '· credited-as edit re-flags instantly:', !!(changed.afterCred && changed.afterCred.marked && changed.afterCred.hasRevert),
    '· other badge kept across revert (not →set):', changed.after?.otherKept, '(' + changed.after?.otherStatusBefore + '→' + changed.after?.otherStatusAfter + ')');
  log('search "Show more…" — results', showMore.before, '→', showMore.after, '· offered:', showMore.hadMore, '· grew:', showMore.grew);
  log('ambiguous same-name "Dansu" — exact matches:', ambiguous.exact, '· confidence:', ambiguous.confidence,
    '· not auto-high:', ambiguous.exact < 2 || ambiguous.confidence !== 'high');
  log('launcher only on Tracklist — Info tab:', launchBeforeTracklist, '· Tracklist:', launchOnTracklist,
    '· other tab:', launchOffTracklist, '· back on Tracklist:', launchBack);
  log('artifacts in', LOG_DIR);
  if (!HEADED) await ctx.close();
}
main().catch(e => { console.error(e); process.exit(1); });
