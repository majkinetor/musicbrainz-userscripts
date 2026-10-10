// #702 (majkinetor, on Mission Control's best cover from Discogs): "looks like some random cover is
// taken from Discogs" · "discogs doesn't have types, 1st one to come is front". The best cover is
// the largest of each source's FIRST image, not of every image a source gives (back, inserts, a
// tracklist scan…). The rule is checked on staged items through the test hook.
import { test, check } from '../../../dev/test/harness.mjs';
import { openArtStation } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

test('#702: only each source\'s first image competes for the best cover', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openArtStation(page, inject);
  const r = await page.evaluate(() => {
    const { frontsOf, pickBest } = window.__asTest.best;
    // Discogs: the front (600×600) arrives first, then a larger tracklist scan; Deezer: one front
    const items = [
      { id: 'dc-tracklist', _provUrl: 'https://www.discogs.com/release/6503066', _provider: 'Discogs', _seq: 2, w: 1200, h: 1200, bytes: 1 },
      { id: 'dz-front', _provUrl: 'https://www.deezer.com/album/1', _provider: 'Deezer', _seq: 3, w: 1000, h: 1000, bytes: 1 },
      { id: 'dc-front', _provUrl: 'https://www.discogs.com/release/6503066', _provider: 'Discogs', _seq: 1, w: 600, h: 600, bytes: 1 },
    ];
    const fronts = frontsOf(items);
    return { fronts: fronts.map(x => x.id).sort(), best: pickBest(fronts).id };
  });
  check(JSON.stringify(r.fronts) === '["dc-front","dz-front"]', 'each source\'s first image is its front: ' + r.fronts);
  check(r.best === 'dz-front', 'the best of the fronts wins, not the larger tracklist scan: ' + r.best);
});
