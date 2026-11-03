// Every script's settings close from the ✕ in their title bar.
import { test, check, SANDBOX } from '../test/harness.mjs';
const S = ['apollo_editor', 'art_station', 'event_horizon', 'first_contact', 'fusion', 'group_therapy', 'isrc_scout', 'mammoth', 'mission_control', 'platform_check', 'credit_hoarder', 'falcon'];
test('the title bar ✕ closes each settings window', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/release/ec116461-5b0d-4c98-bb44-a4de5de63076/edit`, { waitUntil: 'load', timeout: 60000 });
  await inject('string_theory');
  await page.waitForTimeout(6000);
  for (const s of S) {
    await page.evaluate((s) => document.dispatchEvent(new CustomEvent('mbu-open-settings', { detail: s, cancelable: true })), s);
    await page.waitForTimeout(1500);
    const x = page.locator('.mbu-cfg-h .mbu-cfg-x:visible').last();
    if (!(await x.count())) { console.log(s + ': no settings window here'); continue; }
    await x.click();
    await page.waitForTimeout(400);
    const left = await page.locator('.mbu-cfg-h:visible').count();
    check(left === 0, s + ' closed (' + left + ' left)');
  }
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('mbu-open-settings', { detail: 'string_theory', cancelable: true })));
});
