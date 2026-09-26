// #501 (majkinetor): Art Station's settings (artstation:settings) and log-window state
// (artstation:logwin) moved from localStorage to GM storage, which a script manager
// backs up and syncs. An old localStorage value is adopted into GM storage once, when
// GM storage has none, and left in place.
//
// test.musicbrainz.org, read-only.
import { test, check } from '../../../dev/test/harness.mjs';
import { openArtStation } from './as.mjs';

const settings = page => page.evaluate(() => JSON.parse(GM_getValue('artstation:settings') || 'null'));

test.describe('with no GM value yet', () => {
  test.use({ gm: { name: 'Art Station' } });
  test('the old localStorage settings are adopted', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openArtStation(page, inject, {
      path: 'add-cover-art',
      // not showOrig: true, which hides #as-root in favour of MusicBrainz's page
      before: () => page.evaluate(() => {
        localStorage.setItem('artstation:settings', JSON.stringify({ tile: 333, hideMbFooter: false, sort: 'name' }));
        localStorage.setItem('artstation:logwin', JSON.stringify({ open: true, x: 55 }));
      }),
    });
    const s = await settings(page);
    check(s && s.tile === 333 && s.hideMbFooter === false && s.sort === 'name', `adopted into GM storage, through the document-start read too (${JSON.stringify(s)})`);
    check(await page.evaluate(() => localStorage.getItem('artstation:settings') !== null), 'the old localStorage key is left in place');
    await page.evaluate(() => { localStorage.removeItem('artstation:settings'); localStorage.removeItem('artstation:logwin'); });
  });
});

test.describe('with a GM value', () => {
  test.use({ gm: { name: 'Art Station', values: { 'artstation:settings': JSON.stringify({ tile: 250, sort: 'type' }) } } });
  test('GM storage wins over a different localStorage value', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openArtStation(page, inject, {
      path: 'add-cover-art',
      before: () => page.evaluate(() => localStorage.setItem('artstation:settings', JSON.stringify({ tile: 999, sort: 'name' }))),
    });
    const s = await settings(page);
    check(s && s.tile === 250, `the GM value wins (tile ${s && s.tile}, not 999)`);
    await page.evaluate(() => localStorage.removeItem('artstation:settings'));
  });
});
