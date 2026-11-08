// Consolidation (First Contact's hand-off to Mission Control) on a phone: one column,
// the comparison on top, the sources and the inspector under it, the header in two
// rows; nothing cut off at the sides, the page's body pinned under it.
import { test, check, attachShot, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' }, viewport: { width: 360, height: 760 }, deviceScaleFactor: 4, isMobile: true, hasTouch: true });

for (const width of [360, 248]) {
  test(`consolidation fits a ${width}px phone screen`, { tag: ['@sandbox', '@cosmetic'] }, async ({ page, inject }, testInfo) => {
    await page.setViewportSize({ width, height: 760 });
    await page.goto(SANDBOX + '/release/add#mc=phonecons', { waitUntil: 'domcontentloaded' });
    await inject('mission_control', { waitFor: '__mccTest' });
    await page.evaluate(() => {
      const send = (type, data) => document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(data) }));
      const tracks = Array.from({ length: 6 }, (_, i) => ({ title: 'A rather long track title number ' + (i + 1), lengthMs: 180000 + i * 1000, credit: [{ name: 'Various Artists' }] }));
      const rel = { title: 'Black Sabbath Vol. 4 (Super Deluxe Remastered Edition)', barcode: '894231248122', credit: [{ name: 'Black Sabbath' }], labels: [{ name: 'Vertigo', catno: '6360 071' }], types: ['Album'], date: '1972-09-25', country: 'GB', mediums: [{ format: 'Digital Media', tracks }] };
      send('fc:consolidate', { token: 'phonecons', source: 'apple', sourceName: 'Apple Music', url: 'https://music.apple.com/us/album/299006364', rel });
      const cc = window.__mccTest.state();
      cc.pc.state = 'done';
      const url = 'https://www.deezer.com/album/12345';
      cc.sources.push({ key: 'deezer', url, role: 'found', take: true, tracks: null, barcode: null, read: { state: 'reading' } });
      send('mc:read-result', { run: cc.run, url, ok: true, ms: 1, rel: { ...rel, title: 'Black Sabbath Vol. 4 (Remastered)' } });
      // MusicBrainz already has it, linked to many platforms: its row and "This album" carry a dozen icons
      const keys = ['apple', 'spotify', 'deezer', 'tidal', 'qobuz', 'amazon', 'youtube', 'bandcamp', 'beatport', 'napster', 'soundcloud', 'audiomack'];
      keys.slice(2).forEach(k => cc.sources.push({ key: k, url: 'https://example.com/' + k, role: 'found', take: true, tracks: 6, barcode: '894231248122', read: { state: 'done', rel } }));
      cc.inMb = { state: 'done', releases: [{ id: '11111111-2222-3333-4444-555555555555', title: 'Black Savage', disamb: '', date: '2018-06-13', format: 'Digital Media', tracks: 6, barcode: '894231248122', urls: cc.sources.map(s => s.url), same: true }] };
      window.__mccTest.paint();
    });
    await page.waitForSelector('#mcc-root .mcc-f');
    await attachShot(testInfo, page, 'top');
    const r = await page.evaluate(() => {
      const vv = visualViewport, root = document.querySelector('#mcc-root').getBoundingClientRect();
      const sel = '#mcc-root .mcc-inmb *, #mcc-root .mcc-hdr > *, #mcc-root .mcc-side, #mcc-root .mcc-center, #mcc-root .mcc-insp, #mcc-root .mcc-sect, #mcc-root .mcc-f, #mcc-root .mcc-f .i';
      const out = [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length).map(e => [e.className, e.getBoundingClientRect()])
        .filter(([, b]) => b.width && (b.left < vv.offsetLeft - 1 || b.right > vv.offsetLeft + vv.width + 1)).map(([c, b]) => c + ' ' + Math.round(b.left) + '..' + Math.round(b.right));
      const box = s => { const b = document.querySelector(s).getBoundingClientRect(); return [Math.round(b.top), Math.round(b.width)]; };
      return { out, root: [root.width, root.height], vv: [vv.width, vv.height], ttl: box('#mcc-root .mcc-rel'), steps: box('#mcc-root .mcc-steps'), center: box('#mcc-root .mcc-center'), side: box('#mcc-root .mcc-side'), pinned: getComputedStyle(document.body).position };
    });
    console.log(JSON.stringify(r));
    check(r.out.length === 0, `nothing in the header or the columns sticks out of the screen (${r.out.slice(0, 8).join(' · ')})`);
    check(r.root[0] <= r.vv[0] + 1 && r.root[1] <= r.vv[1] + 1, `consolidation is the screen's size (${r.root} on ${r.vv})`);
    check(r.ttl[1] > width * 0.4, `the release title has room (${r.ttl[1]}px)`);
    check(r.steps[0] > r.ttl[0], `the steps sit on a row of their own (${r.steps} under ${r.ttl})`);
    check(r.center[0] < r.side[0] && r.center[1] >= width - 2, `the comparison is on top, full width, the sources under it (${r.center} / ${r.side})`);
    check(r.pinned === 'fixed', 'the page body is pinned while it is open');
    await page.evaluate(() => document.querySelector('#mcc-root [data-cc="more"]').click());
    const menu = await page.evaluate(() => { const m = document.querySelector('#mcc-root .mcc-menu').getBoundingClientRect(); return [Math.round(m.left), Math.round(m.right)]; });
    check(menu[0] >= 0 && menu[1] <= width, `the ▾ menu is on the screen (${menu})`);
    await attachShot(testInfo, page, 'menu');
    await page.evaluate(() => document.querySelector('#mcc-root [data-cc="close"]').click());
    check(await page.evaluate(() => !document.documentElement.classList.contains('mc-open') && getComputedStyle(document.body).position !== 'fixed'), 'closing unpins the page');
  });
}
