// #693, #851: String Theory's settings window. The manager's menu has one entry, ⚙ Settings, and a
// right-click on the dock's button opens the same window. In it each bundled script can be turned off
// (the GM value 'string_theory.off', folder names; an off member doesn't start, the others do), and the
// corner launchers get their side, layout, size and whether they fold into String Theory's icon (the
// shared localStorage settings mbu.cornerSide / cornerFlow / cornerSize / stDock). Dragging a launcher
// moves its corner's stack (mbu.cornerOffset); Reset clears place and size.
//
// test.musicbrainz.org, a release page (ISRC Scout's button and Platform Check's panel both show there).
import { readFileSync } from 'node:fs';
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

const RELEASE = 'ec116461-5b0d-4c98-bb44-a4de5de63076';
const MEMBERS = readFileSync(new URL('../members.txt', import.meta.url), 'utf8').split(/\r?\n/).map(l => l.replace(/#.*/, '').trim()).filter(Boolean).length;
const SHARED = ['cornerSide', 'cornerFlow', 'cornerSize', 'cornerOffset', 'stDock', 'dockOpen'];

// a manager's menu like Violentmonkey's: an options.id names the entry
const fakeMenu = () => {
  const menu = window.__menu = new Map(); let next = 1;
  window.GM_registerMenuCommand = (caption, fn, o) => { const id = (o && o.id) || next++; menu.set(id, { caption, fn }); return id; };
  window.GM_unregisterMenuCommand = id => menu.delete(id);
};
// a clean slate, and optionally the launchers left out of the dock (stDock = false), as before #851
async function load(page, inject, { dock = true } = {}) {
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(([keys, dock]) => {
    keys.forEach(k => localStorage.removeItem('mbu.' + k));
    if (!dock) localStorage.setItem('mbu.stDock', 'false');
  }, [SHARED, dock]);
  await page.evaluate(fakeMenu);
  await inject('string_theory');
}
const openSettings = async page => {
  await page.evaluate(() => [...window.__menu.values()].find(e => /Settings/.test(e.caption)).fn());
  await page.waitForSelector('#st-cfg', { timeout: 10000 });
};
// the visible corner launchers, the dock's button left out
const at = page => page.evaluate(() => [...document.querySelectorAll('[data-mb-corner="br"]')]
  .filter(e => e.id !== 'mbu-dock' && getComputedStyle(e).display !== 'none')
  .map(e => { const r = e.getBoundingClientRect(); return { id: e.id, bottom: Math.round(innerHeight - r.bottom), left: Math.round(r.left), right: Math.round(document.documentElement.clientWidth - r.right), w: Math.round(r.width) }; }));
const stacked = page => until(() => page.evaluate(() => document.querySelectorAll('[data-mb-corner="br"]:not(#mbu-dock)').length), n => n >= 2, { timeout: 30000 });

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
    check(logs.some(l => /turned off in its settings — platform_check/.test(l)), 'the console names what is off');
  });
});

test('one menu entry opens the settings, which turn a script off and on', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }, info) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await load(page, inject);
  const captions = await page.evaluate(() => [...window.__menu.values()].map(e => e.caption));
  check(captions.length === 1 && captions[0] === '⚙ Settings', `one entry (${captions.join(' · ')})`);
  await openSettings(page);
  const boxes = await page.evaluate(() => [...document.querySelectorAll('#st-cfg [data-st-m]')].map(b => [b.dataset.stM, b.checked, b.closest('label').textContent]));
  check(boxes.length === MEMBERS && boxes.every(b => b[1]), `${MEMBERS} scripts, all on (${boxes.map(b => b[0]).join(' ')})`);
  check(boxes.some(b => b[0] === 'platform_check' && /Platform Check.*\d{4}\.\d+\.\d+/.test(b[2])), 'with the script\'s name and version');
  check(await page.evaluate(() => document.getElementById('st-reload').hidden), 'no Reload button yet');
  await page.screenshot({ path: info.outputPath('settings.png') });

  await page.locator('#st-cfg [data-st-m="platform_check"]').click();
  check(JSON.stringify(await page.evaluate(() => GM_getValue('string_theory.off'))) === '["platform_check"]', 'stored as off');
  check(!(await page.evaluate(() => document.getElementById('st-reload').hidden)), 'Reload shows: it applies from the next load');
  await page.locator('#st-cfg [data-st-m="platform_check"]').click();
  check(JSON.stringify(await page.evaluate(() => GM_getValue('string_theory.off'))) === '[]', 'a second click turns it back on');

  // Esc closes it; the menu opens it again
  await page.keyboard.press('Escape');
  check(!(await page.evaluate(() => !!document.getElementById('st-cfg-ov'))), 'Esc closes it');
});

