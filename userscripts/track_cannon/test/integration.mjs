// Track Cannon — end-to-end: seed the editor, inject the script, run matchAll(),
// apply the confident matches, and verify the model + the rendered fields resolved.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'track_cannon.user.js');
const SEED_PATH = resolve(HERE, 'seed-saigon.local.json');
const ORIGIN = process.env.TC_ORIGIN || 'https://beta.musicbrainz.org';
const HEADED = process.argv.includes('--headed');
const LOG_DIR = resolve(HERE, 'logs', 'int-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
const log = (...a) => console.log('[integration]', ...a);

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
  await page.evaluate(() => localStorage.setItem('trackCannon.settings.v1', JSON.stringify({ replace: false, autoRun: false })));
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

  // switch to the Tracklist tab so the artist fields are visible
  await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  const greenCount = () => page.evaluate(() => [...document.querySelectorAll('.artist-credit-editor input')].filter(i => /177, 235, 176/.test(getComputedStyle(i).backgroundColor)).length);
  const beforeGreen = await greenCount();

  // ── drive the floating panel via the API (the in-page mirror is the default UI now) ──
  log('opening Track Cannon floating panel…');
  await page.evaluate(() => { window.__trackCannon.hideMirror(); window.__trackCannon.openPanel(); });
  await page.waitForSelector('#tc-panel .tc-mirror tbody tr', { timeout: 60000 });   // shell renders instantly
  await page.waitForFunction(() => { const m = window.__trackCannon.model; return m && m.tracks.length && m.tracks.every(t => t.slots.every(s => !s._pending)); }, null, { timeout: 60000 });   // matching done
  await page.screenshot({ path: resolve(LOG_DIR, 'panel.png'), fullPage: true });
  // widen the panel so the capture is landscape and legible (display scales tall images down)
  await page.evaluate(() => { const p = document.getElementById('tc-panel'); if (p) { p.style.width = '1180px'; p.style.maxWidth = 'none'; p.style.right = '12px'; p.style.maxHeight = '94vh'; } });
  await page.waitForTimeout(150);
  await page.locator('#tc-panel').screenshot({ path: resolve(LOG_DIR, 'panel-only.png') }).catch(() => {});
  await page.evaluate(() => { const p = document.getElementById('tc-panel'); if (p) { p.style.width = '720px'; p.style.maxWidth = '96vw'; } });
  // capture the type-to-search dropdown open (focus a resolved field — shows results, no typing so it stays linked)
  await page.locator('#tc-panel .tc-mirror tbody tr .tc-search input.nm').nth(2).click();
  await page.waitForSelector('.tc-acpop .tc-acrow', { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(LOG_DIR, 'combo.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  // bug fix: focusing an already-resolved (set) field with NO typing must still search (not "no matches")
  const setTk = await page.evaluate(() => { const t = window.__trackCannon.model.tracks.find(t => t.slots.some(s => s.status === 'set')); return t ? t.mi + ':' + t.ti : null; });
  let setFocus = { ok: false };
  if (setTk) {
    await page.locator(`#tc-panel tr[data-tk="${setTk}"] .tc-search input.nm`).first().click();
    await page.waitForSelector('.tc-acpop .tc-acrow[data-i]', { timeout: 8000 }).catch(() => {});
    setFocus = { ok: true, results: await page.evaluate(() => { const p = document.querySelector('.tc-acpop'); return p ? p.querySelectorAll('.tc-acrow[data-i]').length : 0; }) };
    await page.keyboard.press('Escape').catch(() => {});
  }
  await page.waitForTimeout(150);
  // editable combo: focus an input → results pop appears → pick the 2nd → status becomes 'user' + purple
  const userCheck = await page.evaluate(async () => {
    const tc = window.__trackCannon;
    const inputs = [...document.querySelectorAll('#tc-panel .tc-mirror tbody tr .tc-search input.nm')];
    let picked = false, popCount = 0;
    for (const inp of inputs) {
      inp.focus(); await new Promise(r => setTimeout(r, 60));
      const pop = document.querySelector('.tc-acpop'); const rows = pop ? [...pop.querySelectorAll('.tc-acrow[data-i]')] : [];
      if (rows.length > 1) { popCount = rows.length; rows[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); picked = true; break; }
      inp.blur();
    }
    await new Promise(r => setTimeout(r, 80));
    const userStatus = tc.model.tracks.flatMap(x => x.slots).some(s => s.status === 'user');
    const greenBar = [...document.querySelectorAll('#tc-panel .tc-search.matched')].length > 0;
    return { picked, popCount, userStatus, greenBar };
  });

  // propagation (all mode): picking copies to every same-credit track, marks them, outline persists till next pick
  const propCheck = await page.evaluate(async () => {
    const tc = window.__trackCannon; tc.settings.applyMode = 'all';
    const all = []; tc.model.tracks.forEach(t => t.slots.forEach(s => { if (s.status !== 'set' && s.entity) all.push(s); }));
    const byCred = {}; all.forEach(s => { const k = s.creditedAs.toLowerCase(); (byCred[k] = byCred[k] || []).push(s); });
    const dup = Object.values(byCred).find(a => a.length >= 2 && (a[0].candidates[0] || a[0].entity));
    if (!dup) return { ok: false };
    tc.pickArtist(dup[0], dup[0].candidates[0] || dup[0].entity); await new Promise(r => setTimeout(r, 60));
    const marked = dup.every(s => s._marked);
    const domOutlined = document.querySelectorAll('#tc-panel .tc-search.tc-marked').length;
    // the propagation message goes to the toast, NOT the header status (which keeps the count)
    const toastMsg = (document.querySelector('#tc-panel .tc-toast') || {}).textContent || '';
    const headerStatus = (document.querySelector('#tc-panel .tc-hstatus') || {}).textContent || '';
    // next selection (a unique-credit slot, no propagation) must clear the outline
    const cnt = {}; all.forEach(s => { cnt[s.creditedAs.toLowerCase()] = (cnt[s.creditedAs.toLowerCase()] || 0) + 1; });
    const single = all.find(s => cnt[s.creditedAs.toLowerCase()] === 1 && (s.candidates[0] || s.entity));
    let clearedAfter = null;
    if (single) { tc.pickArtist(single, single.candidates[0] || single.entity); await new Promise(r => setTimeout(r, 60)); clearedAfter = dup.every(s => !s._marked); }
    return { ok: true, count: dup.length, allSame: dup.every(s => s.gid === dup[0].gid && s.committed), marked, domOutlined, clearedAfter, toastHasMsg: /other track/.test(toastMsg), headerIsStatus: !/other track/.test(headerStatus) };
  });

  // propagation must also overwrite already-SET tracks with the same credit (the reported bug)
  const setProp = await page.evaluate(async () => {
    const tc = window.__trackCannon; tc.settings.applyMode = 'all';
    const setSlots = []; tc.model.tracks.forEach(t => t.slots.forEach(s => { if (s.status === 'set') setSlots.push(s); }));
    const by = {}; setSlots.forEach(s => { const k = s.creditedAs.toLowerCase(); (by[k] = by[k] || []).push(s); });
    const dup = Object.values(by).find(a => a.length >= 2); if (!dup) return { ok: false };
    const cand = (await tc.searchArtist(dup[0].creditedAs))[0]; tc.pickArtist(dup[0], cand);
    await new Promise(r => setTimeout(r, 60));
    return { ok: true, cred: dup[0].creditedAs, count: dup.length, allChanged: dup.every(s => s.gid === cand.gid && s.committed) };
  });

  // editing "Credited as" propagates to every other track sharing that credit (all mode)
  const credProp = await page.evaluate(async () => {
    const tc = window.__trackCannon; tc.settings.applyMode = 'all';
    const by = {}; tc.model.tracks.forEach(t => t.slots.forEach(s => { const k = (s.creditedAs || '').toLowerCase(); if (k) (by[k] = by[k] || []).push(s); }));
    const dup = Object.values(by).find(a => a.length >= 2); if (!dup) return { ok: false };
    const target = dup[0]; const tr = [...document.querySelectorAll('#tc-panel .tc-mirror tbody tr')].find(r => r.dataset.tk === target._entry.mi + ':' + target._entry.ti);
    const cred = tr.querySelector('.tc-cred'); const newVal = 'XCredit ' + target.creditedAs;
    cred.focus(); cred.value = newVal; cred.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 80));
    return { ok: true, count: dup.length, newVal, allChanged: dup.every(s => s.creditedAs === newVal) };
  });
  log('credited-as propagation:', JSON.stringify(credProp));

  // pasting an MBID into a search field resolves straight to that artist
  const mbidResolve = await page.evaluate(async () => {
    const tc = window.__trackCannon, GID = '83d91898-7763-47d7-b03b-b92132375c47';   // Pink Floyd
    const t = tc.model.tracks[0]; const slot = t.slots[0];
    const tr = [...document.querySelectorAll('#tc-panel .tc-mirror tbody tr')].find(r => r.dataset.tk === t.mi + ':' + t.ti);
    const inp = tr.querySelector('.tc-search input.nm');
    inp.focus(); inp.value = GID; inp.dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 1300));
    const u = v => (typeof v === 'function' ? v() : v);
    const ko = u(u(u(window.MB.releaseEditor.rootField.release).mediums)[t.mi].tracks)[t.ti];
    const ac = u(u(ko.artistCredit).names); const liveGid = ac && ac[0] ? u(u(ac[0].artist).gid) : null;
    return { gid: tc.model.tracks[0].slots[0].gid, committed: tc.model.tracks[0].slots[0].committed, matched: tc.model.tracks[0].slots[0].gid === GID, wroteToMB: liveGid === GID };
  });
  log('MBID paste → resolve:', JSON.stringify(mbidResolve));

  // dropdown shows aliases (english if present, else first) fetched via one WS2 search
  const aliasCheck = await page.evaluate(async () => {
    const t = window.__trackCannon.model.tracks[2];
    const tr = [...document.querySelectorAll('#tc-panel .tc-mirror tbody tr')].find(r => r.dataset.tk === t.mi + ':' + t.ti);
    const inp = tr.querySelector('.tc-search input.nm');
    inp.focus(); inp.value = 'عمرو دياب'; inp.dispatchEvent(new Event('input'));   // Amr Diab (Arabic) — has a Latin alias
    await new Promise(r => setTimeout(r, 1700));
    const akas = [...document.querySelectorAll('.tc-acpop .tc-aka')].map(e => e.textContent);
    // pick the first result → its alias should appear on the resolved bar, and survive a rebuild (delete)
    const row0 = document.querySelector('.tc-acpop .tc-acrow[data-i="0"]'); if (row0) row0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
    const find = () => { const r = [...document.querySelectorAll('#tc-panel .tc-mirror tbody tr')].find(x => x.dataset.tk === t.mi + ':' + t.ti); return r ? ((r.querySelector('.tc-bar-aka') || {}).textContent || '') : ''; };
    const barAka = find();
    return { count: akas.length, sample: akas.slice(0, 3), barAka };
  });
  log('alias display — dropdown:', aliasCheck.count, JSON.stringify(aliasCheck.sample), '· resolved bar:', JSON.stringify(aliasCheck.barAka));

  // create-artist handshake: createArtist sets a token on the new tab, the "artist page" posts it back → inserted
  const createFlow = await page.evaluate(async () => {
    const tc = window.__trackCannon, GID = '83d91898-7763-47d7-b03b-b92132375c47';
    const t = tc.model.tracks.find(x => x.slots.some(s => !s.committed)) || tc.model.tracks[1];
    const slot = t.slots.find(s => !s.committed) || t.slots[0];
    const store = {}; const fakeTab = { sessionStorage: { setItem: (k, v) => { store[k] = v; }, getItem: k => store[k] } };
    const origOpen = window.open; window.open = () => fakeTab;
    tc.createArtist('Some New Artist', slot);
    window.open = origOpen;
    await new Promise(r => setTimeout(r, 100));
    const token = store['trackCannon.pendingArtist'];
    const bc = new BroadcastChannel('track-cannon-artist');
    bc.postMessage({ type: 'tc-artist-created', token, gid: GID, id: 191, name: 'Pink Floyd' });
    await new Promise(r => setTimeout(r, 200));
    return { gotToken: !!token, inserted: slot.gid === GID, committed: slot.committed, name: slot.name };
  });
  log('create-artist handshake:', JSON.stringify(createFlow));

  // no apply phase — confident matches auto-commit on load and picks commit immediately
  await page.waitForTimeout(800);
  const report = await page.evaluate(() => {
    const tc = window.__trackCannon;
    const after = tc.readTracklist();
    const slots = after.reduce((n, t) => n + t.names.length, 0);
    const resolvedSlots = after.reduce((n, t) => n + t.names.filter(x => x.artistGid).length, 0);
    const summary = after.filter(t => t.names.length).map(t => ({ n: t.number, title: t.title.slice(0, 28), artists: t.names.map(x => (x.artistGid ? '✓' : '·') + x.artistName).join(' | ') }));
    return { totalSlots: slots, resolvedSlots, summary };
  });
  const afterGreen = await greenCount();

  // unlink-on-type: typing a non-matching phrase un-links the artist (white bar + ＋), keeping the text
  const unlink = await page.evaluate(async () => {
    const tc = window.__trackCannon;
    const t = tc.model.tracks.find(t => t.slots[0].committed && t.slots.length === 1);
    const tr = [...document.querySelectorAll('#tc-panel .tc-mirror tbody tr')].find(r => r.dataset.tk === t.mi + ':' + t.ti);
    const inp = tr.querySelector('.tc-search input.nm'); const search = inp.closest('.tc-search');
    inp.focus(); inp.value = 'Zzz Nonexistent Band'; inp.dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 90));
    const status = (document.querySelector('#tc-panel .tc-hstatus') || {}).textContent;
    return { uncommitted: !t.slots[0].committed, query: t.slots[0].query, whiteBar: !search.classList.contains('matched'), hasPlus: !!search.querySelector('.mk'), status };
  });

  await page.screenshot({ path: resolve(LOG_DIR, 'after.png'), fullPage: true });

  // ── verify Original (per-track) reset via the exposed API ──
  const interactive = await page.evaluate(() => {
    const tc = window.__trackCannon;
    const out = {};
    const r0 = tc.model.tracks[0];
    const before = tc.readTracklist().find(x => x.mi === r0.mi && x.ti === r0.ti);
    tc.resetTrack(r0);
    const after = tc.readTracklist().find(x => x.mi === r0.mi && x.ti === r0.ti);
    out.track0 = { title: r0.title.slice(0, 24), beforeResolved: before.names.every(n => n.artistGid), afterResolved: after.names.every(n => n.artistGid), afterNames: after.names.map(n => ({ credited: n.creditedAs, gid: !!n.artistGid })) };
    return out;
  });
  log('focus a SET field (no typing) → search results:', JSON.stringify(setFocus));
  log('combo search → picked from pop (' + userCheck.popCount + ' results) · status=user:', userCheck.userStatus, '· green search bar:', userCheck.greenBar);
  log('propagation (all mode):', JSON.stringify(propCheck));
  log('propagation across SET tracks:', JSON.stringify(setProp));
  log('unlink-on-type:', JSON.stringify(unlink));
  log('Original reset on track 1:', JSON.stringify(interactive.track0));
  // close the panel and capture the clean tracklist (the artist column, resolved/green)
  await page.locator('#tc-panel [data-act="close"]').click().catch(() => {});
  await page.waitForTimeout(300);
  const tbl = page.locator('table.tbl').first();
  await (tbl.count().then(n => n ? tbl.screenshot({ path: resolve(LOG_DIR, 'tracklist.png') }) : page.screenshot({ path: resolve(LOG_DIR, 'tracklist.png'), fullPage: true }))).catch(() => page.screenshot({ path: resolve(LOG_DIR, 'tracklist.png'), fullPage: true }));
  await writeFile(resolve(LOG_DIR, 'report.json'), JSON.stringify(report, null, 2));
  await writeFile(resolve(LOG_DIR, 'console.log'), cons.join('\n'));

  log('── tracklist after Apply ──');
  report.summary.forEach(r => console.log('   ', String(r.n).padStart(2), r.title.padEnd(30), '→', r.artists));
  log(`resolved slots: ${report.resolvedSlots}/${report.totalSlots}`);
  log(`green fields: ${beforeGreen} → ${afterGreen}`);
  log('artifacts in', LOG_DIR);
  if (!HEADED) await ctx.close();
}
main().catch(e => { console.error(e); process.exit(1); });
