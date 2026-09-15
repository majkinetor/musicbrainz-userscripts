// #593 (majkinetor): "This is the log I got from history. It didn't have a name
// (just date) while release name is resolved and it is missing starting lines"
//
// Two reported faults, one shared cause each:
//
//   · the log began 53 seconds after its own session start, because
//     writeLogNow persisted LOG.slice(-400) — the LAST 400 lines. Every run
//     bigger than that lost its opening.
//   · the history entry showed a bare date, because a Harmony seed calls
//     newSession() at boot, the release name lands against THAT id, and then
//     Start mints a second session for the run. History lists the second one.
//
// And a third that nobody had reported yet, which falls out of the first:
// sessionHasRealWork() matches "starting N worker(s)", a line near the START.
// Trimmed away, a big run's log looks like it did nothing — and newSession()
// deletes such a session when the next run supersedes it. Big logs could vanish
// from history entirely. That one is checked here too.
//
// Runs on a real MusicBrainz page because the code under test reads
// localStorage on that origin, but no run is started and nothing is submitted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.FALCON_SRC || resolve(HERE, '..', 'falcon.user.js'), 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1400, height: 900 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const wrote = [];
page.on('request', r => { if ((r.method() === 'POST' || r.method() === 'PUT') && /musicbrainz\.org/.test(r.url())) wrote.push(r.url()); });

await page.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
  window.GM_xmlhttpRequest = () => {};
  window.GM_openInTab = () => ({ close() {}, closed: false });
});
await page.goto('https://musicbrainz.org/release/55530bc0-97ec-4256-97fc-e6058958c251', { waitUntil: 'domcontentloaded', timeout: 90000 });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
// start from a clean slate so an earlier session cannot answer for this one
await page.evaluate(() => { Object.keys(localStorage).filter(k => k.startsWith('falcon:')).forEach(k => localStorage.removeItem(k)); });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, null, { timeout: 20000 });
/* The panel must be OPEN: #falcon-log-history and #falcon-log-copy only exist
   once it has rendered, and asking for them on a closed panel reported "(no
   option)" and then died on a null .click() — which reads exactly like a broken
   feature rather than a test that never opened the UI. */
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 10000 });
await page.evaluate(() => {
  const t = [...document.querySelectorAll('#falcon-panel button, #falcon-panel .falcon-tab')]
    .find(b => /^log$/i.test((b.textContent || '').trim()));
  if (t) t.click();
});
await page.waitForSelector('#falcon-log-history', { timeout: 10000 });
ck(true, 'fixture: the panel is open on the Log tab, so its controls exist');

/* ── 0. the symptom he actually pasted, checked on ANY build ───────────────
   What he quoted is the header of a COPIED log:
       Falcon log (v2026.9.14.164508, session 2026-09-15 07:13:45, 400 lines)
   This check needs none of the new hooks — it seeds a historical session
   straight into localStorage and copies it — so it runs on the old build too
   and shows the difference, rather than aborting with "no machinery". */
const HIST = '20260101000000-9';
await page.evaluate((id) => {
  localStorage.setItem('falcon:session:' + id, JSON.stringify(['[00:00:00] INFO  starting 5 worker(s)']));
  localStorage.setItem('falcon:session:' + id + ':name', 'Deep Heads Dubstep Vol. 4');
}, HIST);
const portableHeader = await page.evaluate(async (id) => {
  const F = window.__falconTest;
  let grabbed = '';
  const real = navigator.clipboard.writeText.bind(navigator.clipboard);
  navigator.clipboard.writeText = async t => { grabbed = t; };
  F.populateLogHistory();
  F.setViewingSession(id);
  document.getElementById('falcon-log-copy').click();
  await new Promise(r => setTimeout(r, 400));
  navigator.clipboard.writeText = real;
  F.setViewingSession(null);
  return grabbed.split(String.fromCharCode(10))[0];
}, HIST);
console.log('\ncopied header (historic session):', portableHeader);
ck(/Deep Heads Dubstep Vol\. 4/.test(portableHeader || ''),
  `a copied historic log names its release — "${portableHeader}"`);

