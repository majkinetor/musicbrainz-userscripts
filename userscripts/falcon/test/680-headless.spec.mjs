// #680 Mission Control: a batch sent with `headless: true` and a `tag` keeps the panel out
// of sight (built off-screen, since the workers live in it), and every change to its items
// is reported as falcon:status { tag, running, items }. falcon:show brings the panel back.
// falcon:import, not falcon:run, so nothing is submitted.
//
// The release page is a fixture, routed on one narrow regex.
import { readFile } from 'node:fs/promises';
import { test, check, sourceOf, until } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

test('#680: a headless batch keeps the panel shut and reports falcon:status', { tag: ['@sandbox'] }, async ({ context }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');
  await context.route(/^https:\/\/test\.musicbrainz\.org\/release\//, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><head><meta charset="utf-8"></head><body><h1>A Release</h1></body></html>' }));
  const page = await context.newPage();
  await page.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
    window.GM_xmlhttpRequest = () => {};
    window.__status = [];
    document.addEventListener('falcon:status', e => window.__status.push(JSON.parse(e.detail)));
  });
  page.on('load', () => { page.addScriptTag({ content: code }).catch(() => {}); });
  await page.goto('https://test.musicbrainz.org/release/20b03c7d-9e8a-42b9-8a96-bcc9564de034', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__falconTest, null, { timeout: 15000 });

  const mbid = '20b03c7d-9e8a-42b9-8a96-bcc9564de034';
  await page.evaluate(mbid => document.dispatchEvent(new CustomEvent('falcon:import', { detail: JSON.stringify({ name: 'x', headless: true, tag: 'mc:pc:r1', items: [{ entityType: 'release', mbid, name: 'A Release', urls: [{ url: 'https://www.deezer.com/album/1' }] }] }) })), mbid);
  const st = await until(() => page.evaluate(() => window.__status), s => s.length > 0);
  check(st[0].tag === 'mc:pc:r1' && st[0].items.length === 1 && st[0].items[0].status === 'queued' && st[0].items[0].urls === 1, `falcon:status reports the tagged item (${JSON.stringify(st[0])})`);
  const hidden = await page.evaluate(() => { const p = document.getElementById('falcon-panel'), r = p.getBoundingClientRect(); return { right: r.right, opacity: getComputedStyle(p).opacity, workers: !!document.getElementById('falcon-workers') }; });
  check(hidden.right < 0 && hidden.opacity === '0' && hidden.workers, `the panel is built for its workers, but off-screen (${JSON.stringify(hidden)})`);

  // a change to the item is reported
  await page.evaluate(() => { const t = window.__falconTest; t.getQueue()[0].status = 'failed'; t.getQueue()[0].error = 'nope'; t.setQueue(t.getQueue()); });
  const last = await until(() => page.evaluate(() => window.__status[window.__status.length - 1]), s => s && s.items[0].status === 'failed');
  check(last.items[0].error === 'nope', 'a failed item comes with its error');

  await page.evaluate(() => document.dispatchEvent(new CustomEvent('falcon:show')));
  const shown = await page.evaluate(() => { const p = document.getElementById('falcon-panel'), r = p.getBoundingClientRect(); return { left: r.left, opacity: getComputedStyle(p).opacity }; });
  check(shown.left >= 0 && shown.opacity === '1', `falcon:show brings the panel on screen (${JSON.stringify(shown)})`);
});
