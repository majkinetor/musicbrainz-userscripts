// Probe #186 — detailed recordings highlighting.
// Enables the opt-in setting, opens a release with linked recordings, synthesizes
// a few title/length differences in-page (LOCAL ONLY — never saved), and verifies
// the per-character title diff (.tc-dh) + graded length shade (.tc-dh-len) render
// without errors. Captures a screenshot of the recordings table.
//
// Needs the shared logged-in profile (.pw-profile).

import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE        = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const HEADED      = process.argv.includes('--headed');
const ORIGIN      = 'https://musicbrainz.org';
const RELEASE     = 'ec116461-5b0d-4c98-bb44-a4de5de63076';   // Daft Punk — Random Access Memories (13 tracks, recordings)

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const LOG_DIR = resolve(HERE, 'logs', '186-' + stamp);
const log = (...a) => console.log('[probe-186]', ...a);

async function main() {
  await mkdir(LOG_DIR, { recursive: true });
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !HEADED, viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 3,
  });
  ctx.on('page', async p => { try { const u = p.url(); if (u && u !== 'about:blank' && /\/(artist|label)\/(add|create)/.test(u)) await p.close(); } catch {} });

  const page = ctx.pages()[0] || await ctx.newPage();
  const consoleLines = [];
  page.on('console', m => consoleLines.push(`${m.type().padEnd(7)} ${m.text()}`));
  page.on('pageerror', e => consoleLines.push(`[pageerror] ${e.name}: ${e.message}`));

  await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('Not logged in in .pw-profile.'); await ctx.close(); process.exit(3); }

  // enable the opt-in setting before the script boots
  await page.evaluate(() => {
    const KEY = 'apolloEditor.settings.v1';
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    s.apolloEnabled = true; s.replaceRecordings = true; s.recDetailedHl = true; s.recLenTol = 5;
    localStorage.setItem(KEY, JSON.stringify(s));
  });

  log('opening release edit page…');
  await page.goto(`${ORIGIN}/release/${RELEASE}/edit`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    try { const e = window.MB && window.MB.releaseEditor; return e && e.rootField && e.rootField.release && e.rootField.release(); } catch { return false; }
  }, null, { timeout: 120000 }).catch(() => log('editor not ready (timeout)'));

  await page.addScriptTag({ content: scriptCode });
  await page.waitForTimeout(2500);

  // switch to the Recordings step
  await page.evaluate(() => {
    const a = [...document.querySelectorAll('ul.ui-tabs-nav a, a, button')].find(x => /^\s*Recordings\s*$/i.test(x.textContent || ''));
    if (a) a.click();
  });
  await page.waitForTimeout(1500);

  // synthesize LOCAL, UNSAVED diffs on the first few recordings so the highlight has something to show
  const synth = await page.evaluate(() => {
    const u = v => { try { return typeof v === 'function' ? v() : v; } catch { return undefined; } };
    const set = (obs, val) => { try { if (typeof obs === 'function') obs(val); } catch (e) {} };
    const rel = u(window.MB.releaseEditor.rootField.release());
    const med = (u(rel.mediums) || [])[0]; if (!med) return { ok: false };
    const tracks = u(med.tracks) || [];
    const edits = [];
    const tweaks = [
      { i: 0, name: t => t + ' (Remastered)', dLen: 2500 },   // char diff (suffix) + mid shade
      { i: 1, name: t => t.replace(/o/i, '0') + ' [Edit]', dLen: 8000 },   // char subs + solid red
      { i: 2, name: t => 'The ' + t, dLen: 600 },   // prefix char diff + sub-1s (no shade)
    ];
    for (const tw of tweaks) {
      const tk = tracks[tw.i]; if (!tk) continue;
      const rec = u(tk.recording); if (!rec) continue;
      // Mutate the TRACK side (editable observables) so it differs from its linked
      // recording — same effect as the editor user typing a different title/length.
      const recName = u(rec.name) || '';
      const recLen = u(rec.length) || 210000;
      set(tk.name, tw.name(recName));
      set(tk.length, recLen + tw.dLen);
      edits.push({ recName, trackNow: u(tk.name), recLen, trackLen: u(tk.length), diffs: typeof tk.titleDiffersFromRecording === 'function' ? tk.titleDiffersFromRecording() : '?' });
    }
    if (window.__apolloEditor && window.__apolloEditor.showRecMirror) window.__apolloEditor.showRecMirror();
    return { ok: true, edits };
  });
  log('synthesized diffs:', JSON.stringify(synth.edits || synth));
  await page.waitForTimeout(1200);

  const found = await page.evaluate(() => ({
    rows: document.querySelectorAll('.tc-rectbl tr.tc-recrow').length,
    dhSpans: document.querySelectorAll('.tc-rectbl .tc-dh').length,
    dhCells: document.querySelectorAll('.tc-rectbl td.tc-dh-cell').length,
    dhLen: document.querySelectorAll('.tc-rectbl td.tc-dh-len').length,
    sampleTitleHtml: (document.querySelector('.tc-rectbl td.tc-dh-cell') || {}).innerHTML || null,
  }));
  log('recordings rows:', found.rows, '| .tc-dh spans:', found.dhSpans, '| dh-cells:', found.dhCells, '| dh-len:', found.dhLen);
  log('sample diffed title cell:', found.sampleTitleHtml);

  const tbl = await page.$('.tc-rectbl');
  if (tbl) await tbl.screenshot({ path: resolve(LOG_DIR, 'recordings-detailed.png') }).catch(() => {});
  await writeFile(resolve(LOG_DIR, 'console.log'), consoleLines.join('\n'));

  const fatal = consoleLines.filter(l => l.startsWith('[pageerror]'));
  log('pageerrors:', fatal.length); fatal.slice(0, 5).forEach(l => console.log('   ', l));

  const pass = found.rows > 0 && found.dhSpans > 0 && found.dhLen > 0 && fatal.length === 0;
  log('RESULT:', pass ? 'PASS' : 'CHECK', '— artifacts in', LOG_DIR);

  if (!HEADED) await ctx.close(); else log('headed — leaving open');
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
