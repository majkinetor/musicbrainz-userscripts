// #571 (majkinetor): "We should be able to change the name of the entity. As
// usual, produce proof edits on test.musicbrainz."
//
// A REAL run: Falcon commits actual edits on test.musicbrainz and each entity is
// then read back to prove the new name landed. Nothing is intercepted — an
// aborted POST would only prove a request left the browser.
//
// Unlike the disambiguation proof, this one RESTORES the original names when it
// is done. These sandbox entities are shared fixtures for the rest of the suite
// (verify-512-release-name-persist and the #509 name tests all read them), so a
// proof that permanently renamed them would quietly break its neighbours.
//
// Sandbox only: it refuses to run against any host but test.musicbrainz.org.
// Run: node test/live-571-rename-proof.mjs
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

const HOST = 'https://test.musicbrainz.org';
if (!/test\.musicbrainz\.org$/.test(new URL(HOST).hostname)) { console.log('REFUSING: sandbox only'); process.exit(2); }

const TARGETS = [
  { type: 'artist',        mbid: '82ca9599-5a15-4ff5-90d5-59ac8afaf5c7', seg: 'artist' },
  { type: 'release_group', mbid: 'ed64def7-4a2f-4ff7-9ae3-fbdfac9f8e0e', seg: 'release-group' },
  { type: 'recording',     mbid: '2bea9225-3cee-4a23-b8f3-cd705bed3d06', seg: 'recording' },
  { type: 'label',         mbid: '0bef945e-5ab2-4276-8296-921b48d45ace', seg: 'label' },
  // the one that does NOT go through seeding — its KO editor ignores the param,
  // so Falcon types the field (setReleaseName). Included precisely because it
  // takes the other route.
  { type: 'release',       mbid: '3a37a35f-1e06-457f-9b2a-46155c5c03ce', seg: 'release' },
];
const STAMP = 'falcon rename ' + new Date().toISOString().slice(0, 19).replace('T', ' ');

const UA = { 'User-Agent': 'Falcon-verify-571/1.0 ( https://github.com/majkinetor/musicbrainz-userscripts )', Accept: 'application/json' };
// artists/labels use `name`; releases, RGs and recordings use `title`.
async function readName(seg, mbid) {
  for (let a = 1; a <= 6; a++) {
    const r = await fetch(`${HOST}/ws/2/${seg}/${mbid}?fmt=json`, { headers: UA });
    if (r.ok) { const j = await r.json(); return j.title != null ? j.title : j.name; }
    await new Promise(x => setTimeout(x, 4000));
  }
  return '<unreadable>';
}

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

console.log('names BEFORE:');
const before = {};
for (const t of TARGETS) { before[t.type] = await readName(t.seg, t.mbid); console.log('  ' + t.type.padEnd(14) + JSON.stringify(before[t.type])); }
if (Object.values(before).some(v => v === '<unreadable>')) { console.log('could not read a starting name — aborting rather than renaming blind'); process.exit(4); }

const newNameFor = t => `${before[t.type]} (${STAMP})`;

