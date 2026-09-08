// #575 A/B: does running the tracklist match through a small pool actually make
// it faster, or is the difference just MusicBrainz having a good minute?
//
// The single-run numbers were useless for exactly that reason — the same fixture
// took 42s and 124s on the same build minutes apart. So alternate the two builds,
// round by round, and read the medians. Recordings auto-match is off throughout,
// to isolate the artist pass.
//
//   APOLLO_OLD=<path to pre-fix build> node test/probe-575-ab.mjs [rounds]
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');

const NEW = 'C:/Work/mb-userscripts/userscripts/apollo_editor/apollo_editor.user.js';
const OLD = process.env.APOLLO_OLD;
if (!OLD) { console.log('set APOLLO_OLD to the pre-fix build'); process.exit(2); }
const ROUNDS = Number(process.argv[2] || 3);

const ARTISTS = ['Elis Regina', 'Nara Leão', 'Jorge Ben', 'Dorival Caymmi', 'Ornella Vanoni',
  'Osmar Milito', 'Trio Esperança', 'Georgette', 'Os Brazões', 'Orlandivo',
  'Rosa Maria', 'Marisa Rossi', 'Daniel Salinas', 'Toquinho'];

async function run(src) {
  const code = await readFile(src, 'utf8');
  const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
    { headless: true, viewport: { width: 1700, height: 1100 } });
  await ctx.addInitScript(() => {
    const store = new Map([['apolloEditor.settings.v1', JSON.stringify({ autoMatch: true, autoMatchRec: false, replaceTracklist: true, replaceRecordings: true })]]);
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_info = { script: { name: 'apollo', version: 't' } };
  });
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

  let reqs = 0, throttles = 0, inflight = 0, peak = 0;
  page.on('request', r => { if (/musicbrainz\.org\/ws\/2\//.test(r.url())) { reqs++; inflight++; if (inflight > peak) peak = inflight; } });
  page.on('requestfailed', r => { if (/musicbrainz\.org\/ws\/2\//.test(r.url())) inflight--; });
  page.on('response', r => { if (!/musicbrainz\.org\/ws\/2\//.test(r.url())) return; inflight--; if (r.status() === 503 || r.status() === 429) throttles++; });
  await page.route(() => true, r => (r.request().method() === 'POST' ? r.abort() : r.fallback()));

  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => window.__apolloEditor, null, { timeout: 60000 });
  const t0 = Date.now();
  await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});
  await page.waitForSelector('.tc-search input.nm', { state: 'visible', timeout: 60000 });
  const ok = await page.waitForFunction(() => {
    const m = window.__apolloEditor.model;
    if (!m || !m.tracks.length) return false;
    return !m.tracks.some(t => t.slots.some(s => s._pending)) && !document.querySelector('.tc-btn.tc-stopping');
  }, null, { timeout: 600000, polling: 400 }).then(() => true).catch(() => false);
  const elapsed = Date.now() - t0;
  const resolved = await page.evaluate(() => {
    const m = window.__apolloEditor.model;
    return m.tracks.filter(t => t.slots.some(s => s.committed)).length;
  });
  await ctx.close();
  return { elapsed, ok, resolved, reqs, throttles, peak };
}

const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const res = { old: [], new: [] };
for (let i = 0; i < ROUNDS; i++) {
  for (const [tag, src] of [['new', NEW], ['old', OLD]]) {
    const r = await run(src);
    if (!r) { console.log('NOT LOGGED IN'); process.exit(3); }
    res[tag].push(r.elapsed);
    console.log(`round ${i + 1} ${tag}: ${(r.elapsed / 1000).toFixed(1)}s · ${r.reqs} req (${r.throttles} throttled) · peak ${r.peak} · ${r.resolved}/14 resolved${r.ok ? '' : ' · TIMED OUT'}`);
  }
}
console.log('\nmedian old:', (med(res.old) / 1000).toFixed(1) + 's', ' median new:', (med(res.new) / 1000).toFixed(1) + 's');
console.log('all old:', res.old.map(x => (x / 1000).toFixed(1)).join(', '));
console.log('all new:', res.new.map(x => (x / 1000).toFixed(1)).join(', '));
