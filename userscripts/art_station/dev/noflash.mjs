import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = '51431e0c-fdae-41a9-b8ff-65364c600eb4';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 900 },
});
// addInitScript => runs at document-start in every navigation, like a userscript
await ctx.addInitScript({ content: script });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE.ERR:', m.text()); });

// sample native artwork visibility very early (right at DOMContentLoaded)
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'domcontentloaded' });
const early = await page.evaluate(() => {
  const a = document.querySelector('.artwork-cont');
  return { artworkExists: !!a, artworkVisible: a ? getComputedStyle(a).display !== 'none' : null, earlyStyle: !!document.querySelector('style') };
});
console.log('[at DOMContentLoaded] native artwork visible:', early.artworkVisible);

await page.waitForTimeout(3500);
const after = await page.evaluate(() => ({
  root: !!document.getElementById('as-root'),
  cards: document.querySelectorAll('.as-card').length,
  anyArtworkVisible: [...document.querySelectorAll('.artwork-cont')].some(a => getComputedStyle(a).display !== 'none'),
  hasEarlyHide: [...document.querySelectorAll('style')].some(s => s.textContent.includes('.artwork-cont')),
  styleCount: document.querySelectorAll('style').length,
}));
console.log('[after mount] gallery root:', after.root, '| cards:', after.cards, '| any native artwork visible:', after.anyArtworkVisible);
console.log('  early-hide style present:', after.hasEarlyHide, '| total <style>:', after.styleCount);
await ctx.close();
