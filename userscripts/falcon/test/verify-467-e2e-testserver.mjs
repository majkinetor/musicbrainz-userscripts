// #467 (majkinetor: "Now, I want you to work on this version on test MB server
// and make it work without issue") — the only test here that commits for real.
//
// Every other Falcon test intercepts the submit and fakes a 302, which proves
// the POST left the browser but never that MusicBrainz ACCEPTED it or that the
// relationships landed with the right types. This one runs the full pipeline
// against the sandbox with nothing intercepted, then reads each entity back
// through the web service and requires both relationship types to be present.
//
// It also guards the safety property that makes running here possible at all:
// MB_TARGET follows the origin the panel is open on. @match covers
// *.musicbrainz.org, so a target pinned to production meant a batch queued while
// testing on the sandbox would build its edit urls against the LIVE site and
// quietly edit real data. The run asserts zero requests reach production.
//
// Runs in Firefox (majkinetor's browser, and where the freeze lived). Needs the
// .pw-profile-ff logged into test.musicbrainz.org — that is a SEPARATE account
// database from production; the sandbox login is majkinetor/mb.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { firefox } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

const TEST_MB = 'https://test.musicbrainz.org';
// stable sandbox recordings; if any of these ever vanish the run reports it
// rather than silently testing fewer entities.
const RECS = [
  'fe5bad81-5d3c-4e8e-b636-f0b77b5b3e76', '3964f887-c1ab-474a-a33e-629a56b6377d',
  '8ad7132c-d7f2-423d-964c-3f6537fe9d8a', '38552665-562f-454a-8788-b93241b39de2',
  '23532e14-f71f-4ec9-8fdb-8eba5146b6bf', 'f808c981-7abd-468a-91e0-3b147d46c34d',
  '55ef97a1-659d-4f86-8355-f897c1f59e14', '05a51124-0f8b-496a-8324-c30c3dcc3d5a',
];

const ctx = await firefox.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile-ff', { headless: true, viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
// nothing is intercepted here — instead, watch for anything touching production
let prodHits = 0;
page.on('request', r => {
  if (/\/\/(www\.)?musicbrainz\.org\//.test(r.url())) prodHits++;
});

await page.goto(TEST_MB + '/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN to test.musicbrainz.org'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(800);
await page.evaluate(() => {
  window.__stalls = [];
  let last = performance.now();
  setInterval(() => { const n = performance.now(); const late = Math.round(n - last - 200); last = n; if (late > 400) window.__stalls.push(late); }, 200);
});
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 15000 });

const target = await page.evaluate(() => window.__falconTest.buildSeedEditUrl({ entityType: 'recording', mbid: 'x', urls: [], note: '' }).split('/recording/')[0]);
console.log('MB_TARGET resolved to:', target);
ck(target === TEST_MB, `edit urls are built against the server the panel is open on, NOT pinned to production (got ${target})`);

await page.evaluate(() => document.getElementById('falcon-launcher').click());
await page.waitForTimeout(600);

// fresh urls per run so MB has a genuine edit to make every time
const rnd = Math.floor(Math.random() * 1e6);
const urlFor = i => `https://music.apple.com/sg/song/${rnd}${i}`;
await page.evaluate(({ recs, rnd }) => {
  window.__falconTest.setQueue(recs.map((mbid, i) => ({
    id: 'e' + i, entityType: 'recording', mbid,
    // the dual-type shape: one url, two relationship types
    urls: [
      { url: `https://music.apple.com/sg/song/${rnd}${i}`, linkTypeId: '254' },
      { url: `https://music.apple.com/sg/song/${rnd}${i}`, linkTypeId: '979' },
    ],
    name: null, urlResults: null, status: 'queued', error: '',
  })));
  window.__falconTest.cfg.workers = 3;
}, { recs: RECS, rnd });

const t0 = Date.now();
await page.evaluate(() => window.__falconTest.start());
const finished = await page.waitForFunction(
  () => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'),
  null, { timeout: 180000 },
).then(() => true).catch(() => false);
const elapsed = Date.now() - t0;
const q = await page.evaluate(() => window.__falconTest.getQueue().map(i => ({ s: i.status, e: i.error }))).catch(() => null);
const stalls = await page.evaluate(() => window.__stalls).catch(() => null);
console.log('elapsed', elapsed, 'ms; statuses', JSON.stringify((q || []).reduce((a, x) => (a[x.s] = (a[x.s] || 0) + 1, a), {})));
console.log('item errors:', JSON.stringify([...new Set((q || []).map(x => x.e).filter(Boolean))]));

ck(finished, `all ${RECS.length} items finish`);
ck(Array.isArray(q) && q.every(x => x.s === 'done'), `every item commits for real against the sandbox (${JSON.stringify((q || []).map(x => x.s))})`);
ck(Array.isArray(stalls) && stalls.length === 0, `the UI thread was never blocked (stalls over 400ms: ${JSON.stringify(stalls)})`);
ck(prodHits === 0, `nothing reached PRODUCTION musicbrainz.org while working on the sandbox (${prodHits} request(s))`);

// The actual point: read the entities back and require the relationships to be
// there. "status: done" only means MB redirected off /edit.
await page.waitForTimeout(3000);
const shortfalls = [];
for (let i = 0; i < RECS.length; i++) {
  const types = await page.evaluate(async ({ mbid, want, base }) => {
    const r = await fetch(`${base}/ws/2/recording/${mbid}?inc=url-rels&fmt=json`, { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    const j = await r.json();
    return (j.relations || []).filter(x => x.url && x.url.resource === want).map(x => x.type).sort();
  }, { mbid: RECS[i], want: urlFor(i), base: TEST_MB });
  if (!types || types.length !== 2) shortfalls.push({ mbid: RECS[i], got: types });
}
console.log('shortfalls:', JSON.stringify(shortfalls));
ck(shortfalls.length === 0, `all ${RECS.length} entities really carry BOTH relationship types afterwards, confirmed through the web service (${RECS.length - shortfalls.length}/${RECS.length})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
