import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = 'b792340e-2c77-4dd1-9de4-6dc174440a33';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 900 },
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3000);
await page.click('#as-root .as-card:not(.del) .as-thumb');     // open lightbox
await page.waitForTimeout(1200);
const scale = () => page.evaluate(() => { const t = document.querySelector('.as-lb-img')?.style.transform || ''; const m = t.match(/scale\(([^)]+)\)/); return m ? +m[1] : 1; });
const cap = () => page.evaluate(() => document.querySelector('.as-lb-cap')?.textContent);
const cap0 = await cap();
await page.keyboard.press('ArrowUp'); await page.waitForTimeout(80);
await page.keyboard.press('ArrowUp'); await page.waitForTimeout(80);
const up2 = await scale();
const capStill = await cap();
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(80);
const down1 = await scale();
console.log('scale after 2×Up:', up2.toFixed(3), '(want >1, ~1.44) | after 1×Down:', down1.toFixed(3), '(want ~1.2)');
console.log('Up/Down did NOT navigate (caption unchanged):', cap0 === capStill);
// Left/Right still navigate
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(80); // back to 1
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
const capRight = await cap();
console.log('ArrowRight navigated (caption changed):', capRight !== cap0, '|', JSON.stringify([cap0, capRight]));
await ctx.close();
