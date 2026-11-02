import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true } });

const ARTIST = 'https://test.musicbrainz.org/artist/a74b1b7f-71a5-4011-9441-d0b5e4122711';

async function open(page, inject) {
  await page.goto(ARTIST);
  await inject('event_horizon');
  await until(() => page.locator('#s-dg [data-dgview="table"]').count(), n => n === 1);
  await page.locator('#s-dg [data-dgview="table"]').click();
  await until(() => page.locator('#s-dg table.ed-t tbody tr:not(.gh)').count(), n => n > 2);
}
const heads = page => page.$$eval('#s-dg table.ed-t thead th[data-c]:not([hidden])', x => x.map(h => h.dataset.c).join());
const box = page => page.locator('[data-fq="dg"]');

test('a filter is saved by name, brought back, replaced and deleted', { tag: '@sandbox' }, async ({ page, inject }) => {
  await open(page, inject);
  check(await page.locator('[data-pop="nm-flt-dg"]').count() === 0, 'nothing to show before a filter is open or saved');
  await page.locator('[data-fopen="dg"]').click();
  await page.locator('[data-pop="nm-flt-dg"]').click();
  check(await page.locator('[data-nmname="flt-dg"]').count() === 0, 'an empty filter has nothing to save');
  await page.keyboard.press('Escape');
  await box(page).fill('year:1900-');
  await page.locator('[data-pop="nm-flt-dg"]').click();
  await page.locator('[data-nmname="flt-dg"]').fill('Since 1900');
  await page.keyboard.press('Enter');
  await until(() => page.locator('#pop-nm-flt-dg [data-nmuse]').count(), n => n === 1);
  check(await page.locator('#pop-nm-flt-dg').isVisible(), 'the menu stays open');
  await page.locator('[data-nmname="flt-dg"]').fill('since 1900');
  await page.locator('[data-nmsave="flt-dg"]').click();
  await until(() => page.locator('#pop-nm-flt-dg [data-nmuse]').textContent(), t => t === 'since 1900');
  check(await page.locator('#pop-nm-flt-dg [data-nmuse]').count() === 1, 'the same name replaces it');
  await page.keyboard.press('Escape');
  await page.locator('[data-fclr="dg"]').click();
  await until(() => box(page).inputValue(), v => v === '');
  await page.locator('[data-pop="nm-flt-dg"]').click();
  await page.locator('#pop-nm-flt-dg [data-nmuse]').click();
  await until(() => box(page).inputValue(), v => v === 'year:1900-');
  check(await page.locator('#pop-nm-flt-dg').isHidden(), 'picking one closes the menu');
  await page.reload();
  await inject('event_horizon');
  await until(() => page.locator('[data-fopen="dg"]').count(), n => n === 1);
  await page.locator('[data-fopen="dg"]').click();
  await page.locator('[data-pop="nm-flt-dg"]').click();
  await page.locator('#pop-nm-flt-dg [data-nmdel]').click();
  await until(() => page.locator('#pop-nm-flt-dg [data-nmuse]').count(), n => n === 0);
});

test('a table\'s columns are saved by name and brought back', { tag: '@sandbox' }, async ({ page, inject }) => {
  await open(page, inject);
  await page.locator('[data-pop="cols-dg"]').click();
  await page.locator('#pop-cols-dg [data-colk="rating"] input').click();
  await page.locator('#pop-cols-dg [data-colk="releases"] .col-h').focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await until(() => heads(page), h => h === 'title,artist,releases,date,links');
  await page.locator('[data-nmname="cols-dg"]').fill('Short');
  await page.locator('[data-nmsave="cols-dg"]').click();
  await until(() => page.locator('#pop-cols-dg [data-nmuse]').count(), n => n === 1);
  check(await page.locator('#pop-cols-dg').isVisible(), 'the menu stays open');
  await page.locator('[data-colreset="dg"]').click();
  await until(() => heads(page), h => h === 'title,artist,date,rating,releases,links');
  await page.locator('#pop-cols-dg [data-nmuse]').click();
  await until(() => heads(page), h => h === 'title,artist,releases,date,links');
  check(await page.$$eval('#pop-cols-dg .col-row', x => x.map(r => r.dataset.colk).join()) === 'title,artist,releases,date,rating,links', 'the menu follows');
  check(await page.locator('#pop-cols-dg').isVisible(), 'the menu stays open to compare another');
});
