// #309 — saved notes/history are scoped per edit-note entity type.
//  - old flat { saved, history } migrates into the 'release' scope
//  - each page shows only its type's notes; a toolbar chip names the scope
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'mammoth.user.js');
const userJs = await readFile(SCRIPT_PATH, 'utf8');

const FLAT = { saved: [{ id: 'a', text: 'release note one', ts: 1 }, { id: 'b', text: 'release note two', ts: 2 }], history: [{ text: 'h1', ts: 1 }] };
const MULTI = { release: { saved: [{ id: 'r1', text: 'rel A', ts: 1 }, { id: 'r2', text: 'rel B', ts: 2 }], history: [] }, artist: { saved: [{ id: 'x1', text: 'artist only note', ts: 1 }], history: [] } };

async function check(url, store, label) {
  const shim = `(() => { const s = new Map(); s.set('mammoth:data', ${JSON.stringify(JSON.stringify(store))}); window.GM_getValue=(k,d)=>s.has(k)?s.get(k):d; window.GM_setValue=(k,v)=>{s.set(k,v);}; window.unsafeWindow=window; })();`;
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1300, height: 1000 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForSelector('textarea.edit-note', { timeout: 60000, state: 'attached' });
  await page.evaluate(shim); await page.addScriptTag({ content: userJs });
  await page.waitForSelector('.mmth-side', { timeout: 30000, state: 'attached' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => ({ scope: document.querySelector('.mmth-scope')?.textContent, savedRows: document.querySelectorAll('.mmth-list .mmth-row').length, first: document.querySelector('.mmth-list .mmth-row .mmth-txt')?.textContent }));
  console.log(label, JSON.stringify(r));
  await ctx.close();
  return r;
}

const A = await check('https://musicbrainz.org/artist/056e4f3e-d505-4dad-8ec1-d04f521cbb56/edit', FLAT, 'flat@artist  ');
const B = await check('https://musicbrainz.org/release/aa6c4473-3528-41c2-b55b-d9e18bdba4ff/edit', FLAT, 'flat@release ');
const C = await check('https://musicbrainz.org/artist/056e4f3e-d505-4dad-8ec1-d04f521cbb56/edit', MULTI, 'multi@artist ');
const ok = A.scope === 'artist' && A.savedRows === 0 && B.scope === 'release' && B.savedRows === 2 && C.savedRows === 1 && C.first === 'artist only note';
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
