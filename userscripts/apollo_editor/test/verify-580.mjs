// #580 (majkinetor): "Tracklist automatch runs while artist is being searched".
//
//   "If artist is auto matched, editing its search query stops after a single
//    letter and match auto completes it. So you can't for example create new
//    artist with the same name as [+] never appears or do a basic search. Auto
//    matching should not work on item being edited in this way. (BTW, we should
//    also have [+] always appear on item having a focus). Auto match should run
//    after focus is lost (so stuff like split artist still auto matches)."
//
// What probe-580b established on the pre-fix build: un-linking a matched artist
// writes the credit back to Knockout, MB echoes a SECOND notification after
// Apollo's _selfEdit guard has already been dropped, the change-watcher reads it
// as external, and 400ms later the whole tracklist is rebuilt — new <input>, no
// focus, typed text gone, slot re-queued for auto-match.
//
// So this asserts the three halves of the request:
//   1. typing into a matched slot survives — same node, same focus, same text;
//   2. ＋ is present while that slot has focus (and hidden once it does not);
//   3. leaving the field releases the deferred work, so auto-match still runs.
//
// Runs on PRODUCTION /release/add: the sandbox has none of the artists that make
// a slot auto-match in the first place, and auto-matching is the precondition of
// the whole bug. Nothing can be written — every POST, to every host, is aborted
// and the count is asserted to be zero.
//
// Against the pre-fix build (APOLLO_SRC=<old file>) checks 1, 2 and 4 fail.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const SRC = process.env.APOLLO_SRC || 'C:/Work/mb-userscripts/userscripts/apollo_editor/apollo_editor.user.js';
const code = await readFile(SRC, 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1700, height: 1100 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'apollo', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));

await page.goto('https://musicbrainz.org/release/add', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN — log the .pw-profile into MusicBrainz'); await ctx.close(); process.exit(3); }

// Seeding is itself a POST to /release/add — it renders a prefilled form and
// stores nothing (the write would be /ws/js/edit/create, which never runs here),
// so the write block goes up immediately afterwards.
await page.evaluate(() => {
  const f = document.createElement('form');
  f.method = 'POST'; f.action = '/release/add';
  const add = (k, v) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; f.appendChild(i); };
  add('name', 'Apollo 580 fixture'); add('artist_credit.names.0.name', 'Miles Davis'); add('mediums.0.format', 'CD');
  ['So What', 'Blue in Green'].forEach((t, i) => { add(`mediums.0.track.${i}.name`, t); add(`mediums.0.track.${i}.artist_credit.names.0.name`, 'Miles Davis'); });
  document.body.appendChild(f); f.submit();
});
await page.waitForLoadState('domcontentloaded');
await page.waitForSelector('#release-editor', { timeout: 60000 }).catch(() => {});

// Every POST, every host, is aborted — not a glob (#493). What is ASSERTED is
// narrower than what is blocked: MusicBrainz posts its own telemetry, so "zero
// POSTs" would fail for reasons that have nothing to do with editing.
const posted = [];
await page.route(() => true, r => {
  const q = r.request();
  if (q.method() === 'POST') { posted.push(q.url()); return r.abort(); }
  return r.fallback();
});
await page.addScriptTag({ content: code });
await page.waitForFunction(() => window.__apolloEditor, null, { timeout: 60000 });
await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});
await page.waitForSelector('.tc-search input.nm', { state: 'visible', timeout: 60000 });

// The slot must actually be matched — an unmatched one never had the bug.
await page.waitForFunction(() => {
  const m = window.__apolloEditor.model;
  return m && m.tracks.length && m.tracks[0].slots[0].committed;
}, null, { timeout: 120000 });
const start = await page.evaluate(() => {
  const inp = document.querySelector('.tc-search input.nm');
  inp.dataset.fixtureMark = 'original';
  const mk = inp.closest('.tc-search').querySelector('.mk');
  return { value: inp.value, mkShown: !!mk && mk.offsetParent !== null };
});
ck(!start.mkShown, 'a settled matched slot shows no ＋ (it appears on focus, not always)');

const inp = page.locator('.tc-search input.nm').first();
await inp.click();
await page.waitForTimeout(150);
const focused = await page.evaluate(() => {
  const mk = document.querySelector('.tc-search .mk');
  return { mkShown: !!mk && mk.offsetParent !== null };
});
ck(focused.mkShown, '＋ appears on a matched slot once it has focus (so you can create a same-named artist)');

// One character over the whole value — exactly the reported gesture.
await page.keyboard.press('Control+A');
await page.keyboard.type('M');
await page.waitForTimeout(2000);   // well past the 400ms resync that used to fire

const after = await page.evaluate(() => {
  const live = document.querySelector('.tc-search input.nm');
  const s = window.__apolloEditor.model.tracks[0].slots[0];
  return {
    value: live && live.value,
    sameNode: !!live && live.dataset.fixtureMark === 'original',
    focused: document.activeElement === live,
    committed: !!s.committed,
    pending: !!s._pending,
    mkShown: (() => { const mk = document.querySelector('.tc-search .mk'); return !!mk && mk.offsetParent !== null; })(),
  };
});
ck(after.value === 'M', `the typed text survives (got ${JSON.stringify(after.value)}, wanted "M")`);
ck(after.sameNode, 'the field is not swapped out from under the caret');
ck(after.focused, 'focus stays in the field');
// Un-linked AND not queued: on the pre-fix build the slot also reads un-linked
// at this point, but only because the rebuild had just re-queued it for matching
// — which is the bug. Asserting both distinguishes "left alone" from "about to be
// completed for you".
ck(!after.committed && !after.pending, `the slot is left alone while being edited — not re-queued for auto-match (committed=${after.committed}, queued=${after.pending})`);
ck(after.mkShown, '＋ is still offered for the typed name');

// Third half of the request: deferring must not mean dropping. Leaving the field
// releases the resync — "auto match should run after focus is lost". What is
// asserted is that the deferred rebuild RUNS, not that it finds a match: the
// field now reads "M", and whether a one-letter query resolves to anything is
// MusicBrainz's business, not this fix's.
await page.evaluate(() => document.activeElement.blur());
const ran = await page.waitForFunction(() => {
  const live = document.querySelector('.tc-search input.nm');
  return !live || live.dataset.fixtureMark !== 'original';   // rebuilt → a fresh node
}, null, { timeout: 30000 }).then(() => true).catch(() => false);
ck(ran, 'leaving the field releases the deferred resync (deferred, not dropped)');

// /ws/js/edit/preview is MusicBrainz's own edit-PREVIEW render — a POST that
// stores nothing, fired by the editor itself. /ws/js/edit/create is the write.
const writes = posted.filter(u => /\/ws\/js\/edit\/create|\/release\/(add|[0-9a-f-]{36}\/edit)/.test(u));
ck(writes.length === 0, `no edit POST was attempted (blocked ${posted.length} POST(s) in total: ${[...new Set(posted)].slice(0, 3).join(', ') || 'none'})`);
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
