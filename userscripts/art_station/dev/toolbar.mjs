import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = 'b792340e-2c77-4dd1-9de4-6dc174440a33';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3000);
// no selection yet
const bar = await page.$('#as-root .as-bar');
let box = await bar.boundingBox();
await page.screenshot({ path: 'userscripts/art_station/dev/tb_empty.png', clip: { x: box.x, y: box.y, width: box.width, height: box.height + 4 } });
// select all via the ✳ button → selection cluster populates
await page.click('#as-root .as-selall');
await page.waitForTimeout(200);
box = await (await page.$('#as-root .as-bar')).boundingBox();
await page.screenshot({ path: 'userscripts/art_station/dev/tb_sel.png', clip: { x: box.x, y: box.y, width: box.width, height: box.height + 4 } });
console.log('sel count text:', await page.textContent('#as-root .as-selcnt'));
// open the View dropdown
await page.click('#as-root .as-view');
await page.waitForTimeout(200);
const pop = await page.$('.as-view-pop');
const pb = await pop.boundingBox();
await page.screenshot({ path: 'userscripts/art_station/dev/tb_view.png', clip: { x: pb.x - 4, y: box.y, width: pb.width + 8, height: (pb.y + pb.height) - box.y + 8 } });
console.log('view pop open:', !!pop, '| dragwarn present:', await page.$('#as-root .as-dragwarn') ? 'yes' : 'no');
await ctx.close();
