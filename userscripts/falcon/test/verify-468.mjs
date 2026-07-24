// #468 — shared corner-slot convention so independent scripts' floating launcher
// buttons never land on the same pixel. Falcon (data-mb-corner="br", order 10) and
// Apollo Editor / Art Station's switcher (order 20) should stack vertically instead
// of overlapping when both are present on the same real page.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const falconCode = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');
const apolloCode = await readFile(resolve(HERE, '..', '..', 'apollo_editor', 'apollo_editor.user.js'), 'utf8');
const artStationCode = await readFile(resolve(HERE, '..', '..', 'art_station', 'art_station.user.js'), 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'test', version: 't' } };
  window.unsafeWindow = window;
});

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

function rectOf(el) { return { top: el.offsetTop, bottom: el.getBoundingClientRect().bottom, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }; }

async function checkNoOverlap(page, selA, selB) {
  return page.evaluate(({ selA, selB }) => {
    const a = document.querySelector(selA), b = document.querySelector(selB);
    if (!a || !b) return { ok: false, reason: 'missing element(s)', hasA: !!a, hasB: !!b };
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const overlap = !(ra.right <= rb.left || ra.left >= rb.right || ra.bottom <= rb.top || ra.top >= rb.bottom);
    return { ok: !overlap, ra: { top: ra.top, bottom: ra.bottom, left: ra.left, right: ra.right }, rb: { top: rb.top, bottom: rb.bottom, left: rb.left, right: rb.right } };
  }, { selA, selB });
}

// 1. Falcon + Apollo Editor on a real release edit page.
{
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('https://musicbrainz.org/release/ec2449a8-3dc5-461c-80a1-e43d96345613/edit', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForTimeout(1200);
  await page.addScriptTag({ content: falconCode });
  await page.addScriptTag({ content: apolloCode });
  await page.waitForSelector('#falcon-launcher', { timeout: 10000 });
  await page.waitForSelector('#tc-launch', { timeout: 10000 });
  await page.waitForTimeout(600);   // Apollo's watchTabs tick() + its own mbRestackCorner call
  const r = await checkNoOverlap(page, '#falcon-launcher', '#tc-launch');
  console.log('Falcon vs Apollo:', JSON.stringify(r));
  ck(r.ok, `Falcon launcher and Apollo's #tc-launch do not overlap (${JSON.stringify(r)})`);
  ck(r.rb && r.ra && r.rb.bottom <= r.ra.top, 'Apollo (order 20) sits ABOVE Falcon (order 10, closer to the corner)');
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

// 2. Falcon + Art Station on a real cover-art page.
{
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('https://musicbrainz.org/release/ec2449a8-3dc5-461c-80a1-e43d96345613/cover-art', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForTimeout(1200);
  await page.addScriptTag({ content: falconCode });
  await page.addScriptTag({ content: artStationCode });
  await page.waitForSelector('#falcon-launcher', { timeout: 10000 });
  await page.waitForSelector('#as-switch-wrap', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);
  const r = await checkNoOverlap(page, '#falcon-launcher', '#as-switch-wrap');
  console.log('Falcon vs Art Station:', JSON.stringify(r));
  ck(r.ok, `Falcon launcher and Art Station's #as-switch-wrap do not overlap (${JSON.stringify(r)})`);
  ck(r.rb && r.ra && r.rb.bottom <= r.ra.top, 'Art Station (order 20) sits ABOVE Falcon (order 10, closer to the corner)');
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
