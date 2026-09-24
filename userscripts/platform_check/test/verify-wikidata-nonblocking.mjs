// majkinetor: "in PC, wikidata now often blocks (15s wait seem to be frequent).
// Any way to make it non blocking"
//
// runScans awaited the Wikidata SPARQL before starting ANY provider scan, so a
// stalled query.wikidata.org held every row until gmGet's 15 s timeout. Now the
// lookup runs alongside the scans: providers that never use Wikidata start at
// once; only Spotify/Apple/Tidal/Beatport (which can use its answer) wait for it.
//
// Wikidata is stubbed to answer after WD_MS. Asserts:
//   · Deezer/Discogs/Bandcamp requests go out long before Wikidata answers
//   · no Apple/Tidal request goes out before it (they still get its answer)
// Run against the old build (PC_SRC=<file>) to watch the first assertion fail.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.PC_SRC || resolve(HERE, '..', 'platform_check.user.js');
const code = await readFile(SRC, 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const MBID = process.env.PC_RELEASE || 'aa6c4473-3528-41c2-b55b-d9e18bdba4ff';
const WD_MS = 6000;

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1400, height: 900 } });
await ctx.addInitScript((WD_MS) => {
  const store = new Map();
  window.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_listValues = () => [...store.keys()];
  window.GM_info = { script: { name: 'Platform Check', version: 't' } };
  window.open = () => null;
  // No real provider traffic: every request is logged with its start time and
  // answered with an empty body; Wikidata answers late.
  window.__req = [];
  window.GM_xmlhttpRequest = (o) => {
    window.__req.push({ t: performance.now(), url: o.url });
    const wd = /query\.wikidata\.org/.test(o.url);
    const body = wd ? '{"results":{"bindings":[]}}' : '{}';
    setTimeout(() => { if (wd) window.__wdAnsweredAt = performance.now(); try { (o.onload || (() => {}))({ status: 200, responseText: body, finalUrl: o.url, responseHeaders: '' }); } catch (e) {} }, wd ? WD_MS : 40);
    return { abort() {} };
  };
}, WD_MS);
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route(/\/ws\/js\/edit\/|\/relationship-editor|\/edit\/create/i, r => r.abort());
await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.addScriptTag({ content: code });
await page.waitForSelector('#row-discogs', { state: 'attached', timeout: 20000 });
await page.waitForTimeout(WD_MS + 4000);

const { req, wdAt } = await page.evaluate(() => ({ req: window.__req, wdAt: window.__wdAnsweredAt }));
const wdReq = req.find(r => /wikidata/.test(r.url));
const first = re => req.find(r => re.test(r.url));
const rel = r => r ? Math.round(r.t - wdReq.t) : null;
const indep = { deezer: first(/deezer\.com/), discogs: first(/discogs\.com/), bandcamp: first(/bandcamp\.com/) };
const dep = { apple: first(/apple\.com/), tidal: first(/tidal\.com/) };
console.log('wikidata asked at 0, answered at', Math.round(wdAt - wdReq?.t), 'ms');
console.log('first request, ms after the Wikidata request:', JSON.stringify(Object.fromEntries(Object.entries({ ...indep, ...dep }).map(([k, v]) => [k, rel(v)]))));
ck(!!wdReq, 'Wikidata was queried');
const started = Object.entries(indep).filter(([, v]) => v);
ck(started.length > 0, `independent providers made requests (${started.map(([k]) => k).join(', ')})`);
ck(started.every(([, v]) => rel(v) < 2000), 'independent providers start without waiting for Wikidata (< 2 s, Wikidata takes 6 s)');
ck(Object.values(dep).filter(Boolean).every(v => v.t >= wdAt - 5), 'Apple/Tidal wait for the Wikidata answer');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
