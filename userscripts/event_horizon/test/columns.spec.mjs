import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

const ARTIST = 'https://test.musicbrainz.org/artist/a74b1b7f-71a5-4011-9441-d0b5e4122711';

// the discography as a table, its Columns menu open
async function open(page, inject) {
  await page.goto(ARTIST);
  await inject('event_horizon');
  await until(() => page.locator('#s-dg [data-dgview="table"]').count(), n => n === 1);
  await page.locator('#s-dg [data-dgview="table"]').click();
  await until(() => page.locator('#s-dg table.ed-t tbody tr:not(.gh)').count(), n => n > 2);
  await page.locator('[data-pop="cols-dg"]').click();
  await until(() => page.locator('#pop-cols-dg').isVisible(), v => v);
}
const heads = page => page.$$eval('#s-dg table.ed-t thead th[data-c]:not([hidden])', x => x.map(h => h.dataset.c).join());
const rowCells = page => page.$eval('#s-dg table.ed-t tbody tr:not(.gh)', r => [...r.children].filter(c => c.dataset.c && !c.hidden).map(c => c.dataset.c).join());
const span = page => page.$eval('#s-dg table.ed-t tr.gh th', t => t.colSpan);

async function drag(page, key, rows) {
  const h = page.locator(`#pop-cols-dg [data-colk="${key}"] .col-h`), b = await h.boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x, y + rows * 32 * i / 8);
  return async () => { await page.mouse.up(); await until(() => page.evaluate(() => !document.querySelector('.col-row.drag') && !document.body.classList.contains('col-dragging')), v => v); await page.waitForTimeout(220); };
}

test('a column turns off in place and stays off after a redraw', { tag: '@sandbox' }, async ({ page, inject }) => {
  await open(page, inject);
  const mark = await page.$eval('#s-dg table.ed-t', t => { t.dataset.same = '1'; return true; });
  check(mark && await heads(page) === 'title,artist,date,rating,releases', 'the usual columns');
  check(await span(page) === 7, 'a group heading spans them all');
  await page.locator('#pop-cols-dg [data-colk="rating"] input').click();
  await until(() => heads(page), h => h === 'title,artist,date,releases');
  check(await rowCells(page) === 'title,artist,date,releases', 'the rows follow the heading');
  check(await span(page) === 6, 'the group heading narrows');
  check(await page.locator('#pop-cols-dg').isVisible(), 'the menu stays open');
  check(await page.$eval('#s-dg table.ed-t', t => t.dataset.same === '1'), 'the table was not redrawn');
  check((await page.locator('[data-pop="cols-dg"] i').textContent()) === '+1', 'the button counts what is off');
  check(await page.locator('#pop-cols-dg [data-colk="title"] input').isDisabled(), 'the title stays');
  await page.locator('#s-dg [data-dgsort="date"]').click();
  await until(() => page.locator('#s-dg [data-dgsort="date"].on').count(), n => n === 1);
  check(await heads(page) === 'title,artist,date,releases', 'a redraw keeps the choice');
});

test('dragging a row moves the column, and Esc takes it back', { tag: '@sandbox' }, async ({ page, inject }) => {
  await open(page, inject);
  const drop = await drag(page, 'date', -2);
  await until(() => heads(page), h => h === 'date,title,artist,rating,releases');    // the table follows during the drag
  check(await page.$eval('[data-colk="artist"]', r => r.style.transform.includes('translateY')), 'the others slide aside');
  await drop();
  check(await page.$$eval('#pop-cols-dg .col-row', x => x.map(r => r.dataset.colk).join() + x.map(r => r.style.transform).join('')) === 'date,title,artist,rating,releases', 'the menu settles in the new order');
  check(await rowCells(page) === 'date,title,artist,rating,releases', 'the rows are in the new order');
  const undo = await drag(page, 'rating', 1);
  await until(() => heads(page), h => h === 'date,title,artist,releases,rating');
  await page.keyboard.press('Escape');
  await until(() => heads(page), h => h === 'date,title,artist,rating,releases');
  check(await page.locator('#pop-cols-dg').isVisible(), 'Esc stops the drag, not the menu');
  await page.mouse.up();
  await undo().catch(() => {});
});

test('the arrow keys move a column, and the reset brings the usual table back', { tag: '@sandbox' }, async ({ page, inject }) => {
  await open(page, inject);
  await page.locator('#pop-cols-dg [data-colk="releases"] .col-h').focus();
  await page.keyboard.press('ArrowUp');
  await until(() => heads(page), h => h === 'title,artist,date,releases,rating');
  check(await page.$eval('#pop-cols-dg [data-colk="releases"] .col-h', h => h === document.activeElement), 'the handle keeps the focus');
  await page.locator('#pop-cols-dg [data-colk="artist"] input').click();
  await page.locator('[data-colreset="dg"]').click();
  await until(() => heads(page), h => h === 'title,artist,date,rating,releases');
  check(await page.locator('#pop-cols-dg').isVisible(), 'the menu stays open');
  check(await page.locator('[data-pop="cols-dg"] i').isHidden(), 'nothing left to count');
});

