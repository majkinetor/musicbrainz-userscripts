// Probe #450 — a newly-created (or pasted-MBID) artist's disambiguation wasn't shown in
// the tracklist: pickArtist never cached it (only search results were), and the cell read
// only the cache. Picks the entity "Beleth" (fa3f5742, comment "vocalist in NOCTEM") into a
// slot and asserts the grey (disambiguation) shows.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const O = 'https://musicbrainz.org';
const REL = '6a938e06-fbcb-4aed-9e9b-93fb1db601ac';   // "Crusher of Souls" (from the issue)
const BELETH = 'fa3f5742-b0d1-4a8e-b87d-b828dc22c02e';
const COMMENT = 'vocalist in NOCTEM';
const log = (...a) => console.log('[probe-450]', ...a);

const code = await readFile(SCRIPT, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1500, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });
await page.goto(`${O}/release/${REL}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForSelector('#release-editor, form', { timeout: 30000 }).catch(() => {});
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, { timeout: 20000 }).catch(() => {});
if (!await page.evaluate(() => !!window.__apolloEditor)) { log('apollo API not exposed'); await ctx.close(); process.exit(2); }
await page.evaluate(() => { try { window.__apolloEditor.showMirror(); } catch (e) {} });
await page.waitForTimeout(800);

const r = await page.evaluate(async (BELETH) => {
  const A = window.__apolloEditor;
  const ent = await A.fetchEntity(BELETH);
  const slot = A.model && A.model.tracks && A.model.tracks[0] && A.model.tracks[0].slots && A.model.tracks[0].slots[0];
  if (!slot) return { err: 'no slot' };
  A.pickArtist(slot, ent);
  await new Promise(z => setTimeout(z, 300));
  // read the disambiguation the model/table now expose for track 0's first artist
  const s0 = A.model.tracks[0].slots[0];
  const domDisamb = [...document.querySelectorAll('.tc-bar-disamb')].map(e => e.textContent);
  return { entComment: ent && ent.comment, slotName: s0.name, slotComment: s0.entity && s0.entity.comment, domDisamb };
}, BELETH);
log('fetched entity comment:', JSON.stringify(r.entComment));
log('slot after pick:', r.slotName, '| entity.comment:', JSON.stringify(r.slotComment));
log('rendered .tc-bar-disamb spans:', JSON.stringify(r.domDisamb));

let fail = 0; const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(r.entComment === COMMENT, `fetchEntity returns the disambiguation in .comment ("${r.entComment}")`);
check(r.domDisamb && r.domDisamb.some(t => t.includes(COMMENT)), `the tracklist now renders the disambiguation "(${COMMENT})" for the picked artist`);
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
