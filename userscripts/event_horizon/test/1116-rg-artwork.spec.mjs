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
  const some = await until(rows, n => n < all, { timeout: 90000 });
  check(some < all, `Has booklet narrows the rows (${all} → ${some})`);
  const cells = await until(() => page.locator('#app .ed-art').count(), n => n > 0);
  check(cells > 0, `the table has an Art column (${cells} cells)`);
  await page.locator('#app [data-edbook]').click();
  // the header's Artwork opens the tab in place; Event Horizon alone draws its own card
  await page.locator(`#app a[href$="/release-group/${RG}/artwork"]`).first().click();
  await until(() => page.evaluate(() => location.pathname), p => p.endsWith('/artwork'));
  const acts = await page.locator('#app .kicker .acts a').evaluateAll(as => as.map(a => (a.getAttribute('href') || '').split('/').pop()));
  check(acts.indexOf('artwork') === acts.indexOf('edit') + 1, `Artwork sits next to Edit (${acts.join(' ')})`);
  const fb = await until(() => page.locator('#app #as-gslot .rga-fb [data-rgatile]').count(), n => n > 0, { timeout: 120000 });
  check(fb > 0, `without Art Station the tab shows the card (${fb} tiles)`);
  // Art Station, started late (as String Theory starts it), asks for the snapshot and takes the slot
  await inject('art_station');
  const gv = page.locator('#app #as-gslot .as-gv');
  const note = await until(() => gv.locator('.as-gv-note').textContent().catch(() => ''), t => /look-alikes? merged|no look-alikes/.test(t), { timeout: 360000 });
  console.log(note);
  const m = note.match(/(\d+) look-alikes? merged/) || [];
  check(+m[1] > 0, `merging folded look-alikes together: ${note}`);
  check(await page.locator('#app #as-gslot .rga-fb').count() === 0, 'the card made way for the gallery');
  check(await gv.locator('.as-gv-n', { hasText: /×\d+/ }).count() > 0, 'a tile says how many releases share it');
  const byType = await gv.locator('.as-gv-sec h3').allTextContents();
  console.log('type sections', byType.join(' | '));
  check(/^Front/.test(byType[0] || ''), `Type sections start with Front (${byType[0]})`);
  await attachShot(testInfo, gv, 'by type');
  await gv.locator('[data-gvby="release"]').click();
  const byRel = await until(() => gv.locator('.as-gv-sec').count(), n => n > byType.length);
  check(byRel > byType.length, `grouped by release, one section each (${byRel})`);
  // each release's heading has a pencil to its cover-art page; returning to the tab reads that release again
  const pen = gv.locator('.as-gv-sec h3 a.as-gv-edit');
  check(await pen.count() === byRel, `every release heading has the pencil (${await pen.count()} of ${byRel})`);
  const href = await pen.first().getAttribute('href');
  check(/^.release.[0-9a-f-]{36}.cover-art$/.test(href), `the pencil opens the release's cover art (${href})`);
  const rel = href.split('/')[2];
  await page.evaluate(r => { document.dispatchEvent(new CustomEvent('mbu-art-group-edit', { detail: JSON.stringify({ release: r }) })); document.dispatchEvent(new Event('visibilitychange')); }, rel);
  check(await until(() => gv.locator('.as-gv-sec').count(), n => n === byRel) === byRel, 'the gallery redraws the same after a release is read again');
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
  // right-click selects a tile, as in the main gallery; the Download menu counts it
  await gv.locator('.as-gv-t').first().click({ button: 'right' });
  check(await gv.locator('.as-gv-t.on').count() === 1, 'right-click selects the tile');
  await gv.locator('[data-gvdl]').click();
  check(/Selected \(1\)/.test(await gv.locator('[data-gvzip="sel"]').textContent()), 'Download zip offers the selected one');
});
