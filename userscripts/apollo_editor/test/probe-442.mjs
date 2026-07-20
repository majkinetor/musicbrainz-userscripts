// Probe #442 — a feat. artist split from the title must match its existing MB entry
// via the Discogs link, even when the MB artist's NAME differs from the split credit
// (it's only an ALIAS). Release "The Blackbook Translations, Vol. 1" track 2 is
// "Dibidibi (feat. Don Abi) (Massivan remix)"; Discogs credits "Don Abi" (artist
// 84909, a Featuring extraartist), and MB artist "Abiodun" (b4acea3f) links
// discogs.com/artist/84909 with "Don Abi" as an alias. Before the fix the feat credit
// lived only in Discogs `extraartists` (never captured), so the slot had no Discogs URL
// and a name search for "Don Abi" scored 'low'. Now discogsFeatUrlFor bridges it.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const O = 'https://musicbrainz.org';
const REL = 'b58500ec-aa13-4f9d-b1f2-1151c08a1c7e';
const ABIODUN = 'b4acea3f';                       // MB "Abiodun" — aka "Don Abi"
const FEAT_URL = 'https://www.discogs.com/artist/84909';
const log = (...a) => console.log('[probe-442]', ...a);

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

const r = await page.evaluate(async () => {
  const A = window.__apolloEditor;
  const dmap = await A.loadDiscogsMap();
  if (!dmap) return { err: 'no discogs map' };
  // track 2 is "Dibidibi (Massivan remix)" once the feat is split; before the split its
  // title still carries "(feat. Don Abi)" — the by-position path (4==4 tracks) covers both.
  const byPosFeat = (dmap.featByPos && dmap.featByPos[1] || []).map(f => ({ name: f.name, url: f.url }));
  // the resolver: find the Featuring URL for the "Don Abi" slot at track index 1
  const featUrl = A.discogsFeatUrlFor(dmap, 'Dibidibi (Massivan remix)', 1, 4, 'Don Abi');
  const featUrlPreSplit = A.discogsFeatUrlFor(dmap, 'Dibidibi (feat. Don Abi) (Massivan remix)', 1, 4, 'Don Abi');
  // end-to-end: matchSlot with that URL resolves to the MB artist via the Discogs link
  const m = featUrl ? await A.matchSlot('Don Abi', null, featUrl, []) : null;
  // the general improvement (majkinetor): even with NO Discogs URL, an exact-alias
  // match to a single MB artist resolves confidently (source 'alias').
  const ma = await A.matchSlot('Don Abi', null, null, []);
  // and an AMBIGUOUS bare name must NOT alias-match (no false high): "Eva" is many artists
  const amb = await A.matchSlot('Eva', null, null, []);
  return {
    byPosFeat,
    featUrl,
    featUrlPreSplit,
    matchGid: m && m.entity && m.entity.gid.slice(0, 8),
    matchName: m && m.entity && m.entity.name,
    matchSrc: m && m.source,
    aliasGid: ma && ma.entity && ma.entity.gid.slice(0, 8),
    aliasSrc: ma && ma.source,
    ambSrc: amb && amb.source,
  };
});
log('track-2 Discogs Featuring credits:', JSON.stringify(r.byPosFeat));
log('discogsFeatUrlFor (post-split title):', r.featUrl);
log('discogsFeatUrlFor (pre-split title, by position):', r.featUrlPreSplit);
log('matchSlot("Don Abi", url) →', r.matchGid, `"${r.matchName}"`, `(${r.matchSrc})`);
log('matchSlot("Don Abi", NO url) → alias path:', r.aliasGid, `(${r.aliasSrc})`, '| ambiguous "Eva" →', r.ambSrc);

let fail = 0; const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(r.byPosFeat && r.byPosFeat.some(f => f.url === FEAT_URL), 'Discogs map captures the "Featuring: Don Abi" extraartist on track 2');
check(r.featUrl === FEAT_URL, `discogsFeatUrlFor resolves the "Don Abi" slot to ${FEAT_URL} (got ${r.featUrl})`);
check(r.featUrlPreSplit === FEAT_URL, 'resolves by position even before the feat is split from the title');
check(r.matchSrc === 'discogs', `matchSlot links it via the Discogs URL (source=discogs, got ${r.matchSrc})`);
check(r.matchGid === ABIODUN, `matchSlot links "Don Abi" to MB artist Abiodun ${ABIODUN} (got ${r.matchGid})`);
check(r.aliasSrc === 'alias', `exact-alias path: matchSlot("Don Abi", no URL) resolves via alias (source=alias, got ${r.aliasSrc})`);
check(r.aliasGid === ABIODUN, `exact-alias path links to Abiodun ${ABIODUN} (got ${r.aliasGid})`);
check(r.ambSrc !== 'alias', `ambiguous bare name "Eva" does NOT alias-match (got source=${r.ambSrc})`);
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