test('the releases table offers more columns, and Comment takes the note from beside the title', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(ARTIST);
  await inject('event_horizon');
  await until(() => page.locator('#s-dg table, #s-dg .dg-card, #s-dg a[href*="/release-group/"]').count(), n => n > 0);
  await page.locator('#s-dg a[href*="/release-group/"]').first().click();
  await until(() => page.locator('#s-ed [data-edview="table"], #s-ed [data-rgview="table"]').count(), n => n === 1);
  await page.locator('#s-ed [data-edview="table"], #s-ed [data-rgview="table"]').click();
  await until(() => page.locator('[data-pop="cols-ed"]').count(), n => n === 1);
  check((await page.locator('[data-pop="cols-ed"] i').textContent()) === '+4', 'four are on offer');
  await page.locator('[data-pop="cols-ed"]').click();
  for (const k of ['status', 'packaging', 'lang', 'comment']) await page.locator(`#pop-cols-ed [data-colk="${k}"] input`).click();
  const hs = await page.$$eval('#s-ed table.ed-t thead th[data-c]:not([hidden])', x => x.map(h => h.dataset.c).join());
  check(hs.endsWith('status,packaging,lang,comment'), `the new columns show (${hs})`);
  check(await page.$eval('#s-ed table.ed-t', t => t.classList.contains('cmt')), 'the note moves to its column');
  check(await page.$eval('#s-ed table.ed-t col[data-c="comment"]', c => !c.hidden), 'the column highlight follows');
});

test('the Columns menu works on a list of releases that stays MusicBrainz\'s page', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(`${ARTIST}/releases`);
  await inject('event_horizon');
  await until(() => page.locator('.eh-release-views [data-edview="table"], .eh-release-views [data-rgview="table"]').count(), n => n === 1);
  await page.locator('.eh-release-views [data-edview="table"], .eh-release-views [data-rgview="table"]').click();
  await page.locator('[data-pop="cols-ed"]').click();
  await page.locator('#pop-cols-ed [data-colk="status"] input').click();
  const shown = () => page.$$eval('.eh-release-views table.ed-t thead th[data-c]:not([hidden])', x => x.map(h => h.dataset.c).join());
  await until(shown, h => h.endsWith('status'));
  await page.locator('#pop-cols-ed [data-colk="status"] .col-h').focus();
  await page.keyboard.press('ArrowUp');
  await until(shown, h => h.endsWith('status,barcode'));
  check(await page.locator('#pop-cols-ed').isVisible(), 'the menu stays open');
});

test('a column resizes by its edge, fits its content and goes back to fitting itself', { tag: '@sandbox' }, async ({ page, inject }) => {
  await open(page, inject);
  await page.keyboard.press('Escape');
  const width = k => page.$eval(`#s-dg table.ed-t thead th[data-c="${k}"]`, h => h.getBoundingClientRect().width);
  const table = () => page.$eval('#s-dg table.ed-t', t => t.getBoundingClientRect().width);
  const edge = page.locator('[data-colrs="dg\tdate"]');
  check(await page.locator('[data-colrs="dg\treleases"]').isHidden(), 'the last column has no edge to drag');
  const [t0, d0, r0] = [await table(), await width('date'), await width('rating')];
  await edge.scrollIntoViewIfNeeded();
  const b = await edge.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(x + 5 * i, y);
  await until(() => width('date'), w => Math.abs(w - d0 - 30) < 3);
  await page.mouse.up();
  check(Math.abs(await width('rating') - r0 + 30) < 3, 'the next column gives the room');
  check(Math.abs(await table() - t0) < 2, 'the table keeps its width');
  await page.locator('#s-dg [data-dgsort="date"]').click();
  await until(() => page.locator('#s-dg [data-dgsort="date"].on').count(), n => n === 1);
  check(Math.abs(await width('date') - d0 - 30) < 3, 'a redraw keeps the width');
  await edge.dblclick();
  await until(() => width('date'), w => w < d0 + 25);
  check(await page.$eval('#s-dg table.ed-t', t => t.classList.contains('fix')), 'the others stay as they were');
  await page.locator('[data-colfit="dg"]').click();
  await until(() => page.$eval('#s-dg table.ed-t', t => t.classList.contains('fix')), v => !v);
});

test('the filter\'s tooltip shows how to write one', { tag: '@sandbox' }, async ({ page, inject }) => {
  await open(page, inject);
  await page.locator('[data-fopen="dg"]').click();
  await page.locator('[data-fhelp="dg"]').hover();
  await until(() => page.locator('#mbu-tip .flt-tip tr').count(), n => n === 6);
  const tip = await page.locator('#mbu-tip').textContent();
  for (const x of ['Filter by title', '-artist:', 'year:2020-2024', 'a AND b', 'a OR b', '(a OR b)']) check(tip.includes(x), x);
  check((await page.locator('#mbu-tip .flt-tip-cols code').allTextContents()).slice(0, 2).join() === 'title,artist', 'the section\'s columns');
});
