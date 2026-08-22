// #530 (majkinetor): "Cover art URLs not available randomly" — the Source popover
// said "No supported platforms linked on this release" while MusicBrainz's own
// cover-art tab offered "Import from Discogs" at the same moment.
//
// Cause: releaseUrls() cached [] whenever the WS2 request FAILED, and [] is
// truthy, so that verdict stuck for the whole page. MB 503s often enough that
// one unlucky request silently disabled sourcing — "switching back & forth
// usually fixes things but not always".
//
// This drives the real script against a stubbed WS2 endpoint so the failure is
// deterministic rather than waiting for MB to actually 503.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'art_station.user.js'), 'utf8');

const RELEASE = 'bafa58c1-e9b3-4ed3-b42d-70a387e411f4';
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));

// Count and control every url-rels request the script makes.
let urlRelHits = 0, mode = 'fail';
await page.route('**/ws/2/release/*inc=url-rels*', async route => {
    urlRelHits++;
    if (mode === 'fail') return route.fulfill({ status: 503, contentType: 'text/plain', body: 'busy' });
    return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ relations: [{ url: { resource: 'https://www.discogs.com/release/1234' } }] }),
    });
});

for (let a = 1; ; a++) {
    try { await page.goto(`https://musicbrainz.org/release/${RELEASE}/add-cover-art`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 3) throw e; console.log('goto retry ' + a); await page.waitForTimeout(4000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(400);
await page.addScriptTag({ content: code });
await page.waitForSelector('#as-root', { timeout: 15000 });
await page.waitForTimeout(600);

// ── the reported symptom: WS2 is failing ────────────────────────────────────
await page.click('.as-src');
await page.waitForSelector('.as-src-pop', { timeout: 5000 });
// wait for the box to SETTLE rather than guessing a duration — the retry
// backoff is ~3s and a fixed wait caught it mid-flight showing "Looking for…".
await page.waitForFunction(() => {
    const b = document.querySelector('.as-src-prov');
    return b && !/Looking for/.test(b.textContent);
}, null, { timeout: 30000 });
const failText = (await page.locator('.as-src-prov').textContent() || '').trim();
console.log('while failing: ' + JSON.stringify(failText) + '  (requests: ' + urlRelHits + ')');
ck(!/No supported platforms/.test(failText), 'a failed lookup does NOT claim the release has no platforms');
ck(/[Cc]ould not read/.test(failText), 'it says the links could not be read');
ck(await page.locator('.as-src-retry').count() === 1, 'and offers a retry');
ck(urlRelHits >= 2, 'transient failures were retried, not accepted first time (' + urlRelHits + ' requests)');

// ── the fix: retrying after MB recovers must find the link ──────────────────
mode = 'ok';
await page.click('.as-src-retry');
await page.waitForSelector('.as-src-pop', { timeout: 5000 });
await page.waitForFunction(() => {
    const b = document.querySelector('.as-src-prov');
    return b && !/Looking for/.test(b.textContent);
}, null, { timeout: 30000 });
const okText = (await page.locator('.as-src-prov').textContent() || '').trim();
console.log('after retry  : ' + JSON.stringify(okText));
ck(/Discogs/.test(okText), 'retrying once MusicBrainz answers finds the Discogs link');
ck(!/Could not read/.test(okText), 'and the failure message is gone');

// ── the original bug in one assertion: the empty verdict must not be sticky ──
const sticky = await page.evaluate(() => {
    // reopen a few times; a cached failure would keep showing the same thing
    const b = document.querySelector('.as-src');
    for (let i = 0; i < 3; i++) { document.querySelectorAll('.as-pop').forEach(p => p.remove()); b.click(); }
    return document.querySelector('.as-src-prov').textContent;
});
await page.waitForTimeout(800);
const after = (await page.locator('.as-src-prov').textContent() || '').trim();
ck(/Discogs/.test(after), 'reopening keeps showing the platform, not a stale empty result');

ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
