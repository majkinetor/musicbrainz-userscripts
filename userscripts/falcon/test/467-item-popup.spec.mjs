// #467 (majkinetor: "When I click the failed label, open its worker alone in a
// popup, let it keep maximize button and show error in header." — then, after
// seeing a text-only version: "I didn't envision item details like this. I
// want to have worker visible there, in its active state.") Reparenting the
// real iframe into a popup was tried and abandoned — moving an iframe element
// to a new parent resets it to about:blank in Chromium (confirmed live),
// destroying the exact state we were trying to preserve. Final design:
// clicking a FAILED/PARTIAL status label jumps to the Workers tab and zooms
// the SAME card that ran it (never moved, never reloaded) — its error now
// shown in a banner right on the card, not just a hover tooltip — reusing the
// card's own maximize/restore toggle. Falls back to a plain text popup
// (url list + error) only when the item was never picked up by any worker.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, idle, frames } from '../../../dev/test/harness.mjs';

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false });

test("#467: item popup", { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
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
  await page.goto('https://test.musicbrainz.org/', { waitUntil: 'load' });
  await requireLogin(page);
  await idle(page);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 5000 });

  // 1. Fallback case: an item that never had a worker (synthetic setQueue) falls
  // back to the plain text popup, and a QUEUED row's status label does nothing.
  await page.evaluate(() => window.__falconTest.setQueue([
    {
      id: 'f1', entityType: 'recording', mbid: 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7',
      urls: [{ url: 'https://sagason.bandcamp.com/track/popuptest', linkTypeId: null }],
      name: 'Beyond the Mists', urlResults: [{ url: 'https://sagason.bandcamp.com/track/popuptest', ok: false, error: 'ambiguous relationship type — use ⇗ to add manually' }],
      status: 'failed', error: 'ambiguous relationship type — use ⇗ to add manually',
    },
    { id: 'q1', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://myspace.com/queuedone', linkTypeId: null }], name: 'Der Zirkel', urlResults: null, status: 'queued', error: '' },
  ]));
  await page.click('.falcon-row-status[data-id="q1"]');
  const popupAfterQueuedClick = await page.evaluate(() => { const el = document.getElementById('falcon-item-popup'); return el ? getComputedStyle(el).display : 'none'; });
  ck(popupAfterQueuedClick === 'none', `clicking a QUEUED row's status label does nothing (popup display="${popupAfterQueuedClick}")`);

  await page.click('.falcon-row-status[data-id="f1"]');
  const popupState = await page.evaluate(() => {
    const el = document.getElementById('falcon-item-popup');
    return {
      display: el ? getComputedStyle(el).display : 'none',
      title: document.getElementById('falcon-item-popup-title')?.textContent,
      error: document.getElementById('falcon-item-popup-error')?.textContent,
      bodyText: document.getElementById('falcon-item-popup-body')?.textContent,
    };
  });
  console.log('fallback popup state:', JSON.stringify(popupState));
  ck(popupState.display === 'flex', `the fallback popup opens (display="${popupState.display}")`);
  ck(/Beyond the Mists/.test(popupState.title) && /FAILED/.test(popupState.title), `the header shows the entity name + status (got "${popupState.title}")`);
  ck(/ambiguous relationship type/.test(popupState.error), `the error is shown prominently (got "${popupState.error}")`);
  ck(/popuptest/.test(popupState.bodyText), `no worker ever ran this item — falls back to the url/error text detail (got "${popupState.bodyText}")`);
  await page.click('#falcon-item-popup-close');
  const closedDisplay = await page.evaluate(() => getComputedStyle(document.getElementById('falcon-item-popup')).display);
  ck(closedDisplay === 'none', `closing the fallback popup hides it (display="${closedDisplay}")`);

  // 2. The REAL case: a genuinely-retired worker exists — clicking its status
  // label jumps to the Workers tab and zooms that SAME card (the actual iframe,
  // never moved/reloaded), with the error shown as a banner right on the card.
  {
    await page.route('**/artist/*/edit*', async (route, request) => {
      if (request.method() === 'POST') { const mbid = (request.url().match(/\/artist\/([0-9a-f-]{36})\/edit/) || [])[1]; return route.fulfill({ status: 302, headers: { Location: `https://test.musicbrainz.org/artist/${mbid}` } }); }
      return route.fallback();
    });
    await page.evaluate(() => {
      window.__falconTest.setQueue([
        { id: 'rej', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://www.facebook.com/derzirkel6665', linkTypeId: null }]   /* on the sandbox's Der Zirkel already */, name: null, urlResults: null, status: 'queued', error: '' },
      ]);
      window.__falconTest.cfg.workers = 1;
    });
    await page.click('#falcon-tab-workers');
    await page.evaluate(() => window.__falconTest.start());
    await page.waitForFunction(() => window.__falconTest.getQueue()[0]?.status === 'failed', null, { timeout: 20000 });
    await frames(page);

    const iframeBefore = await page.evaluate(() => {
      const iframe = document.querySelector('.falcon-worker-card[data-item-id="rej"] iframe');
      let bodyLen = null, url = null;
      // a mark on the loaded page's window: a reload would give a fresh window without it
      // (the page's size is no witness, MusicBrainz keeps rendering into it)
      try { bodyLen = iframe?.contentDocument?.body?.innerHTML?.length; url = iframe?.contentDocument?.location?.href; iframe.contentWindow.__fixtureMark = 'before'; } catch (e) {}
      return { exists: !!iframe, bodyLen, url };
    });
    console.log('iframe before focusing:', JSON.stringify(iframeBefore));
    ck(iframeBefore.exists && iframeBefore.bodyLen > 0, `the retired worker card still has its live, loaded iframe (bodyLen=${iframeBefore.bodyLen})`);

    await page.click('#falcon-tab-queue');
    await page.click('.falcon-row-status[data-id="rej"]');
    await frames(page);

    const afterFocus = await page.evaluate(() => {
      const iframe = document.querySelector('.falcon-worker-card[data-item-id="rej"] iframe');
      let bodyLen = null, url = null, mark = null;
      try { bodyLen = iframe?.contentDocument?.body?.innerHTML?.length; url = iframe?.contentDocument?.location?.href; mark = iframe.contentWindow.__fixtureMark; } catch (e) {}
      const card = document.querySelector('.falcon-worker-card[data-item-id="rej"]');
      return {
        iframeStillSameElement: !!iframe, bodyLen, url, mark,
        activeTab: document.getElementById('falcon-body-workers')?.style.display,
        cardWidth: card?.style.width,
        cardOpacity: card ? getComputedStyle(card).opacity : null,
        bannerVisible: card ? getComputedStyle(card.querySelector('.falcon-worker-errbanner')).display !== 'none' : false,
        bannerText: card?.querySelector('.falcon-worker-errbanner')?.textContent,
        zoomBtnText: card?.querySelector('.falcon-worker-zoom')?.textContent,
      };
    });
    console.log('after focusing the failed item:', JSON.stringify(afterFocus));
    ck(afterFocus.activeTab === 'block', `clicking the status label switches to the Workers tab (display="${afterFocus.activeTab}")`);
    ck(afterFocus.cardWidth === '100%', 'the real card is zoomed (maximized), not shown in a separate popup');
    ck(afterFocus.cardOpacity === '1', 'the zoomed retired card is shown at full opacity, not dimmed, so it is actually readable');
    ck(afterFocus.iframeStillSameElement && afterFocus.mark === 'before' && afterFocus.url === iframeBefore.url, `the iframe is the SAME element with the SAME loaded page — never reloaded (mark ${afterFocus.mark}, bodyLen ${iframeBefore.bodyLen} → ${afterFocus.bodyLen})`);
    ck(afterFocus.bannerVisible && /already present on the entity/i.test(afterFocus.bannerText || ''), `the real error is shown as a banner right on the card (got "${afterFocus.bannerText}")`);
    ck(afterFocus.zoomBtnText === '❐', 'the card keeps its own maximize/restore toggle, now showing "restore"');
  }

  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
});
