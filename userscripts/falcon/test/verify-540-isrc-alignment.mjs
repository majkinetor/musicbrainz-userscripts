// #540 "Wrong ISRC applied on one recording", and the forum report behind it:
// "if it's a big album and some of the submissions failed halfway through and
// you restart it, some links and ISRCs will be attached to the wrong
// recordings."
//
// Falcon used to zip ISRCs onto the recordings found among Harmony's "Link
// external IDs" anchors — the Nth distinct recording got isrcN. Harmony stops
// offering that action once a link exists, so on a second pass over a
// partly-finished release the earlier tracks are absent from that list and
// every later ISRC shifts up. On majkinetor's release 216a51c7 that put
// GBNRN1543507 (isrc7) on track 10's recording: a 3-position shift.
//
// This builds a fake Harmony page in exactly that state — the first three
// tracks already linked, so no action for them — and checks that no ISRC is
// attached by position any more, and that the tracklist path puts each ISRC on
// the right recording. Read-only: no MusicBrainz page is opened, nothing is
// submitted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

// majkinetor's own release, and its real recording MBIDs in track order.
const RELEASE = '216a51c7-c6fd-49b4-b0a8-c508476beecc';
const TRACKS = [
  '4842908e-a77b-49e0-b3b9-39f617242fc5', '340a0dff-933c-46d8-88d9-6c9ff88aad3e',
  'c87b8de2-944f-41e6-a709-6231c29392e0', '250aef3b-09c7-4d76-b6ee-111abfa3a6e1',
  '0f3aad06-6f5b-4d91-8725-a86d20da41d9', 'a12ba61c-6a49-46c9-9f56-aa7fe76079e3',
  '53cb0616-cde0-4e32-b83a-f686de50577e', '0ef7a5f3-3ae9-4701-872d-bd223f28a669',
  '1212ae52-172e-471b-8a16-040f6115aa83', 'f8df5b35-ecf5-4e5d-93e2-3032219d33f6',
  '57e5a5e2-c848-4ff6-bfb7-a3e29cc270ff',
];
const ISRCS = ['GBNRN0933116', 'GBNRN1543502', 'GBNRN0833512', 'GBNRN0933204', 'GBNRN0833513',
  'GBNRN0632109', 'GBNRN1543507', 'GBNRN1543508', 'GBNRN1543509', 'GBNRN1543510', 'GBNRN1543511'];
const ALREADY_LINKED = 3;   // the first three tracks were done in the earlier run

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const magic = 'https://magicisrc.kepstin.ca/?musicbrainzid=' + RELEASE
  + ISRCS.map((v, i) => `&isrc${i + 1}=${v}`).join('') + '&edit-note=' + encodeURIComponent('from Harmony');
// Only the still-unlinked tracks get an action — this is the whole point.
const actions = TRACKS.slice(ALREADY_LINKED).map(mbid =>
  `<li><a href="https://musicbrainz.org/recording/${mbid}/edit?edit-recording.url.0.text=https%3A%2F%2Ftidal.com%2Ftrack%2F1">Link external IDs</a></li>`).join('');
