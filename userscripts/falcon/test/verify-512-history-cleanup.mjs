// #512 follow-up (majkinetor, live):
// 1. "I got bunch of historic logs without any processing... We should have
//    only processing logs." — calling newSession() on every fresh
//    `?falcon=` seed (the earlier #512 fix) means a seed the user never
//    actually Starts leaves behind a session with nothing but tab-unload
//    noise. A session is now deleted outright, instead of lingering in
//    history, if it never reached "starting N worker(s)".
// 2. "add release name in the log name if present... rather than having to
//    navigate dates exclusively" — the history dropdown now prefixes each
//    entry with the release name if the session resolved one (reusing
//    #509's own [names] debug line, no new logging needed).
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
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });

// 1a. sessionHasRealWork() itself.
const noiseLines = ['[15:46:15] ERROR *** THIS TAB IS BEING UNLOADED (after the run finished) *** via beforeunload', '[15:46:16] WARN  falcon= param present but neither valid base64 JSON nor a known pending token'];
const realLines = ['[16:00:53] INFO  === session started ===', '[16:00:53] INFO  starting 6 worker(s) for 15 queued item(s)'];
const noiseCheck = await page.evaluate((l) => window.__falconTest.sessionHasRealWork(l), noiseLines);
const realCheck = await page.evaluate((l) => window.__falconTest.sessionHasRealWork(l), realLines);
ck(noiseCheck === false, `pure unload/warn noise is correctly NOT real work (got ${noiseCheck})`);
ck(realCheck === true, `a session with a "starting N worker(s)" line is correctly real work (got ${realCheck})`);

// 1b. end-to-end: a session that never Starts gets deleted once superseded.
// This is the exact real-world shape: the noise session was left behind by
// a tab that seeded but never Started (so it's NOT mid-run — `midrun` is
// unset/'0' — and per the reattach fix above, a fresh page load correctly
// does NOT reattach to it). newSession() must still find and delete it by
// reading the stale "current" pointer straight from storage, not by
// depending on having reattached its own in-memory SESSION_ID/LOG to it.
await page.evaluate(() => { localStorage.clear(); });
await page.evaluate(() => {
  localStorage.setItem('falcon:session:current', '20260101090000-1');
  localStorage.setItem('falcon:session:midrun', '0');
  localStorage.setItem('falcon:session:20260101090000-1', JSON.stringify(['[09:00:00] INFO  === session 20260101090000-1 started (seeded 1 item(s)) ===', '[09:00:05] ERROR *** THIS TAB IS BEING UNLOADED *** via beforeunload']));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
const reattached = await page.evaluate(() => window.__falconTest.getSessionId());
console.log('session id after reload (should NOT reattach — the noise session was never mid-run):', reattached);
ck(reattached !== '20260101090000-1', `sanity: a non-mid-run noise session does not reattach (got "${reattached}")`);

// now trigger a REAL run — newSession() should see the STALE "current"
// pointer left over from the noise session, find it has no real work, and
// delete it rather than just letting pruneOldSessions() eventually age it out.
await page.evaluate(() => {
  window.__falconTest.setQueue([{ id: '1', entityType: 'artist', mbid: 'aaaaaaaa-5120-0000-0000-000000000001', urls: [{ url: 'https://x.com/1' }], isrcs: [], disambiguation: '', cover: [], status: 'queued', error: '' }]);
});
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });
await page.evaluate(() => window.__falconTest.start());
await page.waitForTimeout(300);
const survived = await page.evaluate(() => localStorage.getItem('falcon:session:20260101090000-1'));
console.log('noise session after a real run starts:', JSON.stringify(survived));
ck(survived === null, 'the noise-only session is deleted once a real session starts, not left to clutter history');

// 2. release name in the history label.
const label = await page.evaluate(() => {
  const t = window.__falconTest;
  const lines = ['[16:00:53] INFO  === session started ===', '[16:01:02] DEBUG [names] release:bc55a0a0-0025-40fd-a9d9-627fc3f5b1f3 — fetched: "Music Will Explain (Choir Music Vol. 1)"'];
  return t.extractReleaseName(lines);
});
console.log('extracted release name:', JSON.stringify(label));
ck(label === 'Music Will Explain (Choir Music Vol. 1)', `extractReleaseName() pulls the name out of the existing [names] debug line (got "${label}")`);

const noNameLabel = await page.evaluate(() => window.__falconTest.extractReleaseName(['[16:00:53] INFO  === session started ===']));
ck(noNameLabel === null, `returns null when no release name was ever resolved in that session (got ${noNameLabel})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
