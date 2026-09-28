// The + button, on the release page: what it queues, and how it opens the editor.
//
// #416: the Discogs MASTER is queued for the release group even when the Discogs RELEASE
//       link is withheld by barcode confidence — a master spans every edition's barcode.
// #556: a ✓ match for a link the release already has, spelled differently (MusicBrainz
//       rewrites URLs as it stores them), is recognised as on the release and not queued.
// #464: + opens the editor in a new tab, or in this one when "Add links in a new tab" is
//       off; right-click opens it in the background (#pc-autocommit), and the opener
//       closes that tab and reloads once it hears "committed".
// #559: the release-group editor (the Discogs master) gets the same background flow, and
//       a release message never closes the release-group tab. Its landing page closes
//       itself; a release-group page never mounts the dashboard.
//
// test.musicbrainz.org. Nothing is submitted, and no editor opens: GM_openInTab and
// window.open are recorded instead. No provider is asked anything, except in #556's test,
// whose scan answers are replayed from fixtures/ws-556-queue.json.gz (RECORD_WS=1 re-records).
import { test, check } from '../../../dev/test/harness.mjs';
import { openPc } from './pc.mjs';

const RAM = 'ec116461-5b0d-4c98-bb44-a4de5de63076';            // on the sandbox as on production; has a barcode
const RAM_RG = 'aa997ea0-2936-40bd-884d-3af8a0e064dc';
const FAKE_RG = '00000000-dead-beef-0000-000000000001';          // an identifier only, never opened
const SANDBOX_RELEASE = `https://test.musicbrainz.org/release/${RAM}`;

// GM_openInTab and window.open, recorded; a fake tab remembers being closed
const recordTabs = page => page.evaluate(() => {
  window.__tabs = []; window.__opened = [];
  window.GM_openInTab = (url, opts) => { const t = { url, opts, closed: false, close() { this.closed = true; sessionStorage.setItem('__fakeTabClosed', url); } }; window.__tabs.push(t); return t; };
  window.open = u => { window.__opened.push(String(u)); return { closed: false, close() {} }; };
});

