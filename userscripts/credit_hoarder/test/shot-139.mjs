// #139 follow-up — screenshot the redesigned toolbar to confirm: (1) the warning/badge pills are
// borderless + larger, and (2) the status message takes the available width up to "Options" and only
// ellipsises when it truly doesn't fit. Runs a real import (Midwest Funk — has warnings + unresolved).
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { launchTestContext, openReleasePage, injectUserscript, clickImport, confirmReviewTable, waitForImportDone } from './lib/browser.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, 'logs', 'shots');
await mkdir(OUT, { recursive: true });

const url = 'https://musicbrainz.org/release/62a764a8-cf05-459c-a358-2c65dbf0b729'; // Midwest Funk
const context = await launchTestContext({ headed: false });
const page = await openReleasePage(context, url);
await injectUserscript(page);
await clickImport(page);
await confirmReviewTable(page);
await waitForImportDone(page);
await page.waitForTimeout(2500);
await page.evaluate(() => window.scrollTo(0, 0));

const shot = async (name) => { const bar = page.locator('.discogs-bar-row1, .discogs-bar > div').first(); await bar.screenshot({ path: resolve(OUT, name) }).catch(async () => { await page.locator('.discogs-bar').screenshot({ path: resolve(OUT, name) }); }); };

// 1) badges as they are after import (borderless, larger)
await shot('i139-badges.png');

// 2) force a LONG status message visible — should fill up to Options, then ellipsis
const measure = async (text) => page.evaluate((t) => {
  const s = document.querySelector('.discogs-bar-status');
  s.style.display = '';
  s.textContent = t;
  const r = s.getBoundingClientRect();
  const opts = [...document.querySelectorAll('.discogs-bar-row1 *')].find(e => /Options/.test(e.textContent) && e.tagName === 'BUTTON');
  const optsR = opts ? opts.getBoundingClientRect() : null;
  return { text: t, clientW: Math.round(r.width), scrollW: s.scrollWidth, ellipsized: s.scrollWidth > Math.ceil(r.width) + 1, leftOfStatus: Math.round(r.left), optsRight: optsR ? Math.round(optsR.right) : null };
}, text);

await measure('Already in MB: vocals');
const baseH = await page.evaluate(() => Math.round(document.querySelector('.discogs-bar-row1').getBoundingClientRect().height));

const longMsg = 'Already in MB: misc: The Rough Guide to the Music of the Sahara — performance, instruments and a VERY long trailing description '.repeat(3) + 'that should clip and never wrap to a second row';
const longRes = await measure(longMsg);
const longH = await page.evaluate(() => Math.round(document.querySelector('.discogs-bar-row1').getBoundingClientRect().height));
await shot('i139-msg-long.png');

const shortRes = await measure('Already in MB: vocals');
await shot('i139-msg-short.png');

console.log('LONG :', JSON.stringify(longRes));
console.log('SHORT:', JSON.stringify(shortRes));
console.log('row1 height short=' + baseH + ' long=' + longH + '  ->', (longH <= baseH + 2 ? 'NO WRAP (pass)' : 'WRAPPED (FAIL)'));
console.log('shots ->', OUT);
await context.close();
