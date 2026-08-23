// #539 (majkinetor): "Currently we have Scope: Release only. I noticed this on
// one edit: Parsed 18 credits from text / Moved 18 release credits to 1 selected
// recording … This could be done faster if user is allowed to select recording
// by track number(s)."
//
// So the text parser can now target recordings directly. What has to hold:
//
//   * a track selector picks the right recordings — and shows which, before
//     anything is applied (getting "1-3" wrong silently credits the wrong
//     tracks, which is worse than not having the feature);
//   * the roles offered follow the scope, because artist→recording and
//     artist→release are different link-type vocabularies;
//   * Apply stages the credit on each selected recording, not on the release.
//
// Runs against test.musicbrainz.org and never submits: every POST to /edit is
// aborted and asserted zero at the end. Staged relationships live in the
// editor's own state until someone presses Enter edit, which this never does.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'group_therapy.user.js'), 'utf8');

const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';   // 3 tracks, one medium
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1100 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Group Therapy', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
for (let a = 1; ; a++) {
  try { await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/edit-relationships`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 3) throw e; console.log('goto retry ' + a); await page.waitForTimeout(4000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(4000);

let posts = 0;
await page.route(() => true, route => {
  const r = route.request();
  if (r.method() === 'POST' && /\/edit/.test(r.url())) { posts++; return route.abort(); }
  return route.continue();
});
await page.addScriptTag({ content: code });
await page.waitForTimeout(800);

// ── the selector itself, against the real tracklist ─────────────────────────
const specs = await page.evaluate(() => {
  const gt = window.__groupTherapy;
  const rows = gt.txpTrackRows();
  const m = spec => gt.txpMatchTracks(spec, rows).map(r => r.num);
  return {
    tracks: rows.map(r => `${r.medium}:${r.num} ${r.title}`),
    one: m('2'), range: m('1-2'), list: m('1,3'), medium: m('1:*'), mediumTrack: m('1:3'),
    all: m('all'), none: m('9'), empty: m(''),
  };
});
console.log('tracklist: ' + JSON.stringify(specs.tracks));
ck(specs.tracks.length === 3, 'the release\'s three tracks are readable with their numbers');
ck(JSON.stringify(specs.one) === '["2"]', 'a bare number picks that track — ' + JSON.stringify(specs.one));
ck(JSON.stringify(specs.range) === '["1","2"]', 'a range picks the span — ' + JSON.stringify(specs.range));
ck(JSON.stringify(specs.list) === '["1","3"]', 'a list picks each — ' + JSON.stringify(specs.list));
ck(JSON.stringify(specs.medium) === '["1","2","3"]', 'medium:* picks a whole medium — ' + JSON.stringify(specs.medium));
ck(JSON.stringify(specs.mediumTrack) === '["3"]', 'medium:track disambiguates — ' + JSON.stringify(specs.mediumTrack));
ck(specs.all.length === 3 && specs.none.length === 0 && specs.empty.length === 0,
  'all / no-match / empty behave (' + specs.all.length + ', ' + specs.none.length + ', ' + specs.empty.length + ')');

// ── drive the parser ────────────────────────────────────────────────────────
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => /text parser/i.test(x.textContent || ''));
  if (b) b.click();
});
await page.waitForSelector('.gt-tp', { timeout: 15000 });
await page.waitForTimeout(400);
ck(await page.locator('.gt-tp-scope-sel').count() === 1, 'the parser offers a scope picker rather than a fixed "Scope: Release" pill');

// release scope first: the recording-only controls stay out of the way
ck(!(await page.locator('.gt-tp-tracks').isVisible()), 'the track selector is hidden while the scope is Release');

await page.selectOption('.gt-tp-scope-sel', 'recording');
await page.waitForTimeout(200);
ck(await page.locator('.gt-tp-tracks').isVisible(), 'and appears when the scope is Recordings');
await page.fill('.gt-tp-tracks', '1,3');
await page.waitForTimeout(300);
const info = (await page.locator('.gt-tp-tracks-info').textContent()) || '';
console.log('scope info: ' + JSON.stringify(info.trim()));
ck(/2 tracks/.test(info) && /1, 3/.test(info), 'it says which tracks it matched, before anything is applied');

// ── roles follow the scope ──────────────────────────────────────────────────
const roles = await page.evaluate(() => {
  const gt = window.__groupTherapy;
  const rel = gt.linkTypesForPair('artist', 'release').map(c => c.name);
  const rec = gt.linkTypesForPair('artist', 'recording').map(c => c.name);
  return { relOnly: rel.filter(n => !rec.includes(n)).slice(0, 4), recOnly: rec.filter(n => !rel.includes(n)).slice(0, 4) };
});
console.log('release-only roles: ' + JSON.stringify(roles.relOnly) + '   recording-only: ' + JSON.stringify(roles.recOnly));
ck(roles.relOnly.length > 0 && roles.recOnly.length > 0, 'the two vocabularies really do differ, so following the scope matters');

// ── parse + resolve + apply ─────────────────────────────────────────────────
await page.evaluate(() => {
  const ta = document.querySelector('.gt-tp-src textarea, .gt-tp textarea');
  if (ta) { ta.value = 'Producer: もちこまめ'; ta.dispatchEvent(new Event('input', { bubbles: true })); }
  const pat = document.querySelector('.gt-tp-pat');
  if (pat) { pat.value = 'R: E'; pat.dispatchEvent(new Event('input', { bubbles: true })); }
});
await page.waitForTimeout(600);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.gt-tp button')].find(x => /Match/i.test(x.textContent || ''));
  if (b) b.click();
});
await page.waitForFunction(() => {
  const b = [...document.querySelectorAll('.gt-tp button')].find(x => /Match/i.test(x.textContent || ''));
  return b && !/Matching|Resolving/i.test(b.textContent);
}, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1200);

const before = await page.evaluate(() => window.__groupTherapy.txpTrackRows().map(r => ({ num: r.num, rels: (r.rec.relationships || []).length })));
const applied = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.gt-tp button')].find(x => /^Apply$/i.test((x.textContent || '').trim()));
  if (!b) return 'no Apply button';
  b.click();
  return 'clicked';
});
console.log('apply: ' + applied);
await page.waitForTimeout(1500);

// Read the editor's own state: which recordings gained a staged relationship?
const after = await page.evaluate(() => {
  const gt = window.__groupTherapy;
  const rows = gt.txpTrackRows();
  return rows.map(r => ({
    num: r.num,
    rels: (r.rec.relationships || []).length,
    staged: [...document.querySelectorAll('tr.track')]
      .filter(tr => tr.contains(r.tr) || tr === r.tr)
      .reduce((n, tr) => n + tr.querySelectorAll('.rel-add, .relationship-item.rel-add').length, 0),
  }));
});
console.log('before: ' + JSON.stringify(before));
console.log('after : ' + JSON.stringify(after));
const gained = after.filter((r, i) => r.rels > (before[i] || {}).rels).map(r => r.num);
const stagedOn = after.filter(r => r.staged > 0).map(r => r.num);
console.log('gained a relationship: ' + JSON.stringify(gained) + '   showing rel-add: ' + JSON.stringify(stagedOn));
const hit = gained.length ? gained : stagedOn;
ck(hit.length === 2, `exactly the two selected recordings were credited (${JSON.stringify(hit)})`);
ck(hit.includes('1') && hit.includes('3'), 'and they are tracks 1 and 3 — not track 2, and not the release');

// ── #539 follow-up: the edit note has to say WHERE the credits went ─────────
// majkinetor: "Make sure scope info is added to the edit note." A reviewer
// reading a batched edit cannot tell which tracks were touched from the diff
// alone once several runs are folded into one submission.
const note = await page.evaluate(() => {
  const ta = document.querySelector('textarea.edit-note, #edit-note-text');
  return ta ? ta.value : '';
});
const NL = String.fromCharCode(10);
console.log('edit note:' + NL + note.split(NL).map(l => '   ' + l).join(NL));
ck(/Parsed \d+ credits? from text to 2 recordings/.test(note), 'the edit note records how many recordings were credited');
ck(/tracks 1, 3/.test(note), 'and names the tracks — ' + JSON.stringify((note.match(/\(tracks?[^)]*\)/) || [])[0] || ''));

// ── the toolbar keeps ⚡ Match with the controls, however long the list ──────
// "With enough tracks, Match button goes to next row." Same row is asserted by
// vertical position, with a tolerance: the button and the scope pill are
// different heights, so their tops differ by a pixel or two on one line.
// Apply closes the window (#522), so reopen it — the scope is remembered.
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => /text parser/i.test(x.textContent || ''));
  if (b) b.click();
});
await page.waitForSelector('.gt-tp-tracks', { timeout: 15000 });
await page.selectOption('.gt-tp-scope-sel', 'recording');
await page.fill('.gt-tp-tracks', 'all');
await page.waitForTimeout(300);
const geo = await page.evaluate(() => {
  const r = sel => { const b = document.querySelector(sel).getBoundingClientRect(); return Math.round(b.top); };
  return { pat: r('.gt-tp-pat'), scope: r('.gt-tp-scope'), match: r('.gt-tp-resolve'), info: (document.querySelector('.gt-tp-tracks-info').textContent || '').trim() };
});
console.log('toolbar rows: ' + JSON.stringify(geo));
ck(Math.abs(geo.match - geo.scope) < 12, 'Match sits on the same row as the scope control');
ck(Math.abs(geo.match - geo.pat) < 12, 'and as the pattern box — it does not wrap away');
ck(/\+\d+$/.test(geo.info) || geo.info.split(',').length <= 7, 'a long selection is summarised rather than listed in full — ' + JSON.stringify(geo.info));

ck(posts === 0, `nothing was submitted (${posts} POSTs to /edit)`);
ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
