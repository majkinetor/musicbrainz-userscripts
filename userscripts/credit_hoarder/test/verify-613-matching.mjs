// #613 / #612 — Credit Hoarder's artist matching: exact NAME or ALIAS (provably unique
// only), the release CONTEXT (related artists of the release artist, one request per
// real release artist, none on VA) and the co-credit option (off by default).
//
// Production MusicBrainz, READ-ONLY: only the preflight resolver runs (through the
// __creditHoarder test hook) — nothing is staged or submitted, no request routing.
// Names are passed names-only (no source URL, no cache key) so nothing touches the
// IndexedDB cache either.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/credit_hoarder/dist/credit_hoarder.user.js', 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 1000 } });
await ctx.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'CH', version: 't', homepageURL: 'x' } }; window.unsafeWindow = window; });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const reqs = []; page.on('request', r => reqs.push(decodeURIComponent(r.url())));

async function open(rel) {
  await page.goto(`https://musicbrainz.org/release/${rel}/edit-relationships`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForFunction(() => window.MB && MB.relationshipEditor && MB.relationshipEditor.state && MB.relationshipEditor.state.entity, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => window.__creditHoarder, null, { timeout: 20000 });
}
// resolve names-only artists with (or without) the page's release context
const resolveNames = (names, { withContext = true, coCredit = false } = {}) => page.evaluate(async ([names, withContext, coCredit]) => {
  const C = window.__creditHoarder;
  const context = withContext ? await C.buildReleaseContext({ coCredit }) : null;
  const { allResults } = await C.resolveAll(names.map(n => ({ name: n, resource_url: '' })), { kindOf: C.ARTIST_KIND, bypassIdb: true, context });
  return { context: context && { seeds: context.seeds.length, related: context.related.length }, results: allResults.map(r => ({ name: r.displayName, type: r.type, via: r.logEntry && r.logEntry.via, gid: (r.mbUrl || '').split('/').pop().slice(0, 8), mbName: r.mbName || null, reason: r.ambiguityReason || null, candidates: (r.nameMatches || []).length })) };
}, [names, withContext, coCredit]);
const byName = (res, n) => res.results.find(r => r.name === n) || {};
const ctxReqs = () => reqs.filter(u => /\/ws\/2\/artist\/[0-9a-f-]{36}\?inc=aliases\+artist-rels/.test(u)).length;

// ── A. The Beatles — Abbey Road ───────────────────────────────────────────────
await open('b25a1e5d-3247-41ea-9920-f93c58a6e479');
let before = ctxReqs();
let A = await resolveNames(['George Harrison', 'Don Abi', 'Solar Moon', 'Kim']);
console.log('A:', JSON.stringify(A, null, 1));
ck(A.context.seeds === 1 && A.context.related > 4, `context: 1 release artist → ${A.context.related} related (members etc.)`);
ck(ctxReqs() - before === 1, `exactly one context request for the one release artist (${ctxReqs() - before})`);
ck(byName(A, 'George Harrison').via === 'ctx' && byName(A, 'George Harrison').gid === '42a8f507', '"George Harrison" (3 exact namesakes in MB) → the Beatle, via release context');
ck(byName(A, 'Don Abi').via === 'alias' && byName(A, 'Don Abi').gid === 'b4acea3f', '"Don Abi" → Abiodun via ALIAS, provably unique (#442 case)');
ck(byName(A, 'Solar Moon').type === 'resolved' && byName(A, 'Solar Moon').via === 'name', '"Solar Moon" → by name');
ck(byName(A, 'Kim').type === 'attention' && /not provably unique/.test(byName(A, 'Kim').reason || ''), `"Kim" left to review — ${byName(A, 'Kim').reason}`);
const noCtx = await resolveNames(['George Harrison'], { withContext: false });
ck(byName(noCtx, 'George Harrison').type === 'attention', 'without context, "George Harrison" stays for review (3 namesakes) — the context is what resolved it');

// ── B. Various Artists release — no context, no request ──────────────────────
await open('cf24355a-bc71-4cfe-9178-51d748649b2e');
before = ctxReqs();
const B = await resolveNames(['Don Abi']);
console.log('B:', JSON.stringify(B));
ck(B.context.seeds === 0 && B.context.related === 0, 'VA release: no context (special-purpose release artist)');
ck(ctxReqs() - before === 0, 'VA release: no context request');
ck(byName(B, 'Don Abi').via === 'alias', 'alias matching still works on a VA release');

// ── C. #437 co-credit option — Sidney Samson "Today (feat. Joni)" ────────────
await open('a56091bd-dd60-44f5-87f5-dec6754b8523');
const off = await resolveNames(['Joni'], { coCredit: false });
const on = await resolveNames(['Joni'], { coCredit: true });
console.log('C off:', JSON.stringify(byName(off, 'Joni')), '\nC on :', JSON.stringify(byName(on, 'Joni')));
ck(byName(off, 'Joni').type === 'attention', 'co-credit OFF (default): "Joni" left to review');
ck(byName(on, 'Joni').via === 'cred' && byName(on, 'Joni').gid === 'a766abff', 'co-credit ON: "Joni" → a766abff via the credit next to Sidney Samson');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
