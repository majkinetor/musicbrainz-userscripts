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
await page.addInitScript(() => { try { delete window.showSaveFilePicker; } catch(e){} });   // force the parallel-blob fallback
await page.reload({ waitUntil: 'networkidle' });
await page.addScriptTag({ content: script }); await page.waitForTimeout(3000);
for (const i of [0,1,2,3]) await page.evaluate((idx)=>{ const c=document.querySelectorAll('#as-root .as-grid .as-card')[idx]; c.dispatchEvent(new MouseEvent('mousedown',{button:2,bubbles:true})); }, i);
await page.waitForTimeout(200);
console.log('fs api present:', await page.evaluate(()=>!!window.showSaveFilePicker), '(want false → fallback)');
const progressSeen = [];
const poll = setInterval(async () => { try { const t = await page.textContent('#as-root .as-bk-dl .as-bt'); if (t && t.includes('Zipping')) progressSeen.push(t); } catch(e){} }, 60);
const [download] = await Promise.all([ page.waitForEvent('download', { timeout: 30000 }), page.click('#as-root .as-bk-dl') ]);
clearInterval(poll);
const buf = readFileSync(await download.path());
const eocd = buf.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
console.log('zip:', download.suggestedFilename(), '| entries:', buf.readUInt16LE(eocd+10), '| size:', buf.length);
console.log('progress labels seen:', JSON.stringify([...new Set(progressSeen)].slice(0,6)));
await ctx.close();
