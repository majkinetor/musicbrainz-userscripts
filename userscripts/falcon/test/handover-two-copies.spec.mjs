// Two installed copies of Falcon (the rename to plain "Falcon" left a manager with both):
// "Send to Falcon" on Harmony stores the batch in the GM storage of whichever copy ran
// there, and on MusicBrainz the other copy may be the one that runs — it found no batch
// and logged "neither valid base64 JSON nor a known pending token". The copy that stands
// down now hands the batch over through the page.
import { readFile } from 'node:fs/promises';
import { test, check, sourceOf, until } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

const HOST = 'https://falcon-handover.test';
const MBID = 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7';
const TOKEN = 'hmgabc12345xyz';
const BATCH = JSON.stringify([{ entityType: 'recording', mbid: MBID, url: 'https://example.com/handover', name: 'A recording' }]);

// one copy, in its own sandbox: its own GM storage, name and version
const copy = (code, name, version, values) => `(function () {
  const store = new Map(${JSON.stringify(values)});
  const GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  const GM_setValue = (k, v) => store.set(k, v);
  const GM_deleteValue = k => store.delete(k);
  const GM_info = { script: { name: ${JSON.stringify(name)}, version: ${JSON.stringify(version)} } };
  const GM_xmlhttpRequest = () => {}, GM_openInTab = () => {}, unsafeWindow = window;
  ${code}
})();`;

for (const order of ['running copy first', 'stood-down copy first']) {
  test(`the copy that stands down hands its batch to the one that runs (${order})`, { tag: '@unit' }, async ({ page }) => {
    const code = await readFile(sourceOf('falcon'), 'utf8');
    await page.route(`${HOST}/**`, r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>t</title><body></body>' }));
    await page.addInitScript(() => { window.__mbuTest = true; });
    await page.goto(`${HOST}/?falcon=${TOKEN}`);
    // the newer copy runs; the older one, whose storage holds the batch, stands down
    const running = copy(code, 'Falcon', '2026.10.5', []);
    const older = copy(code, 'Falcon — bulk MusicBrainz link editor', '2026.10.4', [[`falcon:pending:${TOKEN}`, BATCH]]);
    for (const c of order === 'running copy first' ? [running, older] : [older, running]) await page.addScriptTag({ content: c });
    const queue = await until(() => page.evaluate(() => window.__falconTest ? window.__falconTest.getQueue().map(i => i.mbid) : []), q => q.length > 0, 8000);
    check(queue.length === 1 && queue[0] === MBID, `the running copy queued the batch (${JSON.stringify(queue)})`);
    const log = await page.evaluate(() => window.__falconTest.getLog().map(l => l.msg || l.message || String(l)).join('\n'));
    check(!/neither valid base64 JSON/.test(log), 'and did not report it lost');
  });
}

test('with no copy holding it, the warning says why', { tag: '@unit' }, async ({ page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');
  await page.route(`${HOST}/**`, r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>t</title><body></body>' }));
  await page.addInitScript(() => { window.__mbuTest = true; });
  await page.clock.install();
  await page.goto(`${HOST}/?falcon=${TOKEN}`);
  await page.addScriptTag({ content: copy(code, 'Falcon', '2026.10.5', []) });
  await page.clock.runFor(5000);
  const log = await page.evaluate(() => JSON.stringify(window.__falconTest.getLog()));
  check(/neither valid base64 JSON/.test(log) && /reloaded or reopened/.test(log), `the lost batch is reported with its likely reasons (${log.slice(0, 400)})`);
});
