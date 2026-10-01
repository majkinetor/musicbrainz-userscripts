// #650: the Spotify provider replays the web player's own album query, with the token, client
// token and query id it heard the player use (FC hooks the page's fetch at document-start).
//
// Fixture: Daft Punk, "Random Access Memories" (4m2880jivSbbyEGAKfITCa), 13 tracks; Get Lucky
// credits Pharrell Williams and Nile Rodgers.
import { test, check, sourceOf } from '../../../dev/test/harness.mjs';
import { readFile } from 'node:fs/promises';

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

// majkinetor's log: "the player hasn't loaded an album since this tab opened" on a fresh album page
// — the hook heard nothing. A userscript manager can start the script after the player's first
// queries; the token then comes from any later authorised request of the player, and the album
// query's id is the known one when the player's own wasn't heard.
test('Spotify: First Contact started after the player still reads the album', { tag: ['@web'] }, async ({ page, inject }) => {
  await page.goto('https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);   // the player has made its album query by now
  await page.evaluate(c => (0, eval)(c), await readFile(sourceOf('first_contact'), 'utf8'));   // the page's CSP blocks a script tag
  await page.waitForFunction(() => !!window.__fcTest);
  // the player keeps talking to its APIs (playback state, events…); a scroll nudges it
  await page.mouse.wheel(0, 600);
  const rel = await page.evaluate(async () => {
    const sp = window.__fcTest.providers.find(p => p.id === 'spotify');
    for (let i = 0; !sp.auth && i < 300; i++) await new Promise(r => setTimeout(r, 100));
    return { seen: sp.seen, auth: !!sp.auth, rel: sp.auth ? await sp.fetchRelease('4m2880jivSbbyEGAKfITCa') : null };
  });
  check(rel.auth, `a late start still hears a token (${rel.seen} request(s) seen)`);
  check(rel.rel && rel.rel.title === 'Random Access Memories' && rel.rel.mediums[0].tracks.length === 13, `…and reads the album with the known query id (${rel.rel && rel.rel.title})`);
});

// majkinetor's next log: "the hook saw 0 request(s)", hooked while the document was still loading.
// His manager sandboxes the script: unsafeWindow's fetch there isn't the page's. Here the script
// gets a stand-in unsafeWindow, so only the in-page hook (a blob: script) can hear the player.
test('Spotify: in a sandbox, the in-page hook hears the player', { tag: ['@web'] }, async ({ page, inject }) => {
  const sandboxed = code => `(function (unsafeWindow) {\n${code}\n})({ fetch: function () {}, XMLHttpRequest: function () {} });`;
  await inject('first_contact', { atStart: true, transform: sandboxed });
  await page.goto('https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa', { waitUntil: 'domcontentloaded' });
  await page.locator('#fc-root .fc-go').waitFor({ state: 'visible', timeout: 30000 });
  const r = await page.evaluate(async () => {
    const sp = window.__fcTest.providers.find(p => p.id === 'spotify');
    for (let i = 0; !sp.auth && i < 200; i++) await new Promise(res => setTimeout(res, 100));
    return { seen: sp.seen, auth: !!sp.auth, hash: !!sp.hash, title: sp.auth ? (await sp.fetchRelease('4m2880jivSbbyEGAKfITCa')).title : null };
  });
  check(r.auth && r.seen > 0, `the player is heard through the page (${r.seen} request(s), token ${r.auth})`);
  check(r.title === 'Random Access Memories', `and the album is read (${r.title}; the player's own query id heard: ${r.hash})`);
});
