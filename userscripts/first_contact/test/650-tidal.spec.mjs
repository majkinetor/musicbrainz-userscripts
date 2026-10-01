// #650: the Tidal provider, from the official catalogue API with an app (client-credentials) token.
//
// Fixture: Daft Punk, "Random Access Memories" (Tidal album 211822890), 13 tracks with ISRCs.
import { test, check, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'First Contact' } });

test('a Tidal album: UPC, type, ISRCs, every artist with its Tidal link', { tag: ['@web', '@critical'] }, async ({ page, inject }) => {
  await page.goto(SANDBOX + '/', { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  const { rel, ids } = await page.evaluate(async () => {
    const td = window.__fcTest.providers.find(p => p.id === 'tidal');
    const ids = ['/album/211822890', '/browse/album/211822890', '/album/211822890/', '/track/211822891', '/artist/8847'].map(pathname => td.albumId({ pathname }));
    return { rel: await td.fetchRelease('211822890'), ids };
  });
  const text = c => c.map(a => a.name + a.join).join('');
  check(JSON.stringify(ids) === JSON.stringify(['211822890', '211822890', '211822890', null, null]), `album pages only: ${JSON.stringify(ids)}`);
  check(rel.title === 'Random Access Memories' && text(rel.credit) === 'Daft Punk' && rel.credit[0].url === 'https://tidal.com/artist/8847', `title and credit: ${rel.title} — ${text(rel.credit)} ${rel.credit[0].url}`);
  check(rel.barcode === '886443984059' && rel.types.join() === 'Album', `UPC and type: ${rel.barcode} ${rel.types}`);
  check(rel.date.year === 2013 && rel.labels.length === 0, `date, and no label (Tidal has none): ${JSON.stringify(rel.date)} ${JSON.stringify(rel.labels)}`);
  const tracks = rel.mediums.flatMap(m => m.tracks);
  check(tracks.length === 13 && tracks.every(t => /^USQX913001\d\d$/.test(t.isrc || '') && t.lengthMs > 0), `13 tracks with ISRCs and lengths (${tracks.length})`);
  const lucky = tracks.find(t => t.title === 'Get Lucky');
  // Tidal puts "feat. Pharrell Williams and Nile Rodgers" in the track's version field
  check(lucky && text(lucky.credit) === 'Daft Punk feat. Pharrell Williams & Nile Rodgers', `Get Lucky: "${lucky && lucky.title}" — ${lucky && text(lucky.credit)}`);
  check(lucky && lucky.credit.every(a => /^https:\/\/tidal\.com\/artist\/\d+$/.test(a.url || '')), 'every Get Lucky artist has its Tidal link');
  check(rel.urls[0].url === 'https://tidal.com/album/211822890' && rel.urls[0].linkType === 980, `link: ${JSON.stringify(rel.urls)}`);
});
