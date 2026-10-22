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
  // a manager's menu like Violentmonkey's: an options.id names the entry, and registering that id
  // again relabels it where it stands; unregister removes one
  await page.evaluate(() => {
    const menu = window.__menu = new Map(); let next = 1;
    window.GM_registerMenuCommand = (caption, fn, o) => { const id = (o && o.id) || next++; menu.set(id, { caption, fn }); return id; };
    window.GM_unregisterMenuCommand = id => menu.delete(id);
  });
  await inject('string_theory');
  // the members' entries (☑/☐); the corner-layout entry (↕/↔) has a test of its own
  const captions = () => page.evaluate(() => [...window.__menu.values()].map(e => e.caption).filter(c => /^[☑☐] /.test(c)));
  const before = await captions();
  check(before.length === MEMBERS && before.every(c => c.startsWith('☑ ')), `${MEMBERS} entries, all on (${before.join(' · ')})`);
  check(before.some(c => /^☑ Platform Check v\d{4}\.\d+\.\d+/.test(c)), 'labelled with the script\'s name and version');

  await page.evaluate(() => [...window.__menu.values()].find(e => /Platform Check/.test(e.caption)).fn());
  const after = await captions();
  check(after.length === MEMBERS, `still ${MEMBERS} entries, not doubled (${after.length})`);
  check(after.findIndex(c => c.startsWith('☐ Platform Check')) === before.findIndex(c => c.startsWith('☑ Platform Check')), `relabelled where it stood (${after.join(' · ')})`);
  check(after.some(c => c.startsWith('☐ Platform Check')) && after.filter(c => c.startsWith('☐ ')).length === 1, `Platform Check shows off, nothing else (${after.join(' · ')})`);
  check(JSON.stringify(await page.evaluate(() => GM_getValue('string_theory.off'))) === '["platform_check"]', 'stored as off');

  await page.evaluate(() => [...window.__menu.values()].find(e => /Platform Check/.test(e.caption)).fn());
  check((await captions()).every(c => c.startsWith('☑ ')), 'a second click turns it back on');
  check(JSON.stringify(await page.evaluate(() => GM_getValue('string_theory.off'))) === '[]', 'and stores it so');
});

// The corner launchers' layout: one menu entry, ↕ column (the default) or ↔ row. A click stores it as
// the shared setting (localStorage 'mbu.cornerFlow', which every script reads) and restacks the corner at once.
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
  const flow = () => page.evaluate(() => [...window.__menu.values()].map(e => e.caption).find(c => /Launchers in /.test(c)));
  const at = () => page.evaluate(() => [...document.querySelectorAll('[data-mb-corner="br"]')].filter(e => getComputedStyle(e).display !== 'none')
    .map(e => ({ id: e.id, bottom: e.style.bottom, right: e.style.right })));
  check(await flow() === '↕ Launchers in a column', `a column by default (${await flow()})`);
  const col = await at();
  check(col.every(e => e.right === '14px') && new Set(col.map(e => e.bottom)).size === col.length, `stacked up the right edge (${JSON.stringify(col)})`);

  await page.evaluate(() => [...window.__menu.values()].find(e => /Launchers in /.test(e.caption)).fn());
  const row = await at();
  check(await flow() === '↔ Launchers in a row', `relabelled (${await flow()})`);
  check(await page.evaluate(() => localStorage.getItem('mbu.cornerFlow')) === '"row"', 'stored as the shared setting');
  check(row.every(e => e.bottom === '14px') && new Set(row.map(e => e.right)).size === row.length, `in a row along the bottom (${JSON.stringify(row)})`);
  await page.screenshot({ path: info.outputPath('row.png'), clip: { x: 1400 - 260, y: 900 - 80, width: 260, height: 80 } });

  await page.evaluate(() => [...window.__menu.values()].find(e => /Launchers in /.test(e.caption)).fn());
  check(JSON.stringify(await at()) === JSON.stringify(col), 'a second click puts them back in the column');
  check(await page.evaluate(() => localStorage.getItem('mbu.cornerFlow')) === null, 'and clears the setting');
  // a standalone launcher follows the shared setting with no String Theory on the page: Falcon on its own
  await page.evaluate(() => localStorage.setItem('mbu.cornerFlow', '"row"'));
  await page.reload({ waitUntil: 'load' });
  await inject('falcon'); await inject('fusion');
  await page.waitForSelector('#falcon-launcher'); await page.waitForSelector('#fs-launch');
  const solo = await at();
  check(solo.length === 2 && solo.every(e => e.bottom === '14px') && new Set(solo.map(e => e.right)).size === 2, `standalone scripts line up in the row (${JSON.stringify(solo)})`);
  // and the bundle keeps the row on a fresh page load, not only on the click
  await page.reload({ waitUntil: 'load' });
  await inject('string_theory');
  await until(() => page.evaluate(() => document.querySelectorAll('[data-mb-corner="br"]').length), n => n >= 2, { timeout: 30000 });
  await page.waitForTimeout(3000);
  const loaded = await at();
  check(loaded.every(e => e.bottom === '14px') && new Set(loaded.map(e => e.right)).size === loaded.length, `the bundle loads in the row (${JSON.stringify(loaded)})`);
  await page.evaluate(() => localStorage.removeItem('mbu.cornerFlow'));
});

