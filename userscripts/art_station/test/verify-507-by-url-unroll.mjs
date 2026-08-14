// #507 (majkinetor): redesign the "Source cover art" popover — remove the always-visible
// "or paste any URL" row + Fetch button, replace with a "By URL" title-bar toggle that
// unrolls into an input filling the title (apollo/isrc_scout-style unroll, see #180).
// Pasting a recognized URL still auto-fetches; no button needed.
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
await page.waitForSelector('.as-src-pop', { timeout: 5000 });

ck(!(await page.locator('.as-src-or').count()), 'old "or paste any URL" divider is gone');
ck(!(await page.locator('.as-src-go').count()), 'old "Fetch" button is gone');
ck(!(await page.locator('.as-src-inp').count()), 'old always-visible input is gone');

const btnVisible = await page.locator('.as-src-url-btn').isVisible();
ck(btnVisible, '"By URL" toggle is visible in the title bar before unrolling');
const btnText = (await page.locator('.as-src-url-btn').textContent() || '').trim();
ck(btnText === 'By URL', `toggle reads "By URL" (got "${btnText}")`);

const inpVisibleBefore = await page.locator('.as-src-url-inp').isVisible();
ck(!inpVisibleBefore, 'URL input is hidden before the toggle is clicked');

await page.click('.as-src-url-btn');
await page.waitForTimeout(150);
const inpVisibleAfter = await page.locator('.as-src-url-inp').isVisible();
ck(inpVisibleAfter, 'URL input becomes visible after clicking "By URL"');
const titleHidden = !(await page.locator('.as-src-htxt').isVisible());
ck(titleHidden, '"Source cover art" title text hides while unrolled (input fills the title)');
const btnHiddenAfter = !(await page.locator('.as-src-url-btn').isVisible());
ck(btnHiddenAfter, '"By URL" toggle itself hides while unrolled');

const focused = await page.evaluate(() => document.activeElement === document.querySelector('.as-src-url-inp'));
ck(focused, 'input is auto-focused on unroll');

// Escape collapses back to the icon, without dismissing the whole popover.
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
ck(await page.locator('.as-src-pop').count() === 1, 'Escape collapses the URL field, not the whole popover');
ck(!(await page.locator('.as-src-url-inp').isVisible()), 'URL input hides again after Escape');
ck(await page.locator('.as-src-url-btn').isVisible(), '"By URL" toggle reappears after Escape');

// Paste a recognized URL → auto-fetch (no Enter needed), same as before.
await page.click('.as-src-url-btn');
await page.waitForTimeout(150);
await page.evaluate(() => {
  const inp = document.querySelector('.as-src-url-inp');
  const dt = new DataTransfer(); dt.setData('text/plain', 'https://example.com/some-cover.jpg');
  inp.value = 'https://example.com/some-cover.jpg';
  inp.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
});
await page.waitForTimeout(400);
ck(!(await page.locator('.as-src-pop').count()), 'pasting a URL auto-fetches and closes the popover (no Fetch click needed)');
ck(!!(await page.locator('.as-srcing-thumb, .as-dmeta').count()), 'a sourcing slot was created from the pasted URL');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
