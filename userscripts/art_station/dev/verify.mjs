import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = '51431e0c-fdae-41a9-b8ff-65364c600eb4';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1,
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3500);

// 1) gallery below tabs: tabs/title should appear ABOVE #as-root in document order
const order = await page.evaluate(() => {
  const root = document.getElementById('as-root');
  const tabs = document.querySelector('div.tabs');
  const h1 = document.querySelector('#content h1');
  const pos = (a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING; // a before b
  return { rootAfterTabs: !!pos(tabs, root), rootAfterH1: !!pos(h1, root) };
});
console.log('[mount] root after tabs:', order.rootAfterTabs, '| root after h1:', order.rootAfterH1);

// 2) download: dlOne fetches a real blob (CORS) — invoke the fetch path it uses
const dl = await page.evaluate(async (mbid) => {
  const j = await fetch(`https://coverartarchive.org/release/${mbid}`, { headers: { Accept: 'application/json' } }).then(r => r.json());
  const url = j.images[0].image;
  const r = await fetch(url); const b = await r.blob();
  return { ok: r.ok, size: b.size, type: b.type };
}, MBID);
console.log('[download] blob fetch ok:', dl.ok, '| size:', dl.size, '| type:', dl.type);

// screenshot the top so we can see ordering
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
await page.screenshot({ path: 'userscripts/art_station/poc-pos.png', fullPage: true });
await ctx.close();
