// #430 — review-table roles use the shortened notation: one chip per role, track
// positions grouped with consecutive runs compressed. Uses Before the Rain (#393
// release): Anastasia is arranger/composer/performer/producer on tracks 1-11 via a
// Discogs "1 to 8, 10, 11" + "9" spread → one chip "[1-11]"; Dragan Dautovski's
// kaval on tracks 1 and 9 stays "[1,9]" (no bogus range).
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
await page.goto('https://musicbrainz.org/release/bef9194e-13a5-4d3d-b937-6ac6d6e8f696/edit-relationships', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(3000);
await page.addScriptTag({ content: code });
await page.waitForSelector('.discogs-bar', { timeout: 30000 });
await page.waitForTimeout(1000);
await page.click('.discogs-src-ico[data-src="Discogs"]').catch(async () => { await page.click('.discogs-src-ico'); });
await page.waitForFunction(() => /Preflight done/.test(document.body.innerText), null, { timeout: 120000 });
await page.waitForTimeout(2000);

const r = await page.evaluate(() => {
  const chipsOf = name => {
    const tr = [...document.querySelectorAll('tr')].find(x => x.textContent.includes(name));
    return tr ? [...tr.querySelectorAll('.discogs-role-chip')].map(c => ({ text: c.textContent, key: c.dataset.roleKey })) : null;
  };
  return { anastasia: chipsOf('Анастасија') || chipsOf('Anastasia'), dragan: chipsOf('Dragan Dautovski') };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify(r, null, 1));
const arr = r.anastasia && r.anastasia.filter(c => /^arranger/.test(c.text));
ck(arr && arr.length === 1, 'ONE arranger chip for Anastasia (was one per track)');
ck(arr && arr[0].text === 'arranger [1-11]', `range-compressed to "arranger [1-11]" (got "${arr && arr[0].text}")`);
ck(arr && arr[0].key === 'arranger', 'hover-highlight role key intact');
const kaval = r.dragan && r.dragan.find(c => /^kaval/.test(c.text));
ck(!!kaval && kaval.text === 'kaval [1,9]', `non-consecutive stays a comma list ("${kaval && kaval.text}")`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
