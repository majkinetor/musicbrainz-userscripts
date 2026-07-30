// #472 (majkinetor): bookmarklets like derat/mb-bookmarklets' "Rename tracks"
// and "Edit join phrases" call tr.name(newName) / tr.artistCredit({...})
// directly on MB's own KO track objects — never touching the tracks ARRAY
// (no add/remove/reorder) — so Apollo's old subscribeTracks() (which only
// watched med.tracks and rel.mediums) never saw it; only a full off/on toggle
// forced a resync.
//
// Live-verified against test.musicbrainz.org (separate sandbox DB/login from
// production — majkinetor/mb, sanctioned for exactly this). Seeds a small,
// self-contained release (freeform artist names, no external mbid/release-
// group references, since those wouldn't resolve against the sandbox's own
// DB), then edits a track exactly like the bookmarklets do — bypassing
// Apollo's own API entirely — and confirms Apollo's mirrored model picks up
// both the renamed title and the new join phrase without any toggle.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const ORIGIN = 'https://test.musicbrainz.org';
const log = (...a) => console.log('[verify-472]', ...a);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1600, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));

await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN on', ORIGIN); await ctx.close(); process.exit(3); }

// self-contained seed — no release_group / artist mbid references, so nothing
// depends on data existing in the sandbox's own (separate) database
const seed = {
  name: 'Apollo 472 test ' + Date.now(),
  'artist_credit.names.0.name': 'Apollo Test Artist',
  type: ['album'],
  'mediums.0.format': 'CD',
  'mediums.0.track.0.name': 'Original Track One',
  'mediums.0.track.0.artist_credit.names.0.name': 'Apollo Test Artist',
  'mediums.0.track.1.name': 'Original Track Two',
  'mediums.0.track.1.artist_credit.names.0.name': 'Apollo Test Artist',
  'mediums.0.track.1.artist_credit.names.0.join_phrase': ' feat. ',
  'mediums.0.track.1.artist_credit.names.1.name': 'Second Artist',
  'edit_note': '#472 verification — safe to remove',
};
await page.evaluate(({ origin, params }) => {
  const f = document.createElement('form'); f.method = 'POST'; f.action = origin + '/release/add'; f.style.display = 'none';
  const add = (n, v) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = n; i.value = v; f.appendChild(i); };
  for (const [k, v] of Object.entries(params)) Array.isArray(v) ? v.forEach(x => add(k, x)) : add(k, v);
  document.body.appendChild(f); f.submit();
}, { origin: ORIGIN, params: seed });
await page.waitForLoadState('domcontentloaded');
if (await page.locator('h1', { hasText: /Confirm form submission/i }).count().catch(() => 0)) {
  await page.locator('button[type=submit]', { hasText: /Continue/i }).first().click();
  await page.waitForLoadState('domcontentloaded');
}
// mediums() only populates once the Tracklist tab itself has been shown at
// least once (lazy-initialized) — click it BEFORE waiting on mediums.length.
await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length > 0; } catch { return false; } }, null, { timeout: 60000 });
log('editor ready, url:', page.url());

await page.addScriptTag({ content: scriptCode });
await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 15000 });
await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});
await page.waitForSelector('.tc-medsec .tc-mirror tbody tr', { timeout: 30000 });
// freeform artist names here (no real MB artist to match) never resolve to a
// confident match, so don't wait on _pending clearing — just on the model
// itself having both tracks, which is all this test needs.
await page.waitForFunction(() => { const m = window.__apolloEditor.model; return m && m.tracks.length >= 2; }, null, { timeout: 30000 });
await page.waitForTimeout(1500);   // let any in-flight name-search settle so it can't race our own edits below

const beforeMirrorTitle = await page.evaluate(() => document.querySelectorAll('.tc-medsec .tc-mirror tbody tr .t-title')[0]?.value);
log('mirror title before external edit:', JSON.stringify(beforeMirrorTitle));

// the actual bookmarklet technique: call the KO observable setters DIRECTLY —
// never through Apollo's own API (tc.commitTrack etc.), and never touching
// med.tracks (no push/splice/reorder).
const result = await page.evaluate(async () => {
  const u = v => (typeof v === 'function' ? v() : v);
  const med0 = u(window.MB.releaseEditor.rootField.release).mediums()[0];
  const tracks = med0.tracks();
  const t0 = tracks[0], t1 = tracks[1];

  const before0 = u(t0.name);
  t0.name('Renamed By Bookmarklet');   // "Rename tracks" bookmarklet technique
  const after0 = u(t0.name);

  const ac1 = u(t1.artistCredit);
  const beforeJoin = ac1.names[0].joinPhrase;
  t1.artistCredit({ ...ac1, names: ac1.names.map((n, i) => i === 0 ? { ...n, joinPhrase: ' & ' } : n) });   // "Edit join phrases" bookmarklet technique
  const afterJoin = u(t1.artistCredit).names[0].joinPhrase;

  await new Promise(r => setTimeout(r, 700));   // scheduleSync's 400ms debounce + render
  return { before0, after0, beforeJoin, afterJoin };
});
log('KO model change:', JSON.stringify(result));
ck(result.before0 === 'Original Track One' && result.after0 === 'Renamed By Bookmarklet', 'the KO track.name setter itself changed (sanity check on the seed)');
ck(result.beforeJoin === ' feat. ' && result.afterJoin === ' & ', 'the KO artistCredit setter itself changed (sanity check on the seed)');

await page.waitForTimeout(200);
const mirror = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.tc-medsec .tc-mirror tbody tr[data-tk]')];
  const titleOf = i => rows[i]?.querySelector('.t-title')?.value;
  const joinOf = i => { const c = rows[i]?.querySelector('.tc-cred'); return c ? null : null; };   // join phrase isn't a simple input; check via model instead
  return {
    title0: titleOf(0),
    title1: titleOf(1),
    modelTitle0: window.__apolloEditor.model.tracks[0].title,
    modelJoin1: (window.__apolloEditor.model.tracks[1].slots[0] || {}).joinPhrase,
  };
});
log('Apollo mirror after external edit (no toggle, no reload):', JSON.stringify(mirror));
ck(mirror.title0 === 'Renamed By Bookmarklet' || mirror.modelTitle0 === 'Renamed By Bookmarklet',
  `Apollo's mirror picked up the renamed title WITHOUT a toggle (mirror input: ${JSON.stringify(mirror.title0)}, model: ${JSON.stringify(mirror.modelTitle0)})`);
ck(mirror.modelJoin1 === ' & ', `Apollo's model picked up the new join phrase WITHOUT a toggle (got ${JSON.stringify(mirror.modelJoin1)})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
