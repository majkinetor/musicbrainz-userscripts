// #558 (majkinetor): "Currently I have to open popup and click import all (or
// provider). I almost always use import all so it could be run faster with right
// click on the button. Add tooltip info too."
//
// Right-clicking the toolbar's URL button imports from every source at once,
// without opening the popover.
//
// Read-only: nothing is ever submitted (POSTs are counted and asserted zero).
// The hidden per-source seed iframes ARE the thing being counted, so they are
// allowed to be created but their navigation is aborted — the sourcing slot is
// what proves the fan-out happened, and letting N real uploader pages load would
// make the test slow and flaky without proving anything more.
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'art_station.user.js'), 'utf8');
const SHOTS = resolve(HERE, 'logs'); await mkdir(SHOTS, { recursive: true });

// a release with several linked platforms (the same fixture verify-502 uses)
const RELEASE = 'bafa58c1-e9b3-4ed3-b42d-70a387e411f4';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 950 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
let posts = 0, seeded = 0; const postUrls = [];
await page.route(() => true, route => {
  const r = route.request();
  // MusicBrainz's own page POSTs (CSP reports, analytics) are not edits — only an
  // /edit or /add-*-art submission would be, and none may happen here.
  if (r.method() === 'POST') { postUrls.push(r.url()); if (/\/(edit|add-cover-art|add-event-art|ws\/js)/.test(r.url())) posts++; return route.abort(); }
  // the per-source seed iframe: count it, don't let it load a real uploader page
  if (/\/add-(cover|event)-art\?.*x_seed/.test(r.url())) { seeded++; return route.abort(); }
  return route.continue();
});
await page.goto(`https://musicbrainz.org/release/${RELEASE}/add-cover-art`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForSelector('#as-root', { timeout: 15000 });
// Register a custom provider (#250's public API) that matches a link this release
// really has. Without one the "all" count can't tell the old behaviour from the new
// — the old button counted only linked platforms, so a platforms-only release gives
// the same number either way and the consistency check would be vacuous.
const registered = await page.evaluate(() => {
  const api = window.ArtStation;
  if (!api || !api.registerProvider) return false;
  window.__probe558Run = 0;
  api.registerProvider({
    id: 'probe558', name: 'Probe 558', icon: '',
    match: (u) => /musicbrainz\.org|deezer\.com|spotify\.com|tidal\.com|apple\.com|beatport\.com/i.test(u),
    run: () => { window.__probe558Run++; return []; },
  });
  return true;
});
ck(registered, 'fixture: a custom provider registered through the public API (#250)');
// wait for the source count to resolve — everything below is relative to it
await page.waitForFunction(() => /\(\d+\)/.test((document.querySelector('.as-src-n') || {}).textContent || ''), null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.evaluate(() => window.ArtStation && document.querySelector('.as-src') && null);

const btn = await page.evaluate(() => {
  const b = document.querySelector('.as-src');
  return { n: ((b.querySelector('.as-src-n') || {}).textContent || '').trim(), title: b.title };
});
const total = parseInt((btn.n.match(/\((\d+)\)/) || [])[1], 10);
console.log('URL button: ' + JSON.stringify(btn));
ck(total >= 2, `fixture: this release offers several sources (${total}) — otherwise "all" proves nothing`);
ck(/right-click/i.test(btn.title), '#558: the tooltip advertises the right-click shortcut');
ck(new RegExp(`import from all ${total}`, 'i').test(btn.title), `and names how many it would import (${total})`);

// ── the popover's "Import all" must agree with the button's own count ────────
await page.click('.as-src');
await page.waitForSelector('.as-src-pop', { timeout: 5000 });
await page.waitForTimeout(1200);
const popInfo = await page.evaluate(() => {
  const all = document.querySelector('.as-src-all');
  return {
    allLabel: all ? all.textContent.trim() : '(none)',
    inAllWrap: !!(all && all.closest('.as-src-allwrap')),
    provButtons: document.querySelectorAll('.as-src-prov .as-src-prov-b').length,
    customButtons: document.querySelectorAll('.as-src-custom .as-src-prov-b').length,
  };
});
console.log('popover: ' + JSON.stringify(popInfo));
ck(new RegExp(`Import all ${total} sources`).test(popInfo.allLabel),
  `#558: "Import all" counts every source, platforms AND registered providers (${JSON.stringify(popInfo.allLabel)} vs button's ${total})`);
ck(popInfo.inAllWrap, 'and it sits below both lists rather than inside the platforms box');
ck(popInfo.provButtons + popInfo.customButtons === total, `one button per source above it (${popInfo.provButtons}+${popInfo.customButtons}=${total})`);
ck(popInfo.customButtons > 0, 'the registered provider is among them — so the count above is NOT just the linked platforms');
ck(new RegExp(`Import all ${popInfo.provButtons} sources`).test(popInfo.allLabel) === false,
  `and specifically not the OLD platforms-only count (${popInfo.provButtons}), which is what made this worth fixing`);
await page.locator('.as-src-pop').screenshot({ path: resolve(SHOTS, 'i558-popover.png') }).catch(() => {});

// ── right-click: imports everything, popover never opens ────────────────────
await page.evaluate(() => { document.querySelectorAll('.as-pop').forEach(p => p.remove()); });
await page.waitForTimeout(200);
seeded = 0;
const defaultPrevented = await page.evaluate(() => {
  const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  document.querySelector('.as-src').dispatchEvent(ev);
  return ev.defaultPrevented;
});
ck(defaultPrevented, '#558: the browser context menu is suppressed — it would cover the slots the click starts');
// Sampled promptly: a slot is removed again as soon as its source resolves with
// nothing, so a late read would undercount fan-out that really did happen.
await page.waitForFunction(() => document.querySelectorAll('.as-srcing-lbl').length > 0, null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(600);
const after = await page.evaluate(() => ({
  popOpen: !!document.querySelector('.as-src-pop'),
  slots: [...document.querySelectorAll('.as-srcing-lbl')].map(e => e.textContent.trim()),
  customRuns: window.__probe558Run,
}));
console.log('after right-click: ' + JSON.stringify({ popOpen: after.popOpen, slots: after.slots, customRuns: after.customRuns, seededIframes: seeded }));
ck(!after.popOpen, '#558: the popover does NOT open — that is the whole point of the shortcut');
// The two source kinds go out by different routes and are asserted separately: a
// linked platform seeds a hidden uploader iframe (and keeps its slot while that
// loads), a registered provider has its own run() called (this probe's returns
// nothing, so ITS slot is torn down again at once — which is why the slot count
// is measured against the platforms, and the provider against its run counter).
ck(after.slots.length === popInfo.provButtons, `a sourcing slot started for every linked platform (${after.slots.length} of ${popInfo.provButtons})`);
ck(seeded === popInfo.provButtons, `one seed iframe per linked platform (${seeded} of ${popInfo.provButtons})`);
ck(after.customRuns === 1, `#558: the registered provider was run too — the old "Import all" skipped it entirely (${after.customRuns})`);
ck(after.slots.every(s => /sourcing/i.test(s)), 'each slot names what it is sourcing — ' + JSON.stringify(after.slots.slice(0, 3)));
await page.screenshot({ path: resolve(SHOTS, 'i558-right-click.png') }).catch(() => {});

// ── the ordinary left click is unchanged ────────────────────────────────────
await page.click('.as-src');
await page.waitForTimeout(600);
ck(await page.locator('.as-src-pop').count() > 0, 'a plain left click still opens the popover — the shortcut is additive');

console.log('POSTs seen (all aborted): ' + JSON.stringify(postUrls));
ck(posts === 0, `nothing was submitted (${posts} edit/upload POSTs out of ${postUrls.length} POSTs total, all aborted)`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
