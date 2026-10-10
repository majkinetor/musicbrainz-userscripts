// #709: a link that is another release must say so. On Lou Rawls's "Stormy Monday" (Digital
// Media, 13 tracks) YouTube Music's 10-track album sat in the empty-barcode lane, withheld only for
// "barcode not confirmed", which a lane doesn't repeat: nothing said 10 tracks, so it was taken in by
// hand. Discogs's vinyl was the same. PC now sends the track count and format, and its mismatch
// reasons lead its why: MC shows them in amber on the row, marks the lane icon, and take all in
// leaves those links out. A stand-in PC answers the probe with the platforms of that release.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // any sandbox release: the findings are the stand-in's

test('#709: a track count or format that is not the release\'s shows, and take all in skips it', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    const yt = '10 tracks, the release has 13', dc = 'Vinyl, the release is Digital Media';
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => send('mc:findings', { id: 'pc', run: d.run, barcode: '0077779144150', findings: [
        { key: 'spotify', name: 'Spotify', url: 'https://open.spotify.com/album/2E5VtJahYu8mM1fjycL5ds', state: 'linked', barcode: '077779144150' },
        { key: 'discogs', name: 'Discogs', url: 'https://www.discogs.com/release/1581402', state: 'withheld', tracks: 10, mbTracks: 13, format: 'Vinyl',
          mismatch: [yt, dc], why: yt + ' · ' + dc + ' · barcode not confirmed' },
        { key: 'ytmusic', name: 'YouTube Music', url: 'https://music.youtube.com/playlist?list=OLAK5uy_x', state: 'withheld', tracks: 10, mbTracks: 13,
          mismatch: [yt], why: yt + ' · barcode not confirmed' },
        { key: 'amazonmusic', name: 'Amazon Music', url: 'https://music.amazon.com/albums/B000TETKHQ', state: 'withheld', tracks: 13, mbTracks: 13, why: 'barcode not confirmed' }] }), 50);
    });
    send('mc:provider', { id: 'pc', name: 'Platform Check', version: 1, capabilities: ['probe', 'apply'] });
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root [data-card="pc"] .mc-bcl');

  const card = page.locator('#mc-root .mc-sect:has([data-card="pc"])');
  const lane = card.locator('.mc-bcl').nth(1);   // the release's lane, then the empty-barcode one
  check((await lane.locator('.mc-bc').innerText()).trim() === '', 'the second lane is the empty-barcode one');
  const off = await lane.locator('.mc-ti.off').evaluateAll(is => is.map(i => i.dataset.key));
  check(off.join() === 'discogs,ytmusic', `the folded lane marks Discogs and YouTube Music (${off})`);
  const mark = await lane.locator('.mc-ti.off').first().evaluate(i => getComputedStyle(i, '::before').backgroundColor);
  const warn = await page.evaluate(() => { const s = document.createElement('span'); s.style.color = 'var(--mbu-warn)'; document.querySelector('#mc-root').append(s); const c = getComputedStyle(s).color; s.remove(); return c; });
  check(mark === warn, `the mark is amber (${mark})`);
  check((await lane.locator('.mc-ti[data-key="ytmusic"]').getAttribute('title')).includes('10 tracks, the release has 13'), 'the icon\'s tooltip says why');

  // take all in takes only Amazon Music; the marked ones still toggle one by one
  await lane.locator('.mc-all').click();
  check((await page.evaluate(() => window.__mcTest.picked().pc)).join() === 'amazonmusic', 'take all in leaves the mismatched links out');
  check((await lane.locator('.mc-all').textContent()).includes('all taken in'), 'and reads all taken in');
  await lane.locator('.mc-ti[data-key="ytmusic"]').click();
  check((await page.evaluate(() => window.__mcTest.picked().pc)).sort().join() === 'amazonmusic,ytmusic', 'a marked link is still taken in by hand');

  // opened into rows: the mismatch in amber, the barcode reason left to the lane
  await lane.locator('.mc-bc').click();
  const rows = await card.locator('.mc-line.mc-in').evaluateAll(rs => rs.map(r => ({ t: r.querySelector('.t').textContent, s: (r.querySelector('div.s') || {}).textContent || '', amber: [...r.querySelectorAll('.mc-off')].map(b => b.textContent) })));
  console.log(JSON.stringify(rows));
  const by = k => rows.find(r => r.t === k) || {};
  check(by('YouTube Music').s === '10 tracks, the release has 13' && by('YouTube Music').amber.length === 1, 'YouTube Music\'s row says 10 tracks, in amber');
  check(by('Discogs').amber.join(' | ') === '10 tracks, the release has 13 | Vinyl, the release is Digital Media', 'Discogs\'s says 10 tracks and vinyl');
  check(by('Amazon Music').s === '' && rows.every(r => !r.s.includes('barcode')), 'no barcode reason in a lane, and nothing on the matching one');
  await card.screenshot({ path: 'test-results/mc-709-pc-mismatch.png' });
});
