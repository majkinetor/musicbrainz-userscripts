// #650: the Bandcamp provider reads the album page itself (tralbum + ld+json), no requests.
//
// Fixtures:
//   Bullion, "Nearly": an artist's own account; "Francis Ford (ft. L Devine)" shows the feat. split.
//   Ghostly International, "Ghostly Swim": a label's Various Artists compilation, track titles
//   prefixed with "Artist - ".
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'First Contact' }, pageErrors: 'ignore' });   // bandcamp.com's own scripts are not ours

async function read(page, inject, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
  return page.evaluate(async () => {
    const bc = window.__fcTest.providers.find(p => p.id === 'bandcamp');
    return bc.fetchRelease(bc.albumId(location));
  });
}
const text = c => c.map(a => a.name + a.join).join('');

test("an artist's own album: credit with its link, feat. split, label left out", { tag: ['@web', '@critical'] }, async ({ page, inject }) => {
  const rel = await read(page, inject, 'https://bullion.bandcamp.com/album/nearly');
  check(rel.title === 'Nearly', `title: ${rel.title}`);
  check(text(rel.credit) === 'Bullion' && rel.credit[0].url === 'https://bullion.bandcamp.com', `release credit: ${text(rel.credit)} ${rel.credit[0].url}`);
  check(rel.barcode === '804297847801', `barcode: ${rel.barcode}`);
  check(rel.labels.length === 0, `no label for a self-published album: ${JSON.stringify(rel.labels)}`);
  check(rel.urls.some(u => u.linkType === 74) && rel.urls.every(u => u.url === 'https://bullion.bandcamp.com/album/nearly'), `links: ${JSON.stringify(rel.urls)}`);
  const tracks = rel.mediums[0].tracks;
  check(tracks.length === 10, `10 tracks (${tracks.length})`);
  const ff = tracks.find(t => /^Francis Ford/.test(t.title));
  check(ff && ff.title === 'Francis Ford' && text(ff.credit) === 'Bullion feat. L Devine', `feat. split: "${ff && ff.title}" — ${ff && text(ff.credit)}`);
  check(ff && ff.credit[0].url === 'https://bullion.bandcamp.com' && !ff.credit[1].url, 'the main artist keeps the link, the featured one has none');
  check(tracks.every(t => t.lengthMs > 0), 'every track has a length');
});

test("a label's Various Artists compilation: VA credit, track artists, label", { tag: ['@web'] }, async ({ page, inject }) => {
  const rel = await read(page, inject, 'https://ghostly.bandcamp.com/album/ghostly-swim');
  check(text(rel.credit) === 'Various Artists' && rel.credit[0].mbid === '89ad4ac3-39f7-470e-963a-56509c546377', `VA credit: ${text(rel.credit)} ${rel.credit[0].mbid}`);
  check(rel.labels[0] && rel.labels[0].name === 'Ghostly International', `label: ${JSON.stringify(rel.labels)}`);
  check(rel.date.year === 2009 && rel.date.month === 1 && rel.date.day === 27, `date: ${JSON.stringify(rel.date)}`);
  const t1 = rel.mediums[0].tracks[0];
  check(t1.title === 'Triple Chrome Dipped' && text(t1.credit) === 'Michna', `track 1: "${t1.title}" — ${text(t1.credit)}`);
});
