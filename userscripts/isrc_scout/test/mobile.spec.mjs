// ISRC Scout on a phone: MusicBrainz's page is wider than the screen, so the browser widens the
// layout viewport to it. The window must still fill the screen: nothing cut off at either side, the
// release beside the header's icons, the toolbar one row that scrolls sideways.
import { test, check, attachShot } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' }, viewport: { width: 360, height: 760 }, deviceScaleFactor: 4, isMobile: true, hasTouch: true });

test('the window fits a phone screen', { tag: ['@sandbox', '@cosmetic'] }, async ({ page, inject }, testInfo) => {
  await openScout(page, inject);
  await page.waitForSelector('#ii-table tr[data-idx="0"]');
  await attachShot(testInfo, page, 'open');
  if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + '/is-mobile.png' });
  const r = await page.evaluate(() => {
    const vv = visualViewport, m = document.getElementById('ii-modal').getBoundingClientRect();
    const L = vv.offsetLeft, R = vv.offsetLeft + vv.width;
    const out = [...document.querySelectorAll('#ii-modal *')].filter(e => e.getClientRects().length && !e.closest('.ii-cands, [style*="overflow"], #ii-tools > *, .ii-tl-linked'))
      .map(e => [e.id || e.className, e.getBoundingClientRect()]).filter(([, b]) => b.width && (b.left < L - 1 || b.right > R + 1))
      .map(([c, b]) => c + ' ' + Math.round(b.left) + '..' + Math.round(b.right));
    const z = document.querySelector('#ii-hdr .ii-zen').getBoundingClientRect(), ic = document.querySelector('#ii-hdr .ii-hicons').getBoundingClientRect();
    const zen = { beside: z.right <= ic.left + 1 && z.top < ic.bottom, w: Math.round(z.width) };
    const t = document.getElementById('ii-tools').getBoundingClientRect(), f = document.getElementById('ii-foot').getBoundingClientRect();
    const bars = { tools: Math.round(t.height), foot: Math.round(f.height), hdr: Math.round(document.getElementById('ii-hdr').getBoundingClientRect().height) };
    return { zen, bars, modal: [Math.round(m.left), Math.round(m.right)], vv: [L, R], iw: innerWidth, out };
  });
  console.log(JSON.stringify(r));
  check(r.zen.beside && r.zen.w > 150, `the release sits beside the header's icons (${JSON.stringify(r.zen)})`);
  check(r.bars.tools <= 44 && r.bars.foot <= 48 && r.bars.hdr <= 60, `header, toolbar and footer are one thin row each (${JSON.stringify(r.bars)})`);
  check(r.modal[0] <= r.vv[0] + 1 && r.modal[1] >= r.vv[1] - 1, `the window fills the screen's width (${r.modal} on ${r.vv})`);
  check(r.modal[0] >= r.vv[0] - 1 && r.modal[1] <= r.vv[1] + 1, `the window is on the screen (${r.modal} on ${r.vv})`);
  check(r.out.length === 0, `nothing in it sticks out of the screen (${r.out.slice(0, 8).join(' · ')})`);
});
