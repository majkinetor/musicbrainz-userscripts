import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// #845: a paged list ends in "Load more" and Auto; Auto off, the button loads the next page, and toggling Auto keeps the page still
test('an area list loads its next page with Load more, and Auto keeps the page still', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/area/02b60d8d-7164-339d-868d-22d147d9f74a');
  await inject('event_horizon');
  const foot = page.locator('#s-aa [data-lm]');
  check(await until(() => foot.count(), n => n === 1) === 1, 'the artists list has a Load more foot');
  const auto = foot.locator('input[data-lmauto]');
  if (await auto.isChecked()) {
    await page.evaluate(() => scrollTo(0, 300));
    const y = await page.evaluate(() => scrollY);
    await auto.click({ trial: false, noWaitAfter: true }).catch(() => {});
    await page.waitForTimeout(500);
    // the click may itself have loaded a page through Auto before it went off; only the scroll matters here
    check(!(await page.locator('#s-aa [data-lmauto]').first().isChecked()), 'Auto goes off');
    check(Math.abs(await page.evaluate(() => scrollY) - y) < 400, 'toggling Auto does not jump the page');
  }
  const rows = () => page.locator('#s-aa tbody tr').count();
  const n0 = await rows();
  await page.locator('#s-aa [data-lmgo]').click();
  check(await until(rows, n => n > n0) > n0, 'Load more adds rows');
  await attachShot(testInfo, page, 'area-more');
});

test('an instrument tab past its first page loads more, and a sort lasts', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/instrument/63021302-86cd-4aee-80df-2270d54f4978');
  await inject('event_horizon');
  const foot = page.locator('#s-ir [data-lm]');
  check(await until(() => foot.count(), n => n === 1) === 1, 'the releases tab has a Load more foot');
  const head = page.locator('#s-ir thead button[data-tsort]').first();
  await head.click();
  check(await page.locator('#s-ir thead th[aria-sort="ascending"]').count() === 1, 'a heading sorts');
  const rows = () => page.locator('#s-ir tbody tr').count();
  const n0 = await rows();
  await page.locator('#s-ir [data-lmgo]').click();
  check(await until(rows, n => n > n0) > n0, 'Load more adds rows');
  check(await page.locator('#s-ir thead th[aria-sort="ascending"]').count() === 1, 'the sort stays after more rows come in');
  await page.locator('#s-ir thead button[data-tsort]').first().click();
  await page.locator('#s-ir thead button[data-tsort]').first().click();
  check(await page.locator('#s-ir thead th[aria-sort="none"]').count() > 0 && await page.locator('#s-ir thead .dg-sort.on').count() === 0, 'a third click brings back MusicBrainz\'s order');
  await attachShot(testInfo, page, 'instrument-more');
});

test('a heading\'s funnel filters the table by that column (#845)', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/instrument/63021302-86cd-4aee-80df-2270d54f4978');
  await inject('event_horizon');
  const fun = page.locator('#s-ir thead button[data-tqcol$="\tartist"]');
  check(await until(() => fun.count(), n => n === 1) === 1, 'the artist heading has a funnel');
  const col = await page.$$eval('#s-ir thead th', ths => ths.findIndex(th => th.querySelector('[data-tqcol$="\tartist"]')));
  const cells = () => page.$$eval(`#s-ir tbody tr td:nth-child(${col + 1})`, tds => tds.map(td => td.textContent.trim()));
  const all = await cells(), word = all[0].split(/\s+/)[0];
  await fun.click();
  const box = page.locator('#s-ir input[data-tq]');
  check(await box.inputValue() === 'artist:', 'the funnel starts "artist:"');
  await box.press('End');
  await box.pressSequentially(word);
  const left = await cells();
  check(left.length > 0 && left.every(t => t.toLowerCase().includes(word.toLowerCase())), `every row left has "${word}" in its artist`);
  check(left.length <= all.length, 'the filter does not add rows');
  check(/\/instrument\/63021302-86cd-4aee-80df-2270d54f4978\/aliases$/.test(await page.getAttribute('.als-go', 'href')), 'the aliases row links to the aliases page');
});
