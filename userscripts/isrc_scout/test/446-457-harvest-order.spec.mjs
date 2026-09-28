// Track order from two page-scraped sources.
//
// #446: ISRC Hunt restarts the track number on every Spotify disc and has no disc
// column, so a two-disc album read 1..13,1..12 all on disc 1, and the second disc's rows
// collided with the first medium's. The real parseIsrchunt, on ISRC Hunt's page for the
// reported album (Stan Getz, 13 + 12): rows 14-25 must land on disc 2 at 1-12. The page
// is fixtures/isrchunt-446.html: recorded from isrchunt.com on the first run that can
// reach it, and skipped (saying so) until then.
//
// #457: Beatport's release PAGE embeds the tracklist id-descending (the reverse of album
// order) with no track number, so the harvest's positions came out reversed against the
// API. The harvester now sorts by id. A stub Beatport page carries chaban's release
// (2727783, 29 tracks) the way Beatport serves it, and the real harvester reads it.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { test, check, sourceOf } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh', gm: { name: 'ISRC Scout' } });

test('#446: an ISRC Hunt album with two discs is split into its discs', { tag: ['@unit', '@web'] }, async ({ page }) => {
  const FIXTURE = new URL('./fixtures/isrchunt-446.html', import.meta.url);
  if (!existsSync(FIXTURE)) {
    const html = await fetch('https://isrchunt.com/spotify/importisrc?releaseId=' + encodeURIComponent('https://open.spotify.com/album/2KnY7wRhELHc5s3Yq0T7gk'), { headers: { 'User-Agent': 'mb-userscripts-tests/1.0', Accept: 'text/html' }, signal: AbortSignal.timeout(20000) }).then(r => r.ok ? r.text() : null).catch(() => null);
    test.skip(!html, 'isrchunt.com is unreachable and the page has not been recorded yet');
    await writeFile(FIXTURE, html);
  }
  const html = await readFile(FIXTURE, 'utf8');
  const src = await readFile(sourceOf('isrc_scout'), 'utf8');
  const a = src.indexOf('function parseIsrchunt'), b = src.indexOf('async function fetchSpotify', a);
  const parseFn = src.slice(a, b).trim();
  await page.setContent('<!doctype html><body></body>');
  const rows = await page.evaluate(({ parseFn, html }) => {
    // parseIsrchunt's own helpers, as in the script
    const ISRC_RE = /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/;
    const normalizeIsrc = raw => String(raw || '').toUpperCase().replace(/[\s-]/g, '');
    const isValidIsrc = s => ISRC_RE.test(normalizeIsrc(s));
    const msToMmSs = ms => { if (!ms) return null; const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    const parse = new Function('html', 'DOMParser', 'normalizeIsrc', 'isValidIsrc', 'msToMmSs', parseFn.replace(/^function parseIsrchunt\s*\(html\)\s*\{/, '').replace(/\}$/, ''));
    return parse(html, DOMParser, normalizeIsrc, isValidIsrc, msToMmSs);
  }, { parseFn, html });
  const d1 = rows.filter(r => r.disc === 1), d2 = rows.filter(r => r.disc === 2);
  check(rows.length === 25 && d1.length === 13 && d2.length === 12, `25 rows: 13 on disc 1, 12 on disc 2 (${rows.length}: ${d1.length} + ${d2.length})`);
  check(d1.every((r, i) => r.pos === i + 1) && d2.every((r, i) => r.pos === i + 1), 'each disc numbers from 1');
});

test('#457: a Beatport page harvest is in album order', { tag: '@unit' }, async ({ page, context, inject }) => {
  const first = 12603496;
  const results = Array.from({ length: 29 }, (_, i) => ({ id: first - i, isrc: 'AUXN21934' + (264 - i), name: i === 0 ? 'Luly' : 'track ' + (i + 1), artists: [{ name: 'X' }] }));
  const nextData = { props: { pageProps: { dehydratedState: { queries: [{ state: { data: { results } } }] } } } };
  const URL_ = 'https://www.beatport.com/release/balance-presents-the-soundgarden/2727783';
  await context.route(URL_, r => r.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></body></html>` }));
  await inject('isrc_scout', { atStart: true });
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!GM_getValue('ii:beatport_harvest_2727783'), null, { timeout: 10000 });
  const tracks = await page.evaluate(() => GM_getValue('ii:beatport_harvest_2727783').tracks);
  check(tracks[0].pos === 1 && tracks[0].isrc === 'AUXN21934236', `position 1 is the lowest id, album track 1 (${JSON.stringify(tracks[0])})`);
  check(tracks[28].isrc === 'AUXN21934264', `position 29 is the last (${tracks[28].isrc})`);
  check(tracks.every((t, i) => i === 0 || tracks[i - 1].isrc <= t.isrc), 'ISRCs rise with position, as in the API');
});
