// #467/#459 (majkinetor) — the Harmony bridge. Harmony's "Link external IDs" actions
// are already standard MB seed URLs; parseHarmonySeedUrl decodes them directly (no
// scraping of rendered text needed), and running Falcon ON a Harmony actions page
// surfaces a "Send N to Falcon" button that combines them into one ?falcon= payload.
// Also covers the real-world case Harmony produces: the SAME url needing TWO
// relationship types (e.g. a Bandcamp track as both "stream for free" and "purchase
// for download"), via MB's own "Add another relationship" row.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

// Real hrefs captured live from
// https://harmony.pulsewidth.org.uk/release/actions?release_mbid=...20b03c7d-9e8a-42b9-8a96-bcc9564de034
const HREF_ARTIST = 'https://musicbrainz.org/artist/b31113ab-205d-461b-b431-5d5c52635117/edit?edit-artist.url.0.text=https%3A%2F%2Ftidal.com%2Fartist%2F7388291&edit-artist.url.0.link_type_id=978&edit-artist.edit_note=Matched+artist+while+importing+https%3A%2F%2Fmusicbrainz.org%2Frelease%2F20b03c7d-9e8a-42b9-8a96-bcc9564de034+with+Harmony';
const HREF_LABEL = 'https://musicbrainz.org/label/04201e6d-c430-4a53-a9a0-56170825fbde/edit?edit-label.url.0.text=https%3A%2F%2Fwww.discogs.com%2Flabel%2F741917&edit-label.url.0.link_type_id=217&edit-label.url.1.text=https%3A%2F%2Fbrightestdarkplace.bandcamp.com%2F&edit-label.url.1.link_type_id=719&edit-label.edit_note=Matched+label+while+importing+https%3A%2F%2Fmusicbrainz.org%2Frelease%2F20b03c7d-9e8a-42b9-8a96-bcc9564de034+with+Harmony';
const HREF_RECORDING_DUAL = 'https://musicbrainz.org/recording/e42f8e08-3150-4c6c-be5b-4030c29b1bf7/edit?edit-recording.url.0.text=https%3A%2F%2Fwww.deezer.com%2Ftrack%2F3702424332&edit-recording.url.0.link_type_id=268&edit-recording.url.1.text=https%3A%2F%2Fbrightestdarkplace.bandcamp.com%2Ftrack%2Fdusk&edit-recording.url.1.link_type_id=268&edit-recording.url.2.text=https%3A%2F%2Fbrightestdarkplace.bandcamp.com%2Ftrack%2Fdusk&edit-recording.url.2.link_type_id=254&edit-recording.url.3.text=https%3A%2F%2Ftidal.com%2Ftrack%2F120024260&edit-recording.url.3.link_type_id=979&edit-recording.edit_note=Matched+recording+while+importing+https%3A%2F%2Fmusicbrainz.org%2Frelease%2F20b03c7d-9e8a-42b9-8a96-bcc9564de034+with+Harmony';

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// 1. parseHarmonySeedUrl on the 3 real captured shapes.
{
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  const [artist, label, recDual] = await page.evaluate(([a, l, r]) => {
    const { parseHarmonySeedUrl } = window.__falconTest;
    return [parseHarmonySeedUrl(a), parseHarmonySeedUrl(l), parseHarmonySeedUrl(r)];
  }, [HREF_ARTIST, HREF_LABEL, HREF_RECORDING_DUAL]);
  console.log('artist:', JSON.stringify(artist));
  console.log('label:', JSON.stringify(label));
  console.log('recDual:', JSON.stringify(recDual));
  ck(artist.length === 1 && artist[0].entityType === 'artist' && artist[0].mbid === 'b31113ab-205d-461b-b431-5d5c52635117' && artist[0].url === 'https://tidal.com/artist/7388291' && artist[0].linkTypeId === '978', 'single-url artist href decoded correctly');
  ck(/Matched artist while importing/.test(artist[0].note), 'edit_note decoded from the query param');
  ck(label.length === 2 && label[0].entityType === 'label' && label.every(t => t.mbid === '04201e6d-c430-4a53-a9a0-56170825fbde'), `label href decodes BOTH urls (got ${label.length})`);
  ck(label[1].url === 'https://brightestdarkplace.bandcamp.com/' && label[1].linkTypeId === '719', 'second label url + its link_type_id decoded');
  ck(recDual.length === 4 && recDual[0].entityType === 'recording', `recording href decodes all 4 url entries (got ${recDual.length})`);
  const bandcampEntries = recDual.filter(t => t.url.includes('bandcamp'));
  ck(bandcampEntries.length === 2 && bandcampEntries[0].url === bandcampEntries[1].url && bandcampEntries[0].linkTypeId !== bandcampEntries[1].linkTypeId, `the SAME bandcamp url appears twice with DIFFERENT link_type_id (268 vs 254) (${JSON.stringify(bandcampEntries.map(t => t.linkTypeId))})`);

  // 2. encodeFalconPayload -> parseUrlParam round-trip (what actually crosses the tab boundary).
  const roundtrip = await page.evaluate((tuples) => {
    const { encodeFalconPayload } = window.__falconTest;
    const payload = encodeFalconPayload(tuples);
    const url = new URL('https://musicbrainz.org/?falcon=' + encodeURIComponent(payload));
    history.replaceState(null, '', url.pathname + url.search);
    return window.__falconTest.parseUrlParam();
  }, [...artist, ...label]);
  console.log('roundtrip:', JSON.stringify(roundtrip));
  ck(roundtrip && roundtrip.length === 3, `payload round-trips through encode -> URL -> parseUrlParam (got ${roundtrip?.length})`);
  ck(roundtrip?.some(t => t.entityType === 'label' && t.linkTypeId === '719'), 'linkTypeId survives the round-trip');
}

