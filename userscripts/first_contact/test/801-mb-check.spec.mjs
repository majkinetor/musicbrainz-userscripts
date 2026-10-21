// #801: before the release editor opens, First Contact looks the album up in MusicBrainz (by its links, its
// barcode, and its title and artist) and, when MusicBrainz may have it, asks first: Update this release in
// Mission Control, Add link only, or Import anyway.
//
// Fixture: Daft Punk, "Random Access Memories" (Deezer album 6575789, UPC 886443927087), which the sandbox has with
// that Deezer link (release e0aec533…).
import { test, check, until, loadFunctions, SANDBOX } from '../../../dev/test/harness.mjs';

const ALBUM = 'https://www.deezer.com/en/album/6575789';
const RAM = 'e0aec533-0eb3-49ed-8293-4d650d2aa4eb';

const fns = () => loadFunctions('first_contact', ['fmtKind', 'bcCore', 'relFormat', 'relTracks', 'sameAlbum', 'foldTitle', 'titleClose']);

test('a release is this album unless its barcode, format or track count differs', { tag: ['@unit', '@critical'] }, async () => {
  const { sameAlbum, titleClose } = await fns();
  const rel = { barcode: '0886443927087', mediums: [{ format: 'Digital Media', tracks: Array(13).fill({}) }] };
  check(sameAlbum({ barcode: '886443927087', format: 'Digital Media', tracks: 13 }, rel), 'the same barcode, leading zeros aside');
  check(sameAlbum({ barcode: '', format: '', tracks: null }, rel), 'what MusicBrainz doesn\'t say doesn\'t count');
  check(!sameAlbum({ barcode: '886443927088', format: 'Digital Media', tracks: 13 }, rel), 'another barcode is another release');
  check(!sameAlbum({ barcode: '886443927087', format: 'CD', tracks: 13 }, rel), 'a CD is another release');
  check(!sameAlbum({ barcode: '', format: 'Digital Media', tracks: 14 }, rel), 'another track count is another release');
  check(titleClose('Random Access Memories', 'Random Access Memories (Deluxe)') === false, 'a deluxe edition\'s title is not the same title');
  check(titleClose('Random Access Memories', 'random access memories'), 'case doesn\'t count');
  check(titleClose('Pt. 1 Café', 'Pt 1 Cafe'), 'punctuation and accents don\'t count');
});

test('a link is the same album whatever form MusicBrainz stores it in', { tag: ['@unit'] }, async () => {
  const { linkKey } = await loadFunctions('first_contact', ['linkKey']);
  const same = [
    ['https://music.apple.com/us/album/random-access-memories/617154241', 'https://music.apple.com/gb/album/617154241'],
    ['https://www.deezer.com/en/album/6575789', 'https://www.deezer.com/album/6575789'],
    ['https://listen.tidal.com/album/20188315', 'https://tidal.com/browse/album/20188315'],
    ['https://www.qobuz.com/fr-fr/album/random-access-memories-daft-punk/0886443927087', 'https://www.qobuz.com/gb-en/album/random-access-memories-daft-punk/0886443927087'],
    ['https://open.spotify.com/intl-de/album/4m2880jivSbbyEGAKfITCa', 'https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa'],
    ['https://music.amazon.de/albums/B00CM0CK4Q', 'https://music.amazon.com/albums/B00CM0CK4Q'],
    ['https://daftpunk.bandcamp.com/album/ram/', 'http://daftpunk.bandcamp.com/album/ram'],
  ];
  for (const [a, b] of same) check(linkKey(a) === linkKey(b), `${a} is ${b} (${linkKey(a)} / ${linkKey(b)})`);
  check(linkKey('https://www.deezer.com/album/1') !== linkKey('https://www.deezer.com/album/2'), 'another album id is another album');
});

