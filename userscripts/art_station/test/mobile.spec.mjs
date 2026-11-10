// Art Station on a phone: MusicBrainz's page is 780px wide there (body min-width), wider than the
// screen. Art Station's own area keeps to the screen's width, so its toolbar and covers need no
// scroll to the side; the rest of MusicBrainz's page stays as it is.
import { test, check, until, idle, attachShot, SANDBOX } from '../../../dev/test/harness.mjs';
import { RELEASE, artLoaded } from './as.mjs';

test.use({ gm: { name: 'Art Station' }, viewport: { width: 414, height: 846 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

test('the cover-art page fits a phone screen', { tag: ['@sandbox', '@cosmetic'] }, async ({ page, inject }, testInfo) => {
  await page.goto(`${SANDBOX}/release/${RELEASE}/cover-art`, { waitUntil: 'domcontentloaded' });
  await idle(page);
  await inject('art_station');
  await page.waitForSelector('#as-root .as-bar');
  await artLoaded(page);
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
  // a touch screen's bigger tap padding once squeezed the card's round trash icon to nothing
  const rm = await page.evaluate(() => { const b = document.querySelector('#as-root .as-rmone'), i = b && b.querySelector('svg'); return b && { b: Math.round(b.getBoundingClientRect().width), i: Math.round(i.getBoundingClientRect().width), op: getComputedStyle(b).opacity }; });
  check(rm && rm.i >= 14 && rm.b >= 34 && rm.op === '1', `each card shows its trash icon (${JSON.stringify(rm)})`);
  const barH = await page.evaluate(() => Math.round(document.querySelector('#as-root .as-bar').getBoundingClientRect().height));
  check(barH <= 50, `the toolbar is one row (${barH}px)`);
  // a selection turns the whole bar into the selection bar, still one row; ← brings the normal bar back
  await page.evaluate(() => document.querySelector('#as-root .as-selall').click());
  const sb = await page.evaluate(() => { const b = document.querySelector('#as-root .as-bar'), v = e => e && e.getClientRects().length > 0;
    return { h: Math.round(b.getBoundingClientRect().height), back: v(b.querySelector('.as-selback')), more: v(b.querySelector('.as-selmore')), add: v(b.querySelector('.as-add')), right: Math.round(b.querySelector('.as-selmore').getBoundingClientRect().right), vw: document.documentElement.clientWidth }; });
  if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + '/as-mobile-sel.png' });
  check(sb.h <= 50 && sb.back && sb.more && !sb.add && sb.right <= sb.vw, `the selection bar is one row with ← and ⋯ (${JSON.stringify(sb)})`);
  await page.click('#as-root .as-selmore');
  const acts = await page.locator('.as-more-pop button').evaluateAll(a => a.map(b => b.dataset.a).filter(a => a !== 'rep').join());   // a phone's ⋯ also takes Report (30b9eb29)
  check(acts === 'all,inv,clr', `the ⋯ menu holds select all, invert and clear (${acts})`);
  await page.click('.as-more-pop [data-a=inv]');
  check(await page.locator('#as-root .as-selback').count() === 0, 'inverting a full selection empties it');
  await page.evaluate(() => document.querySelector('#as-root .as-selall').click());
  await page.click('#as-root .as-selback');
  check(await page.evaluate(() => document.querySelector('#as-root .as-add').getClientRects().length > 0), '← brings the normal bar back');
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

// the detailed view on a phone: the types go under the image, two or three to a line, not one long column beside it
test('the detailed view fits a phone screen', { tag: ['@sandbox', '@cosmetic'] }, async ({ page, inject }, testInfo) => {
  await page.goto(`${SANDBOX}/release/${RELEASE}/cover-art`, { waitUntil: 'domcontentloaded' });
  await idle(page);
  await inject('art_station');
  await page.waitForSelector('#as-root .as-bar');
  await artLoaded(page);
  await page.evaluate(() => document.querySelector('#as-root .as-view').click());
  await page.click('.as-view-pop input[value=detailed]');
  await page.waitForSelector('#as-root .as-drow .as-dtypes');
  await page.evaluate(() => document.querySelectorAll('.as-pop').forEach(p => p.remove()));
  await idle(page);
  await attachShot(testInfo, page, 'detailed');
  if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + '/as-mobile-detailed.png' });
  const r = await page.evaluate(() => {
    const row = document.querySelector('#as-root .as-drow:not(.del)'), th = row.querySelector('.as-dthumb').getBoundingClientRect(), ty = row.querySelector('.as-dtypes').getBoundingClientRect();
    const tops = new Set([...row.querySelectorAll('.as-dtypes label')].map(l => Math.round(l.getBoundingClientRect().top)));
    return { under: ty.top >= th.bottom, lines: tops.size, n: row.querySelectorAll('.as-dtypes label').length, right: Math.round(row.getBoundingClientRect().right), vw: document.documentElement.clientWidth };
  });
  console.log(JSON.stringify(r));
  check(r.under, 'the types sit under the image');
  check(r.lines <= Math.ceil(r.n / 2), `the types take two or more to a line (${r.lines} lines for ${r.n})`);
  check(r.right <= r.vw, `the row stays on the screen (${r.right} ≤ ${r.vw})`);
  // the view is a saved setting: put the grid back for the specs after this one
  await page.evaluate(() => document.querySelector('#as-root .as-view').click());
  await page.click('.as-view-pop input[value=grid]');
});
