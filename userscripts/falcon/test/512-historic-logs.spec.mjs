// #512 (majkinetor): "Fix Log that it doesn't show anything from previous
// runs anymore. Or, alternatively, it can keep configurable number of last
// runs in local storage so those can be selected and loaded by datetime.
// Besides that: 1. wrap entire log section in <details> on copy, as usual.
// 2. in work summary at the end of the log, add what was done the same as
// shown in collapsed queue (e.g. 2 link, isrc)."
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, frames, mbNoise } from '../../../dev/test/harness.mjs';
import { join, resolve } from 'node:path';

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false });

test("#512: historic logs", { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');

  const ck = check;

  await context.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  const errs = []; 
  page.on('pageerror', e => { if (!mbNoise(e.message)) errs.push(e.message); });
  await page.goto('https://test.musicbrainz.org/', { waitUntil: 'load' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });

  // 2. pruneOldSessions caps the count, keeping the NEWEST ones.
  const pruneResult = await page.evaluate(() => {
    const t = window.__falconTest;
    localStorage.clear();
    for (let i = 1; i <= 25; i++) {
      const id = `2026081500${String(i).padStart(4, '0')}-1`;
      localStorage.setItem('falcon:session:' + id, JSON.stringify([`line ${i}`]));
    }
    t.cfg.logHistoryCount = 5;
    t.pruneOldSessions();
    return t.listSessionKeys();
  });
  console.log('surviving sessions after prune to 5:', JSON.stringify(pruneResult));
  ck(pruneResult.length === 5, `pruneOldSessions caps to cfg.logHistoryCount (got ${pruneResult.length})`);
  ck(pruneResult[pruneResult.length - 1] === '20260815000025-1', `the newest session (i=25) survives (last kept: ${pruneResult[pruneResult.length - 1]})`);
  ck(pruneResult[0] === '20260815000021-1', `the oldest surviving one (i=21) is exactly the cutoff for keeping 5 of 25 (first kept: ${pruneResult[0]})`);

  // 3. a stored session in the text format before #705 reads back as log lines
  await page.evaluate(() => { localStorage.clear(); });
  const histResult = await page.evaluate(() => {
    localStorage.setItem('falcon:session:20260101120000-1', JSON.stringify(['[12:00:00] INFO  historical line one', '[12:00:01] WARN  [w2] historical line two']));
    return window.__falconTest.loadSessionLines('20260101120000-1');
  });
  console.log('historical session:', JSON.stringify(histResult));
  ck(histResult.length === 2 && histResult[0].msg === 'historical line one' && histResult[1].sev === 'warn' && histResult[1].cat === 'w2',
    `an old run's lines come back with their level and worker (got ${JSON.stringify(histResult)})`);
  ck(new Date(histResult[0].t).toISOString() === '2026-01-01T12:00:00.000Z', 'and their time, on the day of the session');

  // 4. logRunSummary's "worked on: ..." line reflects link/isrc/disambiguation/cover counts.
  const summaryLog = await page.evaluate(() => {
    const t = window.__falconTest;
    t.setQueue([
      { id: 'x1', entityType: 'recording', mbid: 'aaaaaaaa-5120-0000-0000-000000000001', urls: [{ url: 'https://a.com/1' }, { url: 'https://a.com/2' }], isrcs: ['NLTH1'], disambiguation: '', cover: [], status: 'done', error: '', timing: { worker: '[w1]', loadMs: 1, settleMs: 1, fillMs: 1, submitMs: 1, totalMs: 4 } },
      { id: 'x2', entityType: 'release', mbid: 'aaaaaaaa-5120-0000-0000-000000000002', urls: [], isrcs: [], disambiguation: '', cover: [{ url: 'https://a.com/cover.jpg' }], status: 'done', error: '', timing: { worker: '[w1]', loadMs: 1, settleMs: 1, fillMs: 1, submitMs: 1, totalMs: 4 } },
    ]);
    t.logRunSummary();
    return new Promise(resolve => setTimeout(() => resolve(t.getLog().join('\n')), 400));
  });
  console.log('run summary tail:', summaryLog.split('\n').filter(l => /worked on/.test(l)).join('\n'));
  ck(/worked on:.*2 links/.test(summaryLog), 'run summary totals the links across the run (2 links)');
  ck(/worked on:.*isrc on 1/.test(summaryLog), 'run summary counts items with isrc');
  ck(/worked on:.*cover on 1/.test(summaryLog), 'run summary counts items with cover');

  // 5. picking the old run in the Log tab shows it, and Copy takes that run, labelled with its date
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 5000 });
  await page.click('#falcon-tab-log');
  await frames(page);
  await page.evaluate(() => {
    navigator.clipboard.writeText = (t) => { window.__copiedText = t; return Promise.resolve(); };
  });
  await page.selectOption('#falcon-body-log .mbu-log-ses', '20260101120000-1');
  const shown = await page.evaluate(() => document.querySelector('#falcon-body-log .mbu-log-list').textContent);
  ck(/historical line one/.test(shown) && !/worked on/.test(shown), 'the Log tab shows the old run, not the live one');
  await page.click('#falcon-body-log .mbu-logpop-copy');
  await frames(page);
  const copied = await page.evaluate(() => window.__copiedText);
  console.log('copied text starts with:', JSON.stringify((copied || '').slice(0, 120)));
  ck(/^<details><summary>Falcon v[^ ]+ — log of 2026-01-01 \d\d:\d\d:\d\d/.test(copied || ''), `copy wraps in <details> labelled with the run's date (got "${(copied || '').slice(0, 120)}")`);
  ck(/WARN \[w2\] historical line two/.test(copied || '') && (copied || '').includes('```') && (copied || '').trim().endsWith('</details>'), 'copy fences that run’s lines and closes the <details> block');

  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
});
