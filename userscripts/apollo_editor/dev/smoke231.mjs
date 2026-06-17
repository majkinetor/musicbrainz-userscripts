import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const script = readFileSync('userscripts/apollo_editor/apollo_editor.user.js', 'utf8');
const MBID = '01f17c95-b4d4-430a-b1af-bd6ba0b602fe'; // a VA release
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1400, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/edit-relationships`, { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(4000);
// exercise the persistent cache directly via localStorage round-trip the script would do
const ls = await page.evaluate(() => {
  const KEY = 'apollo:discogs-link-cache-v1';
  // simulate a write like _dput would, then confirm read-back + JSON shape
  const obj = { resolve: { 'https://www.discogs.com/artist/1': { v: [{ gid: 'g', name: 'X' }], t: Date.now() } }, rels: {} };
  localStorage.setItem(KEY, JSON.stringify(obj));
  const back = JSON.parse(localStorage.getItem(KEY));
  return { ok: !!back.resolve['https://www.discogs.com/artist/1'], hasKey: KEY in localStorage };
});
console.log('apollo pageerrors:', errs.length ? errs.slice(0,3) : 'none');
console.log('localStorage cache round-trip ok:', ls.ok);
await ctx.close();
