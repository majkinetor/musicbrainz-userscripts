// #765 (chaban-mb): "Would it be possible to reuse the MB supplied CSS to show icons of sites that
// appear in sidebar? The tracklist is using a placeholder icon … whereas the MB recording page has
// the IMDb icon in sidebar."
//
// test.musicbrainz.org; the first recording's reply gets an IMDb, a YouTube and an unknown site's link.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });

const LINKS = {
  imdb: 'https://www.imdb.com/title/tt0000001/',
  youtube: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
  unknown: 'https://mbu-765.example.org/x',
};
const addLinks = j => {
  const rec = j.media[0].tracks[0].recording;
  rec.relations = (rec.relations || []).concat(Object.values(LINKS).map(resource => ({
    'target-type': 'url', type: 'free streaming', ended: false, direction: 'forward', url: { resource, id: '00000000-0000-0000-0000-000000000000' },
  })));
};
// each link's icon in a box: MB's class (and whether its sheet draws it) or an svg
const icons = (page, sel) => page.evaluate(([sel, links]) => Object.fromEntries(Object.entries(links).map(([k, u]) => {
  const a = [...document.querySelectorAll(sel)].find(x => x.getAttribute('href') === u);
  const f = a && a.querySelector('.ii-mbfav');
  return [k, !a ? null : f ? { cls: [...f.classList].find(c => c.endsWith('-favicon')), drawn: getComputedStyle(f).backgroundImage !== 'none', w: f.getBoundingClientRect().width } : { svg: !!a.querySelector('svg') }];
})), [sel, LINKS]);

test('a site ISRC Scout has no icon for shows MusicBrainz\'s own icon, an unknown one the globe', { tag: ['@sandbox', '@cosmetic'] }, async ({ page, inject }) => {
  await openScout(page, inject, { edit: addLinks, open: false });
  const row = await until(() => icons(page, 'td.ii-col-links .ii-trk-ln'), r => r.imdb && r.youtube && r.unknown, { timeout: 45000 });
  console.log('tracklist', JSON.stringify(row));
  check(row.imdb?.cls === 'imdb-favicon' && row.imdb.drawn && row.imdb.w === 15, `tracklist: IMDb gets MB's imdb-favicon, drawn at 15px (${JSON.stringify(row.imdb)})`);
  check(row.youtube?.cls === 'youtube-favicon' && row.youtube.drawn, `tracklist: YouTube gets MB's youtube-favicon (${JSON.stringify(row.youtube)})`);
  check(row.unknown?.svg, `tracklist: a site MB has no icon for keeps the globe (${JSON.stringify(row.unknown)})`);

  await page.evaluate(() => document.getElementById('ii-btn').click());
  await page.waitForSelector('#ii-modal.open', { timeout: 15000 });
  const dlg = await until(() => icons(page, '#ii-modal .ii-tl-linked .ii-tl'), r => r.imdb && r.youtube && r.unknown, { timeout: 45000 });
  console.log('dialog', JSON.stringify(dlg));
  check(dlg.imdb?.cls === 'imdb-favicon' && dlg.imdb.drawn && dlg.imdb.w === 16, `dialog: IMDb gets MB's imdb-favicon, drawn at 16px (${JSON.stringify(dlg.imdb)})`);
  check(dlg.unknown?.svg, `dialog: the unknown site keeps the globe (${JSON.stringify(dlg.unknown)})`);
});
