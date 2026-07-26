// #467 (majkinetor, emphatically): "logs do not work correctly, as I can't get
// previous logs when it closes... I DON'T WANT LOGS FROM OTHER RUNS. I WANT YOU
// TO KEEP THE WINDOW OPEN AND HAVE A SINGLE LOG OF THAT SESSION."
//
// Two bugs sat behind that report.
//
// 1. Nothing was ever written on a short run. The persist was debounced by 10s
//    and a run of 8 recordings takes about 10s, so the first write hadn't fired
//    when the tab went away — and pagehide + GM_setValue is not reliably flushed
//    by a real userscript manager on the way out. The log was empty in precisely
//    the situation it exists for. The live mirror is localStorage now:
//    synchronous, same-origin, and it survives the tab navigating.
//
// 2. Sessions were merged. Restore did LOG.push(...previous), so every log
//    opened with the last run's lines stacked above the current ones.
//
// It also covers the unload forensics: if the page goes away, that fact is
// recorded synchronously with the url, so a tab being closed out from under
// Falcon can never again look like Falcon closing itself, or like a log that
// merely stopped. That line is what identified the real culprit — chaban's
// "Click buttons across tabs", which injects into Falcon's worker iframes and
// closes the tab after a successful edit.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
let posts = 0;
await page.route('**/artist/*/edit*', async (route, request) => {
  if (request.method() === 'POST') { posts++; const m = request.url().match(/\/artist\/([0-9a-f-]{36})\/edit/); return route.fulfill({ status: 302, headers: { Location: `https://musicbrainz.org/artist/${m[1]}` } }); }
  return route.continue();
});
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.evaluate(() => { try { Object.keys(localStorage).filter(k => k.startsWith('falcon:')).forEach(k => localStorage.removeItem(k)); } catch (e) {} });
await page.waitForTimeout(400);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 10000 });
await page.click('#falcon-launcher');

// --- run 1 -----------------------------------------------------------------
await page.evaluate(() => {
  window.__falconTest.setQueue([{ id: 's1', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://myspace.com/session-log-1', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' }]);
  window.__falconTest.cfg.workers = 1;
});
await page.evaluate(() => window.__falconTest.start());
await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 60000 }).catch(() => {});
const s1 = await page.evaluate(() => ({ id: window.__falconTest.getSessionId(), lines: window.__falconTest.getLog().length }));
console.log('run 1 session:', JSON.stringify(s1));
ck(!!s1.id, 'starting a run opens a session with an id');

// the whole point of #1: it is on disk NOW, not in 10 seconds
const persisted = await page.evaluate(id => {
  const raw = localStorage.getItem('falcon:session:' + id);
  return raw ? JSON.parse(raw).length : 0;
}, s1.id);
console.log('lines persisted immediately after the run:', persisted);
ck(persisted > 0, `the log is written to storage during/right after a short run, not on a 10s debounce (${persisted} lines)`);

// --- run 2 must NOT inherit run 1's lines -----------------------------------
// Settle first. The queue reaching a terminal status is not the same as the
// worker coroutine having unwound — a straggler line from run 1 landing after
// run 2 opened its session is a race in the TEST, not a session that leaked.
await page.waitForTimeout(2000);
await page.evaluate(() => {
  window.__falconTest.setQueue([{ id: 's2', entityType: 'artist', mbid: '5441c29d-3602-4898-b1a1-b77fa23b8e50', urls: [{ url: 'https://myspace.com/session-log-2', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' }]);
});
await page.evaluate(() => window.__falconTest.start());
await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 60000 }).catch(() => {});
const s2 = await page.evaluate(() => ({ id: window.__falconTest.getSessionId(), log: window.__falconTest.getLog().join('\n') }));
ck(s2.id !== s1.id, `a second run gets its own session id (${s1.id} -> ${s2.id})`);
// assert on the mbid, not the url: the log records which ENTITY a worker is on,
// and the url only appears in the deeper per-url debug lines, which a run that
// fails early (a slow production edit page) never reaches.
ck(!/d31f76d2/.test(s2.log), 'and its log contains NONE of the previous run\'s lines');
ck(/5441c29d/.test(s2.log), 'while containing its own');

// --- a tab that navigates mid-run must say so, and keep the log -------------
await page.evaluate(() => {
  window.__falconTest.setQueue([{ id: 's3', entityType: 'artist', mbid: '5441c29d-3602-4898-b1a1-b77fa23b8e50', urls: [{ url: 'https://myspace.com/session-log-3', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' }]);
});
await page.evaluate(() => { window.__falconTest.start(); });
await page.waitForTimeout(150);          // catch it with work genuinely in flight
await page.evaluate(() => window.__falconTest.noteUnload());
const s3id = await page.evaluate(() => window.__falconTest.getSessionId());
const marked = await page.evaluate(id => {
  const raw = localStorage.getItem('falcon:session:' + id);
  return raw ? JSON.parse(raw).join('\n') : '';
}, s3id);
ck(/THIS TAB IS BEING UNLOADED/.test(marked), 'unloading records that the PAGE went away — not that Falcon closed itself');
ck(/musicbrainz\.org/.test(marked), 'and records where it was when that happened');

// reload: the killed session's log must still be there when you go looking
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 10000 });
await page.waitForTimeout(500);
const restored = await page.evaluate(() => {
  document.getElementById('falcon-launcher').click();
  document.getElementById('falcon-tab-log').click();
  return { text: document.getElementById('falcon-log-text').textContent };
});
// The panel deliberately does NOT force itself open here any more: that was
// scaffolding for chasing the tab-closing bug, and with the panel already open
// at boot the launcher's first click toggled it shut. The log still survives and
// is one click away, which is the part that matters.
ck(/5441c29d/.test(restored.text), 'with the killed run\'s own lines restored');
ck(/THIS TAB IS BEING UNLOADED/.test(restored.text), 'and the explanation of what happened to it');
ck(!/d31f76d2/.test(restored.text), 'still without dragging in older runs');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
