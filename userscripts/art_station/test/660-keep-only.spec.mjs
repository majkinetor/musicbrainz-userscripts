// #660 (majkinetor): "When importing all images from streaming provider the point is to keep the
// best one. Currently, one must select other images and delete them which is not ideal. Lets have
// an option on new images only to keep just one."
//
// test.musicbrainz.org's cover-art page (read-only): three images dropped in (staged, never
// uploaded). "✓ only this" on one marks the other new ones for removal, leaves the release's own
// covers alone, and ↺ keep brings one back.
import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';
import { openArtStation } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

test('"✓ only this" on a new cover marks the other new ones for removal', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  await openArtStation(page, inject);
  const before = await page.evaluate(() => document.querySelectorAll('.as-card:not(.new):not(.del)').length);
  await page.evaluate(async () => {
    const draw = (w, h) => new Promise(r => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').fillRect(0, 0, w, h); c.toBlob(r, 'image/jpeg', 0.9); });
    const dt = new DataTransfer();
    for (const [w, n] of [[1200, 'a.jpg'], [3000, 'b.jpg'], [600, 'c.jpg']]) dt.items.add(new File([await draw(w, w)], n, { type: 'image/jpeg' }));
    window.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await until(() => page.evaluate(() => [...document.querySelectorAll('.as-card.new')].filter(c => (c.querySelector('.as-dim-px') || {}).textContent).length), n => n === 3);
  check(await page.locator('.as-card.new .as-only').count() === 3, 'each new cover offers "only this"');
  check(await page.locator('.as-card:not(.new) .as-only').count() === 0, 'covers already on the release do not');

  const best = page.locator('.as-card.new', { has: page.locator('.as-dim-px', { hasText: '3000 × 3000' }) });
  await best.hover();
  check(await until(() => best.locator('.as-only').evaluate(b => getComputedStyle(b).opacity), o => o === '1').catch(() => false), 'it shows on hover');
  await attachShot(testInfo, best, 'hover');
  if (process.env.AS_SHOT) await best.screenshot({ path: process.env.AS_SHOT });
  await best.locator('.as-only').click();

  const after = await page.evaluate(() => ({
    kept: [...document.querySelectorAll('.as-card.new:not(.del)')].map(c => c.querySelector('.as-dim-px').textContent),
    removed: document.querySelectorAll('.as-card.new.del').length,
    old: document.querySelectorAll('.as-card:not(.new):not(.del)').length,
    only: document.querySelectorAll('.as-only').length,
  }));
  check(after.kept.length === 1 && after.kept[0] === '3000 × 3000', `only the chosen one is left (${JSON.stringify(after.kept)})`);
  check(after.removed === 2, `the other two are marked for removal (${after.removed})`);
  check(after.old === before, `the release's own covers are untouched (${after.old} of ${before})`);
  check(after.only === 0, 'with one new cover left, there is nothing to keep it over');

  await page.locator('.as-card.new.del .as-undo').first().click();
  check(await page.locator('.as-card.new:not(.del)').count() === 2, '↺ keep brings one back');
  check(await page.locator('.as-card.new:not(.del) .as-only').count() === 2, 'and "only this" is offered again');
});
