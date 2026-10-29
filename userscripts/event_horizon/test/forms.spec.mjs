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

// Annotation lives in More; the release group's Edit and cover offer Set cover art.
test('the release group page leads to its forms', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release-group/${RG}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settled(page);
  await inject('event_horizon');
  check(await until(() => page.locator('.hero .kicker .abx > a.ab[href$="/edit"]').count(), n => n === 1) === 1, 'Edit has a menu');
  await page.locator('.hero .kicker .eh-more > summary').click();
  check(await page.locator(`.eh-more .abm a[href$="/release-group/${RG}/edit_annotation"]`).isVisible(), 'More offers the annotation');
  await page.locator('.hero .kicker .abx > a.ab').hover();
  check(await page.locator(`.abm a[href$="/release-group/${RG}/set-cover-art"]`).isVisible(), 'and the cover art');
  await page.locator('.hero .picw').hover();
  check(await until(() => page.locator('.hero .cvact').evaluate(e => getComputedStyle(e).opacity), o => o === '1') === '1', 'hovering the cover shows Set cover art');
});

// an artist's Releases stands in the action row before History, not in More, with the release's record-and-sleeve mark
test('an artist\'s Releases sits in the action row', { tag: ['@sandbox'] }, async ({ page, inject }, testInfo) => {
  const AR = 'a74b1b7f-71a5-4011-9441-d0b5e4122711';
  await page.goto(`https://test.musicbrainz.org/artist/${AR}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settled(page);
  await inject('event_horizon');
  const row = page.locator('.hero .kicker .acts');
  check(await until(() => row.locator(`> a.ab[href$="/artist/${AR}/releases"]`).count(), n => n === 1) === 1, 'Releases is in the row');
  check(await row.locator(`.eh-more a[href$="/releases"]`).count() === 0, 'and not in More');
  const order = await row.locator('> a.ab').evaluateAll(as => as.map(a => a.getAttribute('href').split('/').pop()));
  check(order.indexOf('releases') === order.indexOf('edits') - 1, `Releases comes just before History (${order.join(', ')})`);
  check(await row.locator(`> a.ab[href$="/releases"] svg rect`).count() === 1, 'its icon is the sleeve');
  await attachShot(testInfo, row, 'artist-row');
});
