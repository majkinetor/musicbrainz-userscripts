// #613 — the exact name/alias resolver may only call a match unique when MusicBrainz
// returned EVERY match. The search doesn't rank exact holders first: `artist:"kim"`
// matches 2,777 artists and the single exact "Kim" among the first 25 was auto-linked.
//
// Production MusicBrainz, read-only (resolver lookups only, nothing submitted, no
// request routing). Distinctive names still resolve; a common short name must not.
// APOLLO_SRC=<old build> to watch "Kim" auto-link.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.APOLLO_SRC || resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => { const s = new Map(); window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d; window.GM_setValue = (k, v) => s.set(k, v); window.GM_info = { script: { name: 'Apollo Editor', version: 't' } }; });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/release/ade2956c-8d7e-4ab3-b359-b55b5ef603e9/edit', { waitUntil: 'domcontentloaded', timeout: 60000 });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForFunction(() => window.MB && MB.releaseEditor && MB.releaseEditor.rootField && MB.releaseEditor.rootField.release(), null, { timeout: 60000 });
await page.waitForTimeout(2000);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => window.__apolloEditor && window.__apolloEditor.resolveByExactAlias, null, { timeout: 20000 });

const r = await page.evaluate(async () => {
  const A = window.__apolloEditor, out = {};
  for (const n of ['Don Abi', 'Solar Moon', 'Kim', 'Sam']) {
    const hit = await A.resolveByExactAlias(n);
    out[n] = hit ? { gid: hit.entity.gid.slice(0, 8), name: hit.entity.name, via: hit.via } : null;
    await new Promise(z => setTimeout(z, 300));
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
ck(r['Don Abi'] && r['Don Abi'].gid === 'b4acea3f' && r['Don Abi'].via === 'alias', '"Don Abi" (1 match in MB) still resolves to Abiodun via alias (#442)');
ck(r['Solar Moon'] && r['Solar Moon'].via === 'name', '"Solar Moon" (2 matches) still resolves by name');
ck(r['Kim'] === null, '"Kim" (2,777 matches) is NOT auto-resolved — can\'t be proven unique');
ck(r['Sam'] === null, '"Sam" (4,178 matches) is NOT auto-resolved');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
