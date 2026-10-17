// Art Station on a phone: MusicBrainz's page is 780px wide there (body min-width), wider than the
// screen. Art Station's own area keeps to the screen's width, so its toolbar and covers need no
// scroll to the side; the rest of MusicBrainz's page stays as it is.
import { test, check, idle, attachShot, SANDBOX } from '../../../dev/test/harness.mjs';
import { RELEASE } from './as.mjs';

test.use({ gm: { name: 'Art Station' }, viewport: { width: 414, height: 846 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

test('the cover-art page fits a phone screen', { tag: ['@sandbox', '@cosmetic'] }, async ({ page, inject }, testInfo) => {
  await page.goto(`${SANDBOX}/release/${RELEASE}/cover-art`, { waitUntil: 'domcontentloaded' });
  await idle(page);
  await inject('art_station');
  await page.waitForSelector('#as-root .as-bar');
  await idle(page);
  await attachShot(testInfo, page, 'cover-art');
  if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + '/as-mobile.png' });
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [...document.querySelectorAll('#as-root, #as-root *')].filter(e => e.getClientRects().length && !e.closest('.as-sc, [style*="overflow"]'))
      .map(e => [e.id || String(e.className).slice(0, 30), e.getBoundingClientRect()]).filter(([, b]) => b.width && b.right > vw + 1)
      .map(([c, b]) => c + ' ' + Math.round(b.left) + '..' + Math.round(b.right));
    const tops = [...document.querySelectorAll('#as-root .as-grid')][0] ? [...[...document.querySelectorAll('#as-root .as-grid')][0].querySelectorAll(':scope > .as-card')].slice(0, 2).map(c => Math.round(c.getBoundingClientRect().top)) : [];
    const c0 = document.querySelector('#as-root .as-card'), g0 = document.querySelector('#as-root .as-grid');
    return { cw: c0 && c0.getBoundingClientRect().width, gw: g0 && g0.getBoundingClientRect().width, tops, vw, cards: document.querySelectorAll('#as-root .as-card').length, out };
  });
  console.log(JSON.stringify(r));
  check(r.tops.length < 2 || r.tops[0] === r.tops[1], `two covers to a row (${r.tops})`);
  check(r.out.length === 0, `nothing of Art Station's runs past the screen's right edge (${r.vw}px: ${r.out.slice(0, 8).join(' · ')})`);
});
