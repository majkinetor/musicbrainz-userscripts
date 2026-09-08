// #580 diagnosis probe: "Tracklist automatch runs while artist is being searched".
//
// majkinetor: typing into an auto-matched artist field "stops after a single
// letter and match auto completes it", so the ＋ (create this artist) never
// appears and you cannot search freely.
//
// This probe does not assert a fix — it establishes WHAT happens, so the fix
// targets the real mechanism rather than a guess. It types one character into a
// committed slot and then watches, for two seconds, whether:
//   - the <input> node is swapped out from under the caret (a re-render),
//   - focus is lost,
//   - the typed value is replaced by the matched artist name,
//   - the slot goes back to committed on its own.
//
// Run on PRODUCTION /release/add, because the sandbox has none of the artists
// that make a slot auto-match in the first place. Nothing can be written: every
// POST, to any host, is aborted and counted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const SRC = process.env.APOLLO_SRC || 'C:/Work/mb-userscripts/userscripts/apollo_editor/apollo_editor.user.js';
const code = await readFile(SRC, 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1700, height: 1100 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'apollo', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.text(); if (/apollo|Apollo/.test(t)) logs.push(t); });
const errs = []; page.on('pageerror', e => errs.push(e.message));

let posts = 0;
const blockWrites = async () => {
  // Hard stop on every write. Not a glob — every POST, every host (see the #493
  // lesson: a guessed endpoint pattern let a real edit through on production).
  // Installed only AFTER seeding, because seeding the editor is itself a POST to
  // /release/add — one that renders a prefilled form and stores nothing; the
  // actual write would be /ws/js/edit/create, which never runs here.
  await page.route(() => true, r => {
    if (r.request().method() === 'POST') { posts++; return r.abort(); }
    return r.fallback();
  });
};

await page.goto('https://musicbrainz.org/release/add', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }

// Seed by driving the editor's own form, so the tracks arrive the way a real
// seeded release does.
await page.evaluate(() => {
  const f = document.createElement('form');
  f.method = 'POST'; f.action = '/release/add';
  const add = (k, v) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; f.appendChild(i); };
  add('name', 'Apollo 580 probe');
  add('artist_credit.names.0.name', 'Miles Davis');
  add('mediums.0.format', 'CD');
  ['So What', 'Blue in Green', 'Flamenco Sketches'].forEach((t, i) => {
    add(`mediums.0.track.${i}.name`, t);
    add(`mediums.0.track.${i}.artist_credit.names.0.name`, 'Miles Davis');
  });
  document.body.appendChild(f); f.submit();
});
await page.waitForLoadState('domcontentloaded');
await page.waitForSelector('#release-editor', { timeout: 60000 }).catch(() => {});
await blockWrites();
await page.addScriptTag({ content: code });
await page.waitForFunction(() => window.__apolloEditor, null, { timeout: 60000 });
// Apollo builds and matches the mirrored tracklist when that tab is entered —
// on the Release Information tab the fields exist but are not visible.
await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});
await page.waitForSelector('.tc-search input.nm', { state: 'visible', timeout: 60000 });
await page.waitForFunction(() => window.__apolloEditor.model, null, { timeout: 60000 });

// Let the load-time match settle: the slot must actually be committed before the
// question ("what happens when you edit a matched slot") means anything.
await page.waitForFunction(() => {
  const m = window.__apolloEditor.model;
  return m && m.tracks.length && m.tracks[0].slots[0].committed;
}, null, { timeout: 120000 }).catch(() => {});

const before = await page.evaluate(() => {
  const s = window.__apolloEditor.model.tracks[0].slots[0];
  const inp = document.querySelector('.tc-search input.nm');
  if (inp) inp.dataset.probeMark = 'original';
  return { committed: !!s.committed, status: s.status, name: s.name, value: inp && inp.value, mkVisible: !!document.querySelector('.tc-search .mk') };
});
console.log('[before]', JSON.stringify(before));

// Type ONE character over the whole value, exactly as reported.
const inp = page.locator('.tc-search input.nm').first();
await inp.click();
await page.keyboard.press('Control+A');
await page.keyboard.type('M');

// Sample repeatedly: a 400ms scheduleSync + a network match is the suspected
// path, so a single immediate read would miss it.
const samples = []; let prev = 0;
for (const wait of [100, 400, 700, 1200, 2000, 3000]) {
  await page.waitForTimeout(wait - prev); prev = wait;
  samples.push(await page.evaluate(t => {
    const s = window.__apolloEditor.model.tracks[0].slots[0];
    const live = document.querySelector('.tc-search input.nm');
    const a = document.activeElement;
    return {
      t,
      value: live && live.value,
      sameNode: !!live && live.dataset.probeMark === 'original',
      focused: !!live && a === live,
      focusTag: a ? (a.tagName + '.' + a.className) : null,
      committed: !!s.committed,
      status: s.status,
      pending: !!s._pending,
      mk: !!document.querySelector('.tc-search .mk'),
    };
  }, wait));
}
samples.forEach(s => console.log('[t+' + s.t + 'ms]', JSON.stringify(s)));
console.log('[posts blocked]', posts, '| page errors:', errs.length, errs.slice(0, 3));
await ctx.close();
