// #619 (chaban-mb): "The lengths are off by more than 5 seconds and on hover it says 'Holds
// together at the strict cutoff'" — a group held together by AcoustID/title/artist showed all
// green, with only a faded Length chip hinting that 4:53 vs 4:38 is 15 s apart.
//
// test.musicbrainz.org, nothing merged: two groups built from sandbox recordings with their
// lengths set to the issue's case (4:53 / 4:38 → 15 s, tolerance 5 s) and to a within-
// tolerance pair (3:20 / 3:22). The first must show the amber Length chip, the "⚠ 15s" badge,
// the off row's amber length cell and the tooltip note; the second none of it.
// FUSION_SRC=<old build> to watch it stay silent.
import { test, check, requireLogin, mbJson } from '../../../dev/test/harness.mjs';

test.use({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2, gm: { name: 'Fusion' } });

test('lengths outside tolerance warn in the chip, the badge, the row and the tooltip', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  // four sandbox recordings (any — their lengths are set in the page)
  const gids = (await mbJson('https://test.musicbrainz.org/ws/2/recording?query=arid:c321a13a-1c52-43c0-b60a-3a454cb7f9a2&limit=8&fmt=json')).recordings.map(x => x.id).slice(0, 4);
  await page.goto(`https://test.musicbrainz.org/recording/${gids[0]}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await requireLogin(page);
  await inject('fusion', { waitFor: '__fusion' });
  const ids = await page.evaluate(async (gids) => {
    const F = window.__fusion;
    await F.openFusion();
    F.clearBoard();
    const recs = [];
    for (const g of gids) { const r = await F.fetchRecordingByGid(g); F.addToPool(r); recs.push(r); }
    const setLen = (r, ms) => { r.length = ms; const st = F.STATE.recordings.get(r.gid); if (st) st.length = ms; };   // Fusion's own record, not a copy
    setLen(recs[0], 293000); setLen(recs[1], 278000);   // 4:53 / 4:38 — the issue
    setLen(recs[2], 200000); setLen(recs[3], 202000);   // 3:20 / 3:22 — within 5 s
    const g1 = F.createGroupWithMember(recs[0].gid); F.addToGroup(recs[1].gid, g1.id); g1.target = recs[0].gid;
    const g2 = F.createGroupWithMember(recs[2].gid); F.addToGroup(recs[3].gid, g2.id); g2.target = recs[2].gid;
    F.renderAll();
    return { g1: g1.id, g2: g2.id, off: recs[1].gid };
  }, gids);
  await page.waitForTimeout(800);
  const card = id => page.evaluate(([id, off]) => {
    const c = document.querySelector(`.fs-gcard[data-gid="${id}"]`); if (!c) return null;
    const chip = [...c.querySelectorAll('.fs-sig span')].find(s => /Length/.test(s.textContent));
    const offRow = c.querySelector(`.fs-grow[data-gid="${off}"] .fs-len`);
    return { chipWarn: !!(chip && chip.classList.contains('warn')), chipTitle: chip ? chip.title : '', badge: (c.querySelector('.fs-lenwarn') || {}).textContent || null, offCells: c.querySelectorAll('.fs-len-off').length, offRowOff: !!(offRow && offRow.classList.contains('fs-len-off')), offRowTitle: offRow ? offRow.title : '', cardTitle: c.title };
  }, [id, ids.off]);
  const a = await card(ids.g1), b = await card(ids.g2);
  console.log('15s group :', JSON.stringify(a)); console.log('2s group  :', JSON.stringify(b));
  check(a && a.chipWarn && /15s/.test(a.chipTitle), 'lengths 15 s apart → the Length chip is amber, with the spread in its tooltip');
  check(a && a.badge === '⚠ 15s', `…a "⚠ 15s" badge next to the title (${a && a.badge})`);
  check(a && a.offRowOff && /−15s against the merge target \(4:53\)/.test(a.offRowTitle), `…the 4:38 row's length is amber: "${a && a.offRowTitle}"`);
  check(a && a.offCells === 1, `…only the off row, not the target (${a && a.offCells})`);
  check(a && /but its lengths differ by up to 15s \(tolerance 5s\)/.test(a.cardTitle), '…and the card tooltip says so');
  check(b && !b.chipWarn && !b.badge && b.offCells === 0 && !/lengths differ/.test(b.cardTitle), 'within tolerance (2 s) → no warning anywhere');

  // #619 follow-up (majkinetor): "Highlighted length is not aligned vertically with normal
  // length" + "Move ⚠ 31s to the right, it should be in 'len column'". Geometry, measured on
  // the rendered text (a Range), not on our CSS.
  const geo = () => page.evaluate(([id, off]) => {
    const c = document.querySelector(`.fs-gcard[data-gid="${id}"]`); if (!c) return null;
    const txt = el => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
    const offCell = c.querySelector(`.fs-grow[data-gid="${off}"] .fs-len`);
    const plain = [...c.querySelectorAll('.fs-grow .fs-len')].find(x => x !== offCell);
    const badge = c.querySelector('.fs-lenwarn'), hdr = c.querySelector('.fs-ghdr');
    const b = badge ? badge.getBoundingClientRect() : null, h = hdr.getBoundingClientRect();
    const rowTop = el => el.closest('.fs-grow').getBoundingClientRect().top;
    const overlaps = sel => { const el = c.querySelector(sel); if (!el || !b) return false; const r = el.getBoundingClientRect(); return b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top; };
    return {
      plainX: plain ? txt(plain).left : null, offX: offCell ? txt(offCell).left : null,
      plainY: plain ? txt(plain).top - rowTop(plain) : null, offY: offCell ? txt(offCell).top - rowTop(offCell) : null,
      offL: offCell ? offCell.getBoundingClientRect().left : null,
      col: !!(badge && badge.classList.contains('fs-lenwarn-col')), badgeL: b ? b.left : null,
      inHdr: !!b && b.top >= h.top && b.bottom <= h.bottom,
      clash: overlaps('.fs-gt') || overlaps('.fs-sig') || overlaps('.fs-ghr'),
      rects: Object.fromEntries(['.fs-lenwarn', '.fs-gt', '.fs-sig', '.fs-ghr', '.fs-ghl', '.fs-ghdr'].map(sel => { const el = c.querySelector(sel); if (!el) return [sel, null]; const r = el.getBoundingClientRect(); return [sel, [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]]; })),
    };
  }, [ids.g1, ids.off]);
  const g = await geo();
  console.log('geometry  :', JSON.stringify(g));
  check(g && Math.abs(g.offX - g.plainX) <= 0.5, `the amber length's digits start where the plain length's do (${g && g.offX.toFixed(1)} vs ${g && g.plainX.toFixed(1)})`);
  check(g && Math.abs(g.offY - g.plainY) <= 0.5, `…on the same line within their rows (${g && g.offY.toFixed(1)} vs ${g && g.plainY.toFixed(1)})`);
  check(g && g.col && Math.abs(g.badgeL - g.offL) <= 1 && g.inHdr && !g.clash, `the ⚠ badge sits in the length column: left edge ${g && g.badgeL && g.badgeL.toFixed(1)} vs the amber cell's ${g && g.offL.toFixed(1)}, inside the header, clear of title/chips/buttons`);

  const box = await page.evaluate(id => { const c = document.querySelector(`.fs-gcard[data-gid="${id}"]`); c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, ids.g1);
  await test.info().attach('the 15 s card', { body: await page.screenshot({ clip: box }), contentType: 'image/png' });

  // a collapsed card has no rows to line up with → the badge stays beside the title
  await page.evaluate(id => { window.__fusion.STATE.collapsedGroups.add(id); window.__fusion.renderAll(); }, ids.g1);
  await page.waitForTimeout(200);
  const gc = await geo();
  check(gc && !gc.col && gc.inHdr && !gc.clash, `collapsed → badge falls back beside the title (col=${gc && gc.col})`);
  await page.evaluate(id => { window.__fusion.STATE.collapsedGroups.delete(id); window.__fusion.renderAll(); }, ids.g1);

  // a narrower window: the length column slides under the chips, so the badge must fall back
  // beside the title rather than sit on the title, the chips or the buttons. (Much narrower —
  // ~900px — and the header itself overflows: the title track collapses to 0 and the buttons
  // spill out of the card, with or without this badge. Nothing to assert there.)
  await page.setViewportSize({ width: 1200, height: 1000 });
  await page.waitForTimeout(400);   // ResizeObserver → rAF → placeLenBadges
  const gn = await geo();
  console.log('narrow    :', JSON.stringify(gn));
  check(gn && gn.inHdr && !gn.clash, `narrower window (1200px) → badge still clear of title/chips/buttons (col=${gn && gn.col})`);
});
