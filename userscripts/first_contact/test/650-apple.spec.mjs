// #650: the Apple Music provider, from Apple's catalogue API (amp-api) with the web player's token.
//
// Fixture: Daft Punk, "Random Access Memories" (us/617154241), 13 songs with ISRCs; "Instant
// Crush" lists Daft Punk & Julian Casablancas, each with an Apple artist id.
import { test, check, SANDBOX, sourceOf } from '../../../dev/test/harness.mjs';
import { readFile } from 'node:fs/promises';

test.use({ gm: { name: 'First Contact' } });

test('an Apple Music album: UPC, label, ISRCs, every artist with its Apple link', { tag: ['@web', '@critical'] }, async ({ page, inject }) => {
  await page.goto(SANDBOX + '/', { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  const { rel, ids } = await page.evaluate(async () => {
    const ap = window.__fcTest.providers.find(p => p.id === 'apple');
    const ids = ['/us/album/random-access-memories/617154241', '/gb/album/617154241', '/us/album/x/617154241?i=617154383', '/us/artist/daft-punk/5468295', '/us/playlist/x/pl.123']
      .map(u => ap.albumId(new URL('https://music.apple.com' + u)));
    return { rel: await ap.fetchRelease('us/617154241'), ids };
  });
  const text = c => c.map(a => a.name + a.join).join('');
  check(JSON.stringify(ids) === JSON.stringify(['us/617154241', 'gb/617154241', 'us/617154241', null, null]), `album pages only, with their storefront: ${JSON.stringify(ids)}`);
  check(rel.title === 'Random Access Memories' && text(rel.credit) === 'Daft Punk', `title and credit: ${rel.title} — ${text(rel.credit)}`);
  check(/^https:\/\/music\.apple\.com\/us\/artist\/daft-punk\/5468295$/.test(rel.credit[0].url || ''), `artist link: ${rel.credit[0].url}`);
  check(rel.barcode === '886443919266' && rel.labels[0] && rel.labels[0].name === 'Columbia', `UPC and label: ${rel.barcode} ${JSON.stringify(rel.labels)}`);
  check(rel.date.year === 2013 && rel.date.month === 5 && rel.date.day === 17, `date: ${JSON.stringify(rel.date)}`);
  const tracks = rel.mediums.flatMap(m => m.tracks);
  check(tracks.length === 13 && tracks.every(t => /^USQX913001\d\d$/.test(t.isrc || '')), `13 songs with ISRCs (${tracks.length})`);
  const ic = tracks.find(t => t.title === 'Instant Crush');
  check(ic && text(ic.credit) === 'Daft Punk & Julian Casablancas' && ic.credit.every(a => /music\.apple\.com\/us\/artist\//.test(a.url || '')), `Instant Crush: ${ic && text(ic.credit)} ${ic && ic.credit.map(a => a.url)}`);
  check(rel.urls[0].linkType === 980 && /music\.apple\.com\/us\/album\/random-access-memories\/617154241$/.test(rel.urls[0].url), `link: ${JSON.stringify(rel.urls)}`);
});

// Fixtures: 664332737 "Get Lucky (feat. Pharrell Williams & Nile Rodgers) [Daft Punk Remix]",
// a single (isSingle) with the feat. clause in its title; 643599161 "Get Lucky (In the Style of
// Daft Punk) [Karaoke Version] - Single", Apple's " - Single" suffix.
test('Apple singles: type Single, the feat. clause and " - Single" taken off the title', { tag: ['@web'] }, async ({ page, inject }) => {
  await page.goto(SANDBOX + '/', { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  const [a, b] = await page.evaluate(async () => {
    const ap = window.__fcTest.providers.find(p => p.id === 'apple');
    return [await ap.fetchRelease('us/664332737'), await ap.fetchRelease('us/643599161')];
  });
  const text = c => c.map(x => x.name + x.join).join('');
  check(a.title === 'Get Lucky [Daft Punk Remix]' && a.types.join() === 'Single', `isSingle: "${a.title}" ${a.types}`);
  check(text(a.credit) === 'Daft Punk feat. Pharrell Williams & Nile Rodgers', `feat. from the title: ${text(a.credit)}`);
  check(b.title === 'Get Lucky (In the Style of Daft Punk) [Karaoke Version]' && b.types[0] === 'Single', `" - Single" is the type, not the title: "${b.title}" ${b.types}`);
});

// music.apple.com's Content Security Policy refuses the harness's inline <script> (a userscript
// manager isn't bound by it); the page allows eval, so the script goes in that way.
test('the button shows on an Apple Music album page', { tag: ['@web'] }, async ({ page }) => {
  await page.goto('https://music.apple.com/us/album/random-access-memories/617154241', { waitUntil: 'domcontentloaded' });
  await page.evaluate(c => (0, eval)(c), await readFile(sourceOf('first_contact'), 'utf8'));
  await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
  check(await page.locator('#fc-root .fc-go').isVisible(), 'the import button shows');
});
