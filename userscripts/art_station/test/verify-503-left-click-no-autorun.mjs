// #503 (majkinetor, live: "when opening the 'enter edit' dialog with normal
// left click it immediately entered edit... not distinguishable" — a
// destructive "Remove Front" batch nearly auto-committed on a routine left
// click). Root cause: `commit.onclick = enterEdit;` assigns the function
// directly as the DOM click handler, which always invokes it with the click
// Event as the first argument — and enterEdit's first (and only) parameter
// IS `immediate`. A MouseEvent object is truthy, so `if (immediate)` read
// true on EVERY left click, identical to the real right-click path (#493).
// Fixed by wrapping in `() => enterEdit()` so a left click genuinely calls
// it with no argument.
//
// Dry-run-forced (see #493's own testing discipline): the "Dry run"
// checkbox is checked by default in this in-memory-only copy, so runOp()'s
// dry branch never issues the actual fetch/POST — safe to click for real
// against a real page regardless of which endpoint it would hit.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
let code = await readFile(resolve(HERE, '..', 'art_station.user.js'), 'utf8');
code = code.replace('<input type="checkbox" class="as-cm-dryrun">', '<input type="checkbox" class="as-cm-dryrun" checked>');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
const page = ctx.pages()[0] || await ctx.newPage();
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

let capturedRequests = [];
await page.route('**/edit-cover-art/**', route => {
  if (route.request().method() !== 'POST') { route.continue(); return; }
  capturedRequests.push(route.request().postData());
  route.fulfill({ status: 200, contentType: 'text/html', body: '<html>blocked-for-test</html>' });
});
await page.route('**/ws/js/edit/create', route => {
  capturedRequests.push(route.request().postData());
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ edits: [] }) });
});

await page.goto('https://musicbrainz.org/release/bafa58c1-e9b3-4ed3-b42d-70a387e411f4/cover-art', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(500);
await page.addScriptTag({ content: code });
await page.waitForSelector('#as-root', { timeout: 15000 });
await page.waitForTimeout(800);

const marker = 'as503dryrun-' + Date.now();
await page.click('.as-card:first-child .as-pencil');
await page.waitForTimeout(200);
await page.fill('.as-card:first-child .as-cmt', marker);
await page.locator('.as-card:first-child .as-cmt').blur();
await page.waitForTimeout(300);
ck(await page.evaluate(() => !document.querySelector('.as-commit').disabled), 'commit button becomes enabled after staging a comment change');

// The actual regression: a plain left click must NOT auto-run.
await page.click('.as-commit');
await page.waitForTimeout(300);
ck(await page.evaluate(() => !!document.getElementById('as-commit')), 'left click opens the review/progress overlay');
const rowAfterLeftClick = await page.evaluate(() => document.querySelector('.as-cm-op .as-cm-st')?.textContent || null);
console.log('row status well after a plain left click (should stay "○", untouched):', rowAfterLeftClick);
ck(rowAfterLeftClick === '○', `left click does NOT auto-run — row stays untouched (got "${rowAfterLeftClick}")`);
ck(capturedRequests.length === 0, `no real POST reached either endpoint from a left click (got ${capturedRequests.length})`);

// #493 must still work: right click still auto-runs.
await page.evaluate(() => document.getElementById('as-commit')?.remove());
await page.waitForTimeout(200);
await page.click('.as-commit', { button: 'right' });
const rowRightAtOpen = await page.evaluate(() => document.querySelector('.as-cm-op .as-cm-st')?.textContent || null);
await page.waitForTimeout(1500);
const rowRightAfter = await page.evaluate(() => document.querySelector('.as-cm-op .as-cm-st')?.textContent || null);
console.log('right click: at-open status =', rowRightAtOpen, ', settled status =', rowRightAfter);
ck(rowRightAtOpen === '○', `right click still opens with the plan visible before running (got "${rowRightAtOpen}")`);
ck(rowRightAfter === '👁', `right click still auto-runs (dry preview) with no Run click needed (got "${rowRightAfter}")`);

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
