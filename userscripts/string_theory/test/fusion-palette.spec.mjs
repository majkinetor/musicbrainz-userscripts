// A member's own commands in the palette (window.__mbuPalette): Fusion lists its boards and what the
// page can add, and the open window's buttons once one is open.
import { test, check, until, SANDBOX, mbJson } from '../../../dev/test/harness.mjs';

const rows = page => page.$$eval('#st-pal-list .st-pal-i', ls => ls.map(l => l.querySelector('.st-pal-c').textContent + l.querySelector('.st-pal-l').textContent));

test.use({ gm: { name: 'String Theory', values: { 'string_theory.off': ['event_horizon'] } } });
test("Fusion's commands are in the palette", { tag: ['@sandbox'] }, async ({ page, inject }) => {
  const gid = (await mbJson('https://test.musicbrainz.org/ws/2/release?query=status:official&limit=1&fmt=json')).releases[0].id;
  await page.goto(`${SANDBOX}/release/${gid}`, { waitUntil: 'load', timeout: 60000 });
  await inject('string_theory');
  await page.waitForSelector('#fs-launch', { state: 'attached', timeout: 15000 });   // Fusion is in: the dock hides its launcher
  await page.mouse.click(5, 5);
  await page.keyboard.press('Control+k');
  await page.waitForSelector('#st-pal-q', { timeout: 10000 });
  await page.keyboard.type('fusion');
  const r = await rows(page);
  console.log(r.join(' | '));
  for (const want of ['Fusion: Open recordings', 'Fusion: Open artists', 'Fusion: Add from this page…', 'Fusion: Add this release', 'Fusion: Add its recordings'])
    check(r.some(x => x.startsWith(want)), `lists ${want}`);
  await page.keyboard.press('Control+a');
  await page.keyboard.type('fusion open artists');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#fs-em-cons', { timeout: 10000 });
  await page.keyboard.press('Control+k');
  await page.waitForSelector('#st-pal-q', { timeout: 10000 });
  await page.keyboard.type('fusion close the window');
  check((await rows(page))[0] === 'Fusion: Close the window', `the window's buttons show (${(await rows(page))[0]})`);
  await page.keyboard.press('Enter');
  await until(() => page.$('#fs-em-cons'), el => !el, { timeout: 5000 });
});
