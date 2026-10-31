// #851: Apollo's settings open in the middle of the screen like every script's, and move by their header.
import { test, check, SANDBOX } from '../../../dev/test/harness.mjs';
test('the settings open centred and move by their header', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/release/ec116461-5b0d-4c98-bb44-a4de5de63076/edit`, { waitUntil: 'load', timeout: 60000 });
  await inject('apollo_editor');
  await page.waitForTimeout(4000);
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('mbu-open-settings', { detail: 'apollo_editor', cancelable: true })));
  await page.waitForSelector('#tc-settings', { timeout: 10000 });
  await page.waitForTimeout(400);
  const b = await page.evaluate(() => { const r = document.getElementById('tc-settings').getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: innerWidth, h: innerHeight, top: r.top }; });
  console.log(JSON.stringify(b));
  check(Math.abs(b.cx - b.w / 2) < 3 && Math.abs(b.cy - b.h / 2) < 3, 'centred');
  const h = await page.locator('#tc-settings .mbu-cfg-h').boundingBox();
  await page.mouse.move(h.x + 40, h.y + h.height / 2); await page.mouse.down(); await page.mouse.move(h.x - 60, h.y + 40, { steps: 5 }); await page.mouse.up();
  const t2 = await page.evaluate(() => document.getElementById('tc-settings')?.getBoundingClientRect().top);
  check(t2 != null && Math.abs(t2 - b.top - (40 - h.height / 2)) < 4, `dragged and still open (${b.top} -> ${t2})`);
  await page.locator('#tc-settings .tc-tab-btn[data-tab="matching"]').click();
  check(await page.locator('#tc-settings').count() === 1, 'tab switch keeps it open');
});
