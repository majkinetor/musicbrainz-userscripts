// #841: the review shows ISRC Scout's changes as a grid of tracks by platform (a track's and a platform's box select
// their changes), lists only the cover Art Station enters, and copies the selected changes as Markdown. Stand-ins
// for ISRC Scout and Art Station give the rows.
import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // any sandbox release: the findings are the stand-ins'

test('#841: the review is a grid of tracks by platform; only the entered cover is listed', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const recs = [...new Set([...document.querySelectorAll('#content table.medium a[href*="/recording/"]')].map(a => a.href.match(/recording\/([0-9a-f-]{36})/)[1]))].slice(0, 2);
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    window.__applies = [];
    const IS = [
      { key: 'i1', kind: 'isrc', track: recs[0], isrc: 'DEU671302217', state: 'new' },
      { key: 'l1', kind: 'link', track: recs[0], url: 'https://open.spotify.com/track/AAA', state: 'new' },
      { key: 'l2', kind: 'link', track: recs[0], url: 'https://www.deezer.com/track/111', state: 'new' },
      { key: 'l3', kind: 'link', track: recs[1], url: 'https://open.spotify.com/track/BBB', state: 'new' },
    ];
    const AS = [
      { key: 'Spotify', name: 'Spotify', icon: 'spotify', url: 'https://open.spotify.com/album/1', state: 'new', role: 'best' },
      { key: 'Discogs', name: 'Discogs', icon: 'discogs', url: 'https://www.discogs.com/release/1', state: 'new', role: 'searched' },
    ];
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => {
        if (d.id === 'is' || !d.id) send('mc:findings', { id: 'is', run: d.run, release: d.release, summary: '', findings: IS });
        if (d.id === 'as' || !d.id) send('mc:findings', { id: 'as', run: d.run, release: d.release, summary: '', findings: AS, best: { w: 1400, h: 1400 } });
      }, 50);
    });
    document.addEventListener('mc:apply', e => {
      const d = JSON.parse(e.detail);
      window.__applies.push([d.id, d.keys]);
      setTimeout(() => send('mc:applied', { id: d.id, run: d.run, release: d.release, ok: true, sent: d.keys.length, note: 'done' }), 50);
    });
    send('mc:provider', { id: 'is', name: 'ISRC Scout', version: 1, capabilities: ['probe', 'apply'] });
    send('mc:provider', { id: 'as', name: 'Art Station', version: 1, capabilities: ['probe', 'apply'] });
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await until(() => page.locator('#mc-root [data-act="exec"]').textContent(), t => /^Execute \(\d+\)$/.test(t), { timeout: 10_000 });
  await page.click('#mc-root [data-act="exec"]');
  const rv = page.locator('.mc-review');
  await rv.waitFor();
  const grid = rv.locator('.mc-rv-grid');
  check(await grid.locator('tbody tr').count() === 2, 'a row per track');
  check(await grid.locator('thead input[data-col]').count() === 3, 'a column each: ISRC, Deezer, Spotify');
  const cover = await rv.locator('.mc-rv-i').allTextContents();
  check(cover.length === 1 && /Spotify, 1400×1400/.test(cover[0]), `only the entered cover (${JSON.stringify(cover)})`);
  await rv.screenshot({ path: 'test-results/mc-841-review-grid.png' });
  // the Spotify column off: both tracks' Spotify links leave
  const spot = grid.locator('thead th').nth(3).locator('input');
  await spot.uncheck();
  check(await grid.locator('tbody input[data-key]:checked').count() === 2, 'a platform\'s box unselects its column');
  check(await page.evaluate(() => document.querySelector('.mc-review tbody input[data-grp]').indeterminate), 'a track with some left shows "some"');
  await rv.locator('[data-rv="md"]').click();
  const md = await until(() => page.evaluate(() => window.__mcReviewMarkdown), m => !!m, { timeout: 5_000 });
  check(/DEU671302217/.test(md) && /Deezer/.test(md) && !/spotify\.com\/track/.test(md), `the Markdown holds only the selected (${md})`);
  await rv.locator('[data-rv="go"]').click();
  const applies = await until(() => page.evaluate(() => window.__applies), a => a.length >= 2, { timeout: 10_000 });
  const is = applies.find(a => a[0] === 'is');
  check(is && JSON.stringify(is[1].sort()) === '["i1","l2"]', `only the selected are sent (${JSON.stringify(applies)})`);
});
