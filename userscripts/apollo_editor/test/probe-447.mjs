// Probe #447 — a track's performing credit on Discogs isn't always "Featuring"; here the
// vocalists are credited as "Vocals" / "Backing Vocals" (release "Phase 3", Discogs 349919).
// MB puts them as a feat. in the title ("feat. Ras B"), so the split feat slot should match
// via the Discogs artist link — but the old code captured only role="Featuring", so these
// fell back to name/alias. Now any performing role is captured, so the slot matches by link.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const O = 'https://musicbrainz.org';
const REL = 'f01e17e0-fd79-4997-b592-dec1c3365fcf';
const RASB_URL = 'https://www.discogs.com/artist/211433';   // "Vocals: Ras B" on Discogs track 3
const NDB_URL = 'https://www.discogs.com/artist/241307';    // "Backing Vocals: Ndb"
const log = (...a) => console.log('[probe-447]', ...a);

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

const r = await page.evaluate(async ({ RASB_URL }) => {
  const A = window.__apolloEditor;
  const dmap = await A.loadDiscogsMap();
  if (!dmap) return { err: 'no discogs map' };
  // Discogs track 3 "Ball 'bout Murda" (index 2): Backing Vocals: Ndb, Vocals: Ras B
  const slot3 = (dmap.featByPos && dmap.featByPos[2] || []).map(f => ({ name: f.name, url: f.url }));
  // resolve the feat slot "Ras B" to its Discogs URL (by position; titles differ with the feat suffix)
  const featUrl = A.discogsFeatUrlFor(dmap, 'Ball Bout Murda', 2, 19, 'Ras B');
  // end-to-end: matchSlot with that URL links via the Discogs relationship (source 'discogs')
  const m = featUrl ? await A.matchSlot('Ras B', null, featUrl, []) : null;
  return {
    slot3,
    featUrl,
    matchSrc: m && m.source,
    matchName: m && m.entity && m.entity.name,
    matchGid: m && m.entity && m.entity.gid.slice(0, 8),
  };
}, { RASB_URL });
log('track-3 captured credits (Vocals/Backing Vocals):', JSON.stringify(r.slot3));
log('discogsFeatUrlFor("Ras B"):', r.featUrl);
log('matchSlot("Ras B", url) →', r.matchGid, `"${r.matchName}"`, `(${r.matchSrc})`);

let fail = 0; const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(r.slot3 && r.slot3.some(f => f.url === RASB_URL), 'a "Vocals" credit (Ras B) is now captured from Discogs, not just "Featuring"');
check(r.slot3 && r.slot3.some(f => f.url === NDB_URL), 'a "Backing Vocals" credit (Ndb) is captured too');
check(r.featUrl === RASB_URL, `discogsFeatUrlFor resolves "Ras B" to ${RASB_URL} (got ${r.featUrl})`);
check(r.matchSrc === 'discogs', `matchSlot links "Ras B" via the Discogs URL (source=discogs, got ${r.matchSrc})`);
check(!!r.matchGid, `it resolved to an MB artist (${r.matchName || 'none'})`);
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
