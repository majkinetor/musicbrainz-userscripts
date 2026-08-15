// #509 (majkinetor, live): "It isn't passed from source" — a real Harmony
// batch showed EVERY entity falling back to an MB lookup despite
// scrapeHarmonyActions() correctly attaching a name to each tuple. Root
// cause, found by replaying majkinetor's own saved copy of the exact page
// offline: scrapeHarmonyActions() worked perfectly (75/75 tuples named) —
// the bug was downstream. harmonyBtn.onclick's payload construction
// (`found.map(t => ({...}))`) never included `name` before writing to
// GM_setValue, and parseUrlParam()'s own return object on the receiving
// tab never read `it.name` back out either — the name was scraped
// correctly and then silently dropped TWICE before ever reaching
// addToQueue(), on every single Harmony import regardless of whether
// scraping succeeded. This test drives the REAL button click (not just
// scrapeHarmonyActions() in isolation, which is what every earlier #509
// test did — a real gap in coverage) through GM storage and a fresh
// "new tab" parseUrlParam() consumption, the exact path that was broken.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const REC1 = 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7';
const REC2 = '5355d372-6d79-45df-bfc6-6a113756fb14';
const HTML = `<html><body>
<div class="action">
  <div><p>
    <a href="https://musicbrainz.org/recording/${REC1}/edit?edit-recording.url.0.text=https%3A%2F%2Fwww.deezer.com%2Ftrack%2F370242433&edit-recording.url.0.link_type_id=268&edit-recording.edit_note=Matched">Link external IDs</a> of
    <span class="entity-links">
      <a href="https://www.deezer.com/track/370242433"><span class="deezer"></span></a>
      <a href="https://musicbrainz.org/recording/${REC1}"><span class="musicbrainz"></span>Dusk</a>
    </span> to MusicBrainz
  </p></div>
</div>
<div class="action">
  <div><p>
    <a href="https://musicbrainz.org/recording/${REC2}/edit?edit-recording.url.0.text=https%3A%2F%2Fwww.deezer.com%2Ftrack%2F773599202&edit-recording.url.0.link_type_id=268&edit-recording.edit_note=Matched">Link external IDs</a> of
    <span class="entity-links">
      <a href="https://www.deezer.com/track/773599202"><span class="deezer"></span></a>
      <a href="https://musicbrainz.org/recording/${REC2}"><span class="musicbrainz"></span>Spirit Remains</a>
    </span> to MusicBrainz
  </p></div>
</div>
</body></html>`;

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });

// tab 1: the Harmony page — click the REAL button (not scrapeHarmonyActions()
// called directly), capture exactly what gets written to GM storage.
const page1 = await ctx.newPage();
const errs1 = []; page1.on('pageerror', e => errs1.push(e.message));
await page1.addInitScript(() => {
  window.__gmStore = new Map();
  window.__gmWrites = [];
  window.GM_getValue = (k, d) => window.__gmStore.has(k) ? window.__gmStore.get(k) : d;
  window.GM_setValue = (k, v) => { window.__gmStore.set(k, v); window.__gmWrites.push([k, v]); };
  window.GM_deleteValue = k => window.__gmStore.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
  window.open = () => null;   // headless: don't actually try to open a tab
});
await page1.route('https://harmony.pulsewidth.org.uk/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: HTML }));
let mbApiHit = false;
await page1.route('**/ws/2/**', route => { mbApiHit = true; route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
await page1.goto('https://harmony.pulsewidth.org.uk/release/actions', { waitUntil: 'domcontentloaded' });
await page1.addScriptTag({ content: code });
await page1.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
await page1.waitForSelector('#falcon-harmony-btn', { timeout: 5000 });
await page1.click('#falcon-harmony-btn');
await page1.waitForTimeout(600);

const write = await page1.evaluate(() => window.__gmWrites.find(([k]) => k.startsWith('falcon:pending:')));
console.log('what got written to GM storage:', JSON.stringify(write));
ck(!!write, 'clicking the real Harmony button writes a falcon:pending: payload');
const [pendingKey, pendingValue] = write || [];
const stored = pendingValue ? JSON.parse(pendingValue) : [];
console.log('stored payload:', JSON.stringify(stored));
ck(stored.length === 2 && stored.every(t => t.name), `the STORED payload itself carries name for every tuple — this is where it was silently dropped before (got ${JSON.stringify(stored.map(t => t.name))})`);
ck(stored.find(t => t.mbid === REC1)?.name === 'Dusk', `REC1's stored name is correct (got "${stored.find(t => t.mbid === REC1)?.name}")`);
ck(stored.find(t => t.mbid === REC2)?.name === 'Spirit Remains', `REC2's stored name is correct (got "${stored.find(t => t.mbid === REC2)?.name}")`);

// tab 2: a FRESH tab (simulating window.open's real destination) reads the
// SAME GM storage back via parseUrlParam() — the other half of the round-trip.
const token = pendingKey.slice('falcon:pending:'.length);
const page2 = await ctx.newPage();
const errs2 = []; page2.on('pageerror', e => errs2.push(e.message));
await page2.addInitScript(({ token, payload }) => {
  const store = new Map([[`falcon:pending:${token}`, payload]]);
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
}, { token, payload: pendingValue });
let mbApiHitTab2 = false;
await page2.route('**/ws/2/**', route => { mbApiHitTab2 = true; route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
await page2.goto('https://musicbrainz.org/?falcon=' + token, { waitUntil: 'domcontentloaded' });
await page2.addScriptTag({ content: code });
await page2.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
await page2.waitForTimeout(500);

const queue = await page2.evaluate(() => window.__falconTest.getQueue().map(i => ({ mbid: i.mbid, name: i.name })));
console.log('queue on the receiving tab:', JSON.stringify(queue));
ck(queue.length === 2 && queue.every(i => i.name), `both items land in the queue WITH their names — the actual end-to-end path that was broken (got ${JSON.stringify(queue)})`);
ck(queue.find(i => i.mbid === REC1)?.name === 'Dusk', 'REC1 has its name on the receiving tab');
ck(queue.find(i => i.mbid === REC2)?.name === 'Spirit Remains', 'REC2 has its name on the receiving tab');
ck(!mbApiHitTab2, 'no MB API round-trip needed on the receiving tab — the name survived the whole pipeline');

ck(errs1.length === 0 && errs2.length === 0, 'no page errors: ' + JSON.stringify([...errs1, ...errs2].slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
