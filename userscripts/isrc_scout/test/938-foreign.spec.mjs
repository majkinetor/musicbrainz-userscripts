import { test, expect, functionSource } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh', gm: false });

test('foreign tracklists survive column filling, cleanup and colspan restoration', { tag: '@unit' }, async ({ page }) => {
  await page.setContent('<section data-mbu-foreign="saed"><table><thead><tr><th colspan="3" data-ii-colspan="1">Medium</th></tr></thead><tbody><tr class="subh"><th>Track</th></tr><tr id="track"><td>Title</td><td class="ii-col">SAED sorting and filter</td></tr></tbody></table></section>');
  await page.addScriptTag({ content: `
    let _tdQueued, _tdObs; const RELEASE = { tracks: [{ trackId: 'track' }] }, IS_OVERVIEW = false;
    const paintColToggles = () => {}, trackDataEnabled = () => true, trackCols = () => ({ isrc: true, links: true });
    const addCols = tr => { tr.dataset.modified = 'yes'; };
    const trackDataCells = () => [];
    ` + await functionSource('isrc_scout', ['fillTrackData', 'showTrackData']) });
  const before = await page.locator('section').innerHTML();
  await page.evaluate(() => { fillTrackData(); showTrackData(); });
  expect(await page.locator('section').innerHTML()).toBe(before);
});

test('platform metadata describes the grouped link, including mixed ended states', { tag: '@unit' }, async ({ page }) => {
  await page.setContent('<main></main>');
  await page.addScriptTag({ content: `const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
    const isrcHtml = s => s;
    const TrackLinks = { pageLinks: t => t.links };
    ` + await functionSource('isrc_scout', ['trackDataCells']) });
  const got = await page.evaluate(() => {
    const links = [true, false].map(ended => ({ name: 'Tidal', ended, url: 'https://tidal.com/1', color: '', icon: '' }));
    document.querySelector('main').innerHTML = trackDataCells({ existing: [], links })[1];
    const a = document.querySelector('a'); return { platform: a.dataset.iiPlatform, ended: a.dataset.iiEnded };
  });
  expect(got).toEqual({ platform: 'Tidal', ended: 'false' });
});
