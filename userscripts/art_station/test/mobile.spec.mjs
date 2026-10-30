// Art Station on a phone: MusicBrainz's page is 780px wide there (body min-width), wider than the
// screen. Art Station's own area keeps to the screen's width, so its toolbar and covers need no
// scroll to the side; the rest of MusicBrainz's page stays as it is.
import { test, check, until, idle, attachShot, SANDBOX } from '../../../dev/test/harness.mjs';
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
  const barH = await page.evaluate(() => Math.round(document.querySelector('#as-root .as-bar').getBoundingClientRect().height));
  check(barH <= 100, `the toolbar is compact, two rows at most (${barH}px)`);
  check(r.out.length === 0, `nothing of Art Station's runs past the screen's right edge (${r.vw}px: ${r.out.slice(0, 8).join(' · ')})`);

  // full screen: the viewer covers the screen, not the page's 780px, and closing it puts the page back where it was
  // the sandbox release's page can be just one screen tall: give it room to scroll, or there is no place to put back
  await page.evaluate(() => { const s = document.createElement('div'); s.style.height = '2000px'; document.body.appendChild(s); scrollTo(0, 400); });
  check(await page.evaluate(() => Math.round(scrollY)) === 400, 'the page is scrolled before full screen opens');
  await page.evaluate(() => document.querySelector('#as-root .as-thumb').click());
  await page.waitForSelector('#as-lb .as-lb-img', { state: 'visible' });
  const lb = await page.evaluate(() => { const o = document.getElementById('as-lb').getBoundingClientRect(), vv = visualViewport; return { lb: [Math.round(o.left), Math.round(o.right)], iw: innerWidth, vv: [vv.offsetLeft, vv.width] }; });
  const corner = await until(() => page.evaluate(() => { const l = document.querySelector('[data-mb-corner="br"]'); if (!l || getComputedStyle(l).display === 'none') return { ok: true }; const b = l.getBoundingClientRect(); return { ok: b.right > innerWidth - 80 && b.bottom > innerHeight - 200, b: [Math.round(b.left), Math.round(b.top)], iw: innerWidth }; }), v => v.ok);
  check(corner.ok, `the corner launcher stays in the screen's corner while the page is pinned (${JSON.stringify(corner)})`);
  if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + '/as-lb.png' });
  check(lb.lb[0] === 0 && lb.lb[1] === lb.vv[1] && lb.vv[0] === 0, `full screen covers the screen (${JSON.stringify(lb)})`);
  await page.keyboard.press('Escape');
  check(await page.evaluate(() => Math.round(scrollY)) === 400, 'closing it puts the page back where it was');
});
