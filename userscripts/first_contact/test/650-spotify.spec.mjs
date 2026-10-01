// #650: the Spotify provider replays the web player's own album query, with the token, client
// token and query id it heard the player use (FC hooks the page's fetch at document-start).
//
// Fixture: Daft Punk, "Random Access Memories" (4m2880jivSbbyEGAKfITCa), 13 tracks; Get Lucky
// credits Pharrell Williams and Nile Rodgers.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'First Contact' }, pageErrors: 'ignore' });   // spotify.com's own scripts are not ours

test('a Spotify album: the player\'s query replayed, artists with their links, type, date, label', { tag: ['@web', '@critical'] }, async ({ page, inject }) => {
  await inject('first_contact', { atStart: true });   // as @run-at document-start: before the player's scripts
  await page.goto('https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa', { waitUntil: 'domcontentloaded' });
  await page.locator('#fc-root .fc-go').waitFor({ state: 'visible', timeout: 30000 });
  const { rel, ids } = await page.evaluate(async () => {
    const sp = window.__fcTest.providers.find(p => p.id === 'spotify');
    const ids = ['/album/4m2880jivSbbyEGAKfITCa', '/intl-de/album/4m2880jivSbbyEGAKfITCa', '/track/0dEIca2nhcxDUV8C5QkPYb', '/artist/4tZwfgrHOc3mvqYlEYSvVi'].map(pathname => sp.albumId({ pathname }));
    return { rel: await sp.fetchRelease('4m2880jivSbbyEGAKfITCa'), ids };
  });
  const text = c => c.map(a => a.name + a.join).join('');
  check(JSON.stringify(ids) === JSON.stringify(['4m2880jivSbbyEGAKfITCa', '4m2880jivSbbyEGAKfITCa', null, null]), `album pages only: ${JSON.stringify(ids)}`);
  check(rel.title === 'Random Access Memories' && text(rel.credit) === 'Daft Punk' && rel.credit[0].url === 'https://open.spotify.com/artist/4tZwfgrHOc3mvqYlEYSvVi', `title and credit: ${rel.title} — ${text(rel.credit)} ${rel.credit[0].url}`);
  check(rel.types.join() === 'Album' && rel.date.year === 2013 && rel.date.month === 5 && rel.date.day === 20, `type and date: ${rel.types} ${JSON.stringify(rel.date)}`);
  check(rel.labels.length === 1 && rel.labels[0].name === 'Columbia', `label: ${JSON.stringify(rel.labels)}`);
  const tracks = rel.mediums.flatMap(m => m.tracks);
  check(tracks.length === 13 && tracks.every(t => t.lengthMs > 0 && /^https:\/\/open\.spotify\.com\/track\/\w{22}$/.test(t.url)), `13 tracks with lengths and links (${tracks.length})`);
  const lucky = tracks.find(t => /^Get Lucky/.test(t.title));
  check(lucky && /Daft Punk/.test(text(lucky.credit)) && /Pharrell Williams/.test(text(lucky.credit)) && lucky.credit.every(a => /open\.spotify\.com\/artist\//.test(a.url || '')), `Get Lucky: "${lucky && lucky.title}" — ${lucky && text(lucky.credit)}`);
  check(rel.urls[0].url === 'https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa' && rel.urls[0].linkType === 85, `link: ${JSON.stringify(rel.urls)}`);
});
