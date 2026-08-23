// #537 (majkinetor): "I think this is all very complicated and is not something
// Falcon should do. Add an option to not process Harmony covers. I think it
// works mostly OK even without maximization."
//
// The option has to hold at BOTH ends, which is the whole point of this test:
//
//   * send side — the Harmony button neither counts nor sends a cover;
//   * receive side — a cover payload that arrives anyway (an older Harmony tab,
//     a hand-written ?falcon= url, a JSON import) is dropped, not queued.
//
// And, just as importantly, everything else in a Harmony batch must still come
// through: the option is about cover art, not about crippling the import.
//
// Nothing is submitted: no run is started.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const launch = async (skipCovers) => {
  const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript((skip) => {
    const s = new Map();
    if (skip) s.set('falcon:skipHarmonyCovers', true);
    window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
    window.GM_setValue = (k, v) => s.set(k, v);
    window.GM_deleteValue = k => s.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  }, skipCovers);
  const page = ctx.pages()[0] || await ctx.newPage();
  for (let a = 1; ; a++) {
    try { await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 3) throw e; await page.waitForTimeout(4000); }
  }
  await page.waitForTimeout(800);
  await page.addScriptTag({ content: code });
  await page.waitForTimeout(400);
  return { ctx, page };
};

// A Harmony payload as it really arrives: two link rows, one ISRC row, and a
// cover with candidates.
const PAYLOAD = [
  { entityType: 'recording', mbid: '2bea9225-3cee-4a23-b8f3-cd705bed3d06', url: 'https://tidal.com/browse/track/1234', note: 'from Harmony' },
  { entityType: 'artist', mbid: '82ca9599-5a15-4ff5-90d5-59ac8afaf5c7', url: 'https://open.spotify.com/artist/abc', note: 'from Harmony' },
  { entityType: 'release', mbid: RELEASE, coverCandidates: [
    { provider: 'iTunes', url: 'https://a1.mzstatic.com/us/r1000/063/Music211/v4/12/44/32/12443250-8925-e891-808d-4df4fef10759/cover.jpg', width: 3000, height: 3000, size: 5580000 },
    { provider: 'Tidal', url: 'https://resources.tidal.com/images/27083100/2879/4034/8084/2e353af1934a/1280x1280.jpg' },
  ] },
];

const queueFor = async (page) => page.evaluate(() => window.__falconTest.getQueue().map(i => ({
  t: i.entityType, mbid: i.mbid.slice(0, 8), urls: i.urls.length, covers: (i.cover || []).length,
  cands: (i.cover || []).reduce((n, c) => n + (c.candidates || []).length, 0),
})));

// ── option OFF: today's behaviour, covers processed ─────────────────────────
{
  const { ctx, page } = await launch(false);
  await page.evaluate(p => window.__falconTest.addToQueue(p), PAYLOAD);
  const q = await queueFor(page);
  console.log('option OFF -> ' + JSON.stringify(q));
  const rel = q.find(x => x.t === 'release');
  ck(!!rel && rel.cands === 2, 'with the option off the cover still arrives with its candidates (unchanged behaviour)');
  ck(q.length === 3, 'and the batch is three rows');
  await ctx.close();
}

// ── option ON: no cover, everything else intact ─────────────────────────────
{
  const { ctx, page } = await launch(true);
  await page.evaluate(p => window.__falconTest.addToQueue(p), PAYLOAD);
  const q = await queueFor(page);
  const logLines = await page.evaluate(() => window.__falconTest.getLog().filter(l => /ignoring cover art/i.test(String(l))));
  console.log('option ON  -> ' + JSON.stringify(q));
  logLines.forEach(l => console.log('   ' + l));
  const rel = q.find(x => x.t === 'release');
  ck(!rel || rel.cands === 0, 'the cover payload is dropped even though it arrived (older tab / hand-made url / JSON import)');
  ck(logLines.length === 1, 'and it says so in the log rather than vanishing quietly');
  // the rest of the batch is untouched — this option is about covers only
  ck(q.some(x => x.t === 'recording' && x.urls === 1), 'the recording link still queues');
  ck(q.some(x => x.t === 'artist' && x.urls === 1), 'the artist link still queues');
  await ctx.close();
}

// ── the setting is reachable from the UI, and reads back ────────────────────
{
  const { ctx, page } = await launch(false);
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 15000 });
  await page.click('#falcon-tab-options');            // the ⚙ tab — options live there
  await page.waitForTimeout(300);
  const box = await page.$('#falcon-opt-skip-harmony-covers');
  ck(!!box, 'the option exists in Settings');
  if (box) {
    const label = await page.evaluate(el => (el.closest('label')?.innerText || '').trim(), box);
    console.log('settings label: ' + JSON.stringify(label));
    ck(/cover/i.test(label), 'labelled for what it does — ' + JSON.stringify(label));
    ck(await box.isChecked() === false, 'and it is off by default, so nobody\'s current behaviour changes');
    await box.check();
    const stored = await page.evaluate(() => window.__falconTest.cfg.skipHarmonyCovers);
    ck(stored === true, 'ticking it stores the setting');
  }
  await ctx.close();
}

console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