// Event Horizon is a member too, and under it the dock is always on: the corner's own tests turn it off.
test.describe('Event Horizon turned off', () => {
  test.use({ gm: { name: 'String Theory', values: { 'string_theory.off': ['event_horizon'] } } });

  // Without Event Horizon the launchers fold into String Theory's icon too; a right-click on it opens the
  // settings, and the setting puts the launchers back in the corner.
  test('the dock shows without Event Horizon, and its right-click opens the settings', { tag: ['@sandbox'] }, async ({ page, inject }, info) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await load(page, inject);
    await stacked(page);
    await page.waitForSelector('#mbu-dock', { timeout: 15000 });
    check(await page.evaluate(() => document.documentElement.hasAttribute('data-mbu-st') && !document.documentElement.hasAttribute('data-mbu-dock')), 'String Theory\'s mark, no Event Horizon');
    check((await at(page)).length === 0, 'the launchers are folded into it');
    await page.screenshot({ path: info.outputPath('dock.png'), clip: { x: 1400 - 120, y: 900 - 120, width: 120, height: 120 } });

    await page.locator('#mbu-dock').click({ button: 'right' });
    await page.waitForSelector('#st-cfg', { timeout: 10000 });
    check(await page.evaluate(() => document.getElementById('st-dock').checked), 'the dock setting is on');
    await page.locator('#st-dock').click();
    check(await page.evaluate(() => localStorage.getItem('mbu.stDock')) === 'false', 'stored as the shared setting');
    check(!(await page.evaluate(() => !!document.getElementById('mbu-dock'))), 'the dock\'s button goes');
    const out = await at(page);
    check(out.length >= 2 && out.every(e => e.right === 14), `the launchers are back up the right edge (${JSON.stringify(out)})`);
    await page.locator('#st-dock').click();
    check(await page.evaluate(() => localStorage.getItem('mbu.stDock') === null && !!document.getElementById('mbu-dock')), 'and back in the dock');
  });

  // The layout: a column (the default) or a row along the page's edge; the side: right (the default) or left.
  test('side and layout move the launchers, and a fresh load keeps them', { tag: ['@sandbox'] }, async ({ page, inject }, info) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await load(page, inject, { dock: false });
    await stacked(page);
    await openSettings(page);
    const col = await at(page);
    check(col.every(e => e.right === 14) && new Set(col.map(e => e.bottom)).size === col.length, `a column up the right edge (${JSON.stringify(col)})`);

    await page.selectOption('#st-flow', 'row');
    check(await page.evaluate(() => localStorage.getItem('mbu.cornerFlow')) === '"row"', 'the row is stored as the shared setting');
    const row = await at(page);
    check(row.every(e => e.bottom === 14) && new Set(row.map(e => e.right)).size === row.length, `in a row along the bottom (${JSON.stringify(row)})`);

    await page.selectOption('#st-side', 'left');
    check(await page.evaluate(() => localStorage.getItem('mbu.cornerSide')) === '"left"', 'the side too');
    const left = await at(page);
    check(Math.min(...left.map(e => e.left)) === 14 && new Set(left.map(e => e.left)).size === left.length, `a row from the bottom-left corner (${JSON.stringify(left)})`);
    await page.screenshot({ path: info.outputPath('left-row.png'), clip: { x: 0, y: 900 - 80, width: 260, height: 80 } });

    await page.reload({ waitUntil: 'load' });
    await inject('string_theory');
    await stacked(page);
    await page.waitForTimeout(2000);
    const loaded = await at(page);
    check(loaded.every(e => e.bottom === 14) && Math.min(...loaded.map(e => e.left)) === 14, `a fresh load keeps them (${JSON.stringify(loaded)})`);
    // a standalone launcher follows the shared settings with no String Theory on the page
    await page.reload({ waitUntil: 'load' });
    await inject('falcon'); await inject('fusion');
    await page.waitForSelector('#falcon-launcher'); await page.waitForSelector('#fs-launch');
    const solo = await at(page);
    check(solo.length === 2 && solo.every(e => e.bottom === 14) && Math.min(...solo.map(e => e.left)) === 14, `standalone scripts follow (${JSON.stringify(solo)})`);
    await page.evaluate(keys => keys.forEach(k => localStorage.removeItem('mbu.' + k)), SHARED);
  });

  // Size scales every launcher; dragging one moves the whole stack; Reset puts both back.
  test('size, drag and reset', { tag: ['@sandbox'] }, async ({ page, inject }, info) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await load(page, inject, { dock: false });
    await stacked(page);
    const base = await at(page);
    await openSettings(page);
    await page.fill('#st-size', '140');
    await page.locator('#st-size').dispatchEvent('change');
    check(await page.evaluate(() => localStorage.getItem('mbu.cornerSize')) === '1.4', `stored as 1.4 (${await page.evaluate(() => localStorage.getItem('mbu.cornerSize'))})`);
    const big = await at(page);
    const one = id => [base.find(e => e.id === id), big.find(e => e.id === id)];
    const [b0, b1] = one(base[0].id);
    check(Math.abs(b1.w - b0.w * 1.4) <= 2 && b1.right === 14, `${base[0].id} scaled in its place (${b0.w} → ${b1.w}, right ${b1.right})`);
    check(new Set(big.map(e => e.bottom)).size === big.length, 'still one above another');
    await page.keyboard.press('Escape');

    // drag the topmost launcher 200px left and 100px up
    const top = big.reduce((a, e) => (e.bottom > a.bottom ? e : a));
    const box = await page.locator('#' + top.id).boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(x - 20 * i, y - 10 * i);
    await page.mouse.up();
    await page.waitForTimeout(300);
    const off = JSON.parse(await page.evaluate(() => localStorage.getItem('mbu.cornerOffset')) || 'null');
    check(off && off.br && Math.abs(off.br.x - 200) <= 2 && Math.abs(off.br.y - 100) <= 2, `the drag is stored (${JSON.stringify(off)})`);
    const moved = await at(page);
    check(moved.every(e => Math.abs(e.right - (14 + off.br.x)) <= 2), `the whole stack moved (${JSON.stringify(moved)})`);
    await page.screenshot({ path: info.outputPath('dragged.png') });

    await openSettings(page);
    await page.locator('#st-reset').click();
    check(await page.evaluate(() => localStorage.getItem('mbu.cornerOffset') === null && localStorage.getItem('mbu.cornerSize') === null), 'Reset clears place and size');
    check(await page.evaluate(() => document.getElementById('st-size').value) === '100', 'the size field shows 100%');
    const back = await at(page);
    check(JSON.stringify(back) === JSON.stringify(base), `the launchers are back as they were (${JSON.stringify(back)})`);
  });
});
