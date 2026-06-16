import { createRequire } from 'module';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = 'b792340e-2c77-4dd1-9de4-6dc174440a33';
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 900 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'domcontentloaded' });
const blocks = await page.evaluate(() => {
  return [...document.querySelectorAll('.artwork-cont')].map(b => {
    const id = (b.innerHTML.match(/edit-cover-art\/(\d+)/) || [])[1];
    const orig = [...b.querySelectorAll('a')].find(a => /original/i.test(a.textContent));
    const ps = [...b.querySelectorAll('p')].map(p => p.textContent.replace(/\s+/g,' ').trim());
    return { id, origHref: orig?.getAttribute('href'), ps, hasPDFword: /PDF/i.test(b.textContent) };
  });
});
console.log('PAGE BLOCKS:');
blocks.forEach(b => console.log(JSON.stringify(b)));
// CAA JSON
const caa = await page.evaluate(async (mbid) => {
  const j = await fetch(`https://coverartarchive.org/release/${mbid}`, { headers: { Accept: 'application/json' } }).then(r => r.json());
  return j.images.map(im => ({ id: im.id, image: im.image, types: im.types, thumb1200: im.thumbnails?.['1200'], thumbLarge: im.thumbnails?.large }));
}, MBID);
console.log('\nCAA IMAGES:');
caa.forEach(c => console.log(JSON.stringify(c)));
await ctx.close();
