// #693, #851: String Theory's settings window. The manager's menu has one entry, ⚙ Settings, and a
// right-click on the dock's button opens the same window. In it each bundled script can be turned off
// (the GM value 'string_theory.off', folder names; an off member doesn't start, the others do), and the
// corner launchers get their side, orientation, size and order (the shared localStorage settings
// mbu.cornerSide / cornerFlow / cornerSize / dockOrder). They fold into String Theory's icon until a click
// unrolls them (remembered, mbu.dockOpen). A right-click on a launcher's icon in the settings opens its
// script's settings.
//
// test.musicbrainz.org, a release page (ISRC Scout's button and Platform Check's panel both show there).
import { readFileSync } from 'node:fs';
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

const RELEASE = 'ec116461-5b0d-4c98-bb44-a4de5de63076';
const MEMBERS = readFileSync(new URL('../members.txt', import.meta.url), 'utf8').split(/\r?\n/).map(l => l.replace(/#.*/, '').trim()).filter(Boolean).length;
const SHARED = ['cornerSide', 'cornerFlow', 'cornerSize', 'dockOrder', 'dockKnown', 'dockOpen'];

// a manager's menu like Violentmonkey's: an options.id names the entry
const fakeMenu = () => {
  const menu = window.__menu = new Map(); let next = 1;
  window.GM_registerMenuCommand = (caption, fn, o) => { const id = (o && o.id) || next++; menu.set(id, { caption, fn }); return id; };
  window.GM_unregisterMenuCommand = id => menu.delete(id);
};
// a clean slate: the dock folded, or unrolled (dockOpen) to measure the launchers
async function load(page, inject, { open = false } = {}) {
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(([keys, open]) => {
    keys.forEach(k => localStorage.removeItem('mbu.' + k));
    if (open) localStorage.setItem('mbu.dockOpen', 'true');
  }, [SHARED, open]);
  await page.evaluate(fakeMenu);
  await inject('string_theory');
}
const openSettings = async page => {
  await page.evaluate(() => [...window.__menu.values()].find(e => /Settings/.test(e.caption)).fn());
  await page.waitForSelector('#st-cfg', { timeout: 10000 });
};
// the visible corner launchers, the dock's button left out unless asked for
const at = (page, dock = false) => page.evaluate(dock => [...document.querySelectorAll('[data-mb-corner="br"]')]
  .filter(e => (dock || e.id !== 'mbu-dock') && getComputedStyle(e).display !== 'none')
  .map(e => { const r = e.getBoundingClientRect(); return { id: e.id, bottom: Math.round(innerHeight - r.bottom), left: Math.round(r.left), right: Math.round(document.documentElement.clientWidth - r.right), w: Math.round(r.width) }; }), dock);
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
  check(await page.evaluate(() => document.getElementById('st-p-a').hidden), 'About is its own tab, closed at first');
  await page.locator('#st-tab-a').click();
  check(await page.evaluate(() => document.getElementById('st-p-l').hidden), 'opening it closes Launchers');
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

// Event Horizon is a member too; these run without it, where the dock works the same.
test.describe('Event Horizon turned off', () => {
  test.use({ gm: { name: 'String Theory', values: { 'string_theory.off': ['event_horizon'] } } });

  // Without Event Horizon the launchers fold into String Theory's icon too, folded at first; a click
  // unrolls them and the next page keeps that; a right-click opens the settings, which have no setting for it.
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
    check(!(await page.evaluate(() => !!document.getElementById('st-dock'))), 'no setting for the folding');
    await page.keyboard.press('Escape');

    await page.mouse.move(10, 10);
    await page.locator('#mbu-dock').click();
    await page.mouse.move(10, 10);
    check(await page.evaluate(() => localStorage.getItem('mbu.dockOpen')) === 'true', 'a click unrolls it, remembered');
    check((await at(page)).length >= 2, 'the launchers show');
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(fakeMenu);
    await inject('string_theory');
    await stacked(page);
    await page.waitForSelector('#mbu-dock', { timeout: 15000 });
    await page.mouse.move(10, 10);
    check(await until(async () => (await at(page)).length, n => n >= 2, { timeout: 10000 }) >= 2, 'the next page keeps it unrolled');
    await page.locator('#mbu-dock').click();
    await page.mouse.move(10, 10);
    check(await page.evaluate(() => localStorage.getItem('mbu.dockOpen')) === null, 'a second click folds it, remembered');
    check(await until(async () => (await at(page)).length, n => n === 0, { timeout: 5000 }) === 0, 'the launchers fold');
  });

  // The orientation: a column (the default) or a row along the page's edge; the side: right (the default) or left.
  test('side and orientation move the launchers, and a fresh load keeps them', { tag: ['@sandbox'] }, async ({ page, inject }, info) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await load(page, inject, { open: true });
    await stacked(page);
    await openSettings(page);
    const pressed = () => page.evaluate(() => [...document.querySelectorAll('#st-cfg [role=radio][aria-checked=true]')].map(b => b.dataset.v).join(' '));
    check(await pressed() === 'right column', `Right and Column are selected (${await pressed()})`);
    const col = await at(page);
    check(col.every(e => e.right === 14) && new Set(col.map(e => e.bottom)).size === col.length, `a column up the right edge (${JSON.stringify(col)})`);

    await page.locator('#st-flow [data-v="row"]').click();
    check(await page.evaluate(() => localStorage.getItem('mbu.cornerFlow')) === '"row"', 'the row is stored as the shared setting');
    const row = await at(page);
    check(row.every(e => e.bottom === 14) && new Set(row.map(e => e.right)).size === row.length, `in a row along the bottom (${JSON.stringify(row)})`);

    await page.locator('#st-side [data-v="left"]').click();
    check(await page.evaluate(() => localStorage.getItem('mbu.cornerSide')) === '"left"', 'the side too');
    check(await pressed() === 'left row', `Left and Row are selected (${await pressed()})`);
    const left = await at(page, true);
    check(Math.min(...left.map(e => e.left)) === 14 && new Set(left.map(e => e.left)).size === left.length, `a row from the bottom-left corner (${JSON.stringify(left)})`);
    await page.screenshot({ path: info.outputPath('left-row.png'), clip: { x: 0, y: 900 - 80, width: 260, height: 80 } });

    await page.reload({ waitUntil: 'load' });
    await inject('string_theory');
    await stacked(page);
    await page.waitForTimeout(2000);
    const loaded = await at(page, true);
    check(loaded.every(e => e.bottom === 14) && Math.min(...loaded.map(e => e.left)) === 14, `a fresh load keeps them (${JSON.stringify(loaded)})`);
    // a standalone launcher follows the shared settings with no String Theory on the page
    await page.reload({ waitUntil: 'load' });
    await inject('falcon'); await inject('fusion');
    await page.waitForSelector('#falcon-launcher'); await page.waitForSelector('#fs-launch');
    const solo = await at(page);
    check(solo.length === 2 && solo.every(e => e.bottom === 14) && Math.min(...solo.map(e => e.left)) === 14, `standalone scripts follow (${JSON.stringify(solo)})`);
    await page.evaluate(keys => keys.forEach(k => localStorage.removeItem('mbu.' + k)), SHARED);
  });

  // The size stepper scales every launcher and the icons in the settings, 60 to 160 % by 10.
  test('the size stepper', { tag: ['@sandbox'] }, async ({ page, inject }, info) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await load(page, inject, { open: true });
    await stacked(page);
    const base = await at(page);
    await openSettings(page);
    const icon = () => page.evaluate(() => Math.round(document.querySelector('#st-order .st-di').getBoundingClientRect().width));
    const i0 = await icon();
    for (let i = 0; i < 4; i++) await page.locator('#st-size-up').click();
    check(await page.evaluate(() => localStorage.getItem('mbu.cornerSize')) === '1.4', `stored as 1.4 (${await page.evaluate(() => localStorage.getItem('mbu.cornerSize'))})`);
    check(await page.locator('#st-size').textContent() === '140 %', 'the stepper shows 140 %');
    const big = await at(page);
    const [b0, b1] = [base[0], big.find(e => e.id === base[0].id)];
    check(Math.abs(b1.w - b0.w * 1.4) <= 2 && b1.right === 14, `${b0.id} scaled in its place (${b0.w} → ${b1.w}, right ${b1.right})`);
    check(Math.abs(await icon() - i0 * 1.4) <= 2, `the settings' icons scale too (${i0} → ${await icon()})`);
    await page.screenshot({ path: info.outputPath('size-140.png') });
    for (let i = 0; i < 2; i++) await page.locator('#st-size-up').click();
    check(await page.locator('#st-size').textContent() === '160 %' && await page.locator('#st-size-up').isDisabled(), 'it stops at 160 %');
    for (let i = 0; i < 6; i++) await page.locator('#st-size-dn').click();
    check(await page.evaluate(() => localStorage.getItem('mbu.cornerSize')) === null, '100 % clears the setting');
    check(JSON.stringify(await at(page)) === JSON.stringify(base), 'the launchers are back as they were');
  });

  // The settings list every launcher a page has shown (mbu.dockKnown); dragging one first puts it nearest
  // the corner (mbu.dockOrder); a right-click opens that script's settings.
  test('launcher order and right-click', { tag: ['@sandbox'] }, async ({ page, inject }, info) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await load(page, inject, { open: true });
    await stacked(page);
    await page.evaluate(() => {   // a launcher another page showed
      const k = JSON.parse(localStorage.getItem('mbu.dockKnown') || '{}');
      k.Elsewhere = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>';
      localStorage.setItem('mbu.dockKnown', JSON.stringify(k));
    });
    // the visible launchers' names, the one nearest the corner first
    const stack = () => page.evaluate(() => [...document.querySelectorAll('[data-mb-corner="br"]:not(#mbu-dock)')]
      .filter(e => getComputedStyle(e).display !== 'none' && e.dataset.mbCornerLabel)
      .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom).map(e => e.dataset.mbCornerLabel)
      .filter((n, i, a) => a.indexOf(n) === i));
    await openSettings(page);
    const strip = () => page.evaluate(() => [...document.querySelectorAll('#st-order .st-di')].map(d => d.dataset.name));
    const names = await strip(), on = await stack();
    check(['Fusion', 'Mission Control', 'Elsewhere'].every(n => names.includes(n)), `the launchers are listed (${names.join(', ')})`);
    check(JSON.stringify(names.filter(n => on.includes(n))) === JSON.stringify(on), `in the page's order (${on.join(', ')})`);
    check(await page.evaluate(() => getComputedStyle(document.querySelector('#st-order [data-name="Elsewhere"]')).opacity === '1'), 'one not on this page is not dimmed');
    check(await page.evaluate(() => getComputedStyle(document.getElementById('st-cfg-ov')).backgroundColor === 'rgba(0, 0, 0, 0)'), 'the page behind is not dimmed');
    await page.screenshot({ path: info.outputPath('order.png') });

    // drag the last launcher on the page to the front
    const last = on[on.length - 1];
    const from = await page.locator(`#st-order [data-name="${last}"]`).boundingBox();
    const to = await page.locator('#st-order .st-di').first().boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(from.x + (to.x + 3 - from.x) * i / 8, to.y + to.height / 2);
    await page.mouse.up();
    const order = JSON.parse(await page.evaluate(() => localStorage.getItem('mbu.dockOrder')) || 'null');
    check(order && order[0] === last, `stored with ${last} first (${JSON.stringify(order)})`);
    check((await stack())[0] === last, `${last} moved nearest the corner (${(await stack()).join(', ')})`);

    // #851: settings open anywhere; a launcher that isn't a member has none
    await page.locator('#st-order [data-name="Elsewhere"]').click({ button: 'right' });
    check(await until(() => page.evaluate(() => /Elsewhere has no settings/.test(document.getElementById('mbu-toast')?.textContent || '')), Boolean, { timeout: 5000 }), 'a right-click on one that is not a member says it has no settings');
    await openSettings(page);
    // every icon in the settings is cropped to what it draws (the pixel crop runs once drawn), so all show the same size
    await page.waitForTimeout(600);
    const sizes = await page.evaluate(() => Promise.all([...document.querySelectorAll('#st-order .st-di img')].map(img => new Promise(ok => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const im = new Image(); im.onload = () => {
        const x = c.getContext('2d'); x.drawImage(im, 0, 0, 64, 64);
        const d = x.getImageData(0, 0, 64, 64).data; let lo = 64, hi = -1;
        for (let i = 0; i < 64 * 64; i++) if (d[i * 4 + 3] > 20) { const y = i >> 6, xx = i & 63; lo = Math.min(lo, xx, y); hi = Math.max(hi, xx, y); }
        ok([img.closest('.st-di').dataset.name, hi - lo]);
      }; im.onerror = () => ok([img.closest('.st-di').dataset.name, -1]); im.src = img.src;
    }))));
    check(sizes.length >= 3 && sizes.every(([, w]) => w >= 54), `each icon fills its circle (${sizes.map(([n, w]) => n + ' ' + w).join(', ')})`);

    await page.locator('#st-tab-a').click();
    const list = await page.evaluate(() => [...document.querySelectorAll('#st-cfg .st-scripts label')].map(l => [l.dataset.name, !!l.querySelector('.st-si img'), l.getBoundingClientRect().height]));
    check(list.length > 5 && list.every(r => r[1]), `every script in About has its icon (${list.filter(r => !r[1]).map(r => r[0]).join(', ') || 'all'})`);
    check(list.every(r => r[2] < 30), `no name wraps (${Math.max(...list.map(r => r[2]))} px rows)`);
    await page.screenshot({ path: info.outputPath('about.png') });
    // #851: Art Station doesn't run on a release page; String Theory starts it only to open its settings
    await page.locator('#st-cfg .st-scripts [data-name="Art Station"]').click({ button: 'right' });
    check(await until(() => page.evaluate(() => !!document.getElementById('as-setup')), Boolean, { timeout: 5000 }), 'a script not on this page opens its settings');
    check(await page.evaluate(() => !document.getElementById('as-css') || !!document.getElementById('as-setup')), 'and only them');
    await page.evaluate(() => document.getElementById('as-setup')?.remove());
    await openSettings(page);
    await page.locator('#st-tab-a').click();
    await page.locator('#st-cfg .st-scripts [data-name="Fusion"]').click({ button: 'right' });
    check(await until(() => page.evaluate(() => !!document.getElementById('fs-settings')), Boolean, { timeout: 5000 }), 'a right-click on Fusion in About opens Fusion\'s settings');
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.getElementById('fs-settings')?.remove());
    await openSettings(page);

    await page.locator('#st-order [data-name="Fusion"]').click({ button: 'right' });
    check(await until(() => page.evaluate(() => !!document.getElementById('fs-settings')), Boolean, { timeout: 5000 }), 'a right-click on Fusion opens Fusion\'s settings');
    check(!(await page.evaluate(() => !!document.getElementById('st-cfg-ov'))), 'and closes String Theory\'s');

    // a fresh load keeps the order
    await page.reload({ waitUntil: 'load' });
    await inject('string_theory');
    await stacked(page);
    await page.waitForTimeout(2000);
    check((await stack())[0] === last, `a fresh load keeps it (${(await stack()).join(', ')})`);
    await page.evaluate(keys => keys.forEach(k => localStorage.removeItem('mbu.' + k)), SHARED);
  });
});
