// #653: String Theory and a standalone Platform Check both installed ran two copies on one page.
// They build the same element ids, so each copy's settings window filled in the other's
// checkboxes (all shown off) and the rows jumped between the two copies' compact rules. The
// first copy now claims the page; the second stays out and says so.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Platform Check' } });

test('a second copy stays out, and says the script is installed twice', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/release/ec116461-5b0d-4c98-bb44-a4de5de63076`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#sidebar');
  await inject('platform_check');
  await page.waitForSelector('#mb-pc-panel');
  await inject('platform_check');   // the second copy (String Theory's, or the standalone one)
  const toast = await until(() => page.evaluate(() => document.getElementById('mbu-toast')?.textContent || ''), t => /installed twice/.test(t));
  check(/Platform Check is installed twice \(standalone v.+ and standalone v.+\): only the standalone v.+ copy runs/.test(toast), `the second copy says so ("${toast}")`);
  check(await page.locator('#mb-pc-panel').count() === 1, `one panel (${await page.locator('#mb-pc-panel').count()})`);
  // the settings window shows the stored settings, not a blank set of boxes
  await page.evaluate(() => document.getElementById('mb-token-setup-btn').click());
  const boxes = await until(() => page.evaluate(() => [...document.querySelectorAll('#mb-provider-modal-card input[type=checkbox]')].filter(i => i.offsetParent).map(i => i.id + '=' + i.checked)), b => b.length > 0);
  check(boxes.length === new Set(boxes.map(b => b.split('=')[0])).size, `each setting has one checkbox (${boxes.join(', ')})`);
  check(boxes.includes('mb-compact-unmatched=true') && boxes.includes('mb-show-icons=true'), `the defaults show as on (${boxes.join(', ')})`);
});
