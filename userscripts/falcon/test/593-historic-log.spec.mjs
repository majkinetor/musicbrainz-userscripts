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
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, mbNoise } from '../../../dev/test/harness.mjs';
import { join } from 'node:path';

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false });

test("#593: historic log", { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');
  const ck = check;

  const errs = []; page.on('pageerror', e => { if (!mbNoise(e.message)) errs.push(e.message); });
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
  await page.goto('https://test.musicbrainz.org/release/55530bc0-97ec-4256-97fc-e6058958c251', { waitUntil: 'load', timeout: 90000 });
  await requireLogin(page);
  // start from a clean slate so an earlier session cannot answer for this one
  await page.evaluate(() => { Object.keys(localStorage).filter(k => k.startsWith('falcon:')).forEach(k => localStorage.removeItem(k)); });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, null, { timeout: 20000 });
  /* The panel must be OPEN: the Log tab's session list and Copy only exist
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
  await page.waitForSelector('#falcon-body-log .mbu-log-ses', { timeout: 10000 });
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
  const copyShown = () => page.evaluate(async () => {
    let grabbed = '';
    const real = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = async t => { grabbed = t; };
    document.querySelector('#falcon-body-log .mbu-logpop-copy').click();
    for (let i = 0; i < 400 && !grabbed; i++) await new Promise(r => setTimeout(r, 25));   // until the copy has written
    navigator.clipboard.writeText = real;
    return grabbed.split(String.fromCharCode(10))[0];
  });
  await page.evaluate(() => window.__falconTest.Log.refresh());
  await page.selectOption('#falcon-body-log .mbu-log-ses', HIST);
  const portableHeader = await copyShown();
  await page.selectOption('#falcon-body-log .mbu-log-ses', '');
  console.log('\ncopied header (historic session):', portableHeader);
  ck(/Deep Heads Dubstep Vol\. 4/.test(portableHeader || ''),
    `a copied historic log names its release — "${portableHeader}"`);

  /* ── 1. a stored run keeps BOTH ends (#593; the window itself is the shared log's, #705) ── */
  const win = await page.evaluate(() => {
    const F = window.__falconTest;
    const MAX = F.LOG_PERSIST_MAX();
    // a run shaped like his: a real opening, a lot of worker chatter, a summary
    F.newSession('seeded 29 item(s)');
    F.log('info', '[names] release:65df7705-599b-4c6a-9116-ac2866583bcc — fetched: "Deep Heads Dubstep Vol. 4"');
    F.log('info', 'starting 5 worker(s)');
    F.Log.keep();
    for (let i = 0; i < 900; i++) F.log('debug', `[w${i % 5 + 1}] url[${i}] chatter`);
    F.log('info', '=== run finished ===');
    F.writeLogNow();
    const id = F.getSessionId(), out = F.loadSessionLines(id), raw = JSON.parse(localStorage.getItem('falcon:session:' + id));
    return {
      MAX, kept: raw.length, first: out[0].msg, fourth: out[3].msg, last: out[out.length - 1].msg,
      marker: (out.find(e => /dropped to fit the stored-log budget/.test(e.msg)) || {}).msg || null,
      worker: out[4].cat,
      hasRealWork: F.sessionHasRealWork(out),
      name: F.extractReleaseName(out),
    };
  });
  console.log('\n' + JSON.stringify(win, null, 1));
  ck(win.kept <= win.MAX, `the stored window still fits the ${win.MAX}-line budget (${win.kept})`);
  ck(/session \d{14}-\d+ started/.test(win.first),
    'the first stored line is the session start — the thing his log was missing');
  ck(/starting 5 worker\(s\)/.test(win.fourth), 'and "starting N worker(s)" survives');
  ck(/run finished/.test(win.last), 'the end of the run is still kept');
  ck(!!win.marker, `the gap is declared rather than silent — "${(win.marker || '').slice(0, 80)}"`);
  ck(win.worker === 'w1', `a worker's line keeps its worker as the category (${win.worker})`);
  ck(win.hasRealWork === true,
    'sessionHasRealWork() can still see the run — so a big log is no longer deleted as "no real work"');
  ck(win.name === 'Deep Heads Dubstep Vol. 4',
    `extractReleaseName() finds the name again in a trimmed log (${JSON.stringify(win.name)})`);

  /* ── 2. the name survives the session change that Start performs ───────────── */
  const nameFlow = await page.evaluate(() => {
    const F = window.__falconTest;
    // boot: seed session, then the release name resolves against it
    F.newSession('seeded 29 item(s) from the falcon= URL param');
    const seedId = F.getSessionId();
    F.noteSessionReleaseName('Deep Heads Dubstep Vol. 4');
    // #705: a session is stored once kept, so the seed (never Started) holds its name in memory only
    const seedName = F.Log.isKept() ? '(stored)' : 'Deep Heads Dubstep Vol. 4';
    // the queue as it stands when Start is pressed
    F.setQueue([
      { id: 'f1', entityType: 'recording', mbid: '11111111-1111-4111-8111-111111111111', urls: [], note: '', disambiguation: '', rename: '', isrcs: [], video: false, aliases: [], cover: [], coverExistingCount: null, name: 'Ethereal', urlResults: null, status: 'queued', error: '' },
      { id: 'f2', entityType: 'release', mbid: '65df7705-599b-4c6a-9116-ac2866583bcc', urls: [], note: '', disambiguation: '', rename: '', isrcs: [], video: false, aliases: [], cover: [], coverExistingCount: null, name: 'Deep Heads Dubstep Vol. 4', urlResults: null, status: 'queued', error: '' },
    ]);
    // Start mints a second session — this is the one history lists
    F.newSession('29 queued, 5 worker(s)');
    const runId = F.getSessionId();
    F.log('info', 'starting 5 worker(s)');
    F.Log.keep();   // what start() does once its workers start
    F.writeLogNow();
    /* The session list leaves out the CURRENT session, which appears as
       "Current session" instead. Mint one more session so the run becomes
       historic, which is also the state he was reading it in. */
    F.newSession('a later run, so the one above becomes history');
    F.Log.refresh();
    const sel = document.querySelector('#falcon-body-log .mbu-log-ses');
    const opt = sel ? [...sel.options].find(o => o.value === runId) : null;
    return { seedId, runId, seedName, runName: F.sessionReleaseName(runId), dropdown: opt ? opt.textContent : '(no option)' };
  });
  console.log('\n' + JSON.stringify(nameFlow, null, 1));
  ck(nameFlow.seedId !== nameFlow.runId, 'fixture: Start really does mint a second session (otherwise this proves nothing)');
  ck(nameFlow.seedName === 'Deep Heads Dubstep Vol. 4', 'fixture: the seed session had the name');
  ck(nameFlow.runName === 'Deep Heads Dubstep Vol. 4',
    `the RUN's session has it too now (${JSON.stringify(nameFlow.runName)})`);
  ck(/Deep Heads Dubstep Vol\. 4/.test(nameFlow.dropdown || ''),
    `and the history entry reads as a name, not a bare date — "${nameFlow.dropdown}"`);

  /* ── 2b. the COPIED header, which is what gets pasted into an issue ────────── */
  await page.selectOption('#falcon-body-log .mbu-log-ses', nameFlow.runId);
  const copied = await copyShown();
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
});
