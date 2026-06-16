import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');

const MBID = process.argv[2] || '51431e0c-fdae-41a9-b8ff-65364c600eb4';
const OUT = process.argv[3] || 'userscripts/art_station/poc.png';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3500);
await page.screenshot({ path: OUT, fullPage: true });
console.log('shot ->', OUT);
await ctx.close();
