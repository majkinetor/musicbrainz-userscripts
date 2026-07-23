// Probe #445 — the unified exact-identity resolver (matchSlot → resolveByExactAlias).
// (1) an exact NAME hit the /ws/js search under-ranked below a look-alike ("Tee Vee"
//     a8122172, no aliases, ranked below "Tee-vee") resolves as a NAME match, not "via alias".
// (2) case-exact beats case-fold: a credit matching several artists case-INSENSITIVELY but
//     exactly ONE case-EXACTLY prefers that one — "Kasane Teto" hits both `kasane teto`
//     (lolicore, name) and `重音テト` (alias "Kasane Teto"); the case-exact alias wins.
// (The old STOO ambiguity fixture was dropped: the artist named "STOO" that made it
//  ambiguous has since been merged/removed from MB, so it's no longer a stable case — and
//  STOO now needs the short-alias auto-commit guard, tracked separately with majkinetor.)
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const O = 'https://musicbrainz.org';
const REL = 'a0c1a69e-e1a1-479f-a0ba-e01fb8d0ca87';   // "Deadspace" (from the issue)
const TEEVEE = 'a8122172', KASANE = '98f7cec1';
const log = (...a) => console.log('[probe-445]', ...a);

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

const r = await page.evaluate(async () => {
  const A = window.__apolloEditor;
  const m = async who => { const x = await A.matchSlot(who, null, null, []); return { gid: x.entity && x.entity.gid.slice(0, 8), name: x.entity && x.entity.name, src: x.source, conf: x.confidence }; };
  return { teeVee: await m('Tee Vee'), kasane: await m('Kasane Teto') };
});
log('Tee Vee     →', r.teeVee.gid, `"${r.teeVee.name}"`, `source=${r.teeVee.src} conf=${r.teeVee.conf}`);
log('Kasane Teto →', r.kasane.gid, `"${r.kasane.name}"`, `source=${r.kasane.src} conf=${r.kasane.conf}`);

let fail = 0; const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(r.teeVee.gid === TEEVEE, `"Tee Vee" resolves to the exact-name artist ${TEEVEE} (got ${r.teeVee.gid})`);
check(r.teeVee.src === 'search' && r.teeVee.conf === 'high', `"Tee Vee" is a confident NAME match (search/high) — got ${r.teeVee.src}/${r.teeVee.conf}`);
// #445 case-exact-beats-case-fold: the case-exact alias holder wins over the wrong-case name
check(r.kasane.gid === KASANE, `"Kasane Teto" resolves to 重音テト ${KASANE} (case-exact alias) — got ${r.kasane.gid}`);
check(r.kasane.src === 'alias', `"Kasane Teto" is an alias match — got source=${r.kasane.src}`);
check(r.kasane.conf === 'high', `"Kasane Teto" is now a confident auto-link (case-exact broke the tie) — got conf=${r.kasane.conf}`);
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
