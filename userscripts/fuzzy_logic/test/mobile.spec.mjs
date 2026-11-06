// On a phone the window fills the screen and its close button stays on it
import { test, check, until, requireLogin, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Fuzzy Logic' }, viewport: { width: 360, height: 760 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

test('the window fills a phone screen', { tag: ['@sandbox', '@cosmetic'] }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/release-group/b1392450-e666-3926-a536-22c65f834433');
  await requireLogin(page);
  await inject('fuzzy_logic', { waitFor: '__fuzzyLogic' });
  await page.evaluate(() => document.getElementById('mb-fl-dock').click());
  await until(() => page.evaluate(() => window.__fuzzyLogic.ran && !window.__fuzzyLogic.busy), b => b, { timeout: 90000 });
  await attachShot(testInfo, page, 'phone');
  if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + '/fl-mobile.png' });
  const r = await page.evaluate(() => {
    const vv = visualViewport, L = vv.offsetLeft, R = L + vv.width;
    const p = document.querySelector('.fl-pop .mbu-ov-panel').getBoundingClientRect(), x = document.querySelector('.fl-pop .mbu-cfg-x').getBoundingClientRect();
    return { L, R, p: [p.left, p.right, p.top, p.height], x: [x.left, x.right], vh: vv.height };
  });
  console.log(JSON.stringify(r));
  check(r.x[0] >= r.L && r.x[1] <= r.R + 1, 'the close button is on screen ' + JSON.stringify(r.x));
  check(r.p[0] <= r.L + 1 && r.p[1] >= r.R - 1 && r.p[3] >= r.vh - 2, 'the window fills the screen ' + JSON.stringify(r.p));
});
