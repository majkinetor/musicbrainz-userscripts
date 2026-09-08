// #575 round 4. majkinetor attached the actual Discogs import he is running —
// "Here is the import from Discogs that you can try on your own" — so this drives
// HIS release rather than a fixture of my own invention, with every auto-matcher
// on as he has them.
//
// Three claims to check:
//   1. "No difference" — the shared-throttle build is no faster;
//   2. "both Matches can be 100% unresponsive to clicks, especially Recordings";
//   3. "it often shows 'scanning duplicates', although there either aren't any
//      or all are 0% similar".
//
// Responsiveness is measured, not eyeballed: a click is dispatched at intervals
// during the run and what is recorded is whether the UI answered it at all —
// whether the button's own label/state changed within a second of the press.
// A main thread blocked by a synchronous loop cannot answer; one that is merely
// awaiting network can.
//
// Read-only: every POST is aborted.
//
//   node test/probe-575-majkinetor-seed.mjs [--headed]
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const SRC = process.env.APOLLO_SRC || 'C:/Work/mb-userscripts/userscripts/apollo_editor/apollo_editor.user.js';
// The seed fields of the Discogs import he attached. Extracted rather than
// committing his saved page: MusicBrainz embeds its Mapbox token in every
// rendered page, and GitHub push protection refuses it, rightly.
const SEED = process.env.SEED_JSON || 'C:/Work/mb-userscripts/userscripts/apollo_editor/test/seed-575-discogs-import.json';
const code = await readFile(SRC, 'utf8');

// Pull the seed fields straight out of his saved confirmation page.
const fields = JSON.parse(await readFile(SEED, 'utf8')).fields;
console.log(`seed: ${fields.length} fields, ${fields.filter(([k]) => /track\.\d+\.name$/.test(k)).length} tracks`);

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1700, height: 1100 } });
await ctx.addInitScript(() => {
  // Everything on, as he says he runs it.
  const store = new Map([['apolloEditor.settings.v1', JSON.stringify({
    apolloEnabled: true, autoMatch: true, autoMatchRec: true, autoMatchLabel: true, autoMatchArtist: true,
    replaceReleaseInfo: true, replaceTracklist: true, replaceRecordings: true, discogsUrlMatch: true,
  })]]);
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'apollo', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));

await page.goto('https://musicbrainz.org/release/add', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.evaluate(f => {
  const form = document.createElement('form');
  form.method = 'POST'; form.action = '/release/add';
  f.forEach(([k, v]) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; form.appendChild(i); });
  document.body.appendChild(form); form.submit();
}, fields);
await page.waitForLoadState('domcontentloaded');
await page.waitForSelector('#release-editor', { timeout: 60000 }).catch(() => {});

let reqs = 0, throttled = 0;
page.on('response', r => { if (!/musicbrainz\.org\/ws\/2\//.test(r.url())) return; reqs++; if (r.status() === 503 || r.status() === 429) throttled++; });
await page.route(() => true, r => (r.request().method() === 'POST' ? r.abort() : r.fallback()));

await page.addScriptTag({ content: code });
await page.waitForFunction(() => window.__apolloEditor, null, { timeout: 60000 });
const t0 = Date.now();
await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});
await page.waitForSelector('.tc-search input.nm', { state: 'visible', timeout: 60000 });

// Poll the two Match buttons: their label, whether the pointer would even reach
// them, and — the real question — whether the main thread is answering at all.
// rAF round-trip time is the honest measure of that: a blocked thread cannot
// schedule a frame.
const sample = () => page.evaluate(async () => {
  const t = performance.now();
  const rafMs = await new Promise(r => { const s = performance.now(); requestAnimationFrame(() => r(performance.now() - s)); });
  const btn = document.querySelector('.tc-toolbar .tc-btn.tc-match, .tc-btn.tc-stopping, #tc-mirror-wrap .tc-btn');
  const rec = document.querySelector('#tc-recwrap .tc-rec-am');
  const txt = e => e ? (e.textContent || '').trim().replace(/\s+/g, ' ') : null;
  const status = document.querySelector('.tc-status, .tc-msg, #tc-recwrap .tc-rec-status');
  const m = window.__apolloEditor.model;
  return {
    at: Math.round(t), rafMs: Math.round(rafMs),
    tracklistBtn: txt(btn), recBtn: txt(rec),
    recDisabled: rec ? !!rec.disabled : null,
    status: txt(status),
    queued: m ? m.tracks.filter(x => x.slots.some(s => s._pending)).length : null,
  };
});

const marks = [];
const deadline = Date.now() + 300000;
let done = false;
while (Date.now() < deadline && !done) {
  const s = await sample();
  marks.push(s);
  done = await page.evaluate(() => {
    const m = window.__apolloEditor.model;
    return !!m && m.tracks.length > 0 && !m.tracks.some(t => t.slots.some(x => x._pending)) && !document.querySelector('.tc-btn.tc-stopping');
  });
  if (!done) await page.waitForTimeout(3000);
}
const elapsed = Date.now() - t0;

console.log(`\nartist pass ${done ? 'finished' : 'DID NOT FINISH'} in ${(elapsed / 1000).toFixed(1)}s · ${reqs} /ws/2 requests (${throttled} throttled)`);
const worst = marks.reduce((m, s) => Math.max(m, s.rafMs), 0);
console.log(`main thread: worst rAF round trip ${worst}ms over ${marks.length} samples`);
console.log('samples (t, rAF, tracklist btn, recordings btn, status, queued):');
marks.forEach(s => console.log(`  ${String(s.at).padStart(7)}ms  raf=${String(s.rafMs).padStart(5)}ms  ${JSON.stringify(s.tracklistBtn)}  ${JSON.stringify(s.recBtn)}  ${JSON.stringify(s.status)}  q=${s.queued}`));
console.log('page errors:', errs.slice(0, 3));
await ctx.close();
