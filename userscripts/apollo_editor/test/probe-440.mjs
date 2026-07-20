// Probe #440 — recording matching via duplicates (position + similarity).
// On the "Zaïre 74" RG, the recording "Salongo Part 1" (bb07aeb2) sits at position
// 1.3 in one edition and "Salongo, Pt. 1" in another — too different for the title
// matcher (edit-distance > tolerance), but the position index + similarity gate
// resolve it. Verifies the primitives Apollo's auto-matcher now uses.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const O = 'https://musicbrainz.org';
const REL = '7e0aee4e-fa3e-4c9f-a57f-d41f7b23ea22';       // Zaire 74: The African Artists
const RG  = '74c48185-1502-4413-b346-13b732094ccb';
const SALONGO = 'bb07aeb2';                                // "Salongo Part 1" recording, at position 1.3
const log = (...a) => console.log('[probe-440]', ...a);

const code = await readFile(SCRIPT, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1600, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });
await page.goto(`${O}/release/${REL}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForSelector('#release-editor, form', { timeout: 30000 }).catch(() => {});
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, { timeout: 20000 }).catch(() => {});
if (!await page.evaluate(() => !!window.__apolloEditor)) { log('apollo API not exposed'); await ctx.close(); process.exit(2); }

// 1) the position index from the RG's editions holds bb07aeb2 at "1.3"
const posHit = await page.evaluate(async (rg) => {
  const idx = await window.__apolloEditor.fetchRgPositionIndex(rg);
  const at13 = (idx.get('1.3') || []).map(c => ({ gid: c.gid.slice(0, 8), name: c.name }));
  return { size: idx.size, at13 };
}, RG);
log('1) position index "1.3":', JSON.stringify(posHit.at13));

// 2) the similarity gate bridges the title wording difference, and the title matcher would NOT
const sim = await page.evaluate(() => ({
  bridges: window.__apolloEditor.recSimilar('Salongo, Pt. 1', 'Salongo Part 1'),
  rejectsUnrelated: window.__apolloEditor.recSimilar('Salongo, Pt. 1', 'Magali Ya Kinshasa'),
}));
log('2) recSimilar bridges Pt.1/Part 1 =', sim.bridges, '| rejects unrelated =', sim.rejectsUnrelated);

// 3) end-to-end primitive: for track "Salongo, Pt. 1" at 1.3, a similar-titled candidate is found
const resolved = await page.evaluate(async (rg) => {
  const idx = await window.__apolloEditor.fetchRgPositionIndex(rg);
  const cands = (idx.get('1.3') || []).filter(c => window.__apolloEditor.recSimilar(c.name, 'Salongo, Pt. 1'));
  return cands.map(c => c.gid.slice(0, 8));
}, RG);
log('3) position+similarity candidates for "Salongo, Pt. 1":', JSON.stringify(resolved));

let fail = 0; const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(posHit.at13.some(c => c.gid === SALONGO), 'position index holds the Salongo recording at slot 1.3');
check(sim.bridges === true, 'similarity gate bridges "Salongo, Pt. 1" ↔ "Salongo Part 1"');
check(sim.rejectsUnrelated === false, 'similarity gate rejects an unrelated same-slot title');
check(resolved.includes(SALONGO), 'position + similarity resolves the differently-worded recording');
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
