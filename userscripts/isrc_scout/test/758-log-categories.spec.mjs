// #758: a category per source. A line is tagged by the source it starts with (molla and ISRC Hunt
// are Spotify's), the edits on MusicBrainz are "MusicBrainz", and a line naming no source has none.
import { test, check } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });

test('#758: each log line carries its source as its category', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await openScout(page, inject);
  const cats = await page.evaluate(() => {
    const L = window.__isrcScoutLogger;
    const lines = ['Spotify: importing album x', 'molla #4 GBCCH9600297 "Above & Beyond"', 'SX lookup GBCCH9600297 (#4)',
      'YouTube Music GBCCH9600294 → x', 'Tidal 429 — backing off 4000ms', 'Submitting 10 ISRC(s)', 'Linked 10 track-links on MusicBrainz',
      'Track ISRC provider → Deezer'];
    lines.forEach((m, i) => (i % 2 ? L.warn : L.info)(m));
    const e = L.entries();
    return lines.map(m => { const x = e.find(y => y.msg === m); return x ? (x.cat || '') : '?'; });
  });
  const want = ['Spotify', 'Spotify', 'SoundExchange', 'YouTube Music', 'Tidal', 'MusicBrainz', 'MusicBrainz', ''];
  check(JSON.stringify(cats) === JSON.stringify(want), `categories ${JSON.stringify(cats)}`);
  await page.click('#ii-log-link');
  await page.waitForSelector('#mbu-logpop', { timeout: 5000 });
  const chips = await page.locator('#mbu-logpop').innerText();
  check(/Spotify/.test(chips) && /SoundExchange/.test(chips) && /MusicBrainz/.test(chips), 'the Log window offers them as filters');
});
