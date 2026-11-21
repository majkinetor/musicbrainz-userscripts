import { test, check, until, settled, requireLogin, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

const RG = 'ed64def7-4a2f-4ff7-9ae3-fbdfac9f8e0e';

// a release group's Set cover art and its Edit annotation keep MusicBrainz's form, dressed in Event Horizon's header and theme
for (const [form, name] of [['set-cover-art', 'Set cover art'], ['edit_annotation', 'Annotation']]) {
  test(`${name}: the form takes Event Horizon's header`, { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
    await page.goto(`https://test.musicbrainz.org/release-group/${RG}/${form}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await requireLogin(page);
    await settled(page);
    await inject('event_horizon');
    check(await until(() => page.locator(`#eh-relhd h1 a[href$="/release-group/${RG}"]`).count(), n => n === 1) === 1, 'the header shows, its title linking to the release group');
    check(new RegExp(name, 'i').test(await page.locator('#eh-relhd .kicker').textContent()), 'the kicker names the form');
    check(!(await page.locator('#content > .rgheader').isVisible()), 'MusicBrainz\'s header hides');
    check(await page.locator('#content form button.submit').isVisible(), 'the form stays');
    await attachShot(testInfo, page, form);
  });
}

// any other entity's annotation wears the common entity header: its picture, else its kind's mark
test('an artist\'s annotation form wears the entity header', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  const AR = 'a74b1b7f-71a5-4011-9441-d0b5e4122711';
  await page.goto(`https://test.musicbrainz.org/artist/${AR}/edit_annotation`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await requireLogin(page);
  await settled(page);
  await inject('event_horizon');
  check(await until(() => page.locator(`#eh-relhd h1 a[href$="/artist/${AR}"]`).count(), n => n === 1) === 1, 'the header shows, its title linking to the artist');
  check(await until(() => page.locator('#eh-relhd :is(.rhcv:not([hidden]),.rhic:not([hidden]))').count(), n => n === 1) === 1, 'the header shows a picture or the kind\'s mark');
  check(await page.locator('#eh-relhd .kicker svg').count() > 0, 'the kicker carries the kind\'s mark');
  await attachShot(testInfo, page, 'artist-annotation');
});

// Annotation lives in More; Set cover art is an action of its own beside Edit, and on the cover.
test('the release group page leads to its forms', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release-group/${RG}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settled(page);
  await inject('event_horizon');
  check(await until(() => page.locator('.hero .kicker .acts > a.ab[href$="/edit"] + a.ab[href$="/set-cover-art"]').count(), n => n === 1) === 1, 'Set cover art sits beside Edit');
  await page.locator('.hero .kicker .eh-more > summary').click();
  check(await page.locator(`.eh-more .abm a[href$="/release-group/${RG}/edit_annotation"]`).isVisible(), 'More offers the annotation');
  await page.locator('.hero .picw').hover();
  check(await until(() => page.locator('.hero .cvact').evaluate(e => getComputedStyle(e).opacity), o => o === '1') === '1', 'hovering the cover shows Set cover art');
});

// an artist's Releases stands in the action row before History, not in More, with the release's disc-in-case mark
test('an artist\'s Releases sits in the action row', { tag: ['@sandbox'] }, async ({ page, inject }, testInfo) => {
  const AR = 'a74b1b7f-71a5-4011-9441-d0b5e4122711';
  await page.goto(`https://test.musicbrainz.org/artist/${AR}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settled(page);
  await inject('event_horizon');
  const row = page.locator('.hero .kicker .acts');
  check(await until(() => row.locator(`> a.ab[href$="/artist/${AR}/releases"]`).count(), n => n === 1) === 1, 'Releases is in the row');
  check(await row.locator(`.eh-more a[href$="/releases"]`).count() === 0, 'and not in More');
  const order = await row.locator('> a.ab').evaluateAll(as => as.map(a => a.getAttribute('href').split('/').pop()));
  check(order.indexOf('releases') === 1 && order.indexOf('releases') < order.indexOf('edits'), `Releases comes right after Edit, before History (${order.join(', ')})`);
  check(await row.locator(`> a.ab[href$="/releases"] svg rect`).count() === 1, 'its icon is the case');
  await attachShot(testInfo, row, 'artist-row');
});

// Releases opens in the tab (the page does not load, so the player plays on) and draws the releases from ws/2; a reload shows the same view
test('an artist\'s Releases opens in the tab', { tag: ['@sandbox'] }, async ({ page, inject }, testInfo) => {
  const AR = 'a74b1b7f-71a5-4011-9441-d0b5e4122711';
  await page.goto(`https://test.musicbrainz.org/artist/${AR}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settled(page);
  await inject('event_horizon');
  const link = page.locator(`.hero .kicker .acts > a.ab[href$="/artist/${AR}/releases"]`);
  await until(() => link.count(), n => n === 1);
  await page.evaluate(() => { window.ehMark = 1; });
  await link.click();
  check(await until(() => page.locator('table.ed-t a[href*="/release/"]').count(), n => n > 0) > 0, 'the releases show');
  check(page.url().endsWith(`/artist/${AR}/releases`), 'the address is the Releases page');
  check(await page.evaluate(() => window.ehMark) === 1, 'the page did not load');
  check(/Releases/.test(await page.locator('.arthd .kicker').first().textContent()), 'the header names Releases');
  await attachShot(testInfo, page, 'releases-click');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settled(page);
  await inject('event_horizon');
  check(await until(() => page.locator('table.ed-t a[href*="/release/"]').count(), n => n > 0) > 0, 'a reload shows the same view');
  check(/Releases/.test(await page.locator('.arthd .kicker').first().textContent()), 'with the same header');
});
