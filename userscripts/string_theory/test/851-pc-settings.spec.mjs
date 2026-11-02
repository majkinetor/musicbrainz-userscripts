// #851: Platform Check's settings open on pages where it doesn't run; the settings-only start has to reach them.
import { test, check, SANDBOX } from '../../../dev/test/harness.mjs';

const fakeMenu = () => {
  const menu = window.__menu = new Map(); let next = 1;
  window.GM_registerMenuCommand = (caption, fn, o) => { const id = (o && o.id) || next++; menu.set(id, { caption, fn }); return id; };
  window.GM_unregisterMenuCommand = id => menu.delete(id);
};

for (const path of ['/', '/search/edits']) test(`Platform Check settings open on ${path}`, { tag: ['@sandbox'] }, async ({ page, inject }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SANDBOX}${path}`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(fakeMenu);
  await inject('string_theory');
  await page.waitForTimeout(3000);
  await page.evaluate(() => [...window.__menu.values()].find(e => /Settings/.test(e.caption)).fn());
  await page.waitForSelector('#st-cfg');
  await page.locator('#st-tab-a').click();
  await page.locator('#st-cfg .st-scripts [data-name="Platform Check"]').click({ button: 'right' });
  await page.waitForFunction(() => { const m = document.querySelector('#mb-provider-modal-overlay'); return m && m.getBoundingClientRect().width > 0; }, null, { timeout: 8000 });
  check(!errors.some(e => /before initialization/.test(e)), errors.join('; ') || 'no startup error');
});
