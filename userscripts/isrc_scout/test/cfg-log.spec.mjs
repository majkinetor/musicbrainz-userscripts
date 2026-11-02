// The settings header has the suite's Log button, and the log opens above the settings window.
import { test, check, attachShot } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });

test('Log in the settings header', { tag: ['@sandbox'] }, async ({ page, inject }, info) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await openScout(page, inject, { release: '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda' });
  await page.click('#ii-setup-toggle');
  await page.click('#ii-setup-pane .mbu-cfg-log');
  await page.waitForSelector('.mbu-logpop', { timeout: 5000 });
  const top = await page.evaluate(() => { const w = document.querySelector('.mbu-logpop'), r = w.getBoundingClientRect(); return w.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); });
  await attachShot(page, info, 'cfg-log');
  check(top, 'the log is above the settings');
});
