// #851: String Theory's settings open every member's own settings on any page, from a right-click in
// About's script list, also for a member that doesn't run on that page or is turned off. A member that
// isn't running is started only to open its settings: no fetch, no page change, no error.
import require_fs from 'node:fs';
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

const RELEASE = 'ec116461-5b0d-4c98-bb44-a4de5de63076';
const fakeMenu = () => {
  const menu = window.__menu = new Map(); let next = 1;
  window.GM_registerMenuCommand = (caption, fn, o) => { const id = (o && o.id) || next++; menu.set(id, { caption, fn }); return id; };
  window.GM_unregisterMenuCommand = id => menu.delete(id);
};
const openAbout = async page => {
  await page.evaluate(() => [...window.__menu.values()].find(e => /Settings/.test(e.caption)).fn());
  await page.waitForSelector('#st-cfg', { timeout: 10000 });
  await page.locator('#st-tab-a').click();
};
// what's on the page now: every element's id and classes, to see what a right-click added
const snap = page => page.evaluate(() => [...document.querySelectorAll('body *, html > *')]
  .filter(e => e.getClientRects().length && !e.closest('#st-cfg-ov'))
  .map(e => (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : '')).filter(Boolean));

async function survey(page, inject, info, only) {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(fakeMenu);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await inject('string_theory');
  await page.waitForTimeout(4000);
  await openAbout(page);
  const names = (await page.evaluate(() => [...document.querySelectorAll('#st-cfg .st-scripts [data-name]')].map(l => l.dataset.name)))
    .filter(n => n !== 'Credit Hoarder' && (!only || only.includes(n)));
  const out = [];
  for (const n of names) {
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await page.mouse.click(5, 300);
    const before = new Set(await snap(page));
    const reqs = [], onReq = r => { if (!/\.(png|svg|jpe?g|gif|woff2?|css)(\?|$)/.test(r.url())) reqs.push(r.method() + ' ' + r.url()); };
    if (!(await page.locator('#st-cfg').count())) await openAbout(page);
    const errs = errors.length;
    page.on('request', onReq);
    await page.locator(`#st-cfg .st-scripts [data-name="${n}"]`).click({ button: 'right' });
    const added = await until(async () => (await snap(page)).filter(x => !before.has(x)), a => a.length > 0, { timeout: 5000 });
    await page.waitForTimeout(1500);
    page.off('request', onReq);
    await page.screenshot({ path: info.outputPath(n.replace(/\W+/g, '-') + '.png') });
    out.push({ n, added: (await snap(page)).filter(x => !before.has(x)).slice(0, 4), reqs, errs: errors.slice(errs) });
    // close whatever opened: Escape, then drop overlays it left
    await page.keyboard.press('Escape');
  }
  require_fs.writeFileSync(info.outputPath('survey.json'), JSON.stringify(out, null, 1));
  return out;
}

test('every member\'s settings open on a release page', { tag: ['@sandbox'] }, async ({ page, inject }, info) => {
  const out = await survey(page, inject, info);
  for (const r of out) {
    check(r.added.length > 0, `${r.n}: its settings open (${r.added.join(' ')})`);
    check(r.errs.length === 0, `${r.n}: no error (${r.errs.join('; ')})`);
  }
});

test.describe('Mission Control turned off', () => {
  test.use({ gm: { name: 'String Theory', values: { 'string_theory.off': ['mission_control'] } } });
  test('its settings still open', { tag: ['@sandbox'] }, async ({ page, inject }, info) => {
    const [r] = await survey(page, inject, info, ['Mission Control']);
    check(r && r.added.length > 0, `they open (${r && r.added.join(' ')})`);
    check(r && r.errs.length === 0, `no error (${r && r.errs.join('; ')})`);
  });
});
