import { test, check, until, idle, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// OK Computer: 38 releases, 29 with art
const RG = 'b1392450-e666-3926-a536-22c65f834433';

// A release group's Artwork tab reads every release's listing and hashes the images; Art Station draws the
// gallery from what Event Horizon sends: look-alikes merged across releases, grouped by type or release, the
// viewer over a tile's row (#1116).
test('a release group\'s Artwork tab gathers the art of all its releases', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  test.setTimeout(600000);
  await page.goto(`https://test.musicbrainz.org/release-group/${RG}`, { waitUntil: 'domcontentloaded' });
  await idle(page);
  await inject('event_horizon');
  // the table's Has booklet switch reads the listings; the Art column then says what each release has
  await page.locator('#app [data-edview="table"]').first().click();
  const rows = () => page.locator('#app .ed-t tbody tr').count();
  const all = await rows();
  await page.locator('#app [data-edbook]').click();
  const some = await until(rows, n => n < all, 90000);
  check(some < all, `Has booklet narrows the rows (${all} → ${some})`);
  const cells = await until(() => page.locator('#app .ed-art').count(), n => n > 0);
  check(cells > 0, `the table has an Art column (${cells} cells)`);
  await page.locator('#app [data-edbook]').click();
  // the header's Artwork opens the tab in place; Event Horizon alone draws its own card
  await page.locator(`#app a[href$="/release-group/${RG}/artwork"]`).first().click();
  await until(() => page.evaluate(() => location.pathname), p => p.endsWith('/artwork'));
  const fb = await until(() => page.locator('#app #as-gslot .rga-fb [data-rgatile]').count(), n => n > 0, 120000);
  check(fb > 0, `without Art Station the tab shows the card (${fb} tiles)`);
  // Art Station, started late (as String Theory starts it), asks for the snapshot and takes the slot
  await inject('art_station');
  const gv = page.locator('#app #as-gslot .as-gv');
  const note = await until(() => gv.locator('.as-gv-note').textContent().catch(() => ''), t => /after merging/.test(t), 360000);
  console.log(note);
  const m = note.match(/(\d+) images? on (\d+) releases? · (\d+) after merging/) || [];
  check(+m[3] > 0 && +m[3] < +m[1], `merging cut the images (${m[1]} → ${m[3]}): ${note}`);
  check(await page.locator('#app #as-gslot .rga-fb').count() === 0, 'the card made way for the gallery');
  check(await gv.locator('.as-gv-n', { hasText: /×\d+/ }).count() > 0, 'a tile says how many releases share it');
  const byType = await gv.locator('.as-gv-sec h3').allTextContents();
  console.log('type sections', byType.join(' | '));
  check(/^Front/.test(byType[0] || ''), `Type sections start with Front (${byType[0]})`);
  await attachShot(testInfo, gv, 'by type');
  await gv.locator('[data-gvby="release"]').click();
  const byRel = await until(() => gv.locator('.as-gv-sec').count(), n => n > byType.length);
  check(byRel > byType.length, `grouped by release, one section each (${byRel})`);
  await gv.locator('[data-gvby="type"]').click();
  // Booklets only keeps the stacks
  await gv.locator('[data-gvchip="book"]').click();
  const stacks = await gv.locator('.as-gv-t').count(), bk = await gv.locator('.as-gv-t.stk').count();
  check(stacks > 0 && stacks === bk, `Booklets only shows booklet stacks (${bk} of ${stacks})`);
  await gv.locator('[data-gvchip="book"]').click();
  // the viewer over a tile, read-only; closing it gives the gallery back
  await gv.locator('.as-gv-t:not(.stk) .as-gv-im').first().click();
  const lb = page.locator('#as-lb');
  await until(() => lb.isVisible(), Boolean);
  check(await lb.evaluate(e => e.classList.contains('as-lb-ro')), 'the viewer is read-only');
  await attachShot(testInfo, page, 'viewer');
  await page.keyboard.press('Escape');
  await until(() => lb.isVisible().then(v => !v), Boolean);
  check(await gv.locator('.as-gv-t').count() > 0, 'the gallery stays after the viewer closes');
  // selecting a tile counts in the Download menu
  await gv.locator('.as-gv-t .as-gv-pick').first().click({ force: true });
  await gv.locator('[data-gvdl]').click();
  check(/Selected \(1\)/.test(await gv.locator('[data-gvzip="sel"]').textContent()), 'Download zip offers the selected one');
});
