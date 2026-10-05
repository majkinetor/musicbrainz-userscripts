// #680 Mission Control ↔ Platform Check: the first provider adapter.
// MC loads first and PC second, so PC's hello on load is what connects them (not
// MC's discover). Probe then waits for PC's own scan and fills the Platforms card
// with one row per platform; the confirmed ones are ticked and counted.
// Read only: Execute is not wired yet, nothing is submitted.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // sandbox copy of "Bad Boys!" (dev/test/sandbox-copies.json)

test('#680: Probe asks Platform Check and shows its platforms', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await inject('platform_check', { waitFor: '__pcTest680' });
  check(!!(await page.evaluate(() => window.__mcTest.found().pc)), 'PC announced itself to MC on load');

  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  check(/connected/.test(await page.locator('#mc-root .mc-bdg').first().getAttribute('title')), 'PC badge reads connected');

  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root [data-card="pc"] .mc-line', { timeout: 180_000 });
  const rows = await page.locator('#mc-root [data-card="pc"] .mc-line').count();
  const enabled = await page.evaluate(() => document.querySelectorAll('[id^="mb-online-"]').length);
  console.log(`platform rows: ${rows} · PC panel rows: ${enabled}`);
  const none = await page.locator('#mc-root [data-card="pc"] .mc-none .mc-pico').count();
  check(rows + none === enabled, `every platform PC scanned is a row or a not-found icon (${rows} + ${none} of ${enabled})`);

  const states = await page.locator('#mc-root [data-card="pc"] .mc-line').evaluateAll(ls => ls.map(l => l.className.replace('mc-line ', '')));
  console.log('states: ' + JSON.stringify(states));
  const nNew = states.filter(s => s === 'new').length;
  const ticked = await page.locator('#mc-root [data-card="pc"] .mc-pick:checked').count();
  check(ticked === nNew, `ticked by default = the confirmed ones (${ticked} of ${nNew})`);
  check((await page.locator('#mc-root .mc-foot .big').textContent()).startsWith(nNew + ' change'), 'footer counts the ticked rows');

  // unticking one changes the count
  if (nNew) {
    await page.locator('#mc-root [data-card="pc"] .mc-pick:checked').first().uncheck();
    check((await page.locator('#mc-root .mc-foot .big').textContent()).startsWith((nNew - 1) + ' change'), 'unticking lowers the count');
  }
  check(!/…/.test(await page.locator('#mc-root .mc-bdg').first().textContent()), 'PC badge no longer busy');
  await page.screenshot({ path: 'test-results/mc-680-pc.png' });
});
