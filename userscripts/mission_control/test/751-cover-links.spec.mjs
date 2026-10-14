// #751: each platform Art Station searched shows the size of its own cover and links it (the cover the search found
// and dropped for the best). A stand-in Art Station sends the rows as its adapter builds them.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';

test('#751: a searched platform shows its cover\'s size and links it', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => send('mc:findings', { id: 'as', run: d.run, release: d.release, summary: 'Cover art: none yet', findings: [
        { key: 'Tidal', name: 'Tidal', icon: 'tidal', url: 'https://tidal.com/album/16421793', state: 'new', role: 'best', why: 'the best cover (1440×1440): entered as the front cover', cover: { w: 1440, h: 1440, bytes: 1400000, url: 'https://resources.tidal.com/images/x/1280x1280.jpg' } },
        { key: 'Discogs', name: 'Discogs', icon: 'discogs', url: 'https://www.discogs.com/release/1517441', state: 'new', role: 'searched', why: 'searched: 600×600; only Tidal\'s larger cover is entered', cover: { w: 600, h: 600, bytes: 90000, url: 'https://i.discogs.com/x.jpg' } },
        { key: 'Deezer', name: 'Deezer', icon: 'deezer', url: 'https://www.deezer.com/album/4932041', state: 'new', role: 'searched', why: 'searched: no cover; only Tidal\'s larger cover is entered' },
      ] }), 50);
    });
    send('mc:provider', { id: 'as', name: 'Art Station', version: 1, capabilities: ['probe', 'apply'] });
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root [data-card="as"] .mc-line');
  const rows = await page.locator('#mc-root [data-card="as"] .mc-line').evaluateAll(ls => ls.map(l => ({ name: l.querySelector('.t').textContent.trim(), cover: (l.querySelector('.mc-coverlink') || {}).textContent || null, href: (l.querySelector('.mc-coverlink') || {}).href || null, why: (l.querySelector('div.s') || {}).textContent || '' })));
  console.log(JSON.stringify(rows));
  const dc = rows.find(r => r.name === 'Discogs'), dz = rows.find(r => r.name === 'Deezer'), td = rows.find(r => r.name === 'Tidal');
  check(dc && dc.cover === 'cover ↗' && dc.href === 'https://i.discogs.com/x.jpg' && /searched: 600×600/.test(dc.why), `a searched platform: its cover's size in the reason, the cover linked (${JSON.stringify(dc)})`);
  check(td && td.cover === 'cover ↗', 'the best one links its cover too');
  check(dz && !dz.cover && /no cover/.test(dz.why), 'a platform without a cover says so, with no link');
  await page.locator('#mc-root .mc-sect:has([data-card="as"])').screenshot({ path: 'test-results/mc-751-cover-links.png' });
});
