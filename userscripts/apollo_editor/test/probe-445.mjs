// Probe #445 — the exact-alias resolver mislabeled a NAME match as "via exact alias".
// "Tee Vee" (a8122172) has no aliases; it matched on its NAME but the /ws/js search
// ranked a fuzzy "Tee-vee" first, so nameHigh missed it and resolveByExactAlias found
// it — then logged "via exact alias" (wrong). A TRUE alias hit (STOO → Stuart Cambridge,
// alias "Stoo") must still be labeled 'alias'. Verifies the label split (#445).
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
const TEEVEE = 'a8122172', STUART = 'f8e0e6ea';
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
  return { teeVee: await m('Tee Vee'), stoo: await m('STOO') };
});
log('Tee Vee →', r.teeVee.gid, `"${r.teeVee.name}"`, `source=${r.teeVee.src} conf=${r.teeVee.conf}`);
log('STOO    →', r.stoo.gid, `"${r.stoo.name}"`, `source=${r.stoo.src} conf=${r.stoo.conf}`);

let fail = 0; const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(r.teeVee.gid === TEEVEE, `"Tee Vee" resolves to the exact-name artist ${TEEVEE} (got ${r.teeVee.gid})`);
check(r.teeVee.src !== 'alias', `"Tee Vee" is NOT labeled alias (it has no aliases) — got source=${r.teeVee.src}`);
check(r.teeVee.src === 'search' && r.teeVee.conf === 'high', `"Tee Vee" is a confident NAME match (source=search, conf=high) — got ${r.teeVee.src}/${r.teeVee.conf}`);
check(r.stoo.gid === STUART, `"STOO" resolves via the real alias to Stuart Cambridge ${STUART} (got ${r.stoo.gid})`);
check(r.stoo.src === 'alias', `"STOO" is correctly labeled alias — got source=${r.stoo.src}`);
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
