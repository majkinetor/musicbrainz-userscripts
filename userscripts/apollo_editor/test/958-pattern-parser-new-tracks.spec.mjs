// The pattern Track parser on a new release: the tracks it adds keep their artists in MB, so
// Reset # (which re-reads MB) still shows them. MB mounts each new row's artist-credit editor a
// moment after the track is added, and that editor wrote its empty credit over the parser's.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm, mbTracks } from './ap.mjs';

test.use({ gm: apolloGm({ autoMatch: false }) });

test('Reset # after the pattern parser on a new release keeps titles and artists', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { seed: {}, tab: 'tracklist' });
  await page.evaluate(() => window.__apolloEditor.openTrackPatternParser(0));
  await page.waitForSelector('#tc-tpppop');
  await page.evaluate(() => document.querySelector('#tc-tpppop .tc-tpp-src').classList.remove('tc-collapsed'));
  await page.fill('#tc-tpppop .tc-tpp-pi', '#. T - A');
  await page.fill('#tc-tpppop .tc-tpp-ta', '1. Alpha - Nobody One\n2. Beta - Nobody Two\n3. Gamma - Nobody Three');
  await page.click('#tc-tpppop .tc-tpp-ok');
  await until(() => mbTracks(page), t => t.length === 3);
  await page.waitForTimeout(1000);   // past the moment MB's new rows mount
  const mb = await mbTracks(page);
  check(mb.map(t => t.artists[0]).join('|') === 'Nobody One|Nobody Two|Nobody Three', `MB holds the parsed artists (${JSON.stringify(mb.map(t => t.artists))})`);

  await page.evaluate(() => window.__apolloEditor.runMediumTool('resetnum', 0));
  const shown = await until(() => page.evaluate(() => window.__apolloEditor.model.tracks.map(t => t.title + ' - ' + t.slots.map(s => s.name || s.creditedAs).join(', '))), m => m.length === 3);
  check(shown.join('|') === 'Alpha - Nobody One|Beta - Nobody Two|Gamma - Nobody Three', `after Reset # Apollo still shows them (${JSON.stringify(shown)})`);
});
