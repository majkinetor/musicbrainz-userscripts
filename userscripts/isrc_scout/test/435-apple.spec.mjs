// Apple Music as an ISRC source.
//
// #435: on "Distances" (Apple album 1715825602, all 16 tracks with an ISRC there) the
// Apple import button shows, and fills ISRCs from the anonymous amp-api.
// #436: a legacy iTunes URL is Apple Music too: "The Romantic Egotist" links
// https://itunes.apple.com/us/album/id1057026871, so the button shows, and pasting that
// URL imports through fetchApple (it failed with "fetcher is not a function").
//
// test.musicbrainz.org, with production's data (fixtures/ws-435*.json.gz). Apple is live.
import { test, check, until, answerGm } from '../../../dev/test/harness.mjs';
import { openScout, logText, ended } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });
const filled = page => page.evaluate(() => [...document.querySelectorAll('#ii-modal tbody input')].filter(i => i.dataset.autofill === '1' && /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(i.value.trim())).length);
const appleShown = page => page.evaluate(() => getComputedStyle(document.getElementById('ii-am-all')).display !== 'none');

test('an Apple album link fills ISRCs from Apple', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  const ws = await openScout(page, inject, {
    release: 'e78fb896-05d9-403d-aca1-6e79ab6c4219', replay: new URL('./fixtures/ws-435.json.gz', import.meta.url),
    // the album link, should the release lose it; and no ISRCs yet, as when this was
    // written (production has them all now, and the import would only confirm them)
    edit: j => {
      if (!(j.relations || []).some(x => /music\.apple\.com/.test(x.url?.resource || ''))) (j.relations = j.relations || []).push({ url: { resource: 'https://music.apple.com/us/album/distances/1715825602' } });
      (j.media || []).forEach(m => (m.tracks || []).forEach(t => { if (t.recording) t.recording.isrcs = []; }));
    },
  });
  check(await until(() => appleShown(page)), 'the Apple import button shows');
  await page.click('#ii-am-all');
  const log = await ended(page, 'Apple');
  check(/Apple album ".*": 16 track/.test(log), 'the album came back from amp-api, 16 tracks');
  check(/Apple done/.test(log), 'the import finished');
  check(await filled(page) >= 1, `ISRCs were filled (${await filled(page)})`);
  await ws.done();
});

test('a legacy iTunes link is Apple Music, and a pasted iTunes URL imports', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  const ws = await openScout(page, inject, { release: '1a82cf5b-74fe-4515-bb28-b4e1c0e2ef84', replay: new URL('./fixtures/ws-436.json.gz', import.meta.url) });
  check(await until(() => appleShown(page)), 'the iTunes link shows the Apple import button');
  await page.click('#ii-url-btn');
  await page.fill('#ii-url-input', 'https://itunes.apple.com/us/album/id1057026871');
  await page.press('#ii-url-input', 'Enter');
  const log = await ended(page, 'Apple');
  check(/importing pasted album us\/1057026871/.test(log), 'the URL is read as us/1057026871');
  check(!/fetcher is not a function/.test(log) && /Apple done/.test(log), 'the paste import finished');
  check(await filled(page) >= 1, `ISRCs were filled (${await filled(page)})`);
  await ws.done();
});

// The Apple token is cached in localStorage, shared with Platform Check. A refused one (stale,
// rotated, or a recorded stand-in a Platform Check replay left behind) broke every Apple import
// for up to 12 h: it is replaced once, and the import goes through.
test('a refused cached Apple token is replaced, and the import goes through', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  const bad = 'eyJ' + 'x'.repeat(120);
  const ws = await openScout(page, inject, {
    release: 'e78fb896-05d9-403d-aca1-6e79ab6c4219', replay: new URL('./fixtures/ws-435.json.gz', import.meta.url),
    edit: j => {
      if (!(j.relations || []).some(x => /music\.apple\.com/.test(x.url?.resource || ''))) (j.relations = j.relations || []).push({ url: { resource: 'https://music.apple.com/us/album/distances/1715825602' } });
      (j.media || []).forEach(m => (m.tracks || []).forEach(t => { if (t.recording) t.recording.isrcs = []; }));
    },
    before: async () => {
      // live, Apple's own session cookies can carry a read whatever the token says: the stale
      // token's read is answered 401 here, as Apple does without them
      answerGm(page.context(), o => /amp-api\.music\.apple\.com/.test(o.url) && ((o.headers || {}).Authorization || '').includes(bad) ? { status: 401, body: '' } : null);
      await page.context().addInitScript(t => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mbtools:apple-token', JSON.stringify({ t, at: Date.now() })); sessionStorage.setItem('seeded', '1'); } } catch (e) {} }, bad);
    },
  });
  check(await until(() => appleShown(page)), 'the Apple import button shows');
  await page.click('#ii-am-all');
  const log = await ended(page, 'Apple');
  check(/cached token was refused \(401\)/.test(log), 'the refused token is noticed');
  check(/Apple album ".*": 16 track/.test(log) && /Apple done/.test(log), 'a new one is fetched and the import finishes');
  check(await page.evaluate(() => !JSON.parse(localStorage.getItem('mbtools:apple-token') || '{}').t.startsWith('eyJxxx')), 'the refused token is gone from the cache');
  await ws.done();
});
