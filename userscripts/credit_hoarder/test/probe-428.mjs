// #428 — special-purpose artists get NO link UI in the review table. Uses Before the
// Rain (#393 fixture release): "Trad." resolves via url to [traditional]
// (9be7f096…, special-purpose) — its row must carry no 🔗/✓/⚠ link chip, while a
// normal resolved row still does. (The synthetic-URL half of #428 shares the same
// renderActions gate and is unit-covered in consolidate.mjs + registry checks.)
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
await page.evaluate(async () => { const dbs = await indexedDB.databases(); for (const d of dbs) indexedDB.deleteDatabase(d.name); });
await page.waitForTimeout(3000);
await page.addScriptTag({ content: code });
await page.waitForSelector('.discogs-bar', { timeout: 30000 });
await page.waitForTimeout(1000);
await page.click('.discogs-src-ico[data-src="Discogs"]').catch(async () => { await page.click('.discogs-src-ico'); });
await page.waitForFunction(() => /Preflight done/.test(document.body.innerText), null, { timeout: 180000 });
await page.waitForTimeout(4000);   // let the queued per-row URL checks paint the chips

const r = await page.evaluate(() => {
  const rowOf = txt => [...document.querySelectorAll('tr')].find(tr => tr.textContent.includes(txt));
  const linkUi = tr => {
    if (!tr) return null;
    const chips = [...tr.querySelectorAll('button, span')].map(el => el.textContent.trim());
    return { hasLinkChip: chips.some(t => /^🔗/.test(t)), hasCheck: chips.some(t => t === '✓' || t === '⚠️' || t === '…'), text: tr.textContent.replace(/\s+/g, ' ').slice(0, 160) };
  };
  return { trad: linkUi(rowOf('[traditional]')), normal: linkUi(rowOf('Didier Marc')) };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify(r, null, 1));
ck(r.trad && !r.trad.hasLinkChip && !r.trad.hasCheck, '[traditional] row has NO link chip / link state at all');
ck(r.normal && (r.normal.hasLinkChip || r.normal.hasCheck), 'a normal resolved row still shows link UI');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
