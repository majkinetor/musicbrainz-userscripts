// #467 (majkinetor: "when worker tab is not open, it doesnt work") — with the
// Queue tab showing, every item failed with "never redirected off /edit" after
// the full 50s, the submit button found and enabled and MB reporting no error;
// opening the Workers tab made the same 3 items finish in 5s.
//
// Cause: the worker iframes lived inside a display:none container. A
// display:none subtree isn't rendered, and the form submission inside it never
// goes anywhere — the click lands on nothing. Fix: never display:none a pane or
// card that has work in flight; park it OFF-SCREEN instead, so it stays laid
// out and fully live while invisible.
//
// This test is the regression guard: run a batch while the Queue tab is the
// active one (i.e. Workers pane hidden) and require it to commit normally.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, idle } from '../../../dev/test/harness.mjs';
import { join } from 'node:path';

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false });

test("#467: hidden workers", { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');

  await context.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  const ck = check;

  const errs = []; page.on('pageerror', e => errs.push(e.message));
  let posts = 0;
  await page.route('**/artist/*/edit*', async (route, request) => {
    if (request.method() === 'POST') { posts++; const m = request.url().match(/\/artist\/([0-9a-f-]{36})\/edit/); return route.fulfill({ status: 302, headers: { Location: `https://test.musicbrainz.org/artist/${m[1]}` } }); }
    return route.fallback();
  });
  await page.goto('https://test.musicbrainz.org/', { waitUntil: 'load' });
  await requireLogin(page);
  await idle(page);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 5000 });

  // The reported scenario is stronger than "on the Queue tab": the user never
  // clicks ANY tab, so the panes keep whatever the initial markup gave them. That
  // markup used to hand the Workers pane display:none, which meant workers only
  // ran once you'd visited the Workers tab at least once. So do NOT click a tab
  // here — assert straight from the freshly-opened panel.
  const paneState = await page.evaluate(() => {
    const w = document.getElementById('falcon-body-workers');
    const cs = getComputedStyle(w);
    return { display: cs.display, position: cs.position, left: cs.left };
  });
  console.log('workers pane while on Queue tab:', JSON.stringify(paneState));
  ck(paneState.display !== 'none', 'the Workers pane is NOT display:none while hidden (that would kill submits)');
  ck(paneState.position === 'absolute' && parseInt(paneState.left) < -1000, `it is parked off-screen instead (left=${paneState.left})`);

  await page.evaluate(() => {
    window.__falconTest.setQueue([
      { id: 'h1', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://myspace.com/falcon-hidden-1', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' },
      { id: 'h2', entityType: 'artist', mbid: '5441c29d-3602-4898-b1a1-b77fa23b8e50', urls: [{ url: 'https://myspace.com/falcon-hidden-2', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' },
    ]);
    window.__falconTest.cfg.workers = 2;
  });
  const t0 = Date.now();
  await page.evaluate(() => window.__falconTest.start());
  await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 60000 }).catch(() => {});
  const elapsed = Date.now() - t0;
  const q = await page.evaluate(() => window.__falconTest.getQueue().map(i => ({ id: i.id, status: i.status, error: i.error })));
  console.log('elapsed', elapsed, 'ms; queue:', JSON.stringify(q));
  ck(q.every(i => i.status === 'done'), `both items commit with the Workers tab never opened (${q.map(i => i.status).join(', ')})`);
  ck(posts === 2, `both real submits actually left the browser (got ${posts})`);
  ck(elapsed < 30000, `and they landed promptly rather than timing out at 25s+ per attempt (${elapsed}ms)`);

  // the tab we were on must still be the visible one — the fix must not yank focus
  const stillQueue = await page.evaluate(() => getComputedStyle(document.getElementById('falcon-body-queue')).display);
  ck(stillQueue !== 'none', 'the Queue tab stayed the visible one throughout');

  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
});
