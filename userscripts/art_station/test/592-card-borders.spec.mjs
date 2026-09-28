// #592 (majkinetor): "border issue on AS", "mostly visible on smaller sizes",
// "you did changes before, but it still happens that borders are junky",
// "bottom border", "make sure to test it right this time".
//
// It took three passes because there were three separate defects producing one
// symptom, and I fixed them one at a time. This file checks all three at once,
// across tile sizes and card states, so the next one cannot hide behind a fix
// for the others:
//
//   1. the artwork rounded harder than the hole it sat in (9px inside a 9px
//      border → inner radius is 8px), leaving a sliver of card at the top corners
//   2. the size/resolution line could not wrap, so on a small tile it ran past
//      the right border and under the next card
//   3. the type pill's flanking rules drew a SECOND bottom edge 1px above the
//      card's own, stopping at x=9 where the corner curves — the "bottom border"
//
// Geometry is measured, not eyeballed: every check is a number read off the
// rendered page. Nothing is uploaded — write endpoints are asserted unused.
//
// test.musicbrainz.org, read-only.
import { test, check, expect, frames } from '../../../dev/test/harness.mjs';
import { openArtStation } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

test('card borders stay single, concentric and unbroken at every size and state', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  const TILES = ['110px', '120px', '140px', '175px', '260px', '380px'];
  const wrote = [];
  page.on('request', r => {
    if (r.method() !== 'POST' && r.method() !== 'PUT') return;
    if (/\/ws\/2\/|archive\.org|\/cover-art-archive\/|\/edit\//i.test(r.url())) wrote.push(r.method() + ' ' + r.url());
  });
  await openArtStation(page, inject);
  const booted = await page.waitForSelector('.as-card', { timeout: 45000 }).then(() => true).catch(() => false);
  expect(booted, 'the gallery rendered (otherwise every measurement below is vacuous)').toBe(true);

  /* Reads every card and reports, per card:
       thumbRadius/cardRadius/border  — the concentric-corner rule
       overflow                        — any child past the card's inner edge
       bottomLines                     — any thin horizontal element whose ends land
                                         inside the curved bottom corner zone
       pill                            — the type pill still present and centred   */
  const measure = () => page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.as-card').forEach(c => {
      const cs = getComputedStyle(c);
      const cr = c.getBoundingClientRect();
      const rad = parseFloat(cs.borderBottomLeftRadius);
      const bw = parseFloat(cs.borderLeftWidth);
      const th = c.querySelector('.as-thumb');
      const innerR = cr.x + cr.width - bw, innerL = cr.x + bw, botY = cr.y + cr.height;
      let over = 0, overWho = '';
      const bottomLines = [];
      c.querySelectorAll('*').forEach(e => {
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const o = (r.x + r.width) - innerR;
        if (o > over) { over = o; overWho = String(e.className).slice(0, 24); }
        // a hairline sitting on the bottom edge whose end falls in the corner curve
        if (r.height <= 2 && Math.abs((r.y + r.height / 2) - botY) <= 3) {
          const leftIn = r.x - cr.x, rightIn = (cr.x + cr.width) - (r.x + r.width);
          if (leftIn < rad + 0.5 || rightIn < rad + 0.5) bottomLines.push(String(e.className).slice(0, 24));
        }
      });
      const pill = c.querySelector('.as-type');
      const pr = pill && pill.getBoundingClientRect();
      out.push({
        cardRadius: rad, border: bw,
        thumbRadius: th ? parseFloat(getComputedStyle(th).borderTopLeftRadius) : null,
        over: +over.toFixed(1), overWho,
        scroll: c.scrollWidth, client: c.clientWidth,
        bottomLines,
        pill: !!pill,
        pillOffCentre: pr ? +Math.abs((pr.x + pr.width / 2) - (cr.x + cr.width / 2)).toFixed(1) : null,
      });
    });
    return out;
  });
  const setTile = t => page.evaluate(v => document.documentElement.style.setProperty('--as-tile', v), t);

  /* ── 1. concentric corners: inner radius = outer − border ──────────────────── */
  await setTile('175px');
  await frames(page);
  const base = await measure();
  console.log('\nfirst card:', JSON.stringify(base[0]));
  check(base.length > 0, `fixture: ${base.length} card(s) measured`);
  check(base.every(c => c.thumbRadius === c.cardRadius - c.border),
    `the artwork is concentric with the border on every card — inner ${base[0].thumbRadius} = outer ${base[0].cardRadius} − ${base[0].border}`);

  /* ── 2. nothing overflows the card, at any tile size ───────────────────────── */
  for (const tile of TILES) {
    await setTile(tile);
    await frames(page);
    const m = await measure();
    const bad = m.filter(c => c.over > 0.5 || c.scroll > c.client);
    check(bad.length === 0,
      `${tile}: nothing runs past the card's border (${bad.length ? `${bad[0].overWho} by ${bad[0].over}px, scroll ${bad[0].scroll}/${bad[0].client}` : 'all ' + m.length + ' cards clean'})`);
  }

  /* ── 3. one bottom edge, not two ───────────────────────────────────────────── */
  for (const tile of ['120px', '380px']) {
    await setTile(tile);
    await frames(page);
    const m = await measure();
    const doubled = m.filter(c => c.bottomLines.length);
    check(doubled.length === 0,
      `${tile}: the bottom border is drawn once (${doubled.length ? 'also by ' + doubled[0].bottomLines.join(',') : 'no hairline in the corner zone'})`);
    check(m.every(c => c.pill), `${tile}: the type pill is still there`);
    check(m.every(c => c.pillOffCentre !== null && c.pillOffCentre <= 12),
      `${tile}: …and still centred on the bottom edge (off by ${m[0].pillOffCentre}px)`);
  }

  /* ── 4. the states his screenshots were taken in ───────────────────────────── */
  await setTile('380px');
  await frames(page);
  for (const [name, cls] of [['hovered', null], ['selected', 'sel'], ['pending', 'pending'], ['new', 'new']]) {
    if (cls) await page.evaluate(c => document.querySelector('.as-card').classList.add(c), cls);
    else await page.hover('.as-card');
    await frames(page);
    const m = (await measure())[0];
    check(m.over <= 0.5 && m.bottomLines.length === 0 && m.thumbRadius === m.cardRadius - m.border,
      `${name}: still one clean border, concentric, nothing overflowing (over ${m.over}, lines ${m.bottomLines.length})`);
    if (cls) await page.evaluate(c => document.querySelector('.as-card').classList.remove(c), cls);
  }

  check(wrote.length === 0, `nothing was uploaded or submitted (${wrote.length})`);
});
