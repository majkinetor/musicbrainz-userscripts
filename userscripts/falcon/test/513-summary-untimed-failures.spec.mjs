// #513 follow-up (majkinetor, live): "What about 'edit page was never
// loaded'" — that failure sets item.status = 'failed' immediately, WITHOUT
// ever setting item.timing (the worker never gets past the initial iframe-
// load wait). logRunSummary() used to restrict itself to
// queue.filter(i => i.timing), silently dropping that item (and its status)
// from BOTH the per-row table and the totals/byStatus count. Every settled
// item now gets counted; ones with no timing data just show dashes.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, mbNoise } from '../../../dev/test/harness.mjs';
import { join, resolve } from 'node:path';

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false });

test("#513: summary untimed failures", { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
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

  const summaryLog = await page.evaluate(() => {
    const t = window.__falconTest;
    t.setQueue([
      // a normal, timed success — the common case, must still work
      { id: 'r1', entityType: 'recording', mbid: 'aaaaaaaa-5130-0000-0000-000000000001', name: 'Timed OK', urls: [{ url: 'https://a.com/1' }], isrcs: [], disambiguation: '', cover: [], status: 'done', error: '', timing: { worker: '[w1]', loadMs: 5, settleMs: 1, fillMs: 1, submitMs: 1, totalMs: 8 } },
      // an "edit page never loaded" style failure — status set, no timing at all
      { id: 'r2', entityType: 'recording', mbid: 'aaaaaaaa-5130-0000-0000-000000000002', name: 'Never Loaded', urls: [{ url: 'https://a.com/2' }], isrcs: [], disambiguation: '', cover: [], status: 'failed', error: 'edit page never loaded' },
    ]);
    t.logRunSummary();
    return new Promise(resolve => setTimeout(() => resolve(t.getLog().join('\n')), 400));
  });
  console.log('summary:', summaryLog.split('\n').slice(-8).join('\n'));
  ck(/Never Loaded/.test(summaryLog), 'the untimed failure now gets its OWN row in the table (used to be silently dropped)');
  ck(/Never Loaded[^\n]*failed[^\n]*-[^\n]*-[^\n]*-[^\n]*-[^\n]*-/.test(summaryLog), 'its missing timing columns show dashes instead of crashing or showing garbage');
  ck(/2 item\(s\)/.test(summaryLog), 'the item count includes it (2 items total, not just the 1 timed one)');
  ck(/totals:.*1 done.*1 failed|totals:.*1 failed.*1 done/.test(summaryLog), `totals correctly counts BOTH the timed done and the untimed failed (got: ${summaryLog.match(/totals:[^\n]*/)})`);

  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
});
