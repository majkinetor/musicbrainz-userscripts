// #512 follow-up (majkinetor, live): "Still getting previous logs. I reload
// the MB page and expect empty log, but I get this" — a full, already-
// finished run's log, reattached on a plain reload with no `?falcon=` seed.
// The reattach-on-load logic was meant for a run that's still mid-flight
// when a navigation happens (so its log stays continuous) — but a plain
// reload never calls newSession() at all, so it ALWAYS fell through to that
// same reattach, correct mid-run but wrong once the run is long finished.
// noteUnload() now also records whether a run was genuinely still going,
// and reattach only honors that.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, mbNoise } from '../../../dev/test/harness.mjs';

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false });

test("#512: no reattach after finish", { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');

  const ck = check;

  await context.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });

  // 1. a FINISHED run's session must NOT reattach on a later plain reload.
  {
    const page = await context.newPage();
    const errs = []; page.on('pageerror', e => { if (!mbNoise(e.message)) errs.push(e.message); });
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await page.goto('https://test.musicbrainz.org/', { waitUntil: 'load' });
    await page.evaluate(() => localStorage.clear());
    // seed a FINISHED session, exactly like noteUnload() would leave behind
    // after a real run completed and the tab was later closed/navigated away.
    await page.evaluate(() => {
      localStorage.setItem('falcon:session:current', '20260101120000-1');
      localStorage.setItem('falcon:session:midrun', '0');   // the run had already finished
      localStorage.setItem('falcon:session:20260101120000-1', JSON.stringify(['[12:00:00] INFO  === session 20260101120000-1 started (a finished run) ===', '[12:05:00] INFO  run summary ...', '[12:05:01] ERROR *** THIS TAB IS BEING UNLOADED (after the run finished) *** via beforeunload']));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ content: code });
    await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
    const log = await page.evaluate(() => window.__falconTest.getLog());
    const sessionId = await page.evaluate(() => window.__falconTest.getSessionId());
    console.log('log after reload (finished session):', JSON.stringify(log));
    console.log('session id:', JSON.stringify(sessionId));
    ck(!log.some(l => l.includes('a finished run')), 'the finished run\'s old lines are NOT reattached on a plain reload');
    ck(sessionId !== '20260101120000-1', `did not reattach to the finished session's id (got "${sessionId}")`);
    ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  }

  // 2. a MID-RUN session (tab navigated away while items were still active)
  // MUST still reattach — the original, still-needed behavior.
  {
    const page = await context.newPage();
    const errs = []; page.on('pageerror', e => { if (!mbNoise(e.message)) errs.push(e.message); });
    await page.goto('https://test.musicbrainz.org/', { waitUntil: 'load' });
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => {
      localStorage.setItem('falcon:session:current', '20260101130000-1');
      localStorage.setItem('falcon:session:midrun', '1');   // items were still active/queued
      localStorage.setItem('falcon:session:20260101130000-1', JSON.stringify(['[13:00:00] INFO  === session 20260101130000-1 started (still running) ===', '[13:00:05] INFO  [w1] recording x — loading edit page']));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ content: code });
    await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
    const log = await page.evaluate(() => window.__falconTest.getLog());
    const sessionId = await page.evaluate(() => window.__falconTest.getSessionId());
    console.log('log after reload (mid-run session):', JSON.stringify(log));
    console.log('session id:', JSON.stringify(sessionId));
    ck(log.some(l => l.includes('still running')), 'a genuinely mid-run session STILL reattaches, log stays continuous');
    ck(sessionId === '20260101130000-1', `reattached to the correct in-flight session id (got "${sessionId}")`);
    ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  }
});