const html = `<!doctype html><meta charset="utf-8"><title>fake Harmony actions</title>
<body><h1>Release actions</h1><ul>${actions}</ul>
<p><a href="${magic}">Open with MagicISRC</a></p></body>`;

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_deleteValue = k => s.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
// Serve the fake page from harmony's own origin so the script's @match logic
// and any origin checks behave as they would for real.
await page.route('https://harmony.pulsewidth.org.uk/release/actions*', route =>
  route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
await page.goto('https://harmony.pulsewidth.org.uk/release/actions?x=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.addScriptTag({ content: code });
await page.waitForTimeout(600);

const scraped = await page.evaluate(() => {
  const t = window.__falconTest;
  const tuples = t.scrapeHarmonyActions();
  return {
    recordings: tuples.filter(x => x.entityType === 'recording').map(x => ({ mbid: x.mbid, isrc: x.isrc || null })),
    isrcs: t.scrapeHarmonyIsrcs(),
  };
});
console.log(`page offers ${scraped.recordings.length} link actions for an 11-track release, and ${scraped.isrcs.length} ISRCs`);
ck(scraped.recordings.length === TRACKS.length - ALREADY_LINKED, 'the fixture really is the partly-finished case');
ck(scraped.isrcs.length === ISRCS.length, 'while MagicISRC still lists every track\'s ISRC');

// ── the bug, stated directly ────────────────────────────────────────────────
// Old behaviour: recordings[6] (track 10) would carry isrc7 = GBNRN1543507.
const wrong = scraped.recordings.find(r => r.mbid === 'f8df5b35-ecf5-4e5d-93e2-3032219d33f6');
console.log('track 10 recording as scraped: ' + JSON.stringify(wrong));
ck(scraped.recordings.every(r => !r.isrc), 'no ISRC is attached by anchor position any more');
ck(!wrong || wrong.isrc !== 'GBNRN1543507', 'specifically, track 10 does not receive track 7\'s ISRC (the reported symptom)');

// What the Harmony page hands over — the payload the token carries.
const handoff = await page.evaluate(() => window.__falconTest.harmonyIsrcFallback());
ck(handoff && handoff.mbid === '216a51c7-c6fd-49b4-b0a8-c508476beecc', 'the handoff carries the release, not a list of guesses');
ck(handoff && handoff.isrcs.length === ISRCS.length, 'with every ISRC still numbered by track');

// ── and the mapping that replaces it ────────────────────────────────────────
// This half runs where it really runs: on the MusicBrainz tab the token opens.
// (MB_ORIGIN is location.origin, so calling it on the Harmony page would ask
// harmony.pulsewidth.org.uk for /ws/2 — which is exactly nothing.)
for (let a = 1; ; a++) {
  try { await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 3) throw e; await page.waitForTimeout(4000); }
}
await page.addScriptTag({ content: code });
await page.waitForTimeout(500);
const placed = await page.evaluate(async (fb) => {
  const t = window.__falconTest;
  t.setQueue([]);
  await t.resolveIsrcFallback(fb.mbid, fb.isrcs, fb.note);
  return t.getQueue().map(i => ({ mbid: i.mbid, isrcs: i.isrcs }));
}, handoff);
console.log('placed by tracklist:');
placed.forEach((p, i) => console.log(`   track ${String(i + 1).padStart(2)}  ${p.mbid}  ${p.isrcs.join(',')}`));
ck(placed.length === TRACKS.length, `every track got its ISRC (${placed.length}/${TRACKS.length})`);
const byMbid = new Map(placed.map(p => [p.mbid, p.isrcs]));
ck((byMbid.get(TRACKS[6]) || [])[0] === 'GBNRN1543507', 'track 7 gets GBNRN1543507 — the one that went astray');
ck((byMbid.get(TRACKS[9]) || [])[0] === 'GBNRN1543510', 'track 10 gets GBNRN1543510, its own');
ck(TRACKS.every((mbid, i) => (byMbid.get(mbid) || [])[0] === ISRCS[i]), 'and every other track matches the tracklist position too');

// ── a changed tracklist must not be guessed at ──────────────────────────────
const mismatch = await page.evaluate(async (mbid) => {
  const t = window.__falconTest;
  t.setQueue([]);
  const before = t.getLog().length;
  // two more ISRCs than the release has tracks
  await t.resolveIsrcFallback(mbid, ['A1', 'B2', 'C3', 'D4', 'E5', 'F6', 'G7', 'H8', 'I9', 'J10', 'K11', 'L12', 'M13'], '');
  return { queued: t.getQueue().length, warned: t.getLog().slice(before).filter(l => /had no track to sit on/i.test(String(l))) };
}, RELEASE);
console.log('overflow case: queued ' + mismatch.queued + ', warnings: ' + JSON.stringify(mismatch.warned));
ck(mismatch.queued === TRACKS.length, 'extra ISRCs beyond the tracklist are dropped, not shuffled onto whatever fits');
ck(mismatch.warned.length === 1, 'and the mismatch is reported rather than silently absorbed');

ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
