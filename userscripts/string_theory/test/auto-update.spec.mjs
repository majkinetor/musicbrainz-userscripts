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
  const channels = await page.locator('#st-upd > [data-channel]').count(); // Installed describes the local build, without a network request.
  expect(channels).toBeGreaterThanOrEqual(2);
  await expect.poll(() => page.evaluate(() => window.__updates.length)).toBe(channels);
  await expect(page.locator('#st-check')).toHaveCount(0);
  await page.locator('#st-tab-g').click();
  await page.locator('#st-tab-a').click();
  await expect.poll(() => page.evaluate(() => window.__updates.length)).toBe(channels * 2);
  await page.evaluate(n => window.__updates.slice(n).forEach(o => o.onload({ status: 200, responseText: '// @version 9999.1' })), channels);
  await expect(page.locator('#st-upd')).toContainText('v9999.1');
  await page.evaluate(n => window.__updates.slice(0, n).forEach(o => o.onload({ status: 200, responseText: '// @version 1.1' })), channels);
  await expect(page.locator('#st-upd')).toContainText('v9999.1');
});

test('Pinned installs the newest commit of main by its own link', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    window.__menu = new Map();
    window.GM_registerMenuCommand = (name, fn) => { window.__menu.set(name, fn); return name; };
    window.GM_unregisterMenuCommand = name => window.__menu.delete(name);
    const original = window.GM_xmlhttpRequest;
    window.GM_xmlhttpRequest = opts => {
      if (/raw\.githubusercontent\.com\/majkinetor\/musicbrainz-userscripts\/refs\/heads\//.test(opts.url)) return setTimeout(() => opts.onload({ status: 200, responseText: '// @version 9999.1' }));
      if (/api\.github\.com\/repos\/majkinetor\/musicbrainz-userscripts\/commits\/main$/.test(opts.url)) return setTimeout(() => opts.onload({ status: 200, responseText: 'ab'.repeat(20) + '\n' }));
      return original(opts);
    };
    window.__opened = [];
    window.open = url => { const w = { url, location: {} }; window.__opened.push(w); return w; };
  });
  await inject('string_theory');
  await expect.poll(() => page.evaluate(() => [...window.__menu.keys()].some(k => /Settings/.test(k)))).toBe(true);
  await page.evaluate(() => [...window.__menu.entries()].find(([k]) => /Settings/.test(k))[1]());
  await page.locator('#st-tab-a').click();
  const pinned = page.locator('#st-upd [data-channel="main"] [data-st-pinned]');
  await expect(pinned).toHaveText('Pinned');
  await expect(page.locator('#st-upd [data-channel="stable"] [data-st-pinned]')).toHaveCount(0);
  await pinned.click();
  await expect.poll(() => page.evaluate(() => window.__opened.map(w => w.location.href || ''))).toEqual(
    ['https://github.com/majkinetor/musicbrainz-userscripts/raw/' + 'ab'.repeat(20) + '/userscripts/string_theory/string_theory.user.js']);
});
