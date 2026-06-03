// Find MB's guess-case engine: how to compute a guessed title string (for diff detection)
// and how the editor applies it.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SEED_PATH = resolve(HERE, 'seed-saigon.local.json');
const ORIGIN = 'https://musicbrainz.org';
const HEADED = process.argv.includes('--headed');
const LOG_DIR = resolve(HERE, 'logs', 'gc-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));

async function main() {
  if (!existsSync(SEED_PATH)) { console.error('missing seed'); process.exit(2); }
  await mkdir(LOG_DIR, { recursive: true });
  const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1400, height: 900 } });
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
  await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length; } catch { return false; } }, null, { timeout: 120000 });

  const out = await page.evaluate(() => {
    const w = window, R = {}, MB = w.MB;
    R.mbKeys = Object.keys(MB).filter(k => /guess/i.test(k));
    R.hasGuessCase = !!MB.GuessCase;
    if (MB.GuessCase) {
      R.gcKeys = Object.keys(MB.GuessCase);
      R.gcMode = (() => { try { return MB.GuessCase.modeName || (MB.GuessCase.mode && MB.GuessCase.mode.name); } catch (e) { return String(e); } })();
      const tries = ['the QUICK (BROWN) fox feat. someone', 'a love story from sau ri', 'NỖI buồn con gái'];
      R.titleGuess = {}; R.artistGuess = {};
      tries.forEach(s => {
        try { R.titleGuess[s] = MB.GuessCase.title.guess(s); } catch (e) { R.titleGuess[s] = 'ERR ' + e.message; }
        try { R.artistGuess[s] = MB.GuessCase.artist.guess(s); } catch (e) { R.artistGuess[s] = 'ERR ' + e.message; }
      });
      try { R.titleSubKeys = Object.keys(MB.GuessCase.title); } catch (e) {}
    }
    const ed = MB.releaseEditor;
    R.edGuessFns = (() => { const r = []; let p = ed; const seen = new Set(); while (p && p !== Object.prototype) { for (const k of Object.getOwnPropertyNames(p)) { if (!seen.has(k)) { seen.add(k); if (/guess/i.test(k)) r.push(k); } } p = Object.getPrototypeOf(p); } return r; })();
    // does guessCaseTrackName mutate track.name?
    try {
      const t = ed.rootField.release().mediums()[0].tracks()[0];
      const before = t.name();
      R.sampleTitle = before;
    } catch (e) { R.sampleErr = String(e); }
    return R;
  });

  await writeFile(resolve(LOG_DIR, 'gc.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log('[probe-guesscase] artifacts in', LOG_DIR);
  if (!HEADED) await ctx.close();
}
main().catch(e => { console.error(e); process.exit(1); });
