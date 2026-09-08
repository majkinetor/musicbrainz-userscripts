// #580, second probe: probe-580 proved the tracklist is rebuilt ~400ms after the
// first keystroke on a committed slot (input node replaced, focus lost, typed
// text reverted, slot re-queued for matching). 400ms is exactly scheduleSync's
// timer, but "exactly the same number" is not proof — so catch the timer being
// armed and read its stack, and check whether the KO change-watcher fired
// outside our own _selfEdit window.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile(process.env.APOLLO_SRC || 'C:/Work/mb-userscripts/userscripts/apollo_editor/apollo_editor.user.js', 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1700, height: 1100 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'apollo', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();

await page.goto('https://musicbrainz.org/release/add', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.evaluate(() => {
  const f = document.createElement('form');
  f.method = 'POST'; f.action = '/release/add';
  const add = (k, v) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; f.appendChild(i); };
  add('name', 'Apollo 580 probe'); add('artist_credit.names.0.name', 'Miles Davis'); add('mediums.0.format', 'CD');
  ['So What', 'Blue in Green'].forEach((t, i) => { add(`mediums.0.track.${i}.name`, t); add(`mediums.0.track.${i}.artist_credit.names.0.name`, 'Miles Davis'); });
  document.body.appendChild(f); f.submit();
});
await page.waitForLoadState('domcontentloaded');
await page.waitForSelector('#release-editor', { timeout: 60000 }).catch(() => {});
let posts = 0;
await page.route(() => true, r => { if (r.request().method() === 'POST') { posts++; return r.abort(); } return r.fallback(); });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => window.__apolloEditor, null, { timeout: 60000 });
await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});
await page.waitForSelector('.tc-search input.nm', { state: 'visible', timeout: 60000 });
await page.waitForFunction(() => { const m = window.__apolloEditor.model; return m && m.tracks.length && m.tracks[0].slots[0].committed; }, null, { timeout: 120000 }).catch(() => {});

// Arm the instrumentation only now, so the load-time timers are not in the way.
await page.evaluate(() => {
  window.__t400 = [];
  const orig = window.setTimeout;
  window.setTimeout = function (fn, ms) {
    if (ms === 400) { try { throw new Error('armed'); } catch (e) { window.__t400.push(String(e.stack).split('\n').slice(1, 5).join(' | ')); } }
    return orig.apply(this, arguments);
  };
  // Watch the same observable Apollo watches, so we can see WHEN the notification
  // lands relative to the synchronous write that caused it.
  window.__koFires = [];
  const rel = window.MB && window.MB.releaseEditor && window.MB.releaseEditor.rootField
    ? window.MB.releaseEditor.rootField.release() : null;
  const tr = rel && rel.mediums()[0].tracks()[0];
  if (tr && tr.artistCredit && tr.artistCredit.subscribe) {
    tr.artistCredit.subscribe(() => window.__koFires.push(performance.now()));
    window.__koTrack = true;
  }
});

const inp = page.locator('.tc-search input.nm').first();
await inp.click();
await page.keyboard.press('Control+A');
await page.evaluate(() => { window.__typedAt = performance.now(); });
await page.keyboard.type('M');
await page.waitForTimeout(600);

const out = await page.evaluate(() => ({
  koTrackWatched: !!window.__koTrack,
  typedAt: window.__typedAt,
  koFires: window.__koFires,
  timers400: window.__t400,
}));
console.log('watched track.artistCredit:', out.koTrackWatched);
console.log('KO artistCredit notifications after typing (ms since keypress):',
  out.koFires.map(t => Math.round(t - out.typedAt)));
console.log('400ms timers armed after typing:', out.timers400.length);
out.timers400.forEach((s, i) => console.log('  [' + i + ']', s));
console.log('[posts blocked]', posts);
await ctx.close();
