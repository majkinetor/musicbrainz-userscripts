import { test, check, until, idle, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// OK Computer: 38 releases, 29 with art, so the card reads them at once (a big group waits for Scan)
const RG = 'b1392450-e666-3926-a536-22c65f834433';

// A release group's Artwork card reads every release's listing, keeps booklets one row per release and merges
// look-alikes of a type across releases; the Editions table's Art column shows each release's count, and the
// viewer opens on a tile (#1116).
test('a release group gathers the artwork of all its releases', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  test.setTimeout(240000);
  await page.goto(`https://test.musicbrainz.org/release-group/${RG}`, { waitUntil: 'domcontentloaded' });
  await idle(page);
  await inject('event_horizon');
  const card = page.locator('#app #s-art');
  const note = await until(() => card.locator('.aside').first().textContent().catch(() => ''), t => /after merging/.test(t) && !/reading|merging look/.test(t), 90000);
  console.log(note);
  check(/\d+ images on \d+ releases · \d+ after merging/.test(note), `the card's header counts images, releases and merged ones: ${note}`);
  const m = note.match(/(\d+) images on (\d+) releases · (\d+) after merging/) || [];
  check(+m[3] < +m[1], `merging cut the images (${m[1]} → ${m[3]})`);
  const tiles = await card.locator('[data-rgatile]').count();
  check(tiles > 0, `merged tiles show (${tiles})`);
  check(await card.locator('.rga-grid figcaption', { hasText: /× ?\d+|releases?/ }).count() > 0, 'a tile says how many releases share it');
  console.log('booklet rows', await card.locator('.rga-bk').count());
  await attachShot(testInfo, card, 'card');
  // the viewer opens on a tile: Art Station's when installed, else the image in a tab
  // the ask goes to document and doesn't bubble; listen before the click
  await page.evaluate(() => document.addEventListener('mbu-gallery-open', e => { e.preventDefault(); window.__ehGal = JSON.parse(e.detail); }, { once: true }));
  await card.locator('[data-rgatile]').first().click();
  const g = (await until(() => page.evaluate(() => window.__ehGal || null), Boolean)) || {};
  check(g.images && g.images.length > 0 && g.start, `the gallery asks for the tile's images (${g.images && g.images.length})`);
  // the table's Art column
  await page.locator('#app [data-edview="table"]').first().click();
  const cells = await until(() => page.locator('#app .ed-art').count(), n => n > 0);
  check(cells > 0, `the table has an Art column (${cells} cells)`);
  await attachShot(testInfo, page.locator('#app #s-ed, #app .ed-t').first(), 'table');
  // Has booklet narrows the rows
  const rows = () => page.locator('#app .ed-t tbody tr').count();
  const all = await rows();
  await page.locator('#app [data-edbook]').click();
  const some = await until(rows, n => n < all);
  check(some < all, `Has booklet narrows the rows (${all} → ${some})`);
  await page.locator('#app [data-edbook]').click();
});
