// Audiomack (#664), as an ISRC source and a per-track link source. ISRCs come from the
// album's tracks through Audiomack's signed API (the web player's public consumer key,
// no login).
//
//   - a release linking an Audiomack album: the import button shows and the album's
//     ISRCs come back; a pasted album URL imports too;
//   - the album lists each song's own page, the per-track link Find links offers.
//
// test.musicbrainz.org (a copy of a release, with production's data from
// fixtures/ws-439.json.gz; any release will do, the album is what's read). Audiomack is
// live. Nothing is submitted.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openScout, ended } from './is.mjs';

const KAWAII = 'ec2449a8-3dc5-461c-80a1-e43d96345613';
const ALBUM = 'https://audiomack.com/burna-boy/album/no-sign-of-weakness-6579609';
const withAlbum = j => { (j.relations = j.relations || []).push({ url: { resource: ALBUM } }); };
test.use({ gm: { name: 'ISRC Scout' } });

test('an Audiomack album gives its ISRCs, and a pasted album URL imports', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  const ws = await openScout(page, inject, { release: KAWAII, replay: new URL('./fixtures/ws-439.json.gz', import.meta.url), edit: withAlbum });
  check(await until(() => page.evaluate(() => getComputedStyle(document.getElementById('ii-ak-all')).display !== 'none')), 'the Audiomack import button shows');
  await page.click('#ii-ak-all');
  let log = await ended(page, 'Audiomack', 90000);
  check(/Audiomack "No Sign of Weakness": 16 track\(s\), barcode 075679623539/.test(log), 'the album came back through the signed API, with its barcode');
  check(/Audiomack: 16 of 16 track\(s\) carry an ISRC/.test(log), 'every track carries an ISRC');

  await page.click('#ii-url-btn');
  await page.fill('#ii-url-input', 'https://www.audiomack.com/burna-boy/song/tatata-feat-travis-scott-2564133');
  await page.press('#ii-url-input', 'Enter');
  await page.waitForFunction(() => /Audiomack: importing pasted album/.test(window.__isrcScoutLog?.() || ''), null, { timeout: 30000 }).catch(() => {});
  log = await ended(page, 'Audiomack');
  check(/Audiomack: importing pasted album https:\/\/audiomack\.com\/burna-boy\/song\/tatata/.test(log) && /Audiomack "TaTaTa[^"]*": 1 track/.test(log), 'a pasted song URL imports as a one-track release');

  const links = await page.evaluate(async a => (await window.__isrcScoutTest664.audiomackRelease(a)).tracks.slice(0, 2), ALBUM);
  check(links.length === 2 && links.every(t => /^https:\/\/audiomack\.com\/burna-boy\/song\/[^/]+$/.test(t.url) && /^USAT2/.test(t.isrc)), `each track has its own song page and ISRC (${JSON.stringify(links)})`);
  await ws.done();
});
