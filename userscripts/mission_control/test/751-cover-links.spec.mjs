// #751: each platform Art Station searched shows the size of its own cover in a column on the right, a link to the cover
// (the cover the search found and dropped for the best). A stand-in Art Station sends the rows as its adapter builds them.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';

test('#751: a searched platform shows its cover\'s size on the right and links it', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => send('mc:findings', { id: 'as', run: d.run, release: d.release, summary: 'Cover art: 1 image, front cover ✓', findings: [
        { key: 'Tidal', name: 'Tidal', icon: 'tidal', url: 'https://tidal.com/album/16421793', state: 'unsure', role: 'best', why: 'the best cover; not larger than the current front (1440×1440)', cover: { w: 1440, h: 1440, bytes: 1400000, url: 'https://resources.tidal.com/images/x/1280x1280.jpg' } },
        { key: 'Discogs', name: 'Discogs', icon: 'discogs', url: 'https://www.discogs.com/release/1517441', state: 'unsure', role: 'searched', why: 'Tidal\'s was the largest found', cover: { w: 600, h: 600, bytes: 90000, url: 'https://i.discogs.com/x.jpg' } },
        { key: 'Deezer', name: 'Deezer', icon: 'deezer', url: 'https://www.deezer.com/album/4932041', state: 'unsure', role: 'searched', why: 'Tidal\'s was the largest found', cover: { w: 0, h: 0, bytes: 0, url: '' } },
      ] }), 50);
    });
    send('mc:provider', { id: 'as', name: 'Art Station', version: 1, capabilities: ['probe', 'apply'] });
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root [data-card="as"] .mc-line');
  const rows = await page.locator('#mc-root [data-card="as"] .mc-line').evaluateAll(ls => ls.map(l => {
    const c = l.querySelector('.mc-csize'), p = l.querySelector('.mc-pill');
    return { name: l.querySelector('.t').textContent.trim(), size: c ? c.textContent : null, href: c && c.href || null, right: c ? Math.round(c.getBoundingClientRect().right) : null, pill: p ? Math.round(p.getBoundingClientRect().left) : null };
  }));
  console.log(JSON.stringify(rows));
  await page.locator('#mc-root .mc-sect:has([data-card="as"])').screenshot({ path: 'test-results/mc-751-cover-links.png' });
  const dc = rows.find(r => r.name === 'Discogs'), dz = rows.find(r => r.name === 'Deezer'), td = rows.find(r => r.name === 'Tidal');
  check(dc && dc.size === '600×600 ↗' && dc.href === 'https://i.discogs.com/x.jpg', `a searched platform: its cover's size, a link to the cover (${JSON.stringify(dc)})`);
  check(td && td.size === '1440×1440 ↗', 'the best one shows its size and links its cover too');
  check(dz && dz.size === 'no cover' && !dz.href, 'a platform without a cover says so, with no link');
  check(new Set(rows.map(r => r.right)).size === 1, `the sizes line up on the right, whatever the pill (${rows.map(r => r.right)})`);
});
