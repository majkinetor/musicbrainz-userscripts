// Probe #189 — paste a recording MBID into the recordings picker search.
// Opens the recordings tab, opens a track's picker, pastes another recording's
// MBID into the search field, and verifies it resolves to that recording as a
// clickable result and that clicking it links the recording.

import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const HEADED = process.argv.includes('--headed');
const ORIGIN = 'https://musicbrainz.org';
const RELEASE = 'ec116461-5b0d-4c98-bb44-a4de5de63076';   // Random Access Memories
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const LOG_DIR = resolve(HERE, 'logs', '189-' + stamp);
const log = (...a) => console.log('[probe-189]', ...a);

async function main() {
  await mkdir(LOG_DIR, { recursive: true });
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
  ctx.on('page', async p => { try { const u = p.url(); if (u && u !== 'about:blank' && /\/(artist|label)\/(add|create)/.test(u)) await p.close(); } catch {} });
  const page = ctx.pages()[0] || await ctx.newPage();
  const consoleLines = []; page.on('console', m => consoleLines.push(`${m.type().padEnd(7)} ${m.text()}`));
  page.on('pageerror', e => consoleLines.push(`[pageerror] ${e.name}: ${e.message}`));

  await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('Not logged in.'); await ctx.close(); process.exit(3); }
  await page.evaluate(() => { const KEY = 'apolloEditor.settings.v1'; const s = JSON.parse(localStorage.getItem(KEY) || '{}'); s.apolloEnabled = true; s.replaceRecordings = true; localStorage.setItem(KEY, JSON.stringify(s)); });

  await page.goto(`${ORIGIN}/release/${RELEASE}/edit`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { try { const e = window.MB && window.MB.releaseEditor; return e && e.rootField && e.rootField.release && e.rootField.release(); } catch { return false; } }, null, { timeout: 120000 }).catch(() => log('editor not ready'));
  await page.addScriptTag({ content: scriptCode });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const a = [...document.querySelectorAll('ul.ui-tabs-nav a, a, button')].find(x => /^\s*Recordings\s*$/i.test(x.textContent || '')); if (a) a.click(); });
  await page.waitForSelector('.tc-rectbl tr.tc-recrow', { timeout: 20000 });

  // grab two distinct recording gids from the model: paste track 1's recording onto track 0
  const gids = await page.evaluate(() => {
    const u = v => { try { return typeof v === 'function' ? v() : v; } catch { return undefined; } };
    const med = (u(window.MB.releaseEditor.rootField.release().mediums) || [])[0];
    const tracks = u(med.tracks) || [];
    const g = i => { const r = u(tracks[i] && tracks[i].recording); return r ? u(r.gid) : null; };
    return { t0: g(0), t1: g(1) };
  });
  log('track0 rec:', gids.t0, '| track1 rec (to paste onto track0):', gids.t1);

  // open track 0's picker and inspect the current-recording line (Title - Artist(link) - Len)
  await page.click('.tc-rectbl tr.tc-recrow[data-mi="0"][data-ti="0"] .tc-recname');
  await page.waitForSelector('.tc-recpop .tc-rpk-q', { timeout: 10000 });
  const curLine = await page.evaluate(() => {
    const cur = document.querySelector('.tc-recpop .tc-rpk-cur');
    return {
      text: cur ? cur.innerText.replace(/\s+/g, ' ').trim() : null,
      recLink: !!cur?.querySelector('a[href*="/recording/"]'),
      artistLink: !!cur?.querySelector('.tc-rpk-curby a[href*="/artist/"]'),
      hasLen: !!cur?.querySelector('.tc-rpk-curlen'),
    };
  });
  log('current-recording line:', JSON.stringify(curLine));

  // paste a recording MBID → should LINK immediately and close the picker
  await page.evaluate((mbid) => { const q = document.querySelector('.tc-recpop .tc-rpk-q'); q.value = mbid; q.dispatchEvent(new Event('input', { bubbles: true })); }, gids.t1);
  await page.waitForTimeout(1800);
  const afterPaste = await page.evaluate(() => {
    const u = v => { try { return typeof v === 'function' ? v() : v; } catch { return undefined; } };
    const t = (u((u(window.MB.releaseEditor.rootField.release().mediums) || [])[0].tracks) || [])[0];
    const r = u(t && t.recording);
    return { gid: r ? u(r.gid) : null, popupOpen: !!document.querySelector('.tc-recpop') };
  });
  log('after MBID paste → track0 rec:', afterPaste.gid, '| popup still open:', afterPaste.popupOpen, '(expect linked + closed)');

  // re-open a different track's picker and paste the /recording/<mbid> URL → links immediately
  await page.click('.tc-rectbl tr.tc-recrow[data-mi="0"][data-ti="2"] .tc-recname');
  await page.waitForSelector('.tc-recpop .tc-rpk-q', { timeout: 10000 });
  await page.evaluate((mbid) => { const q = document.querySelector('.tc-recpop .tc-rpk-q'); q.value = 'https://musicbrainz.org/recording/' + mbid; q.dispatchEvent(new Event('input', { bubbles: true })); }, gids.t1);
  await page.waitForTimeout(1800);
  const urlGid = await page.evaluate(() => {
    const u = v => { try { return typeof v === 'function' ? v() : v; } catch { return undefined; } };
    const t = (u((u(window.MB.releaseEditor.rootField.release().mediums) || [])[0].tracks) || [])[2];
    const r = u(t && t.recording); return r ? u(r.gid) : null;
  });
  log('after URL paste → track2 rec:', urlGid, '(expected', gids.t1 + ')');

  await writeFile(resolve(LOG_DIR, 'console.log'), consoleLines.join('\n'));
  const fatal = consoleLines.filter(l => l.startsWith('[pageerror]'));
  log('pageerrors:', fatal.length); fatal.slice(0, 4).forEach(l => console.log('   ', l));

  const pass = curLine.recLink && curLine.artistLink && curLine.hasLen
    && afterPaste.gid === gids.t1 && !afterPaste.popupOpen && urlGid === gids.t1 && fatal.length === 0;
  log('RESULT:', pass ? 'PASS' : 'CHECK', '— artifacts in', LOG_DIR);
  if (!HEADED) await ctx.close(); else log('headed — leaving open');
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
