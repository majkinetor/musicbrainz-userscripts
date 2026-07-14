// #393 follow-up — Discogs company names keep their " (N)" disambiguation number
// ("Audiolab (3)" searched and displayed verbatim). Loads majkinetor's failing release
// (Before the Rain, Discogs 5530981), runs a real import and asserts the company search
// query and the review table both use the stripped name.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/credit_hoarder/dist/credit_hoarder.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1700, height: 1000 }, bypassCSP: true });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const queries = [];
page.on('request', r => { const u = r.url(); if (/musicbrainz\.org\/ws\/2\/(label|place)\?query=/.test(u)) queries.push(decodeURIComponent(u)); });
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'CH', version: 't', homepageURL: 'x' } }; window.unsafeWindow = window; });
await page.goto('https://musicbrainz.org/release/bef9194e-13a5-4d3d-b937-6ac6d6e8f696/edit-relationships', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
// clean preflight cache so the company search actually fires
await page.evaluate(async () => { const dbs = await indexedDB.databases(); for (const d of dbs) indexedDB.deleteDatabase(d.name); });
await page.waitForTimeout(3000);
await page.addScriptTag({ content: code });
await page.waitForSelector('.discogs-bar', { timeout: 30000 });
await page.waitForTimeout(1000);
// kick off the Discogs import from the source icon
await page.click('.discogs-src-ico[data-src="Discogs"]').catch(async () => { await page.click('.discogs-src-ico'); });
// wait for the review table (preflight done) — generous, MB throttles hard
await page.waitForSelector('.discogs-review-table, .discogs-review, [class*="review"]', { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(2000);
const table = await page.evaluate(() => document.body.innerText);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const audiolabQ = queries.filter(q => /audiolab/i.test(q));
console.log('company/place queries:', JSON.stringify(queries, null, 1));
ck(audiolabQ.length > 0, 'a search for Audiolab fired');
ck(audiolabQ.every(q => !/\(\s*3\s*\)/.test(q)), 'no "(3)" in any Audiolab query');
ck(!/Audiolab \(3\)/.test(table), 'page shows no "Audiolab (3)"');
ck(/Audiolab/.test(table), 'page shows "Audiolab"');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
