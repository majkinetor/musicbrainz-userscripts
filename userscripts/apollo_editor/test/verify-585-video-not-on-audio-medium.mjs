// #585 (chaban-mb): "Apollo doesn't seem to care if a recording is a video" — a
// music video, sharing title/artist/length with the audio track, auto-linked onto
// a regular audio track. Undoing that is the expensive kind: new recordings, then
// lengths restored, then wrong links and ISRCs stripped.
//
// The rule is MusicBrainz's own, taken from its cleanup report
// (Report/VideosInNonVideoMediums.pm):
//
//     r.video IS TRUE AND t.is_data_track IS FALSE
//     AND m.format IN (<~48 non-video format ids>)
//
// so position is not part of it. That matters twice: the issue's "videos come
// last" heuristic needs a format gate anyway (every track of a DVD is a video),
// and it breaks on a trailing RUN of videos where the earlier ones are not last.
//
// What is checked here:
//   · the format set matches MB's report, read from MB's source at test time, so
//     it cannot quietly drift from the authority it claims to follow
//   · the gate refuses on an audio-only medium, allows on a data track of one,
//     and allows on a video-capable medium
//   · the picker is untouched
//
// Live page, Apollo's own exported predicate, no writes.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.AE_SRC || resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const MBID = process.env.MBID || '55530bc0-97ec-4256-97fc-e6058958c251';   // Enhanced CD, 3 video recordings

