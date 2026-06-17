import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = 'b792340e-2c77-4dd1-9de4-6dc174440a33';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1200, height: 1000 }, acceptDownloads: true,
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('artstation:settings'));
await page.reload({ waitUntil: 'networkidle' });
await page.addScriptTag({ content: script }); await page.waitForTimeout(3000);
// select 3 covers via right-click
for (const i of [0,1,2]) await page.evaluate((idx)=>{ const c=document.querySelectorAll('#as-root .as-grid .as-card')[idx]; c.dispatchEvent(new MouseEvent('mousedown',{button:2,bubbles:true})); }, i);
await page.waitForTimeout(200);
console.log('selected:', await page.textContent('#as-root .as-selcnt'));
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  page.click('#as-root .as-bk-dl'),
]);
const path = await download.path();
const buf = readFileSync(path);
console.log('download filename:', download.suggestedFilename());
// parse EOCD (last 22 bytes): signature 0x06054b50, total entries at +10
const eocd = buf.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
const total = buf.readUInt16LE(eocd + 10);
const localHeaders = (buf.toString('latin1').match(/PK\x03\x04/g) || []).length;
console.log('zip valid EOCD:', eocd > 0, '| entries in central dir:', total, '| local file headers:', localHeaders, '| size:', buf.length, 'bytes');
await ctx.close();
