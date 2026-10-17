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
  await page.evaluate(() => document.querySelector('#mc-launch').click());
  await page.waitForSelector('#mc-root .mc-tbl');
  await page.waitForFunction(() => !document.querySelector('#mc-root .mc-hdr.mc-busy'), null, { timeout: 60_000 }).catch(() => {});
  await attachShot(testInfo, page, 'open');
  const r = await page.evaluate(() => {
    const vv = visualViewport, root = document.querySelector('#mc-root').getBoundingClientRect();
    const out = [...document.querySelectorAll('#mc-root .mc-hdr *, #mc-root .mc-sect')].filter(e => !e.parentElement.closest('.mc-steps') && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => [e.className, e.getBoundingClientRect()]).filter(([, b]) => b.width && (b.left < vv.offsetLeft - 1 || b.right > vv.offsetLeft + vv.width + 1)).map(([c, b]) => c + ' ' + Math.round(b.left) + '..' + Math.round(b.right));
    const st = document.querySelector('#mc-root .mc-steps');
    return { steps: [st.scrollWidth, st.clientWidth, getComputedStyle(st).overflowX], root: [root.left, root.width, root.height], vv: [vv.offsetLeft, vv.width, vv.height, vv.scale], out };
  });
  console.log(JSON.stringify(r));
  check(r.out.length === 0, `nothing in the header or the cards sticks out of the screen (${r.out.slice(0, 8).join(' · ')})`);
  check(r.root[1] <= r.vv[1] + 1 && r.root[2] <= r.vv[2] + 1, `MC is the screen's size (${r.root} on ${r.vv})`);
  check(r.steps[0] <= r.steps[1] || r.steps[2] === 'auto', `the steps scroll sideways when they don't fit (${r.steps})`);
  await page.evaluate(() => document.querySelector('#mc-root [data-act=cfg]').click());
  await page.waitForSelector('.mbu-ov, .mc-cfg');
  await attachShot(testInfo, page, 'settings');
});
