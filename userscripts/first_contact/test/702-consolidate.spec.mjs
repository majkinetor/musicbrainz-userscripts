// #702: Consolidate. The button beside Import reads the album as Import does, stores it for
// Mission Control under fc.handoff.cons.<token>, and opens MusicBrainz's /release/add#mc=<token>,
// where Mission Control compares it with the other platforms. ⚙︎ → Consolidate button hides it.
//
// The album page is a stand-in (routed): Deezer's API is read for real.
import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'First Contact' } });

const ALBUM = 'https://www.deezer.com/en/album/302127';

test('Consolidate stores the album for Mission Control and opens its page', { tag: ['@web', '@critical'] }, async ({ page, inject }) => {
  await page.route(ALBUM, r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>album</title><body><h1>album</h1></body>' }));
  await page.goto(ALBUM);
  await inject('first_contact', { waitFor: '__fcTest' });
  const b = page.locator('#fc-root .fc-cons');
  await b.waitFor({ state: 'visible' });
  check(/^Consolidate in Mission Control: read this Deezer album/.test(await b.getAttribute('title')), `the tooltip says what it does: ${await b.getAttribute('title')}`);
  await b.click();
  const sent = await until(() => page.evaluate(() => window.__fcLastCons && { token: window.__fcLastCons.token, url: window.__fcLastCons.url }), Boolean, { timeout: 60_000 });
  check(sent && new RegExp('^https://musicbrainz\\.org/release/add#mc=' + sent.token + '$').test(sent.url), `Mission Control's page: ${sent && sent.url}`);
  const stored = await page.evaluate(t => GM_getValue('fc.handoff.cons.' + t, null), sent.token);
  check(stored && stored.source === 'deezer' && stored.rel.title === 'Discovery' && stored.rel.mediums[0].tracks.length === 14, `the album is stored for it: ${stored && stored.rel.title}, ${stored && stored.rel.mediums[0].tracks.length} tracks`);
  check(stored && stored.platform.abbr === 'dz' && stored.rel.credit[0].url === 'https://www.deezer.com/artist/27', 'with the platform and the artists\' links');

  await page.click('#fc-root .fc-more');
  await page.locator('#fc-panel .fc-cons-opt').uncheck();
  check(await b.isHidden(), '⚙︎ → Consolidate button hides it');
});
