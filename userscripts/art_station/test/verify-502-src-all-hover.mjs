// #502 (chaban-mb, follow-up to #493): "Import from all sources" button text
// becomes hard to read on hover. Root cause: #493's generic
// `.as-btn:hover:not(:disabled)` rule has the SAME CSS specificity (one
// class + two pseudo-classes) as a bare `.as-src-all:hover` — a tie that
// happened to resolve correctly for `.as-commit:hover:not(:disabled)` (also
// matching that specificity, positioned after the generic rule so it wins
// the tie) but NOT for `.as-src-all:hover`, which never had the matching
// `:not(:disabled)` and so lost outright — its pale lavender hover
// background then won, leaving the button's white text unreadable on it.
// Fixed by matching the specificity so the same tie-break applies.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'art_station.user.js'), 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/release/bafa58c1-e9b3-4ed3-b42d-70a387e411f4/add-cover-art', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForSelector('#as-root', { timeout: 15000 });
await page.waitForTimeout(500);

await page.click('.as-src');
await page.waitForSelector('.as-src-all', { timeout: 5000 });

const box = await page.locator('.as-src-all').boundingBox();
ck(!!box, '"Import all sources" button is present (this release has multiple registered providers)');

const before = await page.evaluate(() => {
  const btn = document.querySelector('.as-src-all');
  const s = getComputedStyle(btn);
  return { color: s.color, background: s.backgroundColor };
});
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(150);
const hovered = await page.evaluate(() => {
  const btn = document.querySelector('.as-src-all');
  const s = getComputedStyle(btn);
  return { color: s.color, background: s.backgroundColor };
});
console.log('before hover:', JSON.stringify(before), '| on hover:', JSON.stringify(hovered));

ck(hovered.color === 'rgb(255, 255, 255)', `text stays white on hover (got "${hovered.color}")`);
ck(hovered.background === 'rgb(78, 50, 159)', `background goes to the intended dark accent, not the generic pale hover color (got "${hovered.background}")`);
ck(hovered.background !== 'rgb(246, 243, 253)', 'specifically NOT the generic .as-btn pale lavender hover background (which is what made the text unreadable)');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
