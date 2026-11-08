// #851: Copy as Markdown includes versions and the environment in a details section, ready to paste into an issue.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

test('copy versions and the environment as Markdown', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/release/ec116461-5b0d-4c98-bb44-a4de5de63076`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => {
    const menu = window.__menu = new Map(); let next = 1;
    window.GM_registerMenuCommand = (caption, fn) => { menu.set(next, { caption, fn }); return next++; };
    window.GM_unregisterMenuCommand = id => menu.delete(id);
    window.__copied = [];
    window.GM_setClipboard = t => window.__copied.push(t);
  });
  await inject('string_theory');
  await page.waitForTimeout(3000);
  await page.evaluate(() => document.dispatchEvent(new Event('mbu-st-settings')));   // the dock's way in: no menu entry since 688151a9
  await page.waitForSelector('#st-cfg', { timeout: 10000 });
  await page.locator('#st-tab-a').click();
  await page.locator('#st-copy-md').click();
  const [md] = await until(() => page.evaluate(() => window.__copied), c => c.length === 1, { timeout: 5000 });
  check(/^<details>\n<summary><b>String Theory<\/b> <code>v\S+<\/code>.*<\/summary>\n\n/.test(md) && /\n- \[[x ]\] Fusion `v\S+`/.test(md) && /\n\*\*Site:\*\* test\.musicbrainz\.org/.test(md) && /\n\n<\/details>$/.test(md), 'Markdown is a details section with the title, a list and the site');
});
