// #474 (majkinetor): recording disambiguation + ISRC, addable via Falcon's own
// queue — "just make it addable via our interface, sender is responsible for
// filling it". Checked MB's own Form/Recording.pm: disambiguation is
// internally called `comment`, ISRC is the repeatable `isrcs` field — both
// seedable the exact same way Falcon already seeds url.N.text.
//
// Also covers the Harmony ISRC pickup: a release's recording "Link external
// IDs" actions never carry ISRC (checked a real Harmony page live), but
// there's a separate "Open with MagicISRC" action with isrc1..isrcN
// positional to track order. scrapeHarmonyActions() zips those onto the
// recording tuples it already builds, by the order recordings first appear.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
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
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(400);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 10000 });

// ── buildSeedEditUrl: comment + isrcs seed for recordings, and are skipped
// entirely for artist/label (MB's form has no such fields there) ──────────
const recUrl = await page.evaluate(() => window.__falconTest.buildSeedEditUrl({
  entityType: 'recording', mbid: 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7',
  comment: 'live version', isrcs: ['USRC17607839', 'GBUM71505078'],
  urls: [{ url: 'https://tidal.com/track/120024260', linkTypeId: '979' }],
}));
const recParams = new URL(recUrl).searchParams;
ck(recParams.get('edit-recording.comment') === 'live version', `disambiguation seeded (got "${recParams.get('edit-recording.comment')}")`);
ck(recParams.get('edit-recording.isrcs.0.value') === 'USRC17607839' && recParams.get('edit-recording.isrcs.1.value') === 'GBUM71505078',
  `both ISRCs seeded at their own index (got ${recParams.get('edit-recording.isrcs.0.value')} / ${recParams.get('edit-recording.isrcs.1.value')})`);

const artUrl = await page.evaluate(() => window.__falconTest.buildSeedEditUrl({
  entityType: 'artist', mbid: '5441c29d-3602-4898-b1a1-b77fa23b8e50',
  comment: 'should be ignored', isrcs: ['USRC17607839'],
  urls: [{ url: 'https://myspace.com/x' }],
}));
const artParams = new URL(artUrl).searchParams;
ck(artParams.get('edit-artist.comment') === null && artParams.get('edit-artist.isrcs.0.value') === null,
  'comment/isrcs are recording-only — never seeded for an artist');

// ── addToQueue: a new item picks up comment/isrc; a later tuple for the SAME
// entity merges in without clobbering, and dedupes a repeated isrc ────────
await page.evaluate(() => window.__falconTest.setQueue([]));
const merged = await page.evaluate(() => {
  window.__falconTest.addToQueue([
    { entityType: 'recording', mbid: 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7', url: 'https://tidal.com/track/1', comment: 'DJ mix edit', isrc: 'USRC17607839' },
    { entityType: 'recording', mbid: 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7', url: 'https://tidal.com/track/1', comment: 'overwrite attempt', isrc: 'USRC17607839' },   // same isrc again — must not duplicate
    { entityType: 'recording', mbid: 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7', url: 'https://www.deezer.com/track/2', isrc: 'GBUM71505078' },   // second url, second isrc, no comment
  ]);
  return window.__falconTest.getQueue()[0];
});
console.log('merged item:', JSON.stringify({ comment: merged.comment, isrcs: merged.isrcs, urls: merged.urls.length }));
ck(merged.comment === 'DJ mix edit', `first comment wins, later ones don't clobber it (got "${merged.comment}")`);
ck(JSON.stringify(merged.isrcs) === JSON.stringify(['USRC17607839', 'GBUM71505078']), `isrcs accumulate without duplicating a repeat (got ${JSON.stringify(merged.isrcs)})`);
ck(merged.urls.length === 2, `both distinct urls grouped onto the one item (got ${merged.urls.length})`);

// ── Harmony ISRC pickup: a synthetic page with 3 recording "Link external
// IDs" actions (2nd one deliberately duplicated, as real Harmony pages do —
// dual relationship types render as two <a> tags for the SAME recording) plus
// one "Open with MagicISRC" action — isrc2 must land on the recording that's
// the SECOND to first appear, regardless of it having two link anchors ──────
const harmonyResult = await page.evaluate(() => {
  document.body.innerHTML = `
    <a href="https://musicbrainz.org/recording/11111111-1111-1111-1111-111111111111/edit?edit-recording.url.0.text=https%3A%2F%2Fa.example%2F1&edit-recording.url.0.link_type_id=268">Link external IDs</a>
    <a href="https://musicbrainz.org/recording/22222222-2222-2222-2222-222222222222/edit?edit-recording.url.0.text=https%3A%2F%2Fa.example%2F2&edit-recording.url.0.link_type_id=268">Link external IDs</a>
    <a href="https://musicbrainz.org/recording/22222222-2222-2222-2222-222222222222/edit?edit-recording.url.0.text=https%3A%2F%2Fa.example%2F2b&edit-recording.url.0.link_type_id=254">Link external IDs</a>
    <a href="https://musicbrainz.org/recording/33333333-3333-3333-3333-333333333333/edit?edit-recording.url.0.text=https%3A%2F%2Fa.example%2F3&edit-recording.url.0.link_type_id=268">Link external IDs</a>
    <a href="https://magicisrc.kepstin.ca/?isrc1=USRC10000001&isrc2=USRC10000002&isrc3=USRC10000003&musicbrainzid=aaaaaaaa-1111-1111-1111-111111111111">Open with MagicISRC</a>
  `;
  const tuples = window.__falconTest.scrapeHarmonyActions();
  return tuples.map(t => ({ mbid: t.mbid, url: t.url, isrc: t.isrc || null }));
});
console.log('harmony scrape result:', JSON.stringify(harmonyResult, null, 1));
const byMbid = id => harmonyResult.filter(t => t.mbid === id);
ck(byMbid('11111111-1111-1111-1111-111111111111').every(t => t.isrc === 'USRC10000001'), 'first recording (1 link) gets isrc1');
ck(byMbid('22222222-2222-2222-2222-222222222222').length === 2 && byMbid('22222222-2222-2222-2222-222222222222').every(t => t.isrc === 'USRC10000002'),
  'second recording (dual-type, 2 anchors) still only counts once and gets isrc2 on BOTH its tuples');
ck(byMbid('33333333-3333-3333-3333-333333333333').every(t => t.isrc === 'USRC10000003'), 'third recording gets isrc3');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
