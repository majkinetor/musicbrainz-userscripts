import { createRequire } from 'module';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = '51431e0c-fdae-41a9-b8ff-65364c600eb4';
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 900 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'domcontentloaded' });
const res = await page.evaluate(async (mbid) => {
  try {
    const j = await fetch(`https://coverartarchive.org/release/${mbid}`, { headers: { Accept: 'application/json' } }).then(r => r.json());
    const first = j.images[0];
    const r = await fetch(first.image);
    const b = await r.blob();
    return { ok: r.ok, type: b.type, size: b.size, status: r.status, imageUrl: first.image };
  } catch (e) { return { error: String(e) }; }
}, MBID);
console.log(JSON.stringify(res, null, 2));
await ctx.close();
