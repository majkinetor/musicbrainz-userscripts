// Barcode lookups, on Random Access Memories (barcode 886443984059), with the release's
// HDtracks and Tidal links taken off so the barcode paths have to find them:
//
// #176: HDtracks resolves the album from the barcode search (ObjectId 5e182300…, 13 tracks).
// #182: Tidal resolves the EXACT-barcode album 211822890, not another edition; Spotify is
//       looked up by barcode too (through Wallstream since #602); a Discogs match carries
//       the barcode read from the API's identifiers. Under strict barcode confidence, a
//       link that can't be confirmed is shown greyed and can't be clicked, not as a ✓ that
//       does nothing; an exact-barcode one stays usable.
// #422: the ↻ button is the progress indicator — it spins and can't be clicked while the
//       scans run, then shows the scan time in its tooltip.
//
// test.musicbrainz.org, with production's data and every provider's answers replayed from
// fixtures/ws-182*.json.gz (RECORD_WS=1 re-records).
import { test, check } from '../../../dev/test/harness.mjs';
import { openPc, scansDone, row, logText } from './pc.mjs';

const RAM = 'ec116461-5b0d-4c98-bb44-a4de5de63076';
const links = { drop: /hdtracks\.com|tidal\.com/ };

test.describe('default settings', () => {
  test.use({ gm: { name: 'Platform Check' } });
  test('HDtracks, Tidal and Spotify are found by barcode, and ↻ shows the scan', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
    const ws = await openPc(page, inject, { release: RAM, links, settle: false, replay: new URL('./fixtures/ws-182.json.gz', import.meta.url) });
    const btn = () => page.evaluate(() => { const b = document.getElementById('mb-refresh-btn'); return { spinning: b.classList.contains('pc-scanning'), title: b.title, pe: getComputedStyle(b).pointerEvents }; });
    const busy = await btn();
    await scansDone(page);
    const done = await btn();
    check(busy.spinning && busy.pe === 'none' && /Scanning platforms/.test(busy.title), `#422: while scanning, ↻ spins and can't be clicked (${JSON.stringify(busy)})`);
    check(!done.spinning && done.pe !== 'none', '#422: …and is clickable again once done');
    check(/Refresh — clear cache and re-scan \(last scan: \d+(\.\d+)?s\)/.test(done.title), `#422: the tooltip gives the scan time ("${done.title}")`);
    check(!(await page.evaluate(() => !!document.getElementById('mb-scan-status'))), '#422: no separate status line');

    const log = await logText(page);
    const hd = await row(page, 'hdtracks');
    check(/5e182300c10cf717bb0315f2/.test(hd.url || ''), `#176: HDtracks resolves the album (${hd.url})`);
    check(hd.value === '13' && /pc-st-match/.test(hd.cls), `#176: …a match, with its 13 tracks (${hd.value}, ${hd.cls})`);
    const tidal = await row(page, 'tidal');
    check(/Barcode 886443984059 → album 211822890/.test(log) && /album\/211822890/.test(tidal.url || ''), `#182: Tidal resolves the exact-barcode album (${tidal.url})`);
    check(/Wallstream.*Spotify barcode lookup 886443984059/.test(log), '#182, #602: Spotify is looked up by barcode');
    check(/API detail parsed:.*barcode=\d/.test(log), '#182: the Discogs match carries its barcode');
    // #501: the scan's cache is the page's (localStorage), not synced script storage
    const stored = await page.evaluate(() => ({ gm: GM_listValues().filter(k => /^pc:(cache|mbdata|pending)/.test(k)), ls: Object.keys(localStorage).filter(k => k.startsWith('pc:cache:v2:')).length }));
    check(stored.gm.length === 0 && stored.ls > 0, `#501: the cache is in localStorage (${stored.ls} entries), none in GM storage (${stored.gm.join(', ') || 'none'})`);
    await ws.done();
  });
});

test.describe('strict barcode confidence', () => {
  test.use({ gm: { name: 'Platform Check', values: { 'pc:respect-barcode': true, 'pc:barcode-mode': 'strict' } } });
  test('an unconfirmed link is greyed and inert; an exact-barcode one is not', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    const ws = await openPc(page, inject, { release: RAM, links, replay: new URL('./fixtures/ws-182b.json.gz', import.meta.url) });
    const rows = {};
    for (const p of ['spotify', 'discogs', 'deezer', 'apple', 'tidal', 'qobuz', 'beatport', 'hdtracks']) rows[p] = await row(page, p);
    const blocked = Object.entries(rows).filter(([, r]) => r.blocked);
    check(blocked.length > 0, `#182: under strict, some links are withheld (${blocked.map(([p]) => p).join(', ') || 'none'})`);
    check(blocked.every(([, r]) => !r.clickable), `#182: …and none of them can be clicked (${blocked.filter(([, r]) => r.clickable).map(([p]) => p).join(', ') || 'ok'})`);
    check(!rows.tidal.blocked && /211822890/.test(rows.tidal.url || ''), `#182: the exact-barcode Tidal album is not withheld (${JSON.stringify(rows.tidal)})`);
    // the flash-message anchor, in icon mode: a visible element, not the page corner
    const anchor = await page.evaluate(() => {
      const panel = document.getElementById('mb-pc-panel'); panel.classList.add('pc-icons-mode');
      const ico = panel.querySelector('.pc-row:not(.pc-compacted) .pc-plat-ico');
      const r = ico ? ico.getBoundingClientRect() : { width: 0, height: 0 }; panel.classList.remove('pc-icons-mode');
      return { id: ico && ico.id, visible: r.width > 0 && r.height > 0 };
    });
    check(anchor.visible, `#182: in icon mode, a row message anchors to a visible icon (${anchor.id})`);
    await ws.done();
  });
});
