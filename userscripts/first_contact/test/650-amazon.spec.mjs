// #650 (majkinetor): "do we support amazon music?" … "implement AM". Read as a guest through the API
// Amazon Music's own web player uses (no login), like Platform Check and ISRC Scout.
//
// Fixtures: Daft Punk, "Random Access Memories" (B00CRMWMZ0), 13 tracks; "Get Lucky" is credited
// "Daft Punk, Pharrell Williams & Nile Rodgers" with only Daft Punk linked; the ℗ line names
// Columbia Records. Simon & Garfunkel, "Bridge Over Troubled Water" (B00PAYQWWG): an "&" that is
// one artist, which the artist link's slug tells apart.
import { test, check, sourceOf } from '../../../dev/test/harness.mjs';
import { readFile } from 'node:fs/promises';

test.use({ gm: { name: 'First Contact' }, pageErrors: 'ignore' });   // music.amazon.com's own scripts are not ours

test('an Amazon Music album: tracklist, artists with their links, date, label, link', { tag: ['@web'] }, async ({ page, inject }) => {
  await page.goto('https://music.amazon.com/albums/B00CRMWMZ0', { waitUntil: 'domcontentloaded' });
  try { await inject('first_contact', { waitFor: '__fcTest' }); }
  catch (e) { await page.evaluate(c => (0, eval)(c), await readFile(sourceOf('first_contact'), 'utf8')); }   // a CSP that refuses the inline <script>
  await page.locator('#fc-root .fc-go').waitFor({ state: 'visible', timeout: 30000 });
  check(await page.locator('#fc-root .fc-go').isVisible(), 'the import button shows on an Amazon Music album page');

  const { rel, sg, ids } = await page.evaluate(async () => {
    const am = window.__fcTest.providers.find(p => p.id === 'amazonmusic');
    const ids = ['/albums/B00CRMWMZ0', '/albums/b00crmwmz0/', '/tracks/B00CRMX53S', '/artists/B000S9ULT8/daft-punk'].map(pathname => am.albumId({ pathname }));
    return { rel: await am.fetchRelease('B00CRMWMZ0'), sg: await am.fetchRelease('B00PAYQWWG'), ids };
  });
  const text = c => c.map(a => a.name + a.join).join('');
  check(JSON.stringify(ids) === JSON.stringify(['B00CRMWMZ0', 'B00CRMWMZ0', null, null]), `album pages only: ${JSON.stringify(ids)}`);
  check(rel.title === 'Random Access Memories' && text(rel.credit) === 'Daft Punk' && rel.credit[0].url === 'https://music.amazon.com/artists/B000S9ULT8', `title and credit: ${rel.title} — ${text(rel.credit)} ${rel.credit[0].url}`);
  check(rel.types.join() === 'Album' && rel.date.year === 2013 && rel.date.month === 5 && rel.date.day === 17, `type and date: ${rel.types} ${JSON.stringify(rel.date)}`);
  check(rel.labels.length === 1 && rel.labels[0].name === 'Columbia Records', `label from the ℗ line: ${JSON.stringify(rel.labels)}`);
  check(rel.barcode === null, 'no barcode (Amazon Music shows none)');
  check(rel.urls.length === 1 && rel.urls[0].url === 'https://music.amazon.com/albums/B00CRMWMZ0' && rel.urls[0].linkType === 980, `link, as a streaming page: ${JSON.stringify(rel.urls)}`);
  const tracks = rel.mediums.flatMap(m => m.tracks);
  check(rel.mediums.length === 1 && tracks.length === 13, `13 tracks on one medium (${rel.mediums.length}, ${tracks.length})`);
  check(tracks.every(t => t.lengthMs > 0 && /^https:\/\/music\.amazon\.com\/tracks\/[A-Z0-9]{10}$/.test(t.url)), 'each track has its length and link');
  check(tracks[0].title === 'Give Life Back to Music' && tracks[0].lengthMs === 275000 && text(tracks[0].credit) === 'Daft Punk', `track 1: "${tracks[0].title}" ${tracks[0].lengthMs} — ${text(tracks[0].credit)}`);
  const lucky = tracks.find(t => t.title === 'Get Lucky');
  check(lucky && text(lucky.credit) === 'Daft Punk, Pharrell Williams & Nile Rodgers', `Get Lucky: ${lucky && text(lucky.credit)}`);
  check(lucky && lucky.credit[0].url === 'https://music.amazon.com/artists/B000S9ULT8' && !lucky.credit[1].url && !lucky.credit[2].url, `only the linked artist carries a link: ${JSON.stringify(lucky && lucky.credit.map(c => c.url || null))}`);

  check(sg.credit.length === 1 && sg.credit[0].name === 'Simon & Garfunkel' && /\/artists\/B000ZSBZ38$/.test(sg.credit[0].url || ''), `"Simon & Garfunkel" is one artist, its link's slug says so: ${JSON.stringify(sg.credit)}`);
  check(sg.date.year === 1970, `its date: ${JSON.stringify(sg.date)}`);
});

// the whole button path, up to the seed (not sent)
test('Amazon Music: Import builds the seed', { tag: ['@web'] }, async ({ page, inject }) => {
  await page.goto('https://music.amazon.com/albums/B00CRMWMZ0', { waitUntil: 'domcontentloaded' });
  try { await inject('first_contact', { waitFor: '__fcTest' }); }
  catch (e) { await page.evaluate(c => (0, eval)(c), await readFile(sourceOf('first_contact'), 'utf8')); }
  await page.locator('#fc-root .fc-go').waitFor({ state: 'visible', timeout: 30000 });
  const seed = await page.evaluate(async () => {
    window.open = () => null;
    HTMLFormElement.prototype.submit = function () { };
    await window.__fcTest.importCurrent();
    const s = window.__fcLastSeed;
    return s && Object.fromEntries(s.params.filter(([k]) => /^(name|artist_credit\.names\.0\.name|date\.year|labels\.0\.name|urls\.0\.url|urls\.0\.link_type|mediums\.0\.track\.12\.name|mediums\.0\.track\.12\.length)$/.test(k)));
  });
  check(seed && seed.name === 'Random Access Memories' && seed['artist_credit.names.0.name'] === 'Daft Punk', `the seed's release: ${JSON.stringify(seed)}`);
  check(seed && seed['urls.0.url'] === 'https://music.amazon.com/albums/B00CRMWMZ0' && seed['urls.0.link_type'] === '980', 'and its link');
  check(seed && seed['mediums.0.track.12.name'] === 'Contact', `the last track: ${seed && seed['mediums.0.track.12.name']}`);
});
