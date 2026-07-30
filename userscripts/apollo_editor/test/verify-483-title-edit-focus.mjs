// #483 (chaban-mb/majkinetor): regression from #472. Typing a title in Apollo's
// OWN mirror input and tabbing/clicking away lost focus on the field the user
// had just moved to — because #472 started watching track.name/artistCredit
// individually to catch EXTERNAL edits (bookmarklets), but several of
// Apollo's OWN internal writers (setTitle, commitTrack, resetTrack, the
// track-parser bulk apply, clearAllTracks, the Recordings-tab "copy from
// recording" actions, and a stray unguarded line inside addTracks) were never
// wrapped in the pre-existing _selfEdit guard — nothing had been watching
// those fields before, so it never mattered until now. Every ordinary title
// edit tripped the "external change" watcher, scheduling a full mirror
// rebuild ~400ms later that destroyed and recreated the input DOM, yanking
// focus wherever the user had since moved it.
//
// Live-verified against test.musicbrainz.org (separate sandbox, majkinetor/mb).
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const ORIGIN = 'https://test.musicbrainz.org';
const log = (...a) => console.log('[verify-483]', ...a);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1600, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));

await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN on', ORIGIN); await ctx.close(); process.exit(3); }

const seed = {
  name: 'Apollo 483 test ' + Date.now(),
  'artist_credit.names.0.name': 'Apollo Test Artist',
  type: ['album'],
  'mediums.0.format': 'CD',
  'mediums.0.track.0.name': 'original title one',
  'mediums.0.track.0.artist_credit.names.0.name': 'Apollo Test Artist',
  'mediums.0.track.1.name': 'original title two',
  'mediums.0.track.1.artist_credit.names.0.name': 'Apollo Test Artist',
  'edit_note': '#483 verification',
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
await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length > 0; } catch { return false; } }, null, { timeout: 60000 });
log('editor ready, url:', page.url());

await page.addScriptTag({ content: scriptCode });
await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 15000 });
await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});
await page.waitForSelector('.tc-medsec .tc-mirror tbody tr', { timeout: 30000 });
await page.waitForFunction(() => { const m = window.__apolloEditor.model; return m && m.tracks.length >= 2; }, null, { timeout: 30000 });
await page.waitForTimeout(1500);

const before = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.tc-medsec .tc-mirror tbody tr[data-tk]')];
  return { row0: rows[0].querySelector('.t-title').value, row1: rows[1].querySelector('.t-title').value };
});
log('before edit:', JSON.stringify(before));

// The exact reported flow, in two parts:
//  1. Edit row 0's title (capitalization-only change) and let its own
//     immediate re-render settle (fillRows() has ALWAYS fully rebuilt the
//     tbody on every commit — that part predates #472 and isn't the
//     regression). Focus the (freshly rebuilt) row-1 title field, same as a
//     real Tab keystroke would land on after that settles.
//  2. THIS is what #472 broke: wait past the 400ms scheduleSync debounce
//     window. Before the #483 fix, the "external change" watcher (added in
//     #472 to catch bookmarklets editing tracks in place) treated Apollo's
//     OWN commit as an external change too, queuing a SECOND, LATER rebuild
//     that yanked focus back off — "even clicking edit... requires double
//     click now" (majkinetor). If the fix holds, nothing should happen here.
const flow = await page.evaluate(async () => {
  const rows = [...document.querySelectorAll('.tc-medsec .tc-mirror tbody tr[data-tk]')];
  const t0 = rows[0].querySelector('.t-title');
  t0.focus();
  t0.value = 'Original Title One';   // capitalization-only change
  t0.dispatchEvent(new Event('change', { bubbles: true }));   // fires setTitle() -> koTrack.name(v)
  await new Promise(r => setTimeout(r, 50));   // let the pre-existing synchronous re-render settle
  const freshRows = [...document.querySelectorAll('.tc-medsec .tc-mirror tbody tr[data-tk]')];
  const t1 = freshRows[1].querySelector('.t-title');
  t1.focus();   // simulates Tab/click landing on the next field, same as a real user
  const focusedRightAfter = document.activeElement === t1;
  await new Promise(r => setTimeout(r, 700));   // past the 400ms debounce window #472 introduced
  const stillT1 = document.activeElement;
  const rows2 = [...document.querySelectorAll('.tc-medsec .tc-mirror tbody tr[data-tk]')];
  const t1Now = rows2[1] ? rows2[1].querySelector('.t-title') : null;
  return {
    focusedRightAfter,
    focusStayedOnT1: stillT1 === t1,
    t1NodeUnchanged: t1Now === t1,   // a SECOND, later rebuild would create a BRAND NEW node, breaking node identity
    row0TitleNow: rows2[0] ? rows2[0].querySelector('.t-title').value : null,
  };
});
log('after edit + tab-away:', JSON.stringify(flow));
ck(flow.focusedRightAfter, 'sanity: focusing row 1 right after row 0 settles actually worked (proves the row-1 reference was fresh, not stale)');

ck(flow.focusStayedOnT1, `focus stayed on the field the user tabbed to, instead of being yanked away 400ms later (got focusStayedOnT1=${flow.focusStayedOnT1})`);
ck(flow.t1NodeUnchanged, `the row-1 title input is still the SAME DOM node — no delayed rebuild destroyed/recreated it (got t1NodeUnchanged=${flow.t1NodeUnchanged})`);
ck(flow.row0TitleNow === 'Original Title One', `row 0's edit was still committed correctly (got ${JSON.stringify(flow.row0TitleNow)})`);

// sanity: confirm the KO model really did change (setTitle actually worked)
const koCheck = await page.evaluate(() => {
  const u = v => (typeof v === 'function' ? v() : v);
  const med0 = u(window.MB.releaseEditor.rootField.release).mediums()[0];
  return u(med0.tracks()[0].name);
});
ck(koCheck === 'Original Title One', `the underlying KO track.name really was updated (got ${JSON.stringify(koCheck)})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
