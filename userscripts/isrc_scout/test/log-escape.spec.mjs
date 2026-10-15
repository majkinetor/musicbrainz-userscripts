// Escape with the log open closes only the log: the shared log window and ISRC Scout's own both
// closed on Escape, and both heard it, so one press shut the log and Scout under it.
import { test, check } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });

test('Escape closes the log, then Scout', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await openScout(page, inject);
  await page.click('#ii-log-link');
  await page.waitForSelector('#mbu-logpop', { timeout: 5000 });
  await page.keyboard.press('Escape');
  const after1 = await page.evaluate(() => ({ log: !!document.getElementById('mbu-logpop'), scout: document.getElementById('ii-modal').classList.contains('open') }));
  check(!after1.log && after1.scout, `the first Escape closes only the log (${JSON.stringify(after1)})`);
  await page.keyboard.press('Escape');
  const scout = await page.evaluate(() => document.getElementById('ii-modal').classList.contains('open'));
  check(!scout, 'the second closes Scout');
});
