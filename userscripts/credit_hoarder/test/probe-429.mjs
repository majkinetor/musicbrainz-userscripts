// #429 — a consolidated row whose Discogs member key is the API form must expose the
// WEBSITE form everywhere user-facing (badge click, add-link seeding). Uses the issue's
// release (Juke Joint, sources: Discogs + Titles) via ⚛ Import all.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/credit_hoarder/dist/credit_hoarder.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1700, height: 1100 }, bypassCSP: true });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => {
  window.GM_getValue = (k, d) => d; window.GM_setValue = () => {};
  window.GM_info = { script: { name: 'CH', version: 't', homepageURL: 'x' } };
  window.unsafeWindow = window;
});
await page.goto('https://musicbrainz.org/release/a532957c-7a38-4e05-b995-8c7a6598dcad/edit-relationships', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.evaluate(async () => { const dbs = await indexedDB.databases(); for (const d of dbs) indexedDB.deleteDatabase(d.name); });
await page.waitForTimeout(3000);
await page.addScriptTag({ content: code });
await page.waitForSelector('.discogs-bar', { timeout: 30000 });
await page.waitForTimeout(1000);
// consolidated import (Discogs + Titles on this release)
await page.click('.discogs-src-all').catch(async () => { await page.click('.discogs-src-ico[data-src="Discogs"]'); });
await page.waitForFunction(() => /Preflight done/.test(document.body.innerText), null, { timeout: 120000 });
await page.waitForTimeout(3000);

const r = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find(x => x.textContent.includes('Boozoo Bajou'));
  const badgeTitles = tr ? [...tr.querySelectorAll('.discogs-src-badge')].map(b => b.title) : [];
  const bodyApi = /api\.discogs\.com/.test(tr ? tr.innerHTML : '');
  return { badgeTitles, bodyApi };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify(r, null, 1));
ck(r.badgeTitles.some(t => /www\.discogs\.com\/artist\/3749/.test(t)), 'Discogs badge carries the WEBSITE url');
ck(!r.badgeTitles.some(t => /api\.discogs\.com/.test(t)) && !r.bodyApi, 'no api.discogs.com anywhere in the row');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
