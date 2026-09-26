// #613 follow-up (majkinetor, with a screenshot of Calypsoul 70): "why i didn't get +alias here?"
// "St. Maarten's The Rolling Tones" was matched AUTOMATICALLY (by its Discogs name, which is also
// its MB name) but credited on this release with the name variation "The Rolling Tones" — which
// the MB artist does not carry (it has no aliases at all). "+ alias" was only ever offered after a
// MANUAL pick; now an automatic match offers it too, when this run's lookups already know the
// artist's aliases (never for an IDB-cached row, so #613's "came back after adding" can't recur).
//
// Production MusicBrainz, READ-ONLY: A runs only the preflight resolver (test hook, names-only, no
// cache). B runs a real Discogs import of the release up to its review table and stops there —
// "Start import" is never pressed, nothing is staged or submitted. B clears THIS test profile's
// Credit Hoarder IndexedDB cache first, so the row is a fresh match. CH_SRC=<old build> to watch
// it fail.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile(process.env.CH_SRC || 'C:/Work/mb-userscripts/userscripts/credit_hoarder/dist/credit_hoarder.user.js', 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const log = (...a) => console.log('[verify-613-auto]', ...a);

const REL = '51df3142-ff64-4ad1-bc67-37bf2767b9d7';   // Calypsoul 70 (Discogs release 1955521)
const TONES = '57088b56-4658-4269-a104-caa44183773d'; // St. Maarten's The Rolling Tones — no aliases in MB

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1100 } });
await ctx.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'CH', version: 't', homepageURL: 'x' } }; window.unsafeWindow = window; });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const posts = []; page.on('request', r => { if (r.method() === 'POST' && /musicbrainz\.org\//.test(r.url())) posts.push(r.url()); });

await page.goto(`https://musicbrainz.org/release/${REL}/edit-relationships`, { waitUntil: 'domcontentloaded', timeout: 60000 });
if (page.url().includes('/login')) { log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForFunction(() => window.MB && MB.relationshipEditor && MB.relationshipEditor.state && MB.relationshipEditor.state.entity, null, { timeout: 60000 });
// fresh matches: drop this test profile's CH cache before the script opens it
const dropped = await page.evaluate(() => new Promise(res => { const q = indexedDB.deleteDatabase('mblink'); q.onsuccess = () => res('deleted'); q.onerror = () => res('error'); q.onblocked = () => res('blocked'); }));
log('CH IndexedDB cache:', dropped);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => window.__creditHoarder, null, { timeout: 20000 });

// ── A. the resolver + the button rule ────────────────────────────────────────
const A = await page.evaluate(async ([tones]) => {
  const C = window.__creditHoarder;
  const context = await C.buildReleaseContext({});
  const run = async ent => (await C.resolveAll([ent], { kindOf: C.ARTIST_KIND, bypassIdb: true, context })).allResults[0];
  const anv = await run({ name: "St. Maarten's The Rolling Tones", anv: 'The Rolling Tones', resource_url: '' });
  const own = await run({ name: "St. Maarten's The Rolling Tones", resource_url: '' });
  const pick = r => ({ id: (r.mbUrl || '').split('/').pop(), name: r.mbName, aliases: r.mbAliases });
  return {
    anv: { type: anv.type, via: anv.logEntry && anv.logEntry.via, gid: pick(anv).id, credit: anv.displayName, aliases: anv.mbAliases, wants: C.wantsAliasButton('artist', pick(anv), anv.displayName) },
    own: { credit: own.displayName, wants: C.wantsAliasButton('artist', pick(own), own.displayName) },
    held: C.wantsAliasButton('artist', { id: tones, name: "St. Maarten's The Rolling Tones", aliases: ['The Rolling Tones'] }, 'The Rolling Tones'),
  };
}, [TONES]);
log('A:', JSON.stringify(A));
ck(A.anv.type === 'resolved' && A.anv.gid === TONES, `"The Rolling Tones" (Discogs name "St. Maarten's The Rolling Tones") resolves automatically (via ${A.anv.via})`);
ck(Array.isArray(A.anv.aliases), `…and the match carries the artist's aliases, known without another request (${JSON.stringify(A.anv.aliases)})`);
ck(A.anv.wants === true, '…so "+ alias" is wanted: the credited name is neither its name nor an alias');
ck(A.own.wants === false, 'credited under its own name → no "+ alias"');
ck(A.held === false, 'credited under a name it already has as an alias → no "+ alias"');

// ── B. the real review table ─────────────────────────────────────────────────
const icon = page.locator('.discogs-bar .discogs-src-ico[data-src="Discogs"]');
if (await icon.count()) await icon.first().click(); else await page.locator('.discogs-bar .discogs-src-ico').first().click();
const started = await page.locator('button', { hasText: /^Start import/i }).first().waitFor({ state: 'visible', timeout: 10 * 60_000 }).then(() => true, () => false);
ck(started, 'the review table rendered (Start import is NOT pressed)');
const B = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find(t => /The Rolling Tones/.test(t.textContent) && /St\. Maarten's The Rolling Tones/.test(t.textContent));
  if (!tr) return null;
  const btn = tr.querySelector('.discogs-add-alias');
  return { row: tr.textContent.replace(/\s+/g, ' ').slice(0, 160), alias: btn ? btn.textContent.trim() : null, title: btn ? btn.title.split('\n')[0] : '' };
});
log('B:', JSON.stringify(B));
ck(B && B.alias === '+ alias', `the automatically matched "The Rolling Tones" row offers "+ alias" (${B && (B.alias || 'no button')})`);
ck(B && /Add "The Rolling Tones" as an alias of St\. Maarten's The Rolling Tones/.test(B.title), `…to add the credited name: "${B && B.title}"`);
ck(posts.length === 0, 'nothing was POSTed to MusicBrainz: ' + JSON.stringify(posts.slice(0, 2)));
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