// 3. Live Harmony page: the button appears, finds real actions, and building its
// payload produces a valid, larger-than-a-handful item count. Does NOT click it
// (that would open a real new tab) — just verifies the scrape + count are live.
{
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('https://harmony.pulsewidth.org.uk/release/actions?release_mbid=https%3A%2F%2Fmusicbrainz.org%2Frelease%2F20b03c7d-9e8a-42b9-8a96-bcc9564de034', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const items = window.__falconTest.scrapeHarmonyActions();   // raw — still includes recordings
    const btn = document.getElementById('falcon-harmony-btn');
    const filtered = items.filter(t => t.entityType !== 'recording');
    const fullUrlLen = `https://musicbrainz.org/?falcon=${encodeURIComponent(window.__falconTest.encodeFalconPayload(items))}`.length;
    const filteredUrlLen = `https://musicbrainz.org/?falcon=${encodeURIComponent(window.__falconTest.encodeFalconPayload(filtered))}`.length;
    return {
      count: items.length, btnExists: !!btn, btnText: document.getElementById('falcon-harmony-lbl')?.textContent, btnTitle: btn?.title,
      byType: items.reduce((m, i) => { m[i.entityType] = (m[i.entityType] || 0) + 1; return m; }, {}),
      fullUrlLen, filteredUrlLen, filteredCount: filtered.length,
    };
  });
  console.log('live harmony scrape:', JSON.stringify(info));
  ck(info.btnExists, 'the "Send to Falcon" button is injected on a real Harmony actions page');
  ck(info.count > 10, `raw scrapeHarmonyActions() still returns recordings too (got ${info.count})`);
  ck((info.byType.artist || 0) > 0 && (info.byType.recording || 0) > 0, `raw scrape covers both artist and recording actions (${JSON.stringify(info.byType)})`);
  // #467 follow-up: recordings excluded from what the button actually SENDS — a real
  // batch's base64 payload blew past ~32,000 chars (measured) and MB's front-end
  // dropped the connection (Firefox: PR_END_OF_FILE_ERROR) rather than erroring cleanly.
  ck(new RegExp(`Send ${info.filteredCount} to Falcon`).test(info.btnText || ''), `button label shows the FILTERED (no-recordings) count, not the raw one (label="${info.btnText}", filtered count=${info.filteredCount})`);
  ck(info.filteredCount < info.count, `recordings are indeed excluded from the sendable set (${info.filteredCount} < ${info.count})`);
  ck(/recording link\(s\) skipped/.test(info.btnTitle || ''), `tooltip explains the skip (title="${info.btnTitle}")`);
  ck(info.filteredUrlLen < 8000, `the filtered payload's URL is comfortably under typical server URL limits (${info.filteredUrlLen} chars, vs raw ${info.fullUrlLen})`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

// 4. Dual relationship type on the SAME url, end-to-end on the real recording page —
// the submit POST is intercepted+faked so nothing real is submitted.
{
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  let posts = 0;
  await page.route('**/recording/*/edit', async (route, request) => {
    if (request.method() === 'POST') { posts++; const mbid = (request.url().match(/\/recording\/([0-9a-f-]{36})\/edit/) || [])[1]; return route.fulfill({ status: 302, headers: { Location: `https://musicbrainz.org/recording/${mbid}` } }); }
    return route.continue();
  });
  await page.goto('https://musicbrainz.org/recording/e42f8e08-3150-4c6c-be5b-4030c29b1bf7', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForTimeout(500);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.waitForSelector('#falcon-launcher', { timeout: 5000 });
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 5000 });
  await page.evaluate((tuples) => {
    window.__falconTest.setQueue([{
      id: 'dual', entityType: 'recording', mbid: 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7',
      urls: tuples.map(t => ({ url: t.url, linkTypeId: t.linkTypeId })),
      note: tuples[0].note, urlResults: null, status: 'queued', error: '',
    }]);
  }, /* only the deezer(268) + bandcamp(268) + bandcamp(254) entries, skip tidal to keep this focused */
     [
       { url: 'https://www.deezer.com/track/3702424332', linkTypeId: '268', note: 'test' },
       { url: 'https://brightestdarkplace.bandcamp.com/track/dusk', linkTypeId: '268', note: 'test' },
       { url: 'https://brightestdarkplace.bandcamp.com/track/dusk', linkTypeId: '254', note: 'test' },
     ]);
  await page.evaluate(() => window.__falconTest.start());
  await page.waitForFunction(() => window.__falconTest.getQueue()[0]?.status !== 'queued' && window.__falconTest.getQueue()[0]?.status !== 'active', null, { timeout: 20000 }).catch(() => {});
  const result = await page.evaluate(() => window.__falconTest.getQueue()[0]);
  console.log('dual-type result:', JSON.stringify(result, null, 1));
  ck(result?.status === 'done', `dual-relationship-type item commits as done (status=${result?.status})`);
  ck(result?.urlResults?.every(r => r.ok), `all 3 entries (2 distinct urls, one with 2 types) succeeded (${JSON.stringify(result?.urlResults)})`);
  ck(posts === 1, `still exactly ONE submit despite the 2nd bandcamp entry being a second relationship on an existing row (got ${posts})`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
