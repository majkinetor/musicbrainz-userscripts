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
//
// The recordings are pristine, made for the run (#795): eight tracks of a new release, made in
// the harness's Chromium (pristine()'s artist form didn't submit in Playwright's Firefox).
import { readFile } from 'node:fs/promises';
import { firefox } from '@playwright/test';
import { test, check, requireLogin, sourceOf, REPO, idle, frames, settled, mbNoise, pristine } from '../../../dev/test/harness.mjs';
import { resolve } from 'node:path';
import { installProdGuard } from '../../../dev/test/guard.mjs';

// Firefox (the harness is Chromium): the script launches it, with its own GM stand-ins
test.use({ gm: false });

test("#467: e2e testserver", { tag: ['@sandbox', '@login', '@flaky'] }, async ({ page: chromium }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');
  const { recordings: RECS } = await pristine(chromium, 'release', { tracks: 8 });

  const TEST_MB = 'https://test.musicbrainz.org';

  const context = await firefox.launchPersistentContext(resolve(REPO, '.pw-profile-ff'), { headless: true, viewport: { width: 1500, height: 950 } });
  // closed in `finally`: a spec that skips (the profile isn't signed in) or fails must not leave
  // Firefox running on the profile, or the next Firefox spec can't open it (#637)
  try {
    await installProdGuard(context);   // Firefox, its own profile: the harness guard is added by hand
    const page = context.pages()[0] || await context.newPage();
    await context.addInitScript(() => {
      window.__mbuTest = true;   // Falcon builds its test hook only on a marked page (#623)
      const store = new Map();
      window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
      window.GM_setValue = (k, v) => store.set(k, v);
      window.GM_deleteValue = k => store.delete(k);
      window.GM_info = { script: { name: 'Falcon', version: 't' } };
    });
    const ck = check;

    const errs = []; page.on('pageerror', e => { if (!mbNoise(e.message)) errs.push(e.message); });
    // nothing is intercepted here — instead, watch for anything touching production
    let prodHits = 0;
    page.on('request', r => {
      if (/\/\/(www\.)?musicbrainz\.org\//.test(r.url())) prodHits++;
    });

    await page.goto(TEST_MB + '/', { waitUntil: 'domcontentloaded' });
    await requireLogin(page);
    await idle(page);
    // a stall is the thread held for 2s or more: the freeze this guards was the CPU pinned, with no
    // end. Three MusicBrainz edit pages loading at once in same-origin iframes hold the panel's
    // thread on their own, up to half a second with no Falcon on the page (measured 2026-10-20),
    // and the earlier 400ms bar failed on that alone
    await page.evaluate(() => {
      window.__stalls = [];
      let last = performance.now();
      setInterval(() => { const n = performance.now(); const late = Math.round(n - last - 200); last = n; if (late > 2000) window.__stalls.push(late); }, 200);
    });
    await page.addScriptTag({ content: code });
    await page.waitForFunction(() => !!window.__falconTest, { timeout: 15000 });

    const target = await page.evaluate(() => window.__falconTest.buildSeedEditUrl({ entityType: 'recording', mbid: 'x', urls: [], note: '' }).split('/recording/')[0]);
    console.log('MB_TARGET resolved to:', target);
    ck(target === TEST_MB, `edit urls are built against the server the panel is open on, NOT pinned to production (got ${target})`);

    await page.evaluate(() => document.getElementById('falcon-launcher').click());
    await frames(page);

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
    ck(Array.isArray(stalls) && stalls.length === 0, `the UI thread was never blocked (stalls over 2s: ${JSON.stringify(stalls)})`);
    ck(prodHits === 0, `nothing reached PRODUCTION musicbrainz.org while working on the sandbox (${prodHits} request(s))`);

    // The actual point: read the entities back and require the relationships to be
    // there. "status: done" only means MB redirected off /edit.
    await settled(page);
    const shortfalls = [];
    for (let i = 0; i < RECS.length; i++) {
      // one read a second, and a throttled one (503) asked again: eight back to back were
      // throttled, and a refused read showed as a missing relationship (got null)
      const types = await page.evaluate(async ({ mbid, want, base }) => {
        for (let attempt = 1; attempt <= 5; attempt++) {
          await new Promise(z => setTimeout(z, 1100 * attempt));
          const r = await fetch(`${base}/ws/2/recording/${mbid}?inc=url-rels&fmt=json`, { headers: { Accept: 'application/json' } });
          if (r.status === 503 || r.status === 429) continue;
          if (!r.ok) return null;
          const j = await r.json();
          return (j.relations || []).filter(x => x.url && x.url.resource === want).map(x => x.type).sort();
        }
        return null;
      }, { mbid: RECS[i], want: urlFor(i), base: TEST_MB });
      if (!types || types.length !== 2) shortfalls.push({ mbid: RECS[i], got: types });
    }
    console.log('shortfalls:', JSON.stringify(shortfalls));
    ck(shortfalls.length === 0, `all ${RECS.length} entities really carry BOTH relationship types afterwards, confirmed through the web service (${RECS.length - shortfalls.length}/${RECS.length}: ${JSON.stringify(shortfalls)})`);

    ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  } finally {
    await context.close();
  }
});
