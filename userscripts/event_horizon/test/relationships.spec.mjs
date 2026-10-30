import { test, expect, check, until, settled, requireLogin, attachShot, functionSource } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

const MJ = 'f27ec8db-af05-4f36-916e-3d57f91ecf5e';

test('Relationships routes cover the entities that have the tab', { tag: '@unit' }, async () => {
  const src = await functionSource('event_horizon', ['MBID', 'RELS_TYPES', 'PAGE', 'navTo']);
  const location = { href: 'https://test.musicbrainz.org/', origin: 'https://test.musicbrainz.org' };
  const route = new Function('location', src + '; return navTo;')(location);
  for (const type of ['artist', 'label', 'area', 'instrument', 'place', 'series', 'event', 'release-group', 'recording', 'work']) {
    expect(route(`/${type}/${MJ}/relationships`)).toBe(`erels/${type}:${MJ}`);
    expect(route(`/${type}/${MJ}/relationships/`)).toBe(`erels/${type}:${MJ}`);
  }
  expect(route(`https://example.com/artist/${MJ}/relationships`)).toBeNull();
});

// an artist's Relationships page: a card per kind of entity, and the Appearances as tables, all filtered in place
test('an artist\'s relationships show as cards and tables', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/artist/${MJ}/relationships`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await requireLogin(page);
  await settled(page);
  await inject('event_horizon');
  check(await until(() => page.locator('#app section.sec').count(), n => n > 2) > 2, 'the page has sections');
  check(await page.locator('#app .arthd h1 a').innerText() === 'Michael Jackson', 'the header names the artist');
  check(await page.locator('#app #s-rlartist dt').count() > 0, 'the Artists card has phrases');
  check(await page.locator('#app #s-rarecording tbody tr').count() > 10, 'the recordings appear in a table');
  await attachShot(testInfo, page, 'relationships');
  await page.locator('#rls-q').fill('supporting');
  check(await until(() => page.locator('#app .rq:not([hidden])').count(), n => n > 0 && n < 40) < 40, 'the filter narrows to a phrase');
  check(await page.locator('#s-rarecording').isHidden(), 'a section with nothing left hides');
});