// The launchers' side (#802): a second entry, → right (the default) or ← left. A click stores it as the shared
// setting (localStorage 'mbu.cornerSide') and mirrors the corner at once; a launcher keeps its place in the stack.
test('the side entry moves the corner launchers to the left edge and back', { tag: ['@sandbox'] }, async ({ page, inject }, info) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => {
    localStorage.removeItem('mbu.cornerSide'); localStorage.removeItem('mbu.cornerFlow');
    const menu = window.__menu = new Map(); let next = 1;
    window.GM_registerMenuCommand = (caption, fn) => { const id = next++; menu.set(id, { caption, fn }); return id; };
    window.GM_unregisterMenuCommand = id => menu.delete(id);
  });
  await inject('string_theory');
  await until(() => page.evaluate(() => document.querySelectorAll('[data-mb-corner="br"]').length), n => n >= 2, { timeout: 30000 });
  const side = () => page.evaluate(() => [...window.__menu.values()].map(e => e.caption).find(c => /Launchers on /.test(c)));
  const click = () => page.evaluate(() => [...window.__menu.values()].find(e => /Launchers on /.test(e.caption)).fn());
  const at = () => page.evaluate(() => [...document.querySelectorAll('[data-mb-corner="br"]')].filter(e => getComputedStyle(e).display !== 'none')
    .map(e => { const r = e.getBoundingClientRect(); return { id: e.id, bottom: e.style.bottom, left: Math.round(r.left), right: Math.round(innerWidth - r.right) }; }));
  check(await side() === '→ Launchers on the right', `the right by default (${await side()})`);
  const right = await at();
  check(right.every(e => e.right === 14), `on the right edge (${JSON.stringify(right)})`);

  await click();
  check(await side() === '← Launchers on the left', `relabelled (${await side()})`);
  check(await page.evaluate(() => localStorage.getItem('mbu.cornerSide')) === '"left"', 'stored as the shared setting');
  const left = await at();
  check(left.every(e => e.left === 14), `on the left edge (${JSON.stringify(left)})`);
  check(JSON.stringify(left.map(e => [e.id, e.bottom])) === JSON.stringify(right.map(e => [e.id, e.bottom])), 'in the same order up the edge');
  await page.screenshot({ path: info.outputPath('left.png'), clip: { x: 0, y: 900 - 260, width: 120, height: 260 } });

  // a row on the left: along the bottom edge from the bottom-left corner
  await page.evaluate(() => [...window.__menu.values()].find(e => /Launchers in /.test(e.caption)).fn());
  const row = await at();
  check(row.every(e => e.bottom === '14px') && Math.min(...row.map(e => e.left)) === 14 && new Set(row.map(e => e.left)).size === row.length, `a row from the bottom-left corner (${JSON.stringify(row)})`);
  await page.screenshot({ path: info.outputPath('left-row.png'), clip: { x: 0, y: 900 - 80, width: 260, height: 80 } });
  await page.evaluate(() => [...window.__menu.values()].find(e => /Launchers in /.test(e.caption)).fn());

  await click();
  check((await at()).every(e => e.right === 14), 'a second click puts them back on the right');
  check(await page.evaluate(() => localStorage.getItem('mbu.cornerSide')) === null, 'and clears the setting');
});
