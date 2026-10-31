// #851: Copy versions also names the manager, the browser and the site; Copy as Markdown copies the same
// ready to paste into an issue.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

test('copy versions with the environment, plain and as Markdown', { tag: ['@sandbox'] }, async ({ page, inject }) => {
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
  await page.evaluate(() => [...window.__menu.values()].find(e => /Settings/.test(e.caption)).fn());
  await page.waitForSelector('#st-cfg', { timeout: 10000 });
  await page.locator('#st-tab-a').click();
  await page.locator('#st-copy').click();
  await page.locator('#st-copy-md').click();
  const [plain, md] = await until(() => page.evaluate(() => window.__copied), c => c.length === 2, { timeout: 5000 });
  console.log(plain + '\n----\n' + md);
  check(/^String Theory v\S+ \(/.test(plain), 'plain starts with String Theory\'s version');
  check(/\nBrowser: \S+/.test(plain) && /\nSite: test\.musicbrainz\.org, in \w+/.test(plain), `plain names the browser and the site (${plain.split('\n').slice(-3).join(' | ')})`);
  check(/^\*\*String Theory\*\* `v\S+`/.test(md) && /\n- Fusion `v\S+`/.test(md) && /\n\*\*Site:\*\* test\.musicbrainz\.org/.test(md), 'Markdown has a bold title, a list and the site');
});
