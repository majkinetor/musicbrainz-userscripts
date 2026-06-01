// Probe the release-editor model for the methods Track Cannon's mirror table needs:
// remove track, move/reorder, read+write title & length, track number/position.
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
const LOG_DIR = resolve(HERE, 'logs', 'probe-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));

async function main() {
  if (!existsSync(SEED_PATH)) { console.error('missing seed'); process.exit(2); }
  await mkdir(LOG_DIR, { recursive: true });
  const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1000 } });
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
    const w = window, u = v => (typeof v === 'function' ? v() : v);
    const isObs = v => typeof v === 'function' && typeof v.peek === 'function';
    const ed = w.MB.releaseEditor;
    const rel = u(ed.rootField.release);
    const med = u(rel.mediums)[0];
    const track = u(med.tracks)[0];
    const fns = o => { const r = []; let p = o; const seen = new Set(); while (p && p !== Object.prototype) { for (const k of Object.getOwnPropertyNames(p)) { if (seen.has(k)) continue; seen.add(k); try { if (typeof o[k] === 'function' && !isObs(o[k])) r.push(k); } catch {} } p = Object.getPrototypeOf(p); } return r.sort(); };
    const obsKeys = o => Object.keys(o).filter(k => isObs(o[k])).sort();
    const grep = (arr, re) => arr.filter(k => re.test(k));
    const allFns = fns(ed).concat(fns(med).map(k => 'medium.' + k)).concat(fns(track).map(k => 'track.' + k));
    return {
      editorFns: fns(ed),
      editorUtils: ed.utils ? Object.keys(ed.utils) : null,
      medium_fns: fns(med),
      medium_obs: obsKeys(med),
      medium_tracks_isObsArray: typeof med.tracks === 'function' && typeof med.tracks.remove === 'function',
      track_fns: fns(track),
      track_obs: obsKeys(track),
      length_value: u(track.length), length_isObs: isObs(track.length),
      number_value: u(track.number), number_isObs: isObs(track.number),
      position_value: u(track.position), position_isObs: isObs(track.position),
      name_value: u(track.name),
      candidates_remove: grep(allFns, /remove|delete/i),
      candidates_move: grep(allFns, /move|swap|sort|reorder|up|down/i),
      candidates_add: grep(allFns, /add/i),
    };
  });

  await writeFile(resolve(LOG_DIR, 'ops.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log('[probe-ops] artifacts in', LOG_DIR);
  if (!HEADED) await ctx.close();
}
main().catch(e => { console.error(e); process.exit(1); });
