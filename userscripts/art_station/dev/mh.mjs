import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = 'b792340e-2c77-4dd1-9de4-6dc174440a33';   // Congo Funk (Various Artists)
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
// capture window.open before the script runs
await page.addInitScript(() => { window.__opened = []; const real = window.open; window.open = (u, t) => { window.__opened.push(u); return { close(){}, closed:false }; }; });
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script }); await page.waitForTimeout(3000);
console.log('MH Covers button present:', await page.$('#as-root .as-mh') ? 'yes' : 'no');
await page.click('#as-root .as-mh'); await page.waitForTimeout(300);
const opened = await page.evaluate(() => window.__opened);
console.log('opened URL:', JSON.stringify(opened));
const toast = await page.evaluate(() => { const t = document.getElementById('as-toast'); return t ? { text: t.textContent, visible: getComputedStyle(t).opacity !== '0' } : null; });
console.log('toast:', JSON.stringify(toast));
const u = new URL(opened[0]);
console.log('host ok:', u.host === 'covers.musichoarders.xyz', '| artist:', u.searchParams.get('artist'), '| album:', u.searchParams.get('album'));
await ctx.close();
