// #512 follow-up (majkinetor, live, with a real 31-item run's log):
// "Logs sometimes do not have a name although in log it is present... log
// must be started before any missing names are fetched, but log can be
// renamed in any case later." The history label used to be mined from the
// log's own "[names] release:..." line, written once near session start —
// LOG_PERSIST_MAX (400) trims that off the front the moment a big run's
// chatter pushes past the window, exactly what happened here. The release
// name is now also stashed in its own small, never-trimmed key the moment
// it's known.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const errs = []; const page = await ctx.newPage();
page.on('pageerror', e => errs.push(e.message));
await page.route('**/artist/*/edit*', route => new Promise(() => {}));
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });

// 1. noteSessionReleaseName persists outside LOG, survives a simulated
// LOG_PERSIST_MAX trim that would have dropped the original "[names]" line.
// noteSessionReleaseName() is a no-op without a live SESSION_ID (same as the
// real code path — a release name is only ever resolved once a session
// exists), so start() a real one first, same as any actual run would.
const sid = await page.evaluate(() => {
  const t = window.__falconTest;
  t.setQueue([{ id: 'x1', entityType: 'artist', mbid: 'aaaaaaaa-5120-0000-0000-000000000001', urls: [{ url: 'https://x.com/1' }], isrcs: [], disambiguation: '', cover: [], status: 'queued', error: '' }]);
  t.start();
  t.noteSessionReleaseName('Deep Heads Dubstep, Volume 3');
  return t.getSessionId();
});
const nameKey = await page.evaluate(() => window.__falconTest.sessionNameKey(window.__falconTest.getSessionId()));
const stored = await page.evaluate((k) => localStorage.getItem(k), nameKey);
console.log('persisted name key:', nameKey, '=', stored);
ck(stored === 'Deep Heads Dubstep, Volume 3', `the name is persisted in its own key, not just the log (got "${stored}")`);

// simulate the log itself having been trimmed past the "[names]" line —
// sessionReleaseName() must still find the name via the dedicated key.
await page.evaluate((id) => {
  localStorage.setItem('falcon:session:' + id, JSON.stringify(['[19:00:00] INFO  starting 6 worker(s) for 31 queued item(s)', '[19:05:00] INFO  run summary ...']));
}, sid);
const resolved = await page.evaluate((id) => window.__falconTest.sessionReleaseName(id), sid);
ck(resolved === 'Deep Heads Dubstep, Volume 3', `sessionReleaseName() finds it even once the log's own [names] line has aged out of the tail (got "${resolved}")`);

// 2. only the FIRST release name for a session sticks — matches
// extractReleaseName()'s existing "first match wins" semantics.
await page.evaluate(() => window.__falconTest.noteSessionReleaseName('A different release'));
const stillFirst = await page.evaluate((k) => localStorage.getItem(k), nameKey);
ck(stillFirst === 'Deep Heads Dubstep, Volume 3', `a later call does not overwrite the first-known name (got "${stillFirst}")`);

// 3. falls back to log-text mining for a session persisted before this fix
// (no dedicated key at all) — existing history isn't blanked out.
const legacyId = '20260101150000-1';
await page.evaluate((id) => {
  localStorage.setItem('falcon:session:' + id, JSON.stringify(['[15:00:00] INFO  === session started ===', '[15:00:05] DEBUG [names] release:bc55a0a0-0025-40fd-a9d9-627fc3f5b1f3 — fetched: "Legacy Release Name"']));
}, legacyId);
const legacyResolved = await page.evaluate((id) => window.__falconTest.sessionReleaseName(id), legacyId);
ck(legacyResolved === 'Legacy Release Name', `falls back to mining the log for a pre-fix session with no dedicated key (got "${legacyResolved}")`);

// 4. deleteSessionData() removes the paired :name key too, not just the log.
await page.evaluate((id) => window.__falconTest.deleteSessionData(id), sid);
const nameAfterDelete = await page.evaluate((k) => localStorage.getItem(k), nameKey);
ck(nameAfterDelete === null, 'deleteSessionData() cleans up the paired name key, not just the log');

// 5. the history dropdown label itself picks up the persisted name, live.
await page.evaluate((id) => {
  localStorage.setItem('falcon:session:' + id, JSON.stringify(['[16:00:00] INFO  starting 1 worker(s) for 1 queued item(s)']));
  localStorage.setItem('falcon:session:' + id + ':name', 'Named Via Dedicated Key');
}, '20260101160000-1');
await page.click('#falcon-tab-log');
await page.waitForTimeout(100);
const label = await page.evaluate(() => [...document.getElementById('falcon-log-history').options].map(o => o.textContent).find(t => t.includes('Named Via Dedicated Key')));
console.log('history label:', label);
ck(!!label, `the history combo shows the dedicated-key name (got ${JSON.stringify(label)})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
