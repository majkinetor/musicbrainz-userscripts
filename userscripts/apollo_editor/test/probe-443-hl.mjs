// Probe #443 (part 2) — the confusable/invisible marking must be gated by DETAILED
// HIGHLIGHTING, not by the "Enlarge punctuation" px size. At 0px a differing invisible
// char (a no-break space) used to vanish entirely (the master-switch bug majkinetor
// flagged); now it still shows its glyph + wash, just un-enlarged. px only enlarges.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const O = 'https://musicbrainz.org';
const REL = 'b58500ec-aa13-4f9d-b1f2-1151c08a1c7e';   // any release — we only need Apollo loaded
const log = (...a) => console.log('[probe-443-hl]', ...a);

const code = await readFile(SCRIPT, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1400, height: 900 } });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });
await page.goto(`${O}/release/${REL}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForSelector('#release-editor, form', { timeout: 30000 }).catch(() => {});
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, { timeout: 20000 }).catch(() => {});
if (!await page.evaluate(() => !!window.__apolloEditor)) { log('apollo API not exposed'); await ctx.close(); process.exit(2); }

const r = await page.evaluate(() => {
  const A = window.__apolloEditor, S = A.settings;
  const str = 'Love' + String.fromCharCode(0x00A0) + 'Song';   // NO-BREAK SPACE between the words
  const run = (hl, px) => { S.recDetailedHl = hl; S.recPunctSize = px; return A.dhRun(str); };
  return { hlOn0px: run(true, 0), hlOn3px: run(true, 3), hlOff0px: run(false, 0), hlOff3px: run(false, 3) };
});
const has = (s, sub) => s.includes(sub);
log('detailed-HL ON, 0px :', r.hlOn0px);
log('detailed-HL ON, 3px :', r.hlOn3px);
log('detailed-HL OFF, 0px:', r.hlOff0px);
log('detailed-HL OFF, 3px:', r.hlOff3px);

let fail = 0; const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(has(r.hlOn0px, 'tc-cf-inv'), 'HL on + 0px: the no-break space is MARKED (tc-cf-inv) — no longer hidden');
check(has(r.hlOn0px, '␣'), 'HL on + 0px: the invisible char draws its visible glyph');
check(!has(r.hlOn0px, 'font-size'), 'HL on + 0px: NOT enlarged (px only controls enlargement)');
check(has(r.hlOn3px, 'tc-cf-inv') && has(r.hlOn3px, 'font-size'), 'HL on + 3px: marked AND enlarged');
check(!has(r.hlOff0px, 'tc-cf'), 'HL off + 0px: plain, no marking (gated by detailed HL)');
check(has(r.hlOff3px, 'tc-cf-inv'), 'HL off + 3px: px>0 still enables the marker (enlarge feature works standalone)');
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
