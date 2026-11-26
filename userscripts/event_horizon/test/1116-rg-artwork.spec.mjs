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
  // Art Station's thumbnail sizes: the buttons, the wheel over them, and right-click + wheel anywhere
  const tw = () => gv.locator('.as-gv-t').first().evaluate(e => e.getBoundingClientRect().width);
  await gv.locator('[data-gvsize="0"]').click();
  const small = await until(tw, w => w < 200);
  await gv.locator('[data-gvsize="3"]').click();
  const xl = await until(tw, w => w >= 300);
  check(small < 200 && xl >= 300 && await gv.locator('[data-gvsize="3"].on').count() === 1, `the size buttons size the tiles (${Math.round(small)} → ${Math.round(xl)} px)`);
  await gv.locator('[data-gvsize="1"]').hover();
  await page.mouse.wheel(0, 100); await page.mouse.wheel(0, 100); await page.mouse.wheel(0, 100); await page.mouse.wheel(0, 100);
  const wheeled = await until(tw, w => w < xl - 40);
  check(wheeled < xl - 40, `the wheel over the buttons shrinks the tiles (${Math.round(wheeled)} px)`);
  const box = await gv.locator('.as-gv-t').nth(1).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const sel0 = await gv.locator('.as-gv-t.on').count();
  await page.mouse.down({ button: 'right' }); await page.mouse.wheel(0, -100); await page.mouse.wheel(0, -100); await page.mouse.up({ button: 'right' });
  const grown = await until(tw, w => w > wheeled + 20);
  check(grown > wheeled + 20 && await gv.locator('.as-gv-t.on').count() === sel0, `right-click + wheel grows them and selects nothing (${Math.round(grown)} px)`);
  await gv.locator('[data-gvsize="0"]').click();
  // a merged tile shows its largest copy, its size read from the first bytes of each
  const merged = await until(() => page.evaluate(() => window.__asTest.gvMerged()), m => m.length > 0 && m.every(c => c.every(z => z !== null)), { timeout: 60000 });
  console.log('merged', JSON.stringify(merged));
  check(merged.length > 0 && merged.every(c => c.every(z => z && z.w * z.h <= c[0].w * c[0].h)), `each merged tile shows its largest copy (${merged.length} tiles)`);
  await gv.locator('[data-gvby="release"]').click();
  const byRel = await until(() => gv.locator('.as-gv-sec').count(), n => n > byType.length);
  check(byRel > byType.length, `grouped by release, one section each (${byRel})`);
  const across = await gv.locator('.as-gv-sec .as-gv-n').evaluateAll(es => es.filter(e => /^×/.test(e.textContent)).length);
  check(across === 0, `grouped by release, no image is merged with another release's (${across})`);
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
  await gv.locator('[data-gvdl]').click();   // close the menu (an outside click is swallowed)
  await gv.locator('.as-gv-t').first().click({ button: 'right' });   // unselect
  // editing the whole group: a type and a comment on two covers, a removal, and (by release) a move; a dry run sends nothing
  const posts = [];
  await page.route('**/*', r => { if (r.request().method() === 'POST') { posts.push(r.request().url()); return r.abort(); } return r.continue(); });
  // Edit keeps in view the image that was at the top
  const tiles = gv.locator('.as-gv-body .as-gv-t[data-gvid]'), ti = Math.min(3, await tiles.count() - 1), aid = await tiles.nth(ti).getAttribute('data-gvid');
  // a phone: the bar drops its labels for icons, so it takes a row or two, not five
  const vp = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 800 });
  const compact = await until(() => gv.locator('.as-gv-bar.mbu-compact').count(), Boolean);
  const barH = (await gv.locator('.as-gv-bar').boundingBox()).height;
  console.log('phone bar height', barH);
  await attachShot(testInfo, gv.locator('.as-gv-head'), 'phone head');
  check(compact && barH < 70, `at phone width the bar shows icons and fits in two rows (${Math.round(barH)}px)`);
  await page.setViewportSize(vp);
  check(await until(() => gv.locator('.as-gv-bar.mbu-compact').count(), n => !n) === 0, 'at full width the labels come back');
  await tiles.nth(ti).evaluate(e => { const h = document.querySelector('.as-gv-head').getBoundingClientRect().bottom; window.scrollBy(0, e.getBoundingClientRect().top - h - 10); });
  const ay = (await tiles.nth(ti).boundingBox()).y;
  await gv.locator('[data-gvedmode]').click();
  const as = gv.locator('.as-gv-as #as-root');
  await until(() => as.locator('.as-card').count(), n => n > 0);
  const card = as.locator(`.as-card[data-id="${aid}"]`).first(), cy = (await card.boundingBox()).y, tbot = await as.locator('.as-bar').evaluate(e => e.getBoundingClientRect().bottom);
  console.log('anchor', aid, 'read y', ay, 'edit y', cy, 'toolbar bottom', tbot);
  check(cy >= tbot - 1 && cy < tbot + Math.max(60, ay - tbot + 20), `Edit keeps image ${aid} at the top of the view (${Math.round(ay)} → ${Math.round(cy)})`);
  check(!(await gv.locator('.as-gv-body').isVisible()) && await as.locator('.as-toolbar, .as-commit').count() > 0, "Edit opens Art Station's gallery in place of the tiles");
  // Jump to: a section's heading lands just under the pinned bars
  await gv.locator('[data-gvtoc]').click();
  const jumps = gv.locator('.as-gv-tocm [data-gvjump]'), nj = await jumps.count();
  check(nj > 1, `Jump to lists the sections (${nj})`);
  if (nj > 1) {
    const name = await jumps.last().locator('span').first().textContent();
    await jumps.last().click();
    const hy = await as.locator('.as-sec, .as-grow').filter({ visible: true }).last().evaluate(e => e.getBoundingClientRect().top);
    const tb = await as.locator('.as-bar').evaluate(e => e.getBoundingClientRect().bottom);
    const maxY = await page.evaluate(() => window.scrollY >= document.documentElement.scrollHeight - innerHeight - 2);
    console.log('jump', name, 'heading', hy, 'toolbar bottom', tb, 'page end', maxY);
    check(!(await gv.locator('.as-gv-tocm').isVisible()) && (Math.abs(hy - tb - 8) < 4 || (maxY && hy > tb)), `Jump to "${name}" puts its heading under the toolbar (${Math.round(hy)} vs ${Math.round(tb)})`);
  }
  check(!(await as.locator('.as-add').isVisible()) && !(await as.locator('.as-src').isVisible()), 'adding and sourcing are left out');
  // scrolled down, the group's bar stays at the top and Art Station's toolbar right under it; each card's size line fills in
  await as.locator('.as-card').nth(20).scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 600);
  const pin = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--eh-pin-h')) || 0);
  await until(async () => (await gv.locator('.as-gv-head').boundingBox()).y - await pin(), d => Math.abs(d) < 2);
  const hb = await gv.locator('.as-gv-head').boundingBox(), tb = await as.locator('.as-bar').boundingBox(), ph = await pin();
  console.log('pinned header', ph);
  check(Math.abs(hb.y - ph) < 2 && Math.abs(tb.y - (hb.y + hb.height)) < 3, `the bars are pinned (bar at ${hb.y}, toolbar at ${tb.y} under ${hb.height})`);
  await attachShot(testInfo, page, 'pinned');
  const dims = await until(() => as.locator('.as-card .as-dim-px').count(), n => n > 0, { timeout: 90000 });   // the originals in view, read once they stay there
  check(dims > 0, `the cards in view show their dimensions (${dims})`);
  await page.evaluate(() => window.scrollTo(0, 0));
  const cards = as.locator('.as-card');
  const select2 = async () => { for (const i of [0, 1]) if (!/\bsel\b/.test(await cards.nth(i).getAttribute('class'))) await cards.nth(i).click({ button: 'right' }); };
  await select2();
  check(await as.locator('.as-card.sel').count() === 2, 'a right-click selects a card, as in the main gallery');
  check(await as.locator('.as-card .as-relban').count() > 0, 'grouped by type, each card says its release');
  await as.locator('.as-bk-type').click();
  await page.locator('.as-pop input[value="Poster"]').check();
  await page.locator('.as-pop .as-pop-add').click();
  await select2();
  await as.locator('.as-bk-cmt').click();
  await page.locator('.as-pop .as-bulk-cmt').fill('as1116-' + Date.now());
  await page.locator('.as-pop .as-bulk-cmt').press('Enter');
  await cards.nth(1).hover();
  await cards.nth(1).locator('.as-rmone').click();
  check(await as.locator('.as-card.del').count() === 1, 'the trash marks one for removal');
  await gv.locator('[data-gvby="release"]').click();
  await until(() => as.locator('.as-relban').count(), n => n <= 1);
  const grid = as.locator('.as-grid').filter({ has: page.locator('.as-card[draggable="true"] ~ .as-card[draggable="true"]') }).first();
  const da = grid.locator('.as-card[draggable="true"]').first(), db = grid.locator('.as-card[draggable="true"]').nth(1);
  const bb = await db.boundingBox();
  await da.dragTo(db, { targetPosition: { x: bb.width - 10, y: 20 } });
  const chg = await as.locator('.as-commit').textContent();
  console.log('commit button', chg);
  const nOps = +((chg.match(/\d+/) || [0])[0]);
  check(nOps >= 3, `the commit button counts the changes: two covers changed, one also removed, and a move (${chg.trim()})`);
  await attachShot(testInfo, gv, 'editing');
  await as.locator('.as-commit').click();
  await until(() => page.locator('#as-commit .as-cm-op').count(), n => n > 0);
  const labels = await page.locator('#as-commit .as-cm-op').allTextContents();
  console.log(labels.join('\n'));
  check(labels.some(t => /Remove/.test(t)) && labels.some(t => /Edit/.test(t)) && labels.some(t => /Reorder/.test(t)), 'the commit dialog lists the removal, the edits and the reorder');
  await page.click('#as-commit .as-cm-more');
  await page.click('#as-commit .as-cm-dryrun');
  const done = await until(() => page.evaluate(() => [...document.querySelectorAll('#as-commit .as-cm-op .as-cm-st')].every(e => e.textContent === '👁')), Boolean, { timeout: 60000 });
  check(done, 'Dry run previews every operation');
  await attachShot(testInfo, page.locator('#as-commit .as-cm-box'), 'group dry run');
  check(await page.locator('#as-commit .as-cm-rel').count() > 0 && !/: (Edit|Remove)/.test(await page.locator('#as-commit .as-cm-lb').first().textContent()), 'the commit window gives the release its own line');
  check(!posts.length, `nothing was submitted (${posts.length} POSTs)`);
  await page.click('#as-commit .as-cm-x');
  check(+(((await as.locator('.as-commit').textContent()).match(/\d+/) || [0])[0]) === nOps, 'a dry run keeps the staged changes');
  page.once('dialog', d => d.accept());
  await gv.locator('[data-gvedmode]').click();
  await until(() => gv.locator('.as-gv-body').isVisible(), Boolean);
  check(!(await page.locator('#as-root').count()) || !(await gv.locator('#as-root').count()), 'leaving Edit gives the tiles back');
});