async function falconRun(renameOf, note) {
  const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 950 } });
  await ctx.addInitScript(() => {
    const s = new Map();
    window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
    window.GM_setValue = (k, v) => s.set(k, v);
    window.GM_deleteValue = k => s.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  for (let a = 1; ; a++) {
    try { await page.goto(`${HOST}/release/${TARGETS[4].mbid}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 3) throw e; await page.waitForTimeout(5000); }
  }
  if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForTimeout(1200);
  await page.addScriptTag({ content: code });
  await page.waitForTimeout(600);
  // The workers live in the panel, so it has to be open or the queue just sits.
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 15000 });
  await page.waitForTimeout(500);

  await page.evaluate(({ targets, renames, note }) => {
    window.__falconTest.setQueue(targets.map((t, i) => ({
      id: 'p' + i, entityType: t.type, mbid: t.mbid, urls: [], note,
      disambiguation: '', rename: renames[t.type], isrcs: [], cover: [], coverExistingCount: null,
      name: null, urlResults: null, status: 'queued', error: '',
    })));
  }, { targets: TARGETS, renames: renameOf, note });
  await page.evaluate(() => window.__falconTest.start());
  await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 300000 }).catch(() => {});
  const outcome = await page.evaluate(() => window.__falconTest.getQueue().map(i => ({ t: i.entityType, s: i.status, e: i.error })));
  // getLog() returns formatted strings; mapping l.sev/l.msg yields "undefined:
  // undefined" for every line, which is how this diagnostic came out empty.
  const flog = await page.evaluate(() => window.__falconTest.getLog().map(String));
  await ctx.close();
  return { outcome, flog, errs };
}

// ── rename ──────────────────────────────────────────────────────────────────
const renames = {}; for (const t of TARGETS) renames[t.type] = newNameFor(t);
console.log('\nrenaming to:');
for (const t of TARGETS) console.log('  ' + t.type.padEnd(14) + JSON.stringify(renames[t.type]));
const first = await falconRun(renames, 'Falcon #571 rename proof');
console.log('run outcome: ' + JSON.stringify(first.outcome));
console.log('--- falcon log (name lines) ---');
for (const l of first.flog.filter(x => /name|submit|commit|no change|seed|edit page/i.test(x)).slice(-20)) console.log('  ' + l);

// ── verify ──────────────────────────────────────────────────────────────────
// MusicBrainz auto-applies some edits and queues others for voting, so the API
// only shows the new value in the first case. Both prove the same thing —
// Falcon built and submitted a correct edit — so accept either and say which.
const ectx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1300, height: 900 } });
const epage = ectx.pages()[0] || await ectx.newPage();
// ⚠ /<entity>/<mbid>/open_edits lists edits for RELATED entities too, so match
// the edit's own type class — not just the page text. A release's page carries
// its recordings' edits, and an earlier proof passed on the wrong one.
const EDIT_CLASS = { artist: 'edit-artist', label: 'edit-label', recording: 'edit-recording', release: 'edit-release', release_group: 'edit-release-group' };
const openEditHas = async (seg, mbid, stamp, cls) => {
  for (let a = 1; ; a++) {
    try { await epage.goto(`${HOST}/${seg}/${mbid}/open_edits`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 3) return false; await epage.waitForTimeout(5000); }
  }
  await epage.waitForTimeout(1200);
  return await epage.evaluate(({ stamp, cls }) => {
    const heads = [...document.querySelectorAll('.edit-header')].filter(h => h.classList.contains(cls));
    return heads.some(h => {
      let text = h.innerText || '';
      for (let n = h.nextElementSibling; n && !n.classList.contains('edit-header'); n = n.nextElementSibling) text += String.fromCharCode(10) + (n.innerText || '');
      return text.includes(stamp);
    });
  }, { stamp, cls });
};

console.log('\nnames AFTER:');
const applied = {};
for (const t of TARGETS) {
  const after = await readName(t.seg, t.mbid);
  applied[t.type] = after === renames[t.type];
  const queued = applied[t.type] ? false : await openEditHas(t.seg, t.mbid, STAMP, EDIT_CLASS[t.type]);
  console.log('  ' + t.type.padEnd(14) + JSON.stringify(after) + (applied[t.type] ? '   [applied immediately]' : queued ? '   [submitted, pending a vote]' : '   [NOT FOUND]'));
  ck(applied[t.type] || queued, `${t.type}: Falcon's rename reached MusicBrainz as a real "${EDIT_CLASS[t.type].replace('edit-', 'edit ')}" edit` + (queued ? ' (queued for voting)' : ''));
}
await ectx.close();

// ── restore ─────────────────────────────────────────────────────────────────
// Only the ones that actually changed need putting back; for the rest the
// rename is still pending a vote and the name never moved.
const toRestore = TARGETS.filter(t => applied[t.type]);
if (toRestore.length) {
  console.log(`\nrestoring ${toRestore.length} name(s) that were applied immediately…`);
  const back = {}; for (const t of TARGETS) back[t.type] = applied[t.type] ? before[t.type] : '';
  const second = await falconRun(back, 'Falcon #571 rename proof — restoring the original name');
  console.log('restore outcome: ' + JSON.stringify(second.outcome));
  console.log('names RESTORED:');
  for (const t of toRestore) {
    const now = await readName(t.seg, t.mbid);
    console.log('  ' + t.type.padEnd(14) + JSON.stringify(now));
    ck(now === before[t.type], `${t.type}: original name put back`);
  }
} else {
  console.log('\nnothing to restore — every rename is queued for voting, so no name actually moved.');
}

ck(first.errs.length === 0, 'no page errors (' + first.errs.join(' | ') + ')');
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
