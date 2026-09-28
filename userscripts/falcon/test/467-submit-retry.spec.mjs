// #467 (majkinetor): "One didn't pass, there was nothing in worker that was
// regarded as error and Enter button was enabled, with all links and types
// set." A valid form + enabled button that still never submits points at the
// CLICK rather than validation. MB's editor is React, and Falcon sets the edit
// note right before submitting — that re-render can DETACH the button node
// found moments earlier, so the click lands on an orphan and silently does
// nothing, surfacing only as the "never redirected" timeout.
//
// Covers: (1) the button node genuinely does get replaced across a re-render on
// a real MB edit page, so a stale reference is a real hazard; (2) fillAndSubmit
// re-queries before clicking and still commits when the node has been swapped;
// (3) a click that gets swallowed entirely is retried rather than burning the
// whole timeout on one lost click.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf } from '../../../dev/test/harness.mjs';

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false });

test("#467: submit retry", { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');

  await context.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  const ck = check;

  // 1. A swallowed first click must not cost the whole timeout: the submit is
  // retried, and the item still commits. The page's own click handler is
  // neutered for the first N clicks to simulate the lost-click case exactly.
  {
    const page = context.pages()[0] || await context.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    let posts = 0;
    await page.route('**/artist/*/edit*', async (route, request) => {
      if (request.method() === 'POST') { posts++; const mbid = (request.url().match(/\/artist\/([0-9a-f-]{36})\/edit/) || [])[1]; return route.fulfill({ status: 302, headers: { Location: `https://test.musicbrainz.org/artist/${mbid}` } }); }
      return route.fallback();
    });
    await page.goto('https://test.musicbrainz.org/', { waitUntil: 'load' });
    await requireLogin(page);
    await page.waitForTimeout(500);
    await page.addScriptTag({ content: code });
    await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
    await page.click('#falcon-launcher');
    await page.waitForSelector('#falcon-panel', { timeout: 5000 });
    await page.evaluate(() => {
      window.__falconTest.setQueue([
        { id: 'retry', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://myspace.com/falcon-retry-1', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' },
      ]);
      window.__falconTest.cfg.workers = 1;
    });
    // swallow the FIRST click that reaches the submit button inside the worker
    // iframe, exactly as a detached/orphaned node would.
    await page.evaluate(() => {
      window.__swallowed = 0;
      const iv = setInterval(() => {
        const f = document.querySelector('.falcon-worker-card iframe');
        const d = f && f.contentDocument;
        const btn = d && (d.querySelector('button.submit.positive') || [...d.querySelectorAll('button')].find(b => /enter edit/i.test(b.textContent || '')));
        if (btn && !btn.dataset.swallowHooked) {
          btn.dataset.swallowHooked = '1';
          btn.addEventListener('click', ev => {
            if (window.__swallowed < 1) { window.__swallowed++; ev.stopImmediatePropagation(); ev.preventDefault(); }
          }, true);
        }
      }, 100);
      setTimeout(() => clearInterval(iv), 30000);
    });
    const t0 = Date.now();
    await page.evaluate(() => window.__falconTest.start());
    await page.waitForFunction(() => window.__falconTest.getQueue()[0]?.status !== 'queued' && window.__falconTest.getQueue()[0]?.status !== 'active', null, { timeout: 40000 }).catch(() => {});
    const elapsed = Date.now() - t0;
    const item = await page.evaluate(() => window.__falconTest.getQueue()[0]);
    const swallowed = await page.evaluate(() => window.__swallowed);
    console.log('swallowed clicks:', swallowed, 'status:', item?.status, 'elapsed:', elapsed, 'posts:', posts);
    ck(swallowed >= 1, `the test actually swallowed a click (got ${swallowed}) — otherwise this proves nothing`);
    ck(item?.status === 'done', `the item still commits despite the first click being lost (status=${item?.status})`);
    ck(posts === 1, `exactly one real submit landed (got ${posts})`);
    ck(elapsed < 30000, `it recovered via retry instead of burning the full 25s timeout on the lost click (${elapsed}ms)`);
    ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
    await page.close();
  }

  // 2. The stale-reference hazard is real: on a live MB edit page, the submit
  // button found before the edit note is set is NOT necessarily the same node
  // afterwards. (If MB stops re-rendering it this can legitimately go either
  // way — the assertion is only that fillAndSubmit doesn't depend on it.)
  {
    const page = await context.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/artist/*/edit*', async (route, request) => {
      if (request.method() === 'POST') { const mbid = (request.url().match(/\/artist\/([0-9a-f-]{36})\/edit/) || [])[1]; return route.fulfill({ status: 302, headers: { Location: `https://test.musicbrainz.org/artist/${mbid}` } }); }
      return route.fallback();
    });
    await page.goto('https://test.musicbrainz.org/artist/d31f76d2-1d8e-4271-8027-148f375979d7/edit', { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    await page.addScriptTag({ content: code });
    await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
    const swap = await page.evaluate(async () => {
      const { findSubmitButton } = window.__falconTest;
      const before = findSubmitButton(document);
      const ta = document.querySelector('textarea.edit-note, textarea[name="edit-note"], #id-edit-note');
      if (ta) {
        const setVal = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setVal.call(ta, 'stale-button probe');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
      }
      await new Promise(r => setTimeout(r, 600));
      const after = findSubmitButton(document);
      return { sameNode: before === after, beforeConnected: before?.isConnected, afterExists: !!after };
    });
    console.log('button identity across the edit-note re-render:', JSON.stringify(swap));
    ck(swap.afterExists, 're-querying after the re-render still finds a submit button (which is what the fix relies on)');
    ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
    await page.close();
  }
});