test.describe('on a Deezer album the sandbox has', () => {
  test.use({
    gm: { name: 'First Contact', persist: 'tabs', values: { 'fc.settings': { server: 'test.musicbrainz.org', archive: false } } },
    pageErrors: 'ignore',   // deezer.com's own scripts throw in an automated browser; not ours
  });

  test('Import asks first, and Update this release hands the album to Mission Control on the release', { tag: ['@web', '@sandbox', '@critical'] }, async ({ page, context, inject }) => {
    test.setTimeout(150_000);
    await page.goto(ALBUM, { waitUntil: 'domcontentloaded' });
    await inject('first_contact', { waitFor: '__fcTest' });
    const go = page.locator('#fc-root .fc-go');
    await go.waitFor({ state: 'visible' });
    await go.click();
    const box = page.locator('#fc-check');
    await box.waitFor({ timeout: 90_000 });
    if (process.env.FC_SHOT) await box.screenshot({ path: process.env.FC_SHOT });   // FC_SHOT=<file.png>: the panel, for the README
    const light = await box.locator('.fc-check-h .fc-light').getAttribute('data-light');
    check(light === 'linked', `the album's link is on a release: the light is linked (${light})`);
    const row = box.locator('li', { has: page.locator(`a[href$="/release/${RAM}"]`) });
    check(await row.count() === 1, 'the release is listed, linked to the sandbox');
    const text = (await row.textContent()).replace(/\s+/g, ' ');
    const badges = await row.locator('.fc-badge').evaluateAll(bs => bs.map(b => (b.classList.contains('fc-badge-no') ? '!' : '') + b.textContent));
    check(['link', 'barcode', 'title', 'tracks', 'format'].every(b => badges.includes(b)), `badges for what agrees: link, barcode, title, tracks, format (${badges})`);
    check(!badges.some(b => b.startsWith('!') && b !== '!≠ date'), `nothing else differs (${badges})`);
    check(await row.locator('.fc-check-link').count() === 0, 'no Add link only: the release has the link');
    check(await page.evaluate(() => !window.__fcLastSeed), 'the release editor isn\'t seeded yet');
    check(await go.locator('.fc-light[data-light="linked"]').count() === 1, 'the Import button wears the light');

    await row.locator('.fc-check-upd').click();
    const upd = await until(() => page.evaluate(() => window.__fcLastUpdate), Boolean);
    check(upd && upd.mbid === RAM, `Update this release goes to the release (${JSON.stringify(upd)})`);
    check(await box.count() === 0, 'the panel closes');
    const opened = await page.evaluate(() => window.__fcLastOpen);
    check(opened === `${SANDBOX}/release/${RAM}#fc-update=${upd.token}`, `it opens the release with the update's token (${opened})`);
    const stored = await page.evaluate(k => GM_getValue(k), 'fc.handoff.upd.' + upd.token);
    check(stored && stored.url === 'https://www.deezer.com/album/6575789' && stored.platform.id === 'deezer' && stored.rel.mediums[0].tracks.length === 13, 'the album is stored for the release page, as read');

    // the release page: First Contact hands it over (a manager's GM storage is one store; the harness's one per origin)
    const rp = await context.newPage();
    await rp.goto(opened, { waitUntil: 'domcontentloaded' });
    await rp.evaluate(([k, v]) => GM_setValue(k, v), ['fc.handoff.upd.' + upd.token, stored]);
    await inject('first_contact', { target: rp, waitFor: '__fcTest' });
    await rp.waitForFunction(() => !!document.documentElement.dataset.fcUpdate);
    const h = await rp.evaluate(() => JSON.parse(document.documentElement.dataset.fcUpdate));
    check(h.token === upd.token && h.mbid === RAM && h.rel.title === 'Random Access Memories', 'published for Mission Control');
    check(await rp.evaluate(k => GM_getValue(k, null), 'fc.handoff.upd.' + upd.token) === null, 'and taken out of the storage');
  });

  test('Import anyway seeds the release editor', { tag: ['@web', '@sandbox'] }, async ({ page, context, inject }) => {
    test.setTimeout(120_000);
    await page.goto(ALBUM, { waitUntil: 'domcontentloaded' });
    await inject('first_contact', { waitFor: '__fcTest' });
    const go = page.locator('#fc-root .fc-go');
    await go.waitFor({ state: 'visible' });
    await go.click();
    await page.locator('#fc-check').waitFor({ timeout: 90_000 });
    await Promise.all([context.waitForEvent('page'), page.locator('#fc-check .fc-warn-go').click()]);
    const seed = await until(() => page.evaluate(() => window.__fcLastSeed && window.__fcLastSeed.params.length), Boolean);
    check(seed > 50, `the seed was built (${seed} parameters)`);
  });

  test('On page load, link only: the button wears the light before any click', { tag: ['@web', '@sandbox'] }, async ({ page, inject }) => {
    await page.goto(ALBUM, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => GM_setValue('fc.settings', { server: 'test.musicbrainz.org', archive: false, check: 'link' }));
    await inject('first_contact', { waitFor: '__fcTest' });
    const light = await until(() => page.locator('#fc-root .fc-go .fc-light').getAttribute('data-light').catch(() => null), v => v === 'linked', { timeout: 30_000 });
    check(light === 'linked', `the link is on a release: linked (${light})`);
    const tip = await page.locator('#fc-root .fc-go').getAttribute('data-tip');
    check(/MusicBrainz has this album/.test(tip), `the tooltip says so (${tip})`);
  });
});
