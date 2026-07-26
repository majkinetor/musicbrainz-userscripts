// Standing rule across every script here (Art Station is the reference impl):
// a toolbar's labelled buttons collapse to icon-only rather than wrapping, with
// the tooltips carrying the meaning.
//
// Falcon needs it more than most — the panel is a 460px box that can be
// drag-resized and maximized, so its three bars swing between cramped and
// roomy constantly. This checks both directions (collapse when narrow, restore
// when maximized), that every collapsed button still explains itself via a
// title, that the icon-only hit area stays generous (#419: no tiny targets),
// and that the two buttons whose labels change at runtime — "Expand all" and
// "Start" — keep their icon+label markup instead of having it flattened by a
// textContent write.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 10000 });
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });

// queue content, so the toolbar carries its real labels and the select-count
await page.evaluate(() => {
  window.__falconTest.setQueue([
    { id: 't1', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://myspace.com/bar1', linkTypeId: null }], name: 'A', urlResults: null, status: 'queued', error: '' },
    { id: 't2', entityType: 'artist', mbid: '5441c29d-3602-4898-b1a1-b77fa23b8e50', urls: [{ url: 'https://myspace.com/bar2', linkTypeId: null }], name: 'B', urlResults: null, status: 'queued', error: '' },
  ]);
});
await page.waitForTimeout(300);

// every labelled button must be built as icon + label, or there is nothing to collapse
const markup = await page.evaluate(() => ['falcon-expand-all', 'falcon-remove-selected', 'falcon-run', 'falcon-log-copy', 'falcon-log-clear'].map(id => {
  const b = document.getElementById(id);
  return { id, icon: !!b?.querySelector('.falcon-bi'), label: !!b?.querySelector('.falcon-bt'), title: (b?.title || '').length };
}));
console.log('button markup:', JSON.stringify(markup));
ck(markup.every(m => m.icon && m.label), `every labelled toolbar button is icon + label (${markup.filter(m => !(m.icon && m.label)).map(m => m.id).join(', ') || 'all ok'})`);
ck(markup.every(m => m.title > 0), `and every one carries a tooltip, which is what has to survive the collapse (${markup.filter(m => !m.title).map(m => m.id).join(', ') || 'all ok'})`);

// Sweep the whole range the user can drag through. The property that actually
// matters is "never wraps", at every width — collapsing is just the mechanism.
// (Measured: the queue toolbar has room for full labels down to ~320px and
// collapses from ~280px, so the assertion below uses a width safely past it
// rather than pinning the exact breakpoint, which is font-dependent.)
const sweep = [];
for (const w of [460, 400, 360, 320, 280, 240, 200]) {
  sweep.push(await page.evaluate(async (w) => {
    const p = document.getElementById('falcon-panel');
    p.style.width = w + 'px'; p.style.maxWidth = w + 'px';
    await new Promise(r => setTimeout(r, 250));
    const bar = document.getElementById('falcon-queue-toolbar');
    return { w, compact: bar.classList.contains('falcon-compact'), wraps: bar.scrollHeight > bar.clientHeight + 1 };
  }, w));
}
console.log('width sweep:', JSON.stringify(sweep));
ck(sweep.every(s => !s.wraps), `the queue toolbar never wraps at any width from 460px down to 200px (${sweep.filter(s => s.wraps).map(s => s.w + 'px').join(', ') || 'none wrapped'})`);
ck(sweep.some(s => s.compact), 'and it does collapse somewhere in that range rather than just overflowing');

// narrow: past the breakpoint
await page.evaluate(() => { const p = document.getElementById('falcon-panel'); p.style.width = '240px'; p.style.maxWidth = '240px'; });
await page.waitForTimeout(400);
const narrow = await page.evaluate(() => {
  const bar = document.getElementById('falcon-queue-toolbar');
  const btn = document.getElementById('falcon-remove-selected');
  return {
    compact: bar.classList.contains('falcon-compact'),
    labelShown: getComputedStyle(btn.querySelector('.falcon-bt')).display !== 'none',
    iconShown: getComputedStyle(btn.querySelector('.falcon-bi')).display !== 'none',
    w: Math.round(btn.getBoundingClientRect().width), h: Math.round(btn.getBoundingClientRect().height),
    wraps: bar.scrollHeight > bar.clientHeight + 1,
  };
});
console.log('narrow:', JSON.stringify(narrow));
ck(narrow.compact, 'a 240px panel collapses the queue toolbar to icon-only');
ck(!narrow.labelShown && narrow.iconShown, 'the label is hidden and the icon kept');
ck(!narrow.wraps, 'and the bar does not wrap to a second row (the whole point)');
ck(narrow.w >= 24 && narrow.h >= 20, `the icon-only button keeps a real hit area, not a bare glyph (${narrow.w}x${narrow.h})`);

// maximized: labels must come back
await page.click('#falcon-maximize');
await page.waitForTimeout(400);
const wide = await page.evaluate(() => {
  const bar = document.getElementById('falcon-queue-toolbar');
  const btn = document.getElementById('falcon-remove-selected');
  return { compact: bar.classList.contains('falcon-compact'), labelShown: getComputedStyle(btn.querySelector('.falcon-bt')).display !== 'none' };
});
console.log('maximized:', JSON.stringify(wide));
ck(!wide.compact && wide.labelShown, 'maximizing brings the labels back — the collapse is responsive, not one-way');

// the runtime-relabelled buttons must not lose their markup when they toggle
await page.click('#falcon-expand-all');
await page.waitForTimeout(250);
const afterToggle = await page.evaluate(() => {
  const b = document.getElementById('falcon-expand-all');
  return { text: b.querySelector('.falcon-bt')?.textContent, icon: !!b.querySelector('.falcon-bi'), label: !!b.querySelector('.falcon-bt') };
});
console.log('expand-all after toggle:', JSON.stringify(afterToggle));
ck(afterToggle.icon && afterToggle.label, 'toggling Expand all/Collapse all keeps the icon+label spans (a textContent write would flatten them)');
ck(/collapse/i.test(afterToggle.text || ''), `and the label really did change (got "${afterToggle.text}")`);

const runBtn = await page.evaluate(() => {
  window.__falconTest.setQueue([]);
  const b = document.getElementById('falcon-run');
  return { icon: !!b.querySelector('.falcon-bi'), label: !!b.querySelector('.falcon-bt'), text: b.querySelector('.falcon-bt')?.textContent };
});
console.log('run button:', JSON.stringify(runBtn));
ck(runBtn.icon && runBtn.label, 'the Start/Stop button keeps its icon+label spans too');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
