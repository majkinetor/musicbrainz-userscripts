// #427 — "Mezzo-soprano Vocals" (Marina Prudenskaja on Romances) was an unmapped role,
// so the whole credit vanished before preflight. With the voice-type vocal mappings she
// must appear in the review table with the mezzo-soprano role.
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
await page.goto('https://musicbrainz.org/release/1bbbe273-7dd9-44e8-940f-75a92aa3a2b0/edit-relationships', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.evaluate(async () => { const dbs = await indexedDB.databases(); for (const d of dbs) indexedDB.deleteDatabase(d.name); });
await page.waitForTimeout(3000);
await page.addScriptTag({ content: code });
await page.waitForSelector('.discogs-bar', { timeout: 30000 });
await page.waitForTimeout(1000);
await page.click('.discogs-src-ico[data-src="Discogs"]').catch(async () => { await page.click('.discogs-src-ico'); });
// preflight on this release takes ~12s
await page.waitForFunction(() => /Preflight done/.test(document.body.innerText), null, { timeout: 120000 });
await page.waitForTimeout(2000);
const r = await page.evaluate(() => {
  const text = document.body.innerText;
  const row = [...document.querySelectorAll('tr')].find(tr => /Marina Prudenskaja/.test(tr.textContent));
  return {
    marinaRow: !!row,
    rowText: row ? row.textContent.replace(/\s+/g, ' ').slice(0, 260) : '',
    mezzoShown: /mezzo-soprano/i.test(row ? row.textContent : ''),
    artistCount: (text.match(/Starting preflight: (\d+) artist/) || [])[1],
  };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify(r, null, 1));
ck(r.marinaRow, 'Marina Prudenskaja appears in the review table');
ck(r.mezzoShown, 'her row shows the mezzo-soprano vocal role');
ck(r.artistCount === '10', `preflight counts 10 artists, was 9 (got ${r.artistCount})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