const T = await page.evaluate(() => ({
  hasWindow: typeof window.__falconTest.persistWindow === 'function',
  hasNewSession: typeof window.__falconTest.newSession === 'function',
}));
ck(T.hasWindow && T.hasNewSession, 'this build exposes the log-window and session helpers');
if (!T.hasWindow || !T.hasNewSession) {
  console.log('no #593 machinery on this build — the behavioural checks below cannot run');
  await ctx.close(); console.log(`\n${fail + 1} FAILED`); process.exit(1);
}

/* ── 1. the persisted window keeps BOTH ends ───────────────────────────────── */
const win = await page.evaluate(() => {
  const F = window.__falconTest;
  const MAX = F.LOG_PERSIST_MAX(), HEAD = F.LOG_PERSIST_HEAD();
  // a run shaped like his: a real opening, a lot of worker chatter, a summary
  const lines = [];
  lines.push('[07:13:45] INFO  === session 20260915071345-1 started (seeded 29 item(s)) ===');
  lines.push('[07:13:45] INFO  [names] release:65df7705-599b-4c6a-9116-ac2866583bcc — fetched: "Deep Heads Dubstep Vol. 4"');
  lines.push('[07:13:46] INFO  starting 5 worker(s)');
  for (let i = 0; i < 900; i++) lines.push(`[07:14:${String(i % 60).padStart(2, '0')}] DEBUG [w${i % 5 + 1}] url[${i}] chatter`);
  lines.push('[07:15:09] INFO  === run finished ===');
  const out = F.persistWindow(lines);
  return {
    MAX, HEAD, input: lines.length, kept: out.length,
    first: out[0], second: out[1], third: out[2],
    last: out[out.length - 1],
    marker: out.find(l => /dropped to fit the stored-log budget/.test(l)) || null,
    hasRealWork: F.sessionHasRealWork(out),
    name: F.extractReleaseName(out),
    // a small log must come through completely untouched
    smallUntouched: (() => { const s = lines.slice(0, 50); return F.persistWindow(s).length === 50 && !F.persistWindow(s).some(l => /budget/.test(l)); })(),
  };
});
console.log('\n' + JSON.stringify(win, null, 1));
ck(win.kept <= win.MAX, `the stored window still fits the ${win.MAX}-line budget (${win.kept})`);
ck(/session 20260915071345-1 started/.test(win.first),
  'the first stored line is the session start — the thing his log was missing');
ck(/starting 5 worker\(s\)/.test(win.third), 'and "starting N worker(s)" survives');
ck(/run finished/.test(win.last), 'the end of the run is still kept');
ck(!!win.marker, `the gap is declared rather than silent — "${(win.marker || '').slice(28, 100)}"`);
ck(win.hasRealWork === true,
  'sessionHasRealWork() can still see the run — so a big log is no longer deleted as "no real work"');
ck(win.name === 'Deep Heads Dubstep Vol. 4',
  `extractReleaseName() finds the name again in a trimmed log (${JSON.stringify(win.name)})`);
ck(win.smallUntouched, 'a log that fits is stored verbatim, with no marker inserted');

