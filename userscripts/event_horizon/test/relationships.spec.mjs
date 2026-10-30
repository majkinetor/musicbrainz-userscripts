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

test('Recordings routes cover the artist, area and instrument', { tag: '@unit' }, async () => {
  const src = await functionSource('event_horizon', ['MBID', 'WORKS_TYPES', 'RECS_TYPES', 'RELS_TYPES', 'PAGE', 'navTo']);
  const location = { href: 'https://test.musicbrainz.org/', origin: 'https://test.musicbrainz.org' };
  const route = new Function('location', src + '; return navTo;')(location);
  for (const type of ['artist', 'area', 'instrument']) expect(route(`/${type}/${MJ}/recordings`)).toBe(`erecs/${type}:${MJ}`);
  expect(route(`/label/${MJ}/recordings`)).not.toBe(`erecs/label:${MJ}`);
});

// an artist's Recordings page: MusicBrainz's table, 100 a page, the next page by Load more
test('an artist\'s recordings show as a table that loads more', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/artist/${MJ}/recordings`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await requireLogin(page);
  await settled(page);
  await inject('event_horizon');
  const rows = () => page.locator('#app #s-rarecording tbody tr').count();
  check(await until(rows, n => n >= 100) === 100, 'the first page is in');
  check(await page.locator('#app .arthd h1 a').innerText() === 'Michael Jackson', 'the header names the artist');
  check(await page.locator('#app #s-rarecording th', { hasText: 'Relationship' }).count() === 0, 'no Relationship column on an artist\'s own');
  await attachShot(testInfo, page, 'recordings');
  await page.locator('#app [data-lmgo^="tab:ra"]:not([data-lmgo$="+"])').click();
  check(await until(rows, n => n > 100) > 100, 'Load more brings the next page');
});

test('Works routes cover the artist and area', { tag: '@unit' }, async () => {
  const src = await functionSource('event_horizon', ['MBID', 'WORKS_TYPES', 'RECS_TYPES', 'RELS_TYPES', 'PAGE', 'navTo']);
  const location = { href: 'https://test.musicbrainz.org/', origin: 'https://test.musicbrainz.org' };
  const route = new Function('location', src + '; return navTo;')(location);
  for (const type of ['artist', 'area']) expect(route(`/${type}/${MJ}/works`)).toBe(`ewrks/${type}:${MJ}`);
  expect(route(`/instrument/${MJ}/works`)).not.toBe(`ewrks/instrument:${MJ}`);
});

// an artist's Works page: MusicBrainz's table, its authors one per line, the next page by Load more
test('an artist\'s works show as a table that loads more', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/artist/${MJ}/works`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await requireLogin(page);
  await settled(page);
  await inject('event_horizon');
  const rows = () => page.locator('#app #s-rawork tbody tr').count();
  check(await until(rows, n => n >= 100) === 100, 'the first page is in');
  check((await page.locator('#app .arthd').innerText()).includes('WORKS') || (await page.locator('#app .arthd').innerText()).includes('Works'), 'the kicker says Works');
  await attachShot(testInfo, page, 'works');
  await page.locator('#app [data-lmgo^="tab:ra"]:not([data-lmgo$="+"])').click();
  check(await until(rows, n => n > 100) > 100, 'Load more brings the next page');
});
