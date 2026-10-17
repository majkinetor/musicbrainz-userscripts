// Mission Control on a phone: MusicBrainz's page is laid out for a desktop, so
// MC must fit itself to the screen, not to the page: nothing cut off at the sides,
// the header readable, the track table scrolls inside its card.
import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' }, viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';

test('MC fits a phone screen', { tag: ['@sandbox', '@cosmetic'] }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  const vp = await page.evaluate(() => ({ iw: innerWidth, vv: visualViewport.width, scale: visualViewport.scale, meta: (document.querySelector('meta[name=viewport]') || {}).content || null }));
  console.log('viewport', JSON.stringify(vp));
  // a stand-in Platform Check: two barcodes, each found by several platforms, so a lane has a row of icons and "take all in"
  await page.evaluate(() => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    const plats = ['spotify', 'apple', 'deezer', 'tidal', 'qobuz'];
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => send('mc:findings', { id: 'pc', run: d.run, barcode: null, findings: [
        { key: 'barcode:859740752799', kind: 'barcode', name: 'Barcode', code: '859740752799', state: 'new', why: 'from Spotify', platforms: plats },
        ...plats.map((k, i) => ({ key: k, name: k, url: 'https://example.com/' + k + '/1', state: i ? 'new' : 'linked', barcode: '859740752799' })),
        ...['bandcamp', 'youtube', 'amazon'].map(k => ({ key: k, name: k, url: 'https://example.com/' + k + '/2', state: 'new' }))] }), 50);
    });
    send('mc:provider', { id: 'pc', name: 'Platform Check', version: 1, capabilities: ['probe', 'apply'] });
  });
  await page.evaluate(() => document.querySelector('#mc-launch').click());
  await page.waitForSelector('#mc-root .mc-tbl');
  await page.evaluate(() => document.querySelector('#mc-root [data-act="probe"]').click());
  await page.waitForSelector('#mc-root [data-card="pc"] .mc-bcl');
  await page.waitForFunction(() => !document.querySelector('#mc-root .mc-hdr.mc-busy'), null, { timeout: 60_000 }).catch(() => {});
  await attachShot(testInfo, page, 'open');
  const r = await page.evaluate(() => {
    const vv = visualViewport, root = document.querySelector('#mc-root').getBoundingClientRect();
    const out = [...document.querySelectorAll('#mc-root .mc-hdr *, #mc-root .mc-sect, #mc-root .mc-bcl > *')].filter(e => !e.parentElement.closest('.mc-steps') && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => [e.className, e.getBoundingClientRect()]).filter(([, b]) => b.width && (b.left < vv.offsetLeft - 1 || b.right > vv.offsetLeft + vv.width + 1)).map(([c, b]) => c + ' ' + Math.round(b.left) + '..' + Math.round(b.right));
    const st = document.querySelector('#mc-root .mc-steps');
    const lanes = [...document.querySelectorAll('#mc-root .mc-bcl')].map(l => { const ic = l.querySelector('.mc-bcl-ic').getBoundingClientRect(); return [Math.round(ic.width), Math.round(ic.height), Math.round(l.getBoundingClientRect().right)]; });
    const ttl = document.querySelector('#mc-root .mc-ttl').getBoundingClientRect().width;
    return { lanes, ttl, steps: [st.scrollWidth, st.clientWidth, getComputedStyle(st).overflowX], root: [root.left, root.width, root.height], vv: [vv.offsetLeft, vv.width, vv.height, vv.scale], out };
  });
  console.log(JSON.stringify(r));
  check(r.lanes.length && r.lanes.every(([w, h]) => h < 40 && w > 100), `a lane's platform icons sit on one line (${JSON.stringify(r.lanes)})`);
  check(r.ttl > 200, `the release title has room (${r.ttl}px)`);
  await page.evaluate(() => document.querySelector('#mc-root [data-card="pc"]').scrollIntoView());
  check(r.out.length === 0, `nothing in the header or the cards sticks out of the screen (${r.out.slice(0, 8).join(' · ')})`);
  check(r.root[1] <= r.vv[1] + 1 && r.root[2] <= r.vv[2] + 1, `MC is the screen's size (${r.root} on ${r.vv})`);
  check(r.steps[1] > 200 && (r.steps[0] <= r.steps[1] || r.steps[2] === "auto"), `the steps have a row of their own and scroll sideways (${r.steps})`);
  await page.evaluate(() => document.querySelector('#mc-root [data-act=cfg]').click());
  await page.waitForSelector('.mbu-ov, .mc-cfg');
  await attachShot(testInfo, page, 'settings');
});
