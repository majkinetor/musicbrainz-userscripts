// Probe #190 — an exact (credited-as) match must apply at ANY cutoff.
// Seeds the maintainer's release, sets Cutoff = "tolerance", runs recording
// auto-match, and checks that A2 / A4 (credited-as tracks: credited name differs
// from the artist entity) get linked as EXACT — they were skipped before the fix.

import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const SEED_JSON = resolve(HERE, 'dupes-ref', 'seed-190.json');
const HEADED = process.argv.includes('--headed');
const ORIGIN = 'https://musicbrainz.org';
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const LOG_DIR = resolve(HERE, 'logs', '190-' + stamp);
const log = (...a) => console.log('[probe-190]', ...a);

async function main() {
  await mkdir(LOG_DIR, { recursive: true });
  const params = JSON.parse(await readFile(SEED_JSON, 'utf8'));
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 2 });
  ctx.on('page', async p => { try { const u = p.url(); if (u && u !== 'about:blank' && /\/(artist|label)\/(add|create)/.test(u)) await p.close(); } catch {} });
  const page = ctx.pages()[0] || await ctx.newPage();
  const consoleLines = []; page.on('console', m => consoleLines.push(`${m.type().padEnd(7)} ${m.text()}`));
  page.on('pageerror', e => consoleLines.push(`[pageerror] ${e.name}: ${e.message}`));

  await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('Not logged in.'); await ctx.close(); process.exit(3); }
  await page.evaluate(() => {
    const KEY = 'apolloEditor.settings.v1'; const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    s.apolloEnabled = true; s.replaceRecordings = true; s.recCutoff = 'tolerance'; s.autoMatchRec = false;
    localStorage.setItem(KEY, JSON.stringify(s));
  });

  await page.evaluate(({ origin, params }) => {
    const f = document.createElement('form'); f.method = 'POST'; f.action = origin + '/release/add'; f.style.display = 'none';
    for (const [k, v] of params) { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; f.appendChild(i); }
    document.body.appendChild(f); f.submit();
  }, { origin: ORIGIN, params });
  await page.waitForLoadState('domcontentloaded');
  if (await page.locator('h1', { hasText: /Confirm form submission/i }).count().catch(() => 0)) {
    await page.locator('button[type=submit]', { hasText: /Continue/i }).first().click();
    await page.waitForLoadState('domcontentloaded');
  }
  await page.waitForFunction(() => { try { const e = window.MB && window.MB.releaseEditor; return e && e.rootField && e.rootField.release && e.rootField.release(); } catch { return false; } }, null, { timeout: 120000 }).catch(() => log('editor not ready'));
  await page.addScriptTag({ content: scriptCode });
  await page.waitForTimeout(1500);

  // The shared form has no artist MBIDs, so resolve A2/A4's track artist to its real
  // entity (keeping the *credited* name) — the state you'd be in after Apollo's artist
  // matcher. A2 → "Machuca Cumbia", A4 → "Carlos Haayen". This is what makes them a
  // credited-as match (same entity, different credited text).
  const resolved = await page.evaluate(() => {
    const u = v => { try { return typeof v === 'function' ? v() : v; } catch { return undefined; } };
    const tracks = u((u(window.MB.releaseEditor.rootField.release().mediums) || [])[0].tracks) || [];
    const ents = { 1: { gid: 'c31f5852-efe4-4ed4-812d-e13c7d03cf5b', name: 'Machuca Cumbia' }, 3: { gid: '9eb03926-4baa-4ef2-8a6a-890934dac52d', name: 'Carlos Haayen' } };
    const done = {};
    for (const i of Object.keys(ents)) {
      try {
        const n0 = (u(u(tracks[i].artistCredit).names) || [])[0];
        const ent = window.MB.entity({ entityType: 'artist', gid: ents[i].gid, name: ents[i].name }, 'artist');
        if (typeof n0.artist === 'function') n0.artist(ent); else n0.artist = ent;
        const gids = (u(u(tracks[i].artistCredit).names) || []).map(n => n.artist && u(u(n.artist).gid)).filter(Boolean);
        done[i] = gids;
      } catch (e) { done[i] = 'ERR:' + e.message; }
    }
    return done;
  });
  log('resolved track artist gids:', JSON.stringify(resolved));

  // enter the Recordings tab (auto-match off), then trigger Match on the resolved state — all
  // via JS so jQuery-UI panel visibility doesn't block us.
  await page.evaluate(() => {
    const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#recordings"]')
      || [...document.querySelectorAll('#release-editor ul.ui-tabs-nav a, a')].find(x => /recordings/i.test(x.getAttribute('href') || '') || /^\s*Recordings\s*$/i.test(x.textContent || ''));
    if (a) a.click();
  });
  await page.waitForFunction(() => document.querySelector('.tc-rectbl tr.tc-recrow'), null, { timeout: 20000 }).catch(() => log('rec rows not found'));
  await page.waitForTimeout(800);
  await page.evaluate(() => { const b = document.querySelector('.tc-rec-am'); if (b) b.click(); });
  await page.waitForFunction(() => /linked \d+ of \d+/.test(document.querySelector('.tc-rec-amstatus')?.textContent || ''), null, { timeout: 90000 }).catch(() => log('auto-match status not seen'));
  await page.waitForTimeout(1500);

  const res = await page.evaluate(() => {
    const u = v => { try { return typeof v === 'function' ? v() : v; } catch { return undefined; } };
    const tracks = u((u(window.MB.releaseEditor.rootField.release().mediums) || [])[0].tracks) || [];
    const info = (i) => {
      const t = tracks[i]; const rec = u(t && t.recording);
      const row = document.querySelector(`.tc-rectbl tr.tc-recrow[data-mi="0"][data-ti="${i}"]`);
      const dot = row && row.querySelector('.tc-dot');
      return { num: u(t && t.number), title: u(t && t.name), linked: !!(rec && u(rec.gid)), dotColor: dot ? dot.style.background : null, dotTitle: dot ? dot.title : null };
    };
    const all = tracks.map((_, i) => info(i));
    return { a2: info(1), a4: info(3), linkedCount: all.filter(x => x.linked).length, total: tracks.length,
      status: document.querySelector('.tc-rec-amstatus')?.textContent || '' };
  });
  log('cutoff=tolerance · auto-match status:', JSON.stringify(res.status));
  log('linked', res.linkedCount, 'of', res.total);
  log('A2:', JSON.stringify(res.a2));
  log('A4:', JSON.stringify(res.a4));

  const tbl = await page.$('.tc-rectbl');
  if (tbl) await tbl.screenshot({ path: resolve(LOG_DIR, 'recordings.png') }).catch(() => {});
  await writeFile(resolve(LOG_DIR, 'console.log'), consoleLines.join('\n'));
  const fatal = consoleLines.filter(l => l.startsWith('[pageerror]'));
  log('pageerrors:', fatal.length); fatal.slice(0, 4).forEach(l => console.log('   ', l));

  // exact dot is blue (#2f6fd6 → rgb(47,111,214)); the fix means A2/A4 link at "tolerance"
  const exactBlue = c => /47, ?111, ?214/.test(c || '');
  const pass = res.a2.linked && res.a4.linked && exactBlue(res.a2.dotColor) && exactBlue(res.a4.dotColor) && fatal.length === 0;
  log('RESULT:', pass ? 'PASS' : 'CHECK', '— artifacts in', LOG_DIR);
  if (!HEADED) await ctx.close(); else log('headed — leaving open');
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
