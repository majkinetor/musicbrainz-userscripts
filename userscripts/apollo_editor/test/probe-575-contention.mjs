// #575 double-check (majkinetor: "maybe it was a glitch but nevertheless double
// check"). His two runs of the SAME release differed by 20x — 4 minutes cold,
// ~14 seconds after a reload — and the second was full of HTTP 503s, so the
// slowness cannot simply be "MusicBrainz was throttling".
//
// The one structural suspect visible in both logs is CONTENTION: the Recordings
// auto-match (rec-match / dup tracklist) starts at load and draws from the same
// paced /ws/2 budget as the artist match — one start slot per second, four in
// flight — so with it on, every artist lookup queues behind recording lookups.
//
// So: run the same fixture twice on production, with the Recordings auto-match
// off and on, and measure. Read-only; every POST is aborted.
//
//   node test/probe-575-contention.mjs
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile(process.env.APOLLO_SRC || 'C:/Work/mb-userscripts/userscripts/apollo_editor/apollo_editor.user.js', 'utf8');

// Real, distinct artists — a name that resolves is what costs a round trip.
const ARTISTS = ['Elis Regina', 'Nara Leão', 'Jorge Ben', 'Dorival Caymmi', 'Ornella Vanoni',
  'Osmar Milito', 'Trio Esperança', 'Georgette', 'Os Brazões', 'Orlandivo',
  'Rosa Maria', 'Marisa Rossi', 'Daniel Salinas', 'Toquinho'];

async function run(autoMatchRec) {
  const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
    { headless: !process.argv.includes('--headed'), viewport: { width: 1700, height: 1100 } });
  await ctx.addInitScript(rec => {
    const store = new Map([['apolloEditor.settings.v1', JSON.stringify({ autoMatch: true, autoMatchRec: rec, replaceTracklist: true, replaceRecordings: true })]]);
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_info = { script: { name: 'apollo', version: 't' } };
  }, autoMatchRec);
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://musicbrainz.org/release/add', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { await ctx.close(); return null; }
  await page.evaluate(a => {
    const f = document.createElement('form');
    f.method = 'POST'; f.action = '/release/add';
    const add = (k, v) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; f.appendChild(i); };
    add('name', 'Wanted Bossa Nova'); add('artist_credit.names.0.name', 'Various Artists'); add('mediums.0.format', 'CD');
    a.forEach((name, i) => { add(`mediums.0.track.${i}.name`, 'Fixture ' + (i + 1)); add(`mediums.0.track.${i}.artist_credit.names.0.name`, name); });
    document.body.appendChild(f); f.submit();
  }, ARTISTS);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('#release-editor', { timeout: 60000 }).catch(() => {});

  const ws = []; let throttles = 0;
  // How many /ws/2 reads are actually in flight at once. The pacer allows four;
  // if the observed peak is one, the bottleneck is the caller awaiting each
  // request before starting the next, not the rate limit.
  let inflight = 0, peak = 0;
  page.on('request', r => { if (/musicbrainz\.org\/ws\/2\//.test(r.url())) { inflight++; if (inflight > peak) peak = inflight; } });
  page.on('requestfailed', r => { if (/musicbrainz\.org\/ws\/2\//.test(r.url())) inflight--; });
  page.on('response', r => {
    const u = r.url();
    if (!/musicbrainz\.org\/ws\/2\//.test(u)) return;
    inflight--;
    ws.push({ t: Date.now(), status: r.status(), url: u });
    if (r.status() === 503 || r.status() === 429) throttles++;
  });
  await page.route(() => true, r => (r.request().method() === 'POST' ? r.abort() : r.fallback()));

  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => window.__apolloEditor, null, { timeout: 60000 });
  const t0 = Date.now();
  await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});
  await page.waitForSelector('.tc-search input.nm', { state: 'visible', timeout: 60000 });

  // Done = the artist pass has nothing queued and is not running.
  const ok = await page.waitForFunction(() => {
    const m = window.__apolloEditor.model;
    if (!m || !m.tracks.length) return false;
    const queued = m.tracks.some(t => t.slots.some(s => s._pending));
    const running = !!document.querySelector('.tc-btn.tc-stopping');
    return !queued && !running;
  }, null, { timeout: 600000, polling: 500 }).then(() => true).catch(() => false);
  const elapsed = Date.now() - t0;

  const resolved = await page.evaluate(() => {
    const m = window.__apolloEditor.model;
    return m.tracks.filter(t => t.slots.some(s => s.committed)).length + '/' + m.tracks.length;
  });
  await ctx.close();
  return { elapsed, ok, resolved, requests: ws.length, throttles, peak };
}

for (const rec of [false, true]) {
  const r = await run(rec);
  if (!r) { console.log('NOT LOGGED IN'); process.exit(3); }
  console.log(`recordings auto-match ${rec ? 'ON ' : 'OFF'}: ` +
    `${(r.elapsed / 1000).toFixed(1)}s  ·  ${r.requests} /ws/2 requests (${r.throttles} throttled)  ·  ` +
    `peak ${r.peak} in flight  ·  ${r.resolved} tracks resolved${r.ok ? '' : '  ·  TIMED OUT'}`);
}
