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
  check(await page.locator('#mc-root .mc-badges .mc-bdg').count() === 5, 'a header badge per provider');

  // left of the header: the source icon and Probe, nothing else
  check(await page.locator('#mc-root .mc-hdr .l > *').count() === 2, 'header left holds the source icon and Probe');
  await page.click('#mc-root [data-act="src"]');
  await page.fill('#mc-root .mc-srcpop input', 'https://open.spotify.com/album/x');
  await page.keyboard.press('Enter');
  check(await page.locator('#mc-root .mc-srcbtn.set').count() === 1, 'source icon lit once a link is set');

  // inspector follows the selected row
  await page.locator('#mc-root .mc-tbl tbody tr[data-i]').first().click();
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