test.describe('without provider answers', () => {
  test.use({ gm: { name: 'Platform Check', xhr: 'none' } });

  test('#416: the Discogs master is queued even when the release link is withheld', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await openPc(page, inject, { release: RAM, settle: false });
    await page.waitForTimeout(1000);
    await recordTabs(page);
    const out = await page.evaluate(({ mbid, rg }) => {
      // Discogs ✓ with a DIFFERENT barcode and a master; a release group with no master yet
      localStorage.setItem(`pc:cache:v2:discogs:${mbid}`, JSON.stringify({ url: 'https://www.discogs.com/release/4570366', tracks: 13, source: 'search', barcode: '111111111111', format: 'Vinyl', masterUrl: 'https://www.discogs.com/master/556257', _t: Date.now() }));
      localStorage.setItem(`pc:mbdata:${mbid}`, JSON.stringify({ releaseGroupMbid: rg, existing: {}, _t: Date.now() }));
      GM_setValue('pc:respect-barcode', true); GM_setValue('pc:barcode-mode', 'exists');
      document.getElementById('ico-discogs').textContent = '✓';
      document.getElementById('mb-inject-btn').click();
      return { release: localStorage.getItem(`pc:pending:${mbid}`), rg: localStorage.getItem(`pc:pending:rg:${rg}`), opened: window.__opened };
    }, { mbid: RAM, rg: FAKE_RG });
    check(/discogs-master/.test(out.rg || '') && /master\/556257/.test(out.rg || ''), `the master is queued for the release group (${out.rg})`);
    check(!/discogs/.test(out.release || ''), `the release link is withheld: its barcode differs (${out.release})`);
    check(out.opened.some(u => u.includes(`/release-group/${FAKE_RG}/edit`)), `the release-group editor is opened (${out.opened.join(', ')})`);
  });

  test('#464, #559: + opens the editor as set, and right-click in the background', { tag: ['@sandbox', '@critical'] }, async ({ page, context, inject }) => {
    await openPc(page, inject, { release: RAM, settle: false });
    await page.waitForFunction(() => !!window.__pcTest464);
    await recordTabs(page);
    // foreground: a new tab by default; with the setting off, this tab goes to the editor
    const fg = await page.evaluate(mbid => { window.__pcTest464.openReleaseEditTab(mbid, { background: false }); return window.__opened.slice(); }, RAM);
    check(fg.length === 1 && fg[0].endsWith(`/release/${RAM}/edit`), `#464: + opens the editor in a new tab (${fg})`);
    let navigated = null;
    await page.route(`**/release/${RAM}/edit`, r => { navigated = r.request().url(); return r.abort(); });
    await page.evaluate(mbid => { GM_setValue('pc:open-new-tab', false); window.__pcTest464.openReleaseEditTab(mbid, { background: false }); }, RAM).catch(() => {});
    await page.waitForTimeout(500);
    check(navigated === `${SANDBOX_RELEASE}/edit`, `#464: with the setting off, this tab goes to the editor (${navigated})`);
    await page.unroute(`**/release/${RAM}/edit`);

    // background: GM_openInTab, inactive, with the autocommit hash; "committed" closes it and reloads
    await openPc(page, inject, { release: RAM, settle: false });
    await page.waitForFunction(() => !!window.__pcTest464);
    await recordTabs(page);
    const bg = await page.evaluate(mbid => { window.__pcTest464.openReleaseEditTab(mbid, { background: true }); const t = window.__tabs[0]; return t && { url: t.url, opts: t.opts }; }, RAM);
    check(bg && bg.url === `${SANDBOX_RELEASE}/edit#pc-autocommit`, `#464: right-click opens the editor with #pc-autocommit (${bg && bg.url})`);
    check(bg && bg.opts.active === false && bg.opts.insert === true, `#464: …in the background (${JSON.stringify(bg && bg.opts)})`);
    const reloaded = page.waitForEvent('load', { timeout: 5000 }).then(() => true).catch(() => false);
    await page.evaluate(mbid => { const ch = new BroadcastChannel('platform-check-inject'); ch.postMessage({ type: 'pc-edit-committed', mbid }); ch.close(); }, RAM);
    check(await reloaded, '#464: once it hears "committed", the opener reloads');
    check((await page.evaluate(() => sessionStorage.getItem('__fakeTabClosed'))) === `${SANDBOX_RELEASE}/edit#pc-autocommit`, '#464: …having closed the background tab');

    // the release group (#559)
    await inject('platform_check');
    await page.waitForFunction(() => !!window.__pcTest464);
    await recordTabs(page);
    const rg = await page.evaluate(async rg => {
      window.__pcTest464.openRgEditTab(rg, { background: true });
      const t = window.__tabs[0], ch = new BroadcastChannel('platform-check-inject'), wait = ms => new Promise(r => setTimeout(r, ms));
      ch.postMessage({ type: 'pc-edit-committed', mbid: rg }); await wait(400);
      const afterRelease = t.closed;
      ch.postMessage({ type: 'pc-rg-edit-committed', mbid: rg }); await wait(400);
      window.__opened.length = 0; GM_setValue('pc:open-new-tab', true);
      window.__pcTest464.openRgEditTab(rg, { background: false, sameTabAllowed: true });
      return { url: t.url, active: t.opts.active, afterRelease, afterRg: t.closed, fg: window.__opened.slice() };
    }, FAKE_RG);
    check(/\/release-group\/[0-9a-f-]{36}\/edit#pc-autocommit$/.test(rg.url) && rg.active === false, `#559: the release-group editor opens in the background too (${rg.url})`);
    check(!rg.afterRelease, "#559: a release's \"committed\" doesn't close the release-group tab");
    check(rg.afterRg, '#559: …its own does');
    check(rg.fg.length === 1 && /\/release-group\/.*\/edit$/.test(rg.fg[0]), `#559: + opens it in a new tab, without #pc-autocommit (${rg.fg})`);
  });

  test('#464, #559: the page an edit lands on closes itself; a release-group page gets no dashboard', { tag: ['@sandbox'] }, async ({ context, inject }) => {
    const land = async (url, key, mbid) => {
      const p = await context.newPage();
      await p.addInitScript(([key, mbid]) => {
        if (key) try { sessionStorage.setItem(key, mbid); } catch (e) {}
        window.__heard = []; window.__closed = false; window.close = () => { window.__closed = true; };
        try { new BroadcastChannel('platform-check-inject').onmessage = e => window.__heard.push(e.data); } catch (e) {}
      }, [key, mbid]);
      await p.goto(url, { waitUntil: 'domcontentloaded' });
      await inject('platform_check', { target: p });
      await p.waitForTimeout(1500);
      const r = await p.evaluate(key => ({ heard: window.__heard, closed: window.__closed, marker: key && sessionStorage.getItem(key), panel: !!document.getElementById('mb-pc-panel'), modals: document.querySelectorAll('#mb-log-modal-overlay, #mb-provider-modal-overlay').length }), key);
      await p.close();
      return r;
    };
    const rel = await land(SANDBOX_RELEASE, 'pc:autocommit-close', RAM);
    check(rel.heard.some(m => m.type === 'pc-edit-committed' && m.mbid === RAM) && rel.closed, `#464: the release page an edit lands on says "committed" and closes (${JSON.stringify(rel.heard)})`);
    check(!rel.marker && !rel.panel, '#464: …clearing its marker, without mounting the dashboard');
    const rgLand = await land(`https://test.musicbrainz.org/release-group/${RAM_RG}`, 'pc:autocommit-close-rg', RAM_RG);
    check(rgLand.heard.some(m => m.type === 'pc-rg-edit-committed' && m.mbid === RAM_RG) && rgLand.closed, `#559: so does the release-group page (${JSON.stringify(rgLand.heard)})`);
    check(!rgLand.marker, '#559: …clearing its marker, so a later visit stays open');
    const rgPage = await land(`https://test.musicbrainz.org/release-group/${RAM_RG}`, null, null);
    check(!rgPage.panel && rgPage.modals === 0 && !rgPage.closed, `#559: a release-group page gets no dashboard and no modals (${JSON.stringify(rgPage)})`);
  });
});