/* ── 2. the name survives the session change that Start performs ───────────── */
const nameFlow = await page.evaluate(() => {
  const F = window.__falconTest;
  // boot: seed session, then the release name resolves against it
  F.newSession('seeded 29 item(s) from the falcon= URL param');
  const seedId = F.getSessionId();
  F.noteSessionReleaseName('Deep Heads Dubstep Vol. 4');
  const seedName = F.sessionReleaseName(seedId);
  // the queue as it stands when Start is pressed
  F.setQueue([
    { id: 'f1', entityType: 'recording', mbid: '11111111-1111-4111-8111-111111111111', urls: [], note: '', disambiguation: '', rename: '', isrcs: [], video: false, aliases: [], cover: [], coverExistingCount: null, name: 'Ethereal', urlResults: null, status: 'queued', error: '' },
    { id: 'f2', entityType: 'release', mbid: '65df7705-599b-4c6a-9116-ac2866583bcc', urls: [], note: '', disambiguation: '', rename: '', isrcs: [], video: false, aliases: [], cover: [], coverExistingCount: null, name: 'Deep Heads Dubstep Vol. 4', urlResults: null, status: 'queued', error: '' },
  ]);
  // Start mints a second session — this is the one history lists
  F.newSession('29 queued, 5 worker(s)');
  const runId = F.getSessionId();
  F.log('info', 'starting 5 worker(s)');
  F.writeLogNow();
  /* ⚠ Two things about this that each failed on a CORRECT build first:
     · formatSessionLabel() is the bare timestamp by design. What the user sees
       is composed from it — the dropdown and the Copy Log header both prepend
       the release name — so those are what to assert on.
     · populateLogHistory() filters out the CURRENT session, which appears as
       "Current session" instead. Asking for the run's own option while it was
       still current returned "(no option)". Mint one more session so the run
       becomes historic, which is also the state he was reading it in. */
  F.newSession('a later run, so the one above becomes history');
  F.populateLogHistory();
  const sel = document.getElementById('falcon-log-history');
  const opt = sel ? [...sel.options].find(o => o.value === runId) : null;
  return { seedId, runId, seedName, runName: F.sessionReleaseName(runId),
    stamp: F.formatSessionLabel(runId), dropdown: opt ? opt.textContent : '(no option)' };
});
console.log('\n' + JSON.stringify(nameFlow, null, 1));
ck(nameFlow.seedId !== nameFlow.runId, 'fixture: Start really does mint a second session (otherwise this proves nothing)');
ck(nameFlow.seedName === 'Deep Heads Dubstep Vol. 4', 'fixture: the seed session had the name');
ck(nameFlow.runName === 'Deep Heads Dubstep Vol. 4',
  `the RUN's session has it too now (${JSON.stringify(nameFlow.runName)})`);
ck(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(nameFlow.stamp || ''),
  `formatSessionLabel stays the plain timestamp (${nameFlow.stamp})`);
ck(/Deep Heads Dubstep Vol\. 4/.test(nameFlow.dropdown || ''),
  `and the history entry reads as a name, not a bare date — "${nameFlow.dropdown}"`);

/* ── 2b. the COPIED header, which is what gets pasted into an issue ────────── */
const copied = await page.evaluate(async () => {
  const F = window.__falconTest;
  let grabbed = '';
  const real = navigator.clipboard.writeText.bind(navigator.clipboard);
  navigator.clipboard.writeText = async t => { grabbed = t; };
  F.setViewingSession(F.getSessionId());
  document.getElementById('falcon-log-copy').click();
  await new Promise(r => setTimeout(r, 400));
  navigator.clipboard.writeText = real;
  return grabbed.split(String.fromCharCode(10))[0];
});
console.log('copied header:', copied);
ck(/Deep Heads Dubstep Vol\. 4/.test(copied || ''),
  `the copied log's header names the release — "${copied}"`);

/* ── 3. a session with no release in the queue is not given a false name ───── */
const noRel = await page.evaluate(() => {
  const F = window.__falconTest;
  F.setQueue([{ id: 'f1', entityType: 'artist', mbid: '22222222-2222-4222-8222-222222222222', urls: [], note: '', disambiguation: '', rename: '', isrcs: [], video: false, aliases: [], cover: [], coverExistingCount: null, name: 'Someone', urlResults: null, status: 'queued', error: '' }]);
  F.newSession('1 queued, 5 worker(s)');
  const id = F.getSessionId();
  return { id, name: F.sessionReleaseName(id) };
});
ck(!noRel.name, `a run with no release in the queue gets no name invented for it (${JSON.stringify(noRel.name)})`);

ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
ck(wrote.length === 0, `nothing was submitted to MusicBrainz (${wrote.length})`);
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
