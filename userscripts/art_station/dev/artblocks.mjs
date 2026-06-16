import { createRequire } from 'module';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = process.argv[2] || '51431e0c-fdae-41a9-b8ff-65364c600eb4';
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 900 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'domcontentloaded' });
const blocks = await page.evaluate(() => {
  return [...document.querySelectorAll('.artwork-cont')].slice(0, 3).map(b => ({
    html: b.outerHTML.replace(/\s+/g, ' ').slice(0, 700),
    links: [...b.querySelectorAll('a')].map(a => ({ text: a.textContent.trim(), href: a.getAttribute('href') })),
    text: b.textContent.replace(/\s+/g, ' ').trim().slice(0, 200),
  }));
});
console.log('artwork-cont count:', await page.$$eval('.artwork-cont', e => e.length));
blocks.forEach((b, i) => {
  console.log(`\n--- block ${i} ---`);
  console.log('text:', b.text);
  console.log('links:', JSON.stringify(b.links, null, 0));
});
await ctx.close();
