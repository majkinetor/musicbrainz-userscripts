// #680 Mission Control: the shell on a release page. It opens from the corner
// launcher, reads the tracklist from the page (no request), and the sidebar
// toggles and the Fusion/CH modes change what is on screen and persist.
// Read only: nothing is submitted.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // sandbox copy of "Bad Boys!" (dev/test/sandbox-copies.json)

test('#680: MC shell — launcher, track matrix, sidebars, modes', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });

  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  check(await page.locator('#mc-launch').isHidden(), 'corner launchers hidden while MC is open');
  const rows = await page.locator('#mc-root .mc-tbl tbody tr[data-i]').count();
  const pageRows = await page.locator('#content table.medium tbody tr a[href*="/recording/"]').count();
  check(rows > 0 && rows === pageRows, `matrix has a row per track (${rows} of ${pageRows})`);
  // the title is the release's own: not what other scripts append to the h1 (ISRC Scout's "ISRC ✓ 12/12")
  const h1Link = await page.evaluate(() => document.querySelector('.releaseheader h1 a[href*="/release/"]').textContent.trim());
  check((await page.locator('#mc-root .mc-ttl').textContent()) === h1Link, 'header title = the h1 link');
  // a short window must not squeeze the track list (flex items shrink by default:
  // a long Platforms card cut it to 3 rows); the centre pane scrolls instead
  await page.setViewportSize({ width: 1600, height: 450 });
  const clipped = await page.locator('#mc-root .mc-center > .mc-sect').first().evaluate(s => s.scrollHeight - s.clientHeight);
  check(clipped <= 1, `the track list isn't clipped in a short window (${clipped}px hidden)`);
  await page.setViewportSize({ width: 1600, height: 1000 });
  // Art Station's best cover: the same image as the current front is not a comparison
  const cover = await page.evaluate(() => {
    const best = { provider: 'Discogs', w: 600, h: 600, bytes: 60416, of: 1, larger: false, replace: false };
    const box = h => { const d = document.createElement('div'); d.innerHTML = h; return { text: d.textContent, figs: d.querySelectorAll('.mc-best-c').length }; };
    return { same: box(window.__mcTest.bestHtml(Object.assign({ current: { w: 600, h: 600, bytes: 60416 } }, best))),
             smaller: box(window.__mcTest.bestHtml(Object.assign({ current: { w: 600, h: 600, bytes: 70000 } }, best))) };
  });
  check(cover.same.figs === 1 && /Already the best cover/.test(cover.same.text) && /same image as the best found \(Discogs\)/.test(cover.same.text), `best cover = current front: one figure, "already the best" (${JSON.stringify(cover.same)})`);
  check(cover.smaller.figs === 2 && /Not larger than the current front/.test(cover.smaller.text), `a different image of the same size is still compared (${JSON.stringify(cover.smaller)})`);
  check(await page.locator('#mc-root .mc-badges .mc-bdg').count() === 5, 'a header badge per provider');

  // left of the header: Probe and its Auto switch, nothing else (#680: no source link)
  check(await page.locator('#mc-root .mc-hdr .l > *').count() === 2 && await page.locator('#mc-root [data-act="src"]').count() === 0, 'header left holds Probe and Auto');
  check(await page.locator('#mc-root .mc-auto.on').count() === 0, 'Auto is off by default');
  await page.click('#mc-root [data-act="auto"]');
  check(await page.locator('#mc-root .mc-auto.on[aria-checked="true"]').count() === 1, 'a click turns Auto on');
  await page.click('#mc-root [data-act="auto"]');
  check(await page.locator('#mc-root .mc-auto.on').count() === 0, 'and off again');

  // inspector follows the selected row
  await page.locator('#mc-root .mc-tbl tbody tr[data-i]').first().locator('td.ttl').click();
  check(/^Track /.test(await page.locator('#mc-root .mc-insp-t').textContent()), 'inspector shows the selected track');

  // hiding the order sidebar shows the horizontal strip; both persist
  check(await page.locator('#mc-root .mc-hdr .r button').count() === 2, 'header right holds only settings and close');
  await page.click('#mc-root [data-close="left"]');
  check(await page.locator('#mc-root .mc-side.left').isHidden(), 'order sidebar hidden');
  check(await page.locator('#mc-root .mc-strip').isVisible(), 'strip shown instead');
  check((await page.evaluate(() => window.__mcTest.settings())).left === false, 'left=false stored');

  // CH off drops its column and its step
  const heads = () => page.locator('#mc-root .mc-tbl th').allTextContents();
  check((await heads()).some(h => h.includes('Credits')), 'credits column present');
  await page.click('#mc-root .mc-strip');
  check(await page.locator('#mc-root .mc-side.left').isVisible(), 'clicking the strip expands the sidebar');
  check(await page.locator('#mc-root .mc-strip').isHidden(), 'strip gone again');
  await page.click('#mc-root .mc-seg[data-mode="ch"] button[data-v="off"]');
  check(!(await heads()).some(h => h.includes('Credits')), 'credits column gone with CH off');
  check(await page.locator('#mc-root .mc-stage.off[data-p="ch"]').count() === 1, 'CH step marked off');

  await page.screenshot({ path: 'test-results/mc-680-shell.png' });
  await page.locator('#mc-root .mc-hdr').screenshot({ path: 'test-results/mc-680-header.png' });
  await page.keyboard.press('Escape');
  check(await page.locator('#mc-root').count() === 0, 'Esc closes');
  check(await page.locator('#mc-launch').isVisible(), 'launcher back after closing');
});
