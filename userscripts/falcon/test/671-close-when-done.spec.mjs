// Platform Check's "Close Falcon after a successful import" (falcon:run with closeWhenDone):
// the run that asked for it closes the panel when every item is done, and the corner icon
// turns the same green as a page reloaded after a clean Harmony import (#588). A failed
// item leaves the panel open and the icon as it was.
//
// The release page is a fixture, routed on one narrow regex.
import { readFile } from 'node:fs/promises';
import { test, check, sourceOf } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

test('closeWhenDone: the panel closes after a clean run, and the icon turns green', { tag: ['@sandbox'] }, async ({ context }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');
  await context.route(/^https:\/\/test\.musicbrainz\.org\/release\//, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><head><meta charset="utf-8"></head><body><h1>A Release</h1></body></html>' }));
  const open = async () => {
    const page = await context.newPage();
    await page.addInitScript(() => {
      const store = new Map();
      window.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
      window.GM_setValue = (k, v) => store.set(k, v);
      window.GM_deleteValue = k => store.delete(k);
      window.GM_info = { script: { name: 'Falcon', version: 't' } };
      window.GM_xmlhttpRequest = () => {};
    });
    page.on('load', () => { page.addScriptTag({ content: code }).catch(() => {}); });
    await page.goto('https://test.musicbrainz.org/release/20b03c7d-9e8a-42b9-8a96-bcc9564de034', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__falconTest, null, { timeout: 15000 });
    return page;
  };
  const finish = (page, statuses) => page.evaluate(ss => {
    const t = window.__falconTest;
    t.showPanel();   // the panel is open, so the tokens are on the page: the case that came out a different green
    t.setQueue(ss.map((status, i) => ({ id: 'f' + i, entityType: 'artist', mbid: `1111111${i}-1111-4111-8111-111111111111`, urls: [{ url: 'https://x.y/' + i }], aliases: [], cover: [], isrcs: [], name: 'A' + i, status, error: status === 'failed' ? 'nope' : '' })));
    t.setCloseWhenDone(true);
    t.maybeClosePanelAfterRun();
    const l = document.getElementById('falcon-launcher');
    return { panel: getComputedStyle(document.getElementById('falcon-panel')).display, bg: l && getComputedStyle(l).backgroundColor, launchers: document.querySelectorAll('#falcon-launcher').length };
  }, statuses);

  const clean = await open();
  const ok = await finish(clean, ['done', 'skipped']);
  check(ok.panel === 'none', `a clean run: the panel closes (${ok.panel})`);
  check(ok.bg === 'rgb(31, 157, 107)' && ok.launchers === 1, `…and the one icon wears #588's green, #1f9d6b (${ok.bg}, ${ok.launchers} launcher(s))`);
  await clean.evaluate(() => document.documentElement.setAttribute('data-mbu-theme', 'dark'));
  check(await clean.evaluate(() => getComputedStyle(document.getElementById('falcon-launcher')).backgroundColor) === 'rgb(31, 157, 107)', 'the same green in the dark theme');
  await clean.close();

  const failed = await open();
  const bad = await finish(failed, ['done', 'failed']);
  check(bad.panel !== 'none' && bad.bg !== 'rgb(31, 157, 107)', `a failed item: the panel stays open and the icon as it was (${bad.panel}, ${bad.bg})`);
  await failed.close();
});

test('Esc closes the panel, an item popup over it first, and not while typing in the page', { tag: ['@sandbox'] }, async ({ context }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');
  await context.route(/^https:\/\/test\.musicbrainz\.org\/release\//, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><head><meta charset="utf-8"></head><body><h1>A Release</h1><input id="page-field"></body></html>' }));
  const page = await context.newPage();
  await page.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
    window.GM_xmlhttpRequest = () => {};
  });
  page.on('load', () => { page.addScriptTag({ content: code }).catch(() => {}); });
  await page.goto('https://test.musicbrainz.org/release/20b03c7d-9e8a-42b9-8a96-bcc9564de034', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__falconTest, null, { timeout: 15000 });
  const shown = () => page.evaluate(() => getComputedStyle(document.getElementById('falcon-panel')).display !== 'none');
  const popup = () => page.evaluate(() => { const p = document.getElementById('falcon-item-popup'); return !!p && p.style.display !== 'none'; });

  await page.evaluate(() => window.__falconTest.showPanel());
  await page.focus('#page-field');
  await page.keyboard.press('Escape');
  check(await shown(), "Esc while typing in the page's own field leaves the panel open");

  await page.evaluate(() => {
    const t = window.__falconTest;
    t.setQueue([{ id: 'f0', entityType: 'artist', mbid: '11111110-1111-4111-8111-111111111111', urls: [{ url: 'https://x.y/0' }], aliases: [], cover: [], isrcs: [], name: 'A', status: 'failed', error: 'nope' }]);
    t.showItemPopup(t.getQueue()[0]);
    document.activeElement.blur();
  });
  check(await popup(), 'fixture: an item popup is open over the panel');
  await page.keyboard.press('Escape');
  check(!await popup() && await shown(), 'the first Esc closes the item popup, not the panel');
  await page.keyboard.press('Escape');
  check(!await shown(), 'the next Esc closes the panel');
});