test.describe('after a scan', () => {
  test.use({ gm: { name: 'Platform Check' } });
  test("#556: + doesn't queue a link the release has, found in another spelling", { tag: ['@sandbox'] }, async ({ page, inject }) => {
    const ESSIEBONS = 'c7f73c79-536e-4b58-8152-a7aad47204c6';   // links Spotify album 2xsS4BkLgZy5EQnpNDncNe
    const ws = await openPc(page, inject, { release: ESSIEBONS, replay: new URL('./fixtures/ws-556-queue.json.gz', import.meta.url) });
    await recordTabs(page);
    // a ✓ Spotify match as a search spelled it (with a locale segment): the link MusicBrainz has
    const queued = await page.evaluate(id => {
      localStorage.setItem(`pc:cache:v2:spotify:${id}`, JSON.stringify({ url: 'https://open.spotify.com/intl-de/album/2xsS4BkLgZy5EQnpNDncNe', tracks: 14, source: 'search', _t: Date.now() }));
      document.getElementById('ico-spotify').textContent = '✓';
      document.getElementById('mb-inject-btn').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      return Object.keys(localStorage).filter(k => k.startsWith('pc:pending')).flatMap(k => Object.values(JSON.parse(localStorage.getItem(k) || '{}')));
    }, ESSIEBONS);
    check(!queued.some(u => /spotify/.test(u)), `it is not queued again (queued: ${JSON.stringify(queued)})`);
    await ws.done();
  });
});
