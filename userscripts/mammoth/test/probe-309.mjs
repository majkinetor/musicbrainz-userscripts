// #309 — "Scope per resource" (opt-in). Off (default) = one shared 'all' pool;
// on = saved notes/history namespaced per edit-note entity type. Old flat data
// migrates into the shared 'all' pool.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'mammoth.user.js');
const userJs = await readFile(SCRIPT_PATH, 'utf8');

const FLAT = { saved: [{ id: 'a', text: 'note one', ts: 1 }, { id: 'b', text: 'note two', ts: 2 }], history: [] };
const MULTI = { all: { saved: [{ id: 'g', text: 'global note', ts: 0 }], history: [] }, release: { saved: [{ id: 'r1', text: 'rel A', ts: 1 }, { id: 'r2', text: 'rel B', ts: 2 }], history: [] }, artist: { saved: [{ id: 'x1', text: 'artist only note', ts: 1 }], history: [] } };

async function check(url, store, settings, label) {
  const sets = settings ? `s.set('mammoth:settings', ${JSON.stringify(JSON.stringify(settings))});` : '';
  const shim = `(() => { const s = new Map(); s.set('mammoth:data', ${JSON.stringify(JSON.stringify(store))}); ${sets} window.GM_getValue=(k,d)=>s.has(k)?s.get(k):d; window.GM_setValue=(k,v)=>{s.set(k,v);}; window.unsafeWindow=window; })();`;
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1300, height: 1000 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForSelector('textarea.edit-note', { timeout: 60000, state: 'attached' });
  await page.evaluate(shim); await page.addScriptTag({ content: userJs });
  await page.waitForSelector('.mmth-side', { timeout: 30000, state: 'attached' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => { const chip = document.querySelector('.mmth-scope'); return { savedRows: document.querySelectorAll('.mmth-list .mmth-row').length, first: document.querySelector('.mmth-list .mmth-row .mmth-txt')?.textContent, chipShown: chip ? getComputedStyle(chip).display !== 'none' : false, chip: chip?.textContent }; });
  console.log(label, JSON.stringify(r));
  await ctx.close();
  return r;
}

// A) scoping OFF (default): old flat migrates to shared pool, shown everywhere; chip hidden
const A = await check('https://musicbrainz.org/artist/056e4f3e-d505-4dad-8ec1-d04f521cbb56/edit', FLAT, null, 'off/flat@artist ');
// B) scoping ON: artist page shows artist pool only; chip visible
const B = await check('https://musicbrainz.org/artist/056e4f3e-d505-4dad-8ec1-d04f521cbb56/edit', MULTI, { scopePerResource: true }, 'on/multi@artist  ');
// C) scoping ON: release page shows release pool
const C = await check('https://musicbrainz.org/release/aa6c4473-3528-41c2-b55b-d9e18bdba4ff/edit', MULTI, { scopePerResource: true }, 'on/multi@release ');
const ok = A.savedRows === 2 && !A.chipShown && B.savedRows === 1 && B.first === 'artist only note' && B.chipShown && B.chip === 'artist' && C.savedRows === 2;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
