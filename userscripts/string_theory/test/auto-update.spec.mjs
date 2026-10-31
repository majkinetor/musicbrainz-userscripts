import { test, expect, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh', gm: { name: 'String Theory' } });
test('About checks on each entry and keeps the newest response', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    window.__menu = new Map();
    window.GM_registerMenuCommand = (name, fn) => { window.__menu.set(name, fn); return name; };
    window.GM_unregisterMenuCommand = name => window.__menu.delete(name);
    window.__updates = [];
    const original = window.GM_xmlhttpRequest;
    window.GM_xmlhttpRequest = opts => /raw\.githubusercontent\.com\/majkinetor\/musicbrainz-userscripts\/refs\/heads\//.test(opts.url)
      ? window.__updates.push(opts) : original(opts);
  });
  await inject('string_theory');
  await expect.poll(() => page.evaluate(() => [...window.__menu.keys()].some(k => /Settings/.test(k)))).toBe(true);
  await page.evaluate(() => [...window.__menu.entries()].find(([k]) => /Settings/.test(k))[1]());
  await page.locator('#st-tab-a').click();
  await expect.poll(() => page.evaluate(() => window.__updates.length)).toBe(2);
  await expect(page.locator('#st-check')).toHaveCount(0);
  await page.locator('#st-tab-l').click();
  await page.locator('#st-tab-a').click();
  await expect.poll(() => page.evaluate(() => window.__updates.length)).toBe(4);
  await page.evaluate(() => window.__updates.slice(2).forEach(o => o.onload({ status: 200, responseText: '// @version 9999.1' })));
  await expect(page.locator('#st-upd')).toContainText('v9999.1');
  await page.evaluate(() => window.__updates.slice(0, 2).forEach(o => o.onload({ status: 200, responseText: '// @version 1.1' })));
  await expect(page.locator('#st-upd')).toContainText('v9999.1');
});
