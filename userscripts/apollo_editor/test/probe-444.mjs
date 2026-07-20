// Probe #444 — the recordings detailed-highlight must char-diff a credited-as TEXT
// difference for the SAME artist entity (previously only a different linked entity was
// highlighted; a credited-as-only change showed nothing). It must NOT box a same-entity
// credit whole (that's for a different entity) and must NOT affect matching.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const O = 'https://musicbrainz.org';
const REL = 'c1085d7a-1899-4825-9fdb-f2c896fcae90';   // "No Looking Back" (from the issue)
const G1 = '11111111-1111-1111-1111-111111111111', G2 = '22222222-2222-2222-2222-222222222222';
const log = (...a) => console.log('[probe-444]', ...a);

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

const r = await page.evaluate(({ G1, G2 }) => {
  const A = window.__apolloEditor, S = A.settings; S.recDetailedHl = true; S.recPunctSize = 3;
  const art = (name, gid) => ({ name, gid, comment: '', join: '' });
  // 1) SAME entity (G1), credited-as text differs by a prefix: "DJ Vadim" vs "Vadim"
  const trackSide = A.acLinksDiff([art('DJ Vadim', G1)], [art('Vadim', G1)], true);
  // 1b) SAME entity, MUTUAL spelling difference: "Vadym" vs "Vadim" — both sides have a unique char
  const recSideMut = A.acLinksDiff([art('Vadym', G1)], [art('Vadim', G1)], true);
  // 2) SAME entity, SAME text → no diff highlight
  const sameText  = A.acLinksDiff([art('Vadim', G1)], [art('Vadim', G1)], true);
  // 3) DIFFERENT entity → boxed whole (existing behavior preserved)
  const diffEnt   = A.acLinksDiff([art('Vadim', G1)], [art('Someone', G2)], true);
  return { trackSide, recSideMut, sameText, diffEnt };
}, { G1, G2 });
const has = (s, sub) => s.includes(sub);
const count = (s, sub) => s.split(sub).length - 1;
log('1) same-entity, prefix differs — track side:', r.trackSide);
log('1b) same-entity, mutual diff — one side     :', r.recSideMut);
log('2) same-entity, same text:', r.sameText);
log('3) different entity (boxed):', r.diffEnt);

let fail = 0; const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(has(r.trackSide, '<span class="tc-dh">DJ </span>'), 'same-entity credited-as diff highlights the differing chars "DJ " only (#444)');
check(has(r.recSideMut, 'tc-dh'), 'a mutual spelling difference (Vadym↔Vadim) highlights the unique char');
check(has(r.trackSide, '/artist/' + G1) && !has(r.trackSide, '<span class="tc-dh"><a'), 'link preserved, and NOT boxed whole (only chars diffed)');
check(!has(r.sameText, 'tc-dh'), 'an identical credited-as shows NO highlight');
check(has(r.diffEnt, '<span class="tc-dh"><a'), 'a DIFFERENT entity is still boxed whole (unchanged)');
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
