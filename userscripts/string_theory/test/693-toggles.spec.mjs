// #693: each bundled script can be turned off from the manager's menu. The off list is the GM value
// 'string_theory.off' (folder names); an off member doesn't start, the others do. The menu lists
// every member as ☑/☐, and a click flips it in storage and relabels the entry.
//
// test.musicbrainz.org, a release page (ISRC Scout's button and Platform Check's panel both show there).
import { readFileSync } from 'node:fs';
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

const RELEASE = 'ec116461-5b0d-4c98-bb44-a4de5de63076';
const MEMBERS = readFileSync(new URL('../members.txt', import.meta.url), 'utf8').split(/\r?\n/).map(l => l.replace(/#.*/, '').trim()).filter(Boolean).length;

test.describe('Platform Check turned off', () => {
  test.use({ gm: { name: 'String Theory', values: { 'string_theory.off': ['platform_check'] } } });

  test('an off member doesn\'t start, the others do', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
    const logs = []; page.on('console', m => logs.push(m.text()));
    await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'load', timeout: 60000 });
    await inject('string_theory');
    const isrc = await until(() => page.evaluate(() => !!document.getElementById('ii-btn')), Boolean, { timeout: 30000 });
    await page.waitForTimeout(3000);   // give Platform Check the time it would take to show
    check(isrc, 'ISRC Scout\'s button is on the page');
    check(!(await page.evaluate(() => !!document.getElementById('mb-pc-panel'))), 'Platform Check\'s panel is not');
    check(logs.some(l => /turned off in the manager menu — platform_check/.test(l)), 'the console names what is off');
  });
});

test('the menu lists every member, and a click flips it and relabels the entry', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'load', timeout: 60000 });
  // a manager's menu: entries by id, unregister removes one
  await page.evaluate(() => {
    const menu = window.__menu = new Map(); let next = 1;
    window.GM_registerMenuCommand = (caption, fn) => { const id = next++; menu.set(id, { caption, fn }); return id; };
    window.GM_unregisterMenuCommand = id => menu.delete(id);
  });
  await inject('string_theory');
  // the members' entries (☑/☐); the corner-layout entry (↕/↔) has a test of its own
  const captions = () => page.evaluate(() => [...window.__menu.values()].map(e => e.caption).filter(c => /^[☑☐] /.test(c)));
  const before = await captions();
  check(before.length === MEMBERS && before.every(c => c.startsWith('☑ ')), `${MEMBERS} entries, all on (${before.join(' · ')})`);
  check(before.includes('☑ Platform Check'), 'labelled with the script\'s name');

  await page.evaluate(() => [...window.__menu.values()].find(e => /Platform Check/.test(e.caption)).fn());
  const after = await captions();
  check(after.length === MEMBERS, `still ${MEMBERS} entries, not doubled (${after.length})`);
  check(after.includes('☐ Platform Check') && after.filter(c => c.startsWith('☐ ')).length === 1, `Platform Check shows off, nothing else (${after.join(' · ')})`);
  check(JSON.stringify(await page.evaluate(() => GM_getValue('string_theory.off'))) === '["platform_check"]', 'stored as off');

  await page.evaluate(() => [...window.__menu.values()].find(e => /Platform Check/.test(e.caption)).fn());
  check((await captions()).every(c => c.startsWith('☑ ')), 'a second click turns it back on');
  check(JSON.stringify(await page.evaluate(() => GM_getValue('string_theory.off'))) === '[]', 'and stores it so');
});

// The corner launchers' layout: one menu entry, ↕ column (the default) or ↔ row. A click stores it as
// 'string_theory.cornerFlow', marks <html data-mb-corner-flow> and restacks the corner at once.
test('the layout entry lines the corner launchers up in a row and back', { tag: ['@sandbox'] }, async ({ page, inject }, info) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => {
    const menu = window.__menu = new Map(); let next = 1;
    window.GM_registerMenuCommand = (caption, fn) => { const id = next++; menu.set(id, { caption, fn }); return id; };
    window.GM_unregisterMenuCommand = id => menu.delete(id);
  });
  await inject('string_theory');
  await until(() => page.evaluate(() => document.querySelectorAll('[data-mb-corner="br"]').length), n => n >= 2, { timeout: 30000 });
  const flow = () => page.evaluate(() => [...window.__menu.values()].map(e => e.caption).find(c => /Launchers/.test(c)));
  const at = () => page.evaluate(() => [...document.querySelectorAll('[data-mb-corner="br"]')].filter(e => getComputedStyle(e).display !== 'none')
    .map(e => ({ id: e.id, bottom: e.style.bottom, right: e.style.right })));
  check(await flow() === '↕ Launchers in a column', `a column by default (${await flow()})`);
  const col = await at();
  check(col.every(e => e.right === '14px') && new Set(col.map(e => e.bottom)).size === col.length, `stacked up the right edge (${JSON.stringify(col)})`);

  await page.evaluate(() => [...window.__menu.values()].find(e => /Launchers/.test(e.caption)).fn());
  const row = await at();
  check(await flow() === '↔ Launchers in a row', `relabelled (${await flow()})`);
  check(await page.evaluate(() => document.documentElement.dataset.mbCornerFlow) === 'row', 'the page is marked');
  check(await page.evaluate(() => GM_getValue('string_theory.cornerFlow')) === 'row', 'stored');
  check(row.every(e => e.bottom === '14px') && new Set(row.map(e => e.right)).size === row.length, `in a row along the bottom (${JSON.stringify(row)})`);
  await page.screenshot({ path: info.outputPath('row.png'), clip: { x: 1400 - 260, y: 900 - 80, width: 260, height: 80 } });

  await page.evaluate(() => [...window.__menu.values()].find(e => /Launchers/.test(e.caption)).fn());
  check(JSON.stringify(await at()) === JSON.stringify(col), 'a second click puts them back in the column');
  check(!(await page.evaluate(() => document.documentElement.hasAttribute('data-mb-corner-flow'))), 'and unmarks the page');
});