/* ── 1. the id set really is MusicBrainz's ─────────────────────────────────── */
const REPORT = 'https://raw.githubusercontent.com/metabrainz/musicbrainz-server/master/lib/MusicBrainz/Server/Report/VideosInNonVideoMediums.pm';
let mbIds = null;
try {
  const pm = await (await fetch(REPORT)).text();
  const block = pm.slice(pm.indexOf('$NON_VIDEO_FORMATS'), pm.indexOf('sub query'));
  mbIds = [...block.matchAll(/^\s*(\d+),\s*#/gm)].map(m => +m[1]);
  // the report also has to still be built the way this fix assumes
  ck(/r\.video IS TRUE/.test(pm) && /t\.is_data_track IS FALSE/.test(pm) && /m\.format IN \(\$NON_VIDEO_FORMATS\)/.test(pm),
    'MB still defines the violation as video + not-a-data-track + non-video format');
} catch (e) { console.log('could not reach the MB source (' + e.message + ') — skipping the drift check'); }
/* Guarded: on a build without the fix this match is null, and indexing it threw a
   TypeError — the pre-fix run died on line 46 instead of reporting a failed
   check, which is indistinguishable from a broken test. */
const setSrc = (code.match(/const NON_VIDEO_FORMAT_IDS = new Set\(\[([\s\S]*?)\]\)/) || [])[1] || '';
ck(!!setSrc, 'the script carries the non-video format set');
const ours = [...setSrc.matchAll(/^\s*(\d+),/gm)].map(m => +m[1]);
console.log(`format ids — ours ${ours.length}, MB ${mbIds ? mbIds.length : 'n/a'}`);
if (mbIds) {
  const missing = mbIds.filter(i => !ours.includes(i));
  const extra = ours.filter(i => !mbIds.includes(i));
  ck(missing.length === 0 && extra.length === 0,
    `our format set is MB's, exactly (missing ${JSON.stringify(missing)}, extra ${JSON.stringify(extra)})`);
}

/* ── 2. the gate behaves, on a real release ────────────────────────────────── */
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1500, height: 1000 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Apollo Editor', version: 't' } };
  window.GM_xmlhttpRequest = () => {};
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const posted = [];
await page.route(/\/ws\/js\/edit\/|\/relationship-editor|\/edit\/create/i, r => { posted.push(r.request().url()); return r.abort(); });
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(5000);
await page.addScriptTag({ content: code });
const haveGate = await page.waitForFunction(() => !!(window.__apolloEditor && window.__apolloEditor.videoBlockedHere), null, { timeout: 20000 }).then(() => true).catch(() => false);
ck(haveGate, 'the script exposes the video gate');
if (!haveGate) {
  console.log('no gate on this build — nothing further to measure');
  await ctx.close();
  console.log(fail + ' FAILED');
  process.exit(1);
}

const probe = await page.evaluate(() => {
  const A = window.__apolloEditor;
  const ed = window.MB.releaseEditor;
  const med = ed.rootField.release().mediums()[0];
  const n = med.tracks().length;
  const read = () => ({ fmt: med.formatID(), blocked: A.videoBlockedHere(0, n - 1), dataTrack: !!med.tracks()[n - 1].isDataTrack() });

  const out = { setSize: A.NON_VIDEO_FORMAT_IDS.size, originalFormat: med.formatID(), states: {} };
  // the release is an Enhanced CD (42) — in MB's list
  out.states.audioOnly = read();
  // …its last track moved into the data section
  med.tracks()[n - 1].isDataTrack(true);
  out.states.dataTrack = read();
  med.tracks()[n - 1].isDataTrack(false);
  /* The video-capable case cannot be driven through formatID: MB's editor
     refuses the write (setting '120' or 120 both left it reading "42"), so a test
     that poked it was asserting nothing. The predicate's only other input is the
     id set, so that side is checked against the REAL format list off the page's
     own <select> instead — see below. */
  med.formatID(null);
  out.states.unknownFormat = read();
  med.formatID(out.originalFormat);
  out.restored = med.formatID();
  // label → id, straight from MB's own medium-format picker
  out.formats = {};
  document.querySelectorAll('select[id^="medium-format"] option').forEach(o => {
    const t = (o.textContent || '').trim(); if (t && o.value) out.formats[t] = +o.value;
  });
  return out;
});
console.log('\n' + JSON.stringify(probe, null, 1));

ck(probe.setSize === ours.length, `the script exposes the whole set (${probe.setSize})`);
ck(probe.states.audioOnly.blocked === true,
  `a video is refused on an audio-only medium (format ${probe.states.audioOnly.fmt}, not a data track)`);
ck(probe.states.dataTrack.blocked === false,
  'the same track in the DATA section accepts it — that is where an Enhanced CD keeps its videos');
/* The video-capable side, checked on MB's real format list rather than by writing
   the observable: these are the formats a video legitimately lives on, and the
   predicate lets a video through for exactly the ids that are NOT in the set. */
const F = probe.formats || {};
const videoCapable = ['DVD-Video', 'Blu-ray', 'VHS', 'Digital Media'].filter(n => F[n]);
const audioOnly = ['CD', '12" Vinyl', 'Cassette', 'Enhanced CD'].filter(n => F[n]);
console.log('video-capable ids', JSON.stringify(videoCapable.map(n => n + '=' + F[n])),
            '· audio-only ids', JSON.stringify(audioOnly.map(n => n + '=' + F[n])));
ck(videoCapable.length >= 3 && audioOnly.length >= 3, `found both kinds of format in MB's picker (${videoCapable.length}/${audioOnly.length})`);
ck(videoCapable.every(n => !ours.includes(F[n])),
  `a video-capable format is never refused — ${videoCapable.join(', ')} are outside the set`);
ck(audioOnly.every(n => ours.includes(F[n])),
  `every audio-only format is covered — ${audioOnly.join(', ')} are in the set`);
ck(probe.states.unknownFormat.blocked === false,
  'an unset format does NOT refuse — half-entered releases must still match');
ck(String(probe.restored) === String(probe.originalFormat), 'the fixture put the format back');

/* ── 3. the picker is not affected ─────────────────────────────────────────── */
const picker = await page.evaluate(() => {
  const A = window.__apolloEditor;
  const vid = { name: 'X', length: 100000, artist: 'Y', video: true };
  const aud = { name: 'X', length: 100000, artist: 'Y', video: false };
  const c = { title: 'X', length: 100000, artist: 'Y' };
  return { video: A.recComboLevel(vid, c), audio: A.recComboLevel(aud, c) };
});
console.log('recComboLevel — video', picker.video, '· audio', picker.audio);
ck(picker.video === picker.audio,
  `scoring itself is untouched, so a hand-picked video still reads at its true confidence (${picker.video} vs ${picker.audio})`);

ck(posted.length === 0, `nothing was submitted (${posted.length})`);
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
