// #498 (chaban-mb via majkinetor) — after a release is added to MB FROM
// Harmony, Harmony's own actions page carries that release's mbid in its own
// query string (`?...&release_mbid=<mbid>`). "Send to Falcon" should open
// Falcon's panel on THAT release's relationship editor instead of MB's bare
// homepage, so credits import (only possible after creation, not during it)
// is one less manual navigation away.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

const RELEASE_MBID = '459eb9bd-f894-4e5a-b151-4cb8cfacca12';   // from majkinetor's own example

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// 1. Harmony URL carrying a real release_mbid — the button must open the
//    panel on that release's edit-relationships page, not the bare homepage.
{
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(`https://harmony.pulsewidth.org.uk/release/actions?deezer=873204812&spotify=1SzNfUgYfuebR9knynZSqz&qobuz=g1zmwqqsmmbeq&gtin=199945053117&itunes=&tidal=&region=GB&release_mbid=${RELEASE_MBID}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.waitForTimeout(1000);
  const clicked = await page.evaluate(() => new Promise(resolveClick => {
    const origOpen = window.open;
    window.open = url => { window.open = origOpen; resolveClick(url); return { closed: false }; };
    document.getElementById('falcon-harmony-btn').click();
  }));
  console.log('captured window.open target:', clicked);
  ck(clicked.startsWith(`https://musicbrainz.org/release/${RELEASE_MBID}/edit-relationships?falcon=`), `opens the release's own edit-relationships page with the token still attached (got "${clicked}")`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

// 2. No release_mbid on the page (a plain lookup/actions page without one) ->
//    falls back to the original bare-homepage target, unchanged behavior.
{
  const page = await ctx.newPage();
  await page.goto('https://harmony.pulsewidth.org.uk/release/actions?release_mbid=https%3A%2F%2Fmusicbrainz.org%2Frelease%2F20b03c7d-9e8a-42b9-8a96-bcc9564de034', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.waitForTimeout(1000);
  const clicked = await page.evaluate(() => new Promise(resolveClick => {
    const origOpen = window.open;
    window.open = url => { window.open = origOpen; resolveClick(url); return { closed: false }; };
    document.getElementById('falcon-harmony-btn').click();
  }));
  console.log('captured window.open target (non-mbid release_mbid value):', clicked);
  ck(clicked === 'https://musicbrainz.org/?falcon=' + new URL(clicked).searchParams.get('falcon'), `a release_mbid value that isn't actually a bare mbid (a full URL, seen on some real Harmony pages) falls back to the homepage target unchanged (got "${clicked}")`);
  await page.close();
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
