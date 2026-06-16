import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = '51431e0c-fdae-41a9-b8ff-65364c600eb4';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(4000);
// add a local image so a NEW card appears
const [chooser] = await Promise.all([
  page.waitForEvent('filechooser'),
  page.click('.as-add'),
]);
await chooser.setFiles('userscripts/art_station/poc-select.png');
await page.waitForTimeout(800);
// the NEW card is appended last; scroll to it and clip
const card = (await page.$$('.as-card.new'));
console.log('new cards:', card.length);
if (card.length) { await card[0].scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await card[0].screenshot({ path: 'userscripts/art_station/poc-newban.png' }); }
await ctx.close();
